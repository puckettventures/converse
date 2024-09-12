import aws from 'aws-sdk';
import OpenAI from "openai";

const s3 = new aws.S3();
const dynamoDb = new aws.DynamoDB.DocumentClient();
const secretManagerClient = new aws.SecretsManager();
const openai = new OpenAI();

const MAX_RETRIES = 10;        // Number of retries for API calls
const BASE_DELAY = 1000;       // Base delay for exponential backoff (1 second)
const MAX_DELAY_CAP = 60000;   // Configurable cap for backoff delay (60 seconds)
const JITTER_FACTOR = 0.2;     // Jitter factor to add random delay (e.g., 20% of retry-after)

// Function for exponential backoff with jitter and retry-after handling
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const exponentialBackoff = async (fn, maxRetries = MAX_RETRIES, delayCap = MAX_DELAY_CAP) => {
    console.log('Attempting function call with failsafe for 429 errors');
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            console.log(`Attempt ${attempt + 1}`);
            return await fn();
        } catch (error) {
            const statusCode = error.status || error.statusCode;
            console.error('Caught error on attempt', error);
            if (statusCode === 429) {
                attempt++;
                let delay;

                // Check if 'retry-after' is provided
                const retryAfter = error.headers?.['retry-after'] || error.headers?.['retry-after-ms'];
                if (retryAfter) {
                    // If 'retry-after' header exists, use it as the base delay and add jitter
                    delay = parseInt(retryAfter) * (retryAfter.endsWith('ms') ? 1 : 1000);
                    const jitter = Math.random() * JITTER_FACTOR * delay;  // Adding jitter up to 20% of the retry-after value
                    delay += jitter;
                    console.warn(`Rate limit hit, retrying after ${delay.toFixed(0)} ms (Retry-After + jitter)`);
                } else {
                    // Otherwise, use exponential backoff with jitter
                    delay = Math.min(BASE_DELAY * (2 ** attempt), delayCap) + Math.random() * 1000;
                    console.warn(`Rate limit hit, retrying in ${delay.toFixed(0)} ms (attempt ${attempt} of ${maxRetries})`);
                }
                
                await sleep(delay);
            } else {
                throw error;
            }
        }
    }
    throw new Error('Max retries reached for OpenAI request');
};

export const generateAudioFiles = async (event) => {
    let last_session_name = '';
    try {
        const result = await secretManagerClient.getSecretValue({ SecretId: 'dev/converse/OpenAI' }).promise();
        const openAISecret = JSON.parse(result.SecretString);
        openai.apiKey = openAISecret.apiKey;
    }
    catch (error) {
        console.error(`Error retrieving OpenAI key`, error);
        return; // Exit early if the API key cannot be retrieved
    }

    for (const record of event.Records) {
        console.log('received record', record);
        const { index, speaker, voice, text, session_name } = JSON.parse(record.body);
        last_session_name = session_name;
        try {
            // Step 1: Generate MP3 file using OpenAI TTS with exponential backoff
            const fileName = `${index}-${speaker}.mp3`;

            const mp3 = await exponentialBackoff(async () => {
                return await openai.audio.speech.create({
                    model: "tts-1-hd",
                    voice: voice, // Assume speaker name corresponds to a voice, adjust as needed
                    input: text,
                });
            });

            const buffer = Buffer.from(await mp3.arrayBuffer());

            // Step 2: Upload MP3 to S3
            const s3Params = {
                Bucket: process.env.S3_BUCKET,
                Key: `audio/${session_name}/${fileName}`,
                Body: buffer,
                ContentType: 'audio/mpeg'
            };

            const uploadResult = await s3.upload(s3Params).promise();

            // Step 3: Update the session status in DynamoDB
            await dynamoDb.update({
                TableName: process.env.DYNAMODB_TABLE,
                Key: { session_name: session_name },
                UpdateExpression: "SET #status = :status, audio_files = list_append(if_not_exists(audio_files, :empty_list), :new_file)",
                ExpressionAttributeNames: {
                    "#status": "status"
                },
                ExpressionAttributeValues: {
                    ":status": "in progress",
                    ":new_file": [uploadResult.Location],
                    ":empty_list": []
                }
            }).promise();

            console.log(`Audio for ${speaker} uploaded to: ${uploadResult.Location}`);

        } catch (error) {
            console.error(`Error generating audio for speaker ${speaker}:`, error);
        }
    }

    // Final step: Mark session as completed once all files are processed
    await dynamoDb.update({
        TableName: process.env.DYNAMODB_TABLE,
        Key: { session_name: last_session_name },
        UpdateExpression: "SET #status = :status",
        ExpressionAttributeNames: {
            "#status": "status"
        },
        ExpressionAttributeValues: {
            ":status": "completed"
        }
    }).promise();
};
