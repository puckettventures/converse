"use strict";

import ffmpeg from 'fluent-ffmpeg';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import aws from 'aws-sdk';

const s3 = new aws.S3();
const dynamoDb = new aws.DynamoDB.DocumentClient();
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

// Download audio files from S3
const downloadFromS3 = async (bucket, key, destination) => {
  const params = { Bucket: bucket, Key: key };
  const s3Object = await s3.getObject(params).promise();
  await writeFile(destination, s3Object.Body);
};

// Fetch paragraphs from DynamoDB
const fetchParagraphsFromDynamo = async (session_name) => {
  const params = {
    TableName: process.env.DYNAMODB_TABLE,
    Key: { session_name },
  };

  const result = await dynamoDb.get(params).promise();
  return result.Item?.paragraphs || [];
};

export const mergeAudioFiles = async (event) => {
  const { session_name, audio_files } = JSON.parse(event.Records[0].body);
  const tempDir = '/tmp';  // Temporary directory in Lambda
  const mergedFilePath = path.join(tempDir, `${session_name}-merged.mp3`);

  // Set the path to FFmpeg binary from the Lambda Layer
  ffmpeg.setFfmpegPath('/opt/bin/ffmpeg');

  try {
    // Download audio files from S3 to /tmp
    const localAudioPaths = [];
    for (const audioFile of audio_files) {
      const fileName = path.basename(audioFile);
      const localFilePath = path.join(tempDir, fileName);
      await downloadFromS3(process.env.S3_BUCKET, audioFile, localFilePath);
      localAudioPaths.push(localFilePath);
    }

    // Fetch the paragraphs (transcript) from DynamoDB
    const paragraphs = await fetchParagraphsFromDynamo(session_name);

    // Merge audio files using FFmpeg
    await new Promise((resolve, reject) => {
      const command = ffmpeg();
      localAudioPaths.forEach((filePath) => command.input(filePath));

      // Output merged file
      command
        .on('end', resolve)
        .on('error', reject)
        .mergeToFile(mergedFilePath, tempDir);
    });

    // Create the transcript metadata from paragraphs
    const transcript = paragraphs
      .map((paragraph, index) => `Paragraph ${index + 1}: ${paragraph.text}`)
      .join('\n');

    // Add transcript metadata (USLT) using FFmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(mergedFilePath)
        .outputOptions([
          `-metadata:s:lyrics="${transcript}"`,  // Add transcript as lyrics
        ])
        .output(mergedFilePath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Upload merged file with metadata back to S3
    const mergedS3Key = `audio/${session_name}/merged/${session_name}-merged.mp3`;
    const mergedFileBuffer = await readFile(mergedFilePath);
    await s3.putObject({
      Bucket: process.env.S3_BUCKET,
      Key: mergedS3Key,
      Body: mergedFileBuffer,
      ContentType: 'audio/mpeg'
    }).promise();

    // Update DynamoDB with the path of the merged file and completion status
    await dynamoDb.update({
      TableName: process.env.DYNAMODB_TABLE,
      Key: { session_name },
      UpdateExpression: "SET #status = :merged, merged_file = :mergedFile",
      ExpressionAttributeNames: {
        "#status": "status"
      },
      ExpressionAttributeValues: {
        ":merged": "merged",
        ":mergedFile": mergedS3Key
      }
    }).promise();

    console.log(`Merged audio file uploaded to: ${mergedS3Key}`);
  } catch (error) {
    console.error('Error merging and adding transcript to audio files:', error);
    throw new Error('Merging and transcript embedding failed');
  }
};
