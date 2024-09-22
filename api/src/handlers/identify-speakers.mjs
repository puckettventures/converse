"use strict"

import aws from 'aws-sdk';
import OpenAI from "openai";
import natural from 'natural';
import exponentialBackoff from './utils/backoff.mjs';
import contextMessages from './resources/reader-config.json' assert { type: "json" };

const sqs = new aws.SQS();
const dynamoDb = new aws.DynamoDB.DocumentClient();
const secretManagerClient = new aws.SecretsManager();
const openai = new OpenAI();
const tokenizer = new natural.SentenceTokenizer();

// Read surrounding paragraph config from environment
const paragraphsBefore = parseInt(process.env.PARAGRAPHS_BEFORE || '10', 10);
const paragraphsAfter = parseInt(process.env.PARAGRAPHS_AFTER || '10', 10);

export const identifySpeakers = async (event, context) => {
    let sessionName = '';
    try {
        const result = await secretManagerClient.getSecretValue({ SecretId: 'dev/converse/OpenAI' }).promise();
        const openAISecret = JSON.parse(result.SecretString);
        openai.apiKey = openAISecret.apiKey;

        for (const record of event.Records) {
            const { session_name, paragraph, index, speakers } = JSON.parse(record.body);
            console.log(`ID: ${context.awsRequestId} record: `, record);
            console.log(`processing ${index} for ${session_name} ID: ${context.awsRequestId}`);
            sessionName = session_name;
            // Combine the current paragraph with surrounding context
            const contextText = await getSurroundingParagraphs(session_name, index, paragraphsBefore, paragraphsAfter);

            let content = {context: contextText, text: paragraph, speakers};
            const messages = [...contextMessages, { role: "user", content: JSON.stringify(content) }];
            console.log(`processing ${index}  ${session_name} ID: ${context.awsRequestId} messages:`,messages);
            // Step 1: Identify speakers for the entire paragraph with context
            const completion = await exponentialBackoff(async () => {
                return await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages
                });
            }, ` session_name: ${session_name}, attempted identification for index:${index}`);
            console.log(`processing ${index} ${session_name} ID: ${context.awsRequestId} completion:`,completion.choices[0].message, completion.choices[0].message.content);
            const {conversation} = JSON.parse(completion.choices[0].message.content);
            const uniqueSpeakers = new Set(conversation.map(s => s.speaker));

            if (uniqueSpeakers.size === 1) {
                const speakerIterator = uniqueSpeakers.values();
                const firstSpeaker = speakerIterator.next().value;
                // Whole paragraph, one speaker: Increment the pending_audio_files by 1
                await dynamoDb.update({
                    TableName: process.env.DYNAMODB_TABLE,
                    Key: { session_name },
                    UpdateExpression: "SET pending_audio_files = if_not_exists(pending_audio_files, :zero) + :increment",
                    ExpressionAttributeValues: {
                        ":zero": 0,
                        ":increment": 1
                    }
                }).promise();

                // Queue for audio generation
                const params = {
                    QueueUrl: process.env.SQS_QUEUE_URL,
                    MessageBody: JSON.stringify({
                        session_name,
                        speaker: firstSpeaker,
                        voice: conversation[0].voice,
                        text: paragraph,
                        index
                    })
                };
                await sqs.sendMessage(params).promise();
            } else if(uniqueSpeakers.size > 1) {
                // Split by sentences: Increment the pending_audio_files by the number of sentences
                const sentences = tokenizer.tokenize(paragraph);

                await dynamoDb.update({
                    TableName: process.env.DYNAMODB_TABLE,
                    Key: { session_name },
                    UpdateExpression: "SET pending_audio_files = if_not_exists(pending_audio_files, :zero) + :increment",
                    ExpressionAttributeValues: {
                        ":zero": 0,
                        ":increment": sentences.length
                    }
                }).promise();

                for (const [i, sentence] of sentences.entries()) {
                    content = {contextText, text: sentence, speakers};
                    const messages2 = [...contextMessages, { role: "user", content: JSON.stringify(content) }];
                    const sentenceCompletion = await exponentialBackoff(async () => {
                        return await openai.chat.completions.create({
                            model: "gpt-4o-mini",
                            messages: messages2
                        });
                    }, ` session_name: ${session_name}, attempted identification for index:${index}-${i}`);
                    console.log(`processing ${index} ${session_name} ID: ${context.awsRequestId} sentenceCompletion:`,sentenceCompletion.choices[0].message, sentenceCompletion.choices[0].message.content);
                    
                    const { conversation } = JSON.parse(sentenceCompletion.choices[0].message.content);
                    
                    const params = {
                        QueueUrl: process.env.SQS_QUEUE_URL,
                        MessageBody: JSON.stringify({
                            session_name,
                            speaker: conversation[0].speaker,
                            voice: conversation[0].voice,
                            text: sentence,
                            index: `${index}-${i}`
                        })
                    };
                    await sqs.sendMessage(params).promise();
                }
            } else {
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
                        ":new_file": `${index} skipped`,
                        ":empty_list": []
                    }
                }).promise();
                console.log(`processing ${index} ${session_name} conversation empty for paragraph ${index} ID: ${context.awsRequestId}`);
            }
        }
    } catch (error) {
        console.error(`processing ${index} ${sessionName} Error identifying speakers. ID: ${context.awsRequestId} `, error);
    }
};

// Helper function to get surrounding paragraphs for context
const getSurroundingParagraphs = async (session_name, index, paragraphsBefore, paragraphsAfter) => {
    const result = await dynamoDb.get({
        TableName: process.env.DYNAMODB_TABLE,
        Key: { session_name }
    }).promise();

    const allParagraphs = result.Item.paragraphs || [];
    
    // Define the context window based on config
    const start = Math.max(0, index - paragraphsBefore);
    const end = Math.min(allParagraphs.length, index + paragraphsAfter + 1);

    // Return full context (including the current paragraph)
    return allParagraphs.slice(start, end).join('\n');
};
