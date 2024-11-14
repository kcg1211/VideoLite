//backend/worker.js

const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

// Function to get region from Parameter Store
async function getParameterValue(parameterName) {
  const client = new SSMClient({
    region: "ap-southeast-2"
 });
  const command = new GetParameterCommand({
    Name: parameterName,
    WithDecryption: false,  // Set to true if the parameter is encrypted
  });

  try {
    const response = await client.send(command);
    return response.Parameter.Value;
  } catch (error) {
    console.error(`Error fetching parameter ${parameterName}:`, error);
    throw error;
  }
}

let s3Client, dynamoDbClient, sqsClient, bucketName, tableName, qutUsername, region, sqsQueueUrl;

(async () => {
  try {
    const secrets = await getSecrets();
    bucketName = secrets.S3_BUCKET_NAME;
    tableName = secrets.DYNAMO_TABLE_NAME;
    qutUsername = secrets.QUT_USERNAME;

    // Fetch AWS_REGION from Parameter Store
    region = await getParameterValue('/n11709596/region');
    sqsQueueUrl = await getParameterValue('/n11709596/sqs_queue_url');

    // Initialize S3 and DynamoDB clients with fetched secrets
    s3Client = new S3Client({
      region: region,
      // credentials: fromIni({ profile: 'CAB432-STUDENT-901444280953' }),
    });

    dynamoDbClient = new DynamoDBClient({
      region: region,
      // credentials: fromIni({ profile: 'CAB432-STUDENT-901444280953' }),
    });

    sqsClient = new SQSClient({
      region: region,
    });

  } catch (error) {
    console.error('Failed to initialize AWS clients:', error);
  }
})();



const processQueue = async () => {
  try {
    const params = {
      QueueUrl: sqsQueueUrl,
      MaxNumberOfMessages: 10, // Process up to 10 messages at a time
      WaitTimeSeconds: 20,     // Long-poll for up to 20 seconds
    };

    const data = await sqsClient.send(new ReceiveMessageCommand(params));

    if (data.Messages) {
      for (let message of data.Messages) {
        const body = JSON.parse(message.Body);
        console.log("Processing message:", body);

        // Perform video compression using ffmpeg (similar to your previous logic)
        const originalPath = path.join(__dirname, '../uploads', body.fileName);
        const compressedFilename = `${Date.now()}-compressed.${body.format}`;
        const compressedPath = path.join(__dirname, '../uploads', compressedFilename);

        await compressVideo(originalPath, compressedPath, body);

        // Upload the compressed video to S3
        const fileStream = fs.createReadStream(compressedPath);
        const s3Params = {
          Bucket: bucketName,
          Key: `compressed-videos/${compressedFilename}`,
          Body: fileStream,
          ContentType: 'video/mp4',
        };

        await s3Client.send(new PutObjectCommand(s3Params));
        console.log(`Video uploaded to S3: ${compressedFilename}`);

        // Save metadata to DynamoDB
        const originalSize = (fs.statSync(originalPath).size / (1024 * 1024)).toFixed(2);
        const compressedSize = (fs.statSync(compressedPath).size / (1024 * 1024)).toFixed(2);
        const videoMetadata = {
          "qut-username": { S: body.username },
          originalFilename: { S: body.fileName },
          compressedFilename: { S: compressedFilename },
          originalSize: { N: originalSize },
          compressedSize: { N: compressedSize },
          s3Url: { S: `https://${bucketName}.s3.${region}.amazonaws.com/compressed-videos/${compressedFilename}` }
        };

        await dynamoDbClient.send(new PutItemCommand({
          TableName: tableName,
          Item: videoMetadata,
        }));

        // Clean up local files
        fs.unlinkSync(compressedPath);
        fs.unlinkSync(originalPath);

        // Delete the message from SQS
        const deleteParams = {
          QueueUrl: sqsQueueUrl,
          ReceiptHandle: message.ReceiptHandle,
        };

        await sqsClient.send(new DeleteMessageCommand(deleteParams));
        console.log("Message processed and deleted from SQS:", message.MessageId);
      }
    }
  } catch (error) {
    console.error('Error processing SQS message:', error);
  }
};

const compressVideo = (inputPath, outputPath, options) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        `-s ${options.resolution}`,
        `-b:v ${options.bitrate}`,
        `-r ${options.frameRate}`,
        "-c:v libx264",
        "-crf 28",
        "-preset fast"
      ])
      .on('end', () => {
        console.log(`Compression finished for: ${outputPath}`);
        resolve();
      })
      .on('error', (err) => {
        console.error('Error during compression:', err);
        reject(err);
      })
      .save(outputPath);
  });
};

// Continuously poll the SQS queue for new messages
setInterval(processQueue, 30000); // Poll every 30 seconds
