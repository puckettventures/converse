"use strict"

import aws from 'aws-sdk';
import crypto from 'crypto';
import OpenAI from "openai";
import exponentialBackoff from './utils/backoff.mjs';
import contextMessages from './resources/speaker-config.json' assert { type: "json" };

const sqs = new aws.SQS();
const dynamoDb = new aws.DynamoDB.DocumentClient();
const secretManagerClient = new aws.SecretsManager();
const openai = new OpenAI();


export const narrateConversation = async (event) => {
    if (event.httpMethod !== 'POST') {
        throw new Error(`narrateConversation only accepts POST method, you tried: ${event.httpMethod}`);
    }

    const body = JSON.parse(event.body);
    const { text } = body;
    const session_name = crypto.randomBytes(16).toString('hex');

    try {
        const result = await secretManagerClient.getSecretValue({ SecretId: 'dev/converse/OpenAI' }).promise();
        const openAISecret = JSON.parse(result.SecretString);
        openai.apiKey = openAISecret.apiKey;

        // Split text into paragraphs
        const paragraphs = text.split(/\n\s*\n/);
        const content = {text};
        //identify all speakers in text
        const messages = [...contextMessages, { role: "user", content: JSON.stringify(content) }];
        console.log(`${session_name} messages:`,messages);
        // Step 1: Identify speakers for the entire paragraph with context
        const completion = await exponentialBackoff(async () => {
            return await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages
            });
        }, ` session_name: ${session_name}, attempted speaker list for text`);
        
        console.log(`completion:`,completion.choices[0].message, completion.choices[0].message.content);

        const {speakers} = JSON.parse(completion.choices[0].message.content);
        // Initialize the session status in DynamoDB
        // Store the entire conversation as paragraphs
        await dynamoDb.put({
            TableName: process.env.DYNAMODB_TABLE,
            Item: {
                session_name,
                status: 'in progress',
                created_at: new Date().toISOString(),
                text,
                speakers,
                paragraphs,  // Store the paragraphs so identify-speakers can use them for context
                pending_audio_files: 0  // Initialize pending audio files to 0
            }
        }).promise();

        // Queue each paragraph for speaker identification
        for (const [index, paragraph] of paragraphs.entries()) {
            const params = {
                QueueUrl: process.env.IDENTIFY_SPEAKERS_QUEUE_URL,
                MessageBody: JSON.stringify({
                    session_name,
                    speakers,
                    paragraph,
                    index
                })
            };
            await sqs.sendMessage(params).promise();
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Paragraphs queued for speaker identification.', session_name })
        };

    } catch (error) {
        console.error(`Error narrating conversation in session ${session_name}:`, error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
