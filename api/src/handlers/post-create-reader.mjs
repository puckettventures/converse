import aws from 'aws-sdk';
import OpenAI from "openai";
import crypto from 'crypto';
import messages from './resources/reader-config.json' assert { type: "json" };

// Create an S3 client
const s3 = new aws.S3();

const secretManagerClient = new aws.SecretsManager();

const openai = new OpenAI();

/**
 * Handler function to create a reader session.
 * This function identifies speakers in the provided text using OpenAI, 
 * splits the text by speakers, and generates MP3 files using OpenAI's TTS.
 */
export const createReader = async (event) => {
    
    if (event.httpMethod !== 'POST') {
        throw new Error(`createReader only accepts POST method, you tried: ${event.httpMethod}`);
    }
   // console.info('Received event:', event);

    // Parse the request body
    const body = JSON.parse(event.body);
    const { text, sessionName } = body;

    try {

        // Get secret
        const result = await secretManagerClient.getSecretValue({
            SecretId: 'dev/converse/OpenAI'
        }).promise()

        const openAISecret = JSON.parse(result.SecretString);
        console.log(openAISecret);
        openai.apiKey = openAISecret.apiKey;
        openai.project = openAISecret.project;
        openai.organization = openAISecret.organization;
        
        // Step 1: Identify speakers using OpenAI
        const speakers = await identifySpeakers(text);

        // Step 2: Generate MP3 files for each speaker using OpenAI TTS
        const audioFiles = await generateAudioFiles(speakers);

        // Return a success response
        const response = {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Reader session created successfully',
                sessionName: sessionName,
                audioFiles: audioFiles
            })
        };

        console.info(`Response from: ${event.path} statusCode: ${response.statusCode} body: ${response.body}`);
        return response;

    } catch (err) {
        console.error('Error creating reader session:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
}

// Helper function to identify speakers using OpenAI
async function identifySpeakers(text) {
    try {
        const updatedMessages = [...messages, { role: "user", content: text }];
        const completion = await openai.chat.completions.create({
            messages: updatedMessages,
            model: "gpt-4o-mini",
          });
        
        console.log(completion.choices[0].message);

        // Parse the structured JSON response from OpenAI
        const speakers = JSON.parse(completion.choices[0].message.content);
        return speakers.conversation;

    } catch (err) {
        console.error("Error identifying speakers:", err);
        throw new Error('Failed to identify speakers');
    }
}

// Helper function to generate MP3 files using OpenAI TTS
async function generateAudioFiles(speakers) {
    const audioFiles = [];
    const timestamp = new Date().getTime();
    for (const [index, speaker] of speakers.entries()) {
        try {
            const ttsText =  speaker.text;
            // Generate a random string using crypto
            const randomString = crypto.randomBytes(6).toString('hex');
            const fileName = `${index} - ${speaker.speaker}-${randomString}.mp3`;
            const mp3 = await openai.audio.speech.create({
                model: "tts-1-hd",
                voice: speaker.voice,
                input: ttsText,
              });

            const buffer = Buffer.from(await mp3.arrayBuffer());
            //await fs.promises.writeFile(audioFilePath, buffer);
            
            const s3Params = {
                Bucket: 'converse-bucket', // Replace with your bucket name
                Key: `audio/${timestamp}/${fileName}`, // S3 path for the file
                Body: buffer,
                ContentType: 'audio/mpeg'
            };
            const uploadResult = await s3.upload(s3Params).promise();
            console.log(`File uploaded successfully to S3: ${uploadResult.Location}`);

            // Push the S3 file path to the audioFiles array
            audioFiles.push(uploadResult.Location);

        } catch (err) {
            console.error(`Error generating audio for speaker ${speaker.speaker}:`, err);
            throw new Error('Failed to generate audio files');
        }
    }

    return audioFiles;
}
