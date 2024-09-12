import aws from 'aws-sdk';

const dynamoDb = new aws.DynamoDB.DocumentClient();

export const checkNarrationStatus = async (event) => {
    const { session_name } = event.pathParameters;
    console.log(event, 'env:', process.env);

    try {
        const result = await dynamoDb.get({
            TableName: process.env.DYNAMODB_TABLE,
            Key: { session_name: session_name }
        }).promise();

        console.log('result', result);

        if (!result.Item) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'Session not found' })
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify(result.Item)
        };

    } catch (error) {
        console.error(`Error checking status for session ${session_name}:`, error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
