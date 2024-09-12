import aws from 'aws-sdk';
import OpenAI from "openai";

const sqs = new aws.SQS();
const dynamoDb = new aws.DynamoDB.DocumentClient();
const secretManagerClient = new aws.SecretsManager();
const openai = new OpenAI();
import updatedMessages from './resources/reader-config.json' assert { type: "json" };
import crypto from 'crypto';


export const narrateConversation = async (event) => {
    if (event.httpMethod !== 'POST') {
        throw new Error(`narrateConversation only accepts POST method, you tried: ${event.httpMethod}`);
    }

    const body = JSON.parse(event.body);
    console.log(process.env);
    const { text } = body;
    const session_name = crypto.randomBytes(6).toString('hex');
    try {
        // Initialize the session status in DynamoDB
        await dynamoDb.put({
            TableName: process.env.DYNAMODB_TABLE,
            Item: {
                session_name,
                status: 'in progress',
                created_at: new Date().toISOString()
            }
        }).promise();

        // Get OpenAI secret
        const result = await secretManagerClient.getSecretValue({ SecretId: 'dev/converse/OpenAI' }).promise();
        const openAISecret = JSON.parse(result.SecretString);
        openai.apiKey = openAISecret.apiKey;

        // Step 1: Identify speakers using OpenAI
        const messages = [...updatedMessages, { role: "user", content: text }];
        const completion = await openai.chat.completions.create({
            messages,
            model: "gpt-4o-mini"
        });


        const speakers = JSON.parse(completion.choices[0].message.content);
        console.log(speakers);

        // Step 2: Queue up each speaker's text for audio generation
        for (const [index, speaker] of speakers.conversation.entries()) {
            const params = {
                QueueUrl: process.env.SQS_QUEUE_URL,
                MessageBody: JSON.stringify({
                    index,
                    speaker: speaker.speaker,
                    voice: speaker.voice,
                    text: speaker.text,
                    session_name
                })
            };
            await sqs.sendMessage(params).promise();
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Speakers identified and audio generation queued.', session_name })
        };

    } catch (error) {
        console.error('Error narrating conversation:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
