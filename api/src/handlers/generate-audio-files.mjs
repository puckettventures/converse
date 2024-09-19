import aws from 'aws-sdk';
import OpenAI from "openai";
import exponentialBackoff from './utils/backoff.mjs';

const s3 = new aws.S3();
const dynamoDb = new aws.DynamoDB.DocumentClient();
const secretManagerClient = new aws.SecretsManager();
const openai = new OpenAI();

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
                    voice: voice,
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
                UpdateExpression: "SET #status = :status, pending_audio_files = pending_audio_files - :decrement, audio_files = list_append(if_not_exists(audio_files, :empty_list), :new_file)",
                ExpressionAttributeNames: {
                    "#status": "status"
                },
                ExpressionAttributeValues: {
                    ":status": "In Progress",
                    ":decrement": 1,
                    ":new_file": [uploadResult.Location],
                    ":empty_list": []
                }
            }).promise();

            // Check if all files have been processed
            const result = await dynamoDb.get({
                TableName: process.env.DYNAMODB_TABLE,
                Key: { session_name }
            }).promise();

            if (result.Item.pending_audio_files === 0) {
                await dynamoDb.update({
                    TableName: process.env.DYNAMODB_TABLE,
                    Key: { session_name },
                    UpdateExpression: "SET #status = :complete",
                    ExpressionAttributeNames: {
                        "#status": "status"
                    },
                    ExpressionAttributeValues: {
                        ":complete": "completed"
                    }
                }).promise();
            }

            console.log(`Audio for ${speaker} uploaded to: ${uploadResult.Location}`);

        } catch (error) {
            console.error(`Error generating audio for speaker ${speaker}:`, error);
        }
    }
};
