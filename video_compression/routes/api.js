//video_compression/routes/api.js

const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const multer = require("multer");
const auth = require("../auth.js");

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const getSecrets = require('../getSecrets.js');

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
      region = secrets.AWS_REGION;

      // Fetch AWS_REGION from Parameter Store
      region = await getParameterValue('/n11709596/region');
      sqsQueueUrl = await getParameterValue('/n11709596/sqs_queue_url');

      // Initialize S3 and DynamoDB clients with fetched secrets
      s3Client = new S3Client({
         region: region,
      });

      dynamoDbClient = new DynamoDBClient({
         region: region,
      });

      sqsClient = new SQSClient({
         region: region,
      });

   } catch (error) {
      console.error('Failed to initialize AWS clients:', error);
   }
})();

// Setup multer for file uploads
const storage = multer.diskStorage({
   destination: (req, file, cb) => {
      cb(null, 'uploads/'); // Directory where files will be stored
   },
   filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname)); // Unique file name
   }
});

const upload = multer({ storage });

// Global variable to store the latest uploaded filename
let latestUploadedFile = '';

router.get('/health', (req, res) => {
   res.status(200).send('OK');
});

router.post("/upload", auth.verifyCognitoToken, async (req, res) => {
   if (!req.files) {
      return res.status(400).json({ error: 'No file uploaded' });
   }

   const file = req.files.file;
   const originalPath = path.join(__dirname, "../uploads", file.name);

   // Save the original file
   file.mv(originalPath, async (err) => {
      if (err) {
         return res.status(500).send("Error saving file. " + err.message);
      }

      // Store the latest uploaded filename
      latestUploadedFile = file.name;

      // Create a message object to send to SQS queue
      const messageBody = JSON.stringify({
         username: req.user.username,
         fileName: latestUploadedFile,
         format: req.body.format || 'mp4',
         resolution: req.body.resolution || '720p',
         bitrate: req.body.bitrate || 'medium',
         frameRate: req.body.frameRate || '30'
      });

      // Send the message to the SQS queue
      try {
         const sqsParams = {
            QueueUrl: sqsQueueUrl,   // SQS queue URL from environment variable
            MessageBody: messageBody,
         };

         await sqsClient.send(new SendMessageCommand(sqsParams));
         console.log(`Message sent to SQS queue: ${messageBody}`);

         res.json({ message: "File uploaded successfully and processing job queued." });
      } catch (err) {
         console.error('Error sending message to SQS:', err);
         res.status(500).json({ error: 'Error queuing video processing job.' });
      }
   });
});



router.post('/process', auth.verifyCognitoToken, (req, res) => {
   // Ensure file is available for processing
   if (!latestUploadedFile) {
      return res.status(400).json({ error: 'No file available for processing.' });
   }

   const username = req.user.username;
   const originalPath = path.join(__dirname, '../uploads', latestUploadedFile);
   const uniqueId = Date.now(); // Add a unique ID for each compressed file
   const compressedFilename = latestUploadedFile.replace(/\.[^/.]+$/, "") + `-compressed-${uniqueId}.${req.body.format || 'mp4'}`;
   const compressedPath = path.normalize(path.join(__dirname, '../uploads', compressedFilename));


   const format = req.body.format || 'mp4';
   const resolution = req.body.resolution || '720p';
   const bitrate = req.body.bitrate || 'medium';
   const frameRate = req.body.frameRate || '30';

   const resolutionMap = {
      '1080p': '1920x1080',
      '720p': '1280x720',
      '480p': '640x480',
      '360p': '480x360',
   };

   const bitrateMap = {
      'low': '500k',
      'medium': '1000k',
      'high': '2000k',
   };

   // ffmpeg compression logic...
   ffmpeg(originalPath)
      .outputOptions([
         `-s ${resolutionMap[resolution]}`,
         `-b:v ${bitrateMap[bitrate]}`,
         `-r ${frameRate}`,
         "-c:v libx264",
         "-crf 28",
         "-preset fast"
      ])
      .on('end', async () => {
         console.log(`Compression finished for: ${compressedFilename}`);

         // S3 upload logic
         const fileStream = fs.createReadStream(compressedPath);
         const uploadParams = {
            Bucket: bucketName,
            Key: `compressed-videos/${compressedFilename}`,
            Body: fileStream,
            ContentType: 'video/mp4',
         };

         try {
            await s3Client.send(new PutObjectCommand(uploadParams));
            console.log(`Video uploaded to S3: ${compressedFilename}`);

            // Save metadata to DynamoDB
            const originalSize = (fs.statSync(originalPath).size / (1024 * 1024)).toFixed(2);
            const compressedSize = (fs.statSync(compressedPath).size / (1024 * 1024)).toFixed(2);
            const uploadDate = new Date().toISOString();

            const videoMetadata = {
               "qut-username": { S: qutUsername },
               username: { S: username },
               uploadDate: { S: uploadDate },
               originalFilename: { S: latestUploadedFile },
               compressedFilename: { S: compressedFilename },
               originalSize: { N: originalSize },
               compressedSize: { N: compressedSize },
               s3Url: { S: `https://${bucketName}.s3.${region}.amazonaws.com/compressed-videos/${compressedFilename}` }
            };

            const putItemCommand = new PutItemCommand({
               TableName: tableName,
               Item: videoMetadata,
            });

            await dynamoDbClient.send(putItemCommand);
            console.log('Metadata saved to DynamoDB successfully');

            // Clean up local files
            fs.unlinkSync(compressedPath); // Delete compressed file
            fs.unlinkSync(originalPath); // Delete original file

            res.json({ message: 'Compression and upload successful', s3Url: `https://${bucketName}.s3.${region}.amazonaws.com/compressed-videos/${compressedFilename}` });
         } catch (err) {
            console.error('Error uploading to S3:', err);
            res.status(500).json({ error: 'Failed to upload video to S3' });
         }
      })
      .on('error', (err) => {
         console.error('Error during compression:', err);
         res.status(500).send('Error compressing video.');
      })
      .save(compressedPath);

});

module.exports = router;
