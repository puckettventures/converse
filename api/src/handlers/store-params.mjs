import aws from 'aws-sdk';
import https from 'https';
import url from 'url';

const ssm = new aws.SSM();

export const handler = (event, context) => {
    console.log("REQUEST RECEIVED:\n" + JSON.stringify(event));

    // For Delete requests, immediately send a SUCCESS response
    if (event.RequestType === "Delete") {
        sendResponse(event, context, "SUCCESS");
        return;
    }

    let responseStatus = "FAILED";
    let responseData = {};

    // Try storing parameters in SSM Parameter Store
    try {
        const { SQSQueueUrl, DynamoDBTableName } = event.ResourceProperties;

        if (process.env.AWS_SAM_LOCAL) {
            console.log('Running locally. Skipping SSM Parameter Store update.');
            responseStatus = "SUCCESS";
            sendResponse(event, context, responseStatus);
            return;
        }

        // Store SQS Queue URL in Parameter Store
        console.log(`Storing SQS Queue URL: ${SQSQueueUrl}`);
        const storeSQSResult = ssm.putParameter({
            Name: '/converse/SQS_QUEUE_URL',
            Value: SQSQueueUrl,
            Type: 'String',
            Overwrite: true
        }).promise();

        // Store DynamoDB Table Name in Parameter Store
        console.log(`Storing DynamoDB Table Name: ${DynamoDBTableName}`);
        const storeDynamoDBResult = ssm.putParameter({
            Name: '/converse/DYNAMODB_TABLE',
            Value: DynamoDBTableName,
            Type: 'String',
            Overwrite: true
        }).promise();

        Promise.all([storeSQSResult, storeDynamoDBResult]).then(() => {
            responseStatus = "SUCCESS";
            responseData = {
                SQSQueueUrl: SQSQueueUrl,
                DynamoDBTableName: DynamoDBTableName
            };
            sendResponse(event, context, responseStatus, responseData);
        }).catch((error) => {
            console.log("Error storing parameters in SSM Parameter Store:", error);
            responseData = { Error: "Failed to store parameters" };
            sendResponse(event, context, responseStatus, responseData);
        });

    } catch (error) {
        console.log("Unexpected error:", error);
        responseData = { Error: "Unexpected error occurred" };
        sendResponse(event, context, responseStatus, responseData);
    }
};

// Send response to CloudFormation
const sendResponse = (event, context, responseStatus, responseData = {}) => {
    const responseBody = JSON.stringify({
        Status: responseStatus,
        Reason: "See the details in CloudWatch Log Stream: " + context.logStreamName,
        PhysicalResourceId: context.logStreamName,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        Data: responseData
    });

    console.log("RESPONSE BODY:\n", responseBody);

    const parsedUrl = url.parse(event.ResponseURL);
    const options = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.path,
        method: "PUT",
        headers: {
            "content-type": "",
            "content-length": responseBody.length
        }
    };

    const request = https.request(options, (response) => {
        console.log("STATUS: " + response.statusCode);
        console.log("HEADERS: " + JSON.stringify(response.headers));
        // Tell AWS Lambda that the function execution is done
        context.done();
    });

    request.on("error", (error) => {
        console.log("sendResponse Error:", error);
        // Tell AWS Lambda that the function execution is done
        context.done();
    });

    console.log("Writing response:", responseBody);
    // Write data to request body
    request.write(responseBody);
    request.end();
};
