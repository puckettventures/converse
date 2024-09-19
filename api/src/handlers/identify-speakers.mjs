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

export const identifySpeakers = async (event) => {
    try {
        const result = await secretManagerClient.getSecretValue({ SecretId: 'dev/converse/OpenAI' }).promise();
        const openAISecret = JSON.parse(result.SecretString);
        openai.apiKey = openAISecret.apiKey;

        for (const record of event.Records) {
            const { session_name, paragraph, index } = JSON.parse(record.body);

            // Fetch paragraphs before and after as context (moving window)
            const surroundingParagraphs = await getSurroundingParagraphs(session_name, index);

            // Combine the current paragraph with surrounding context
            const contextParagraphs = surroundingParagraphs.join('\n');
            const context = `${contextParagraphs}\n${paragraph}\n${contextParagraphs}`;

            let content = {context, text: paragraph};
            const messages = [...contextMessages, { role: "user", content: JSON.stringify(content) }];
            console.log('messages:',messages);
            // Step 1: Identify speakers for the entire paragraph with context
            const completion = await exponentialBackoff(async () => {
                return await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages
                });
            });
            console.log('completion:',completion.choices[0].message, completion.choices[0].message.content);
            const {conversation} = JSON.parse(completion.choices[0].message.content);
            const uniqueSpeakers = new Set(conversation.map(s => s.speaker));

            if (uniqueSpeakers.size === 1) {
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
                        speaker: uniqueSpeakers[0],
                        voice: conversation[0].voice,
                        text: paragraph,
                        index
                    })
                };
                await sqs.sendMessage(params).promise();
            } else {
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
                    content = {context, text: sentence};
                    const messages2 = [...contextMessages, { role: "user", content: JSON.stringify(content) }];
                    const sentenceCompletion = await exponentialBackoff(async () => {
                        return await openai.chat.completions.create({
                            model: "gpt-4o-mini",
                            messages
                        });
                    });

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
            }
        }
    } catch (error) {
        console.error('Error identifying speakers:', error);
    }
};

// Helper function to get surrounding paragraphs for context
const getSurroundingParagraphs = async (session_name, index) => {
    const result = await dynamoDb.get({
        TableName: process.env.DYNAMODB_TABLE,
        Key: { session_name }
    }).promise();

    const allParagraphs = result.Item.paragraphs || [];
    
    // Define the context window (e.g., 1 paragraph before and 1 after)
    const start = Math.max(0, index - 1);
    const end = Math.min(allParagraphs.length, index + 2);

    return allParagraphs.slice(start, end);
};
