//backend/routes/api.js

const express = require("express");
const router = express.Router();
const path = require("path");
const auth = require("../auth.js");

const { S3Client, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient, QueryCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
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

// // Login route -- old working
// router.post("/login", async (req, res) => {
//    const { username, password } = req.body;

//    if (!username || !password) {
//       return res.status(400).json({ error: "Username and password are required" });
//    }

//    // Authenticate user using the updated authenticateUser function
//    const result = await auth.authenticateUser(username, password);

//    if (result.error) {
//       return res.status(400).json({ error: result.error });
//    }

//    // Send back the JWT token if successful
//    res.status(200).json({ authToken: result.token });
// });

router.get('/health', (req, res) => {
   res.status(200).send('OK');
});

router.get('/history', auth.verifyCognitoToken, async (req, res) => {
    const username = req.user.username;
 
    try {
       const params = {
          TableName: tableName,
          KeyConditionExpression: '#qutUsername = :qutUsername',
          ExpressionAttributeNames: {
             '#qutUsername': 'qut-username',
             '#username': 'username'
          },
          ExpressionAttributeValues: {
             ':qutUsername': { S: qutUsername },
             ':username': { S: username }
          },
          FilterExpression: '#username = :username'
       };
 
       const data = await dynamoDbClient.send(new QueryCommand(params));
 
       if (!data.Items || data.Items.length === 0) {
          return res.json({ history: [] });
       }
 
       // Generate pre-signed URLs for the video items
       const userMetadata = await Promise.all(data.Items.map(async (item) => {
          const signedUrl = await getSignedUrl(s3Client, new GetObjectCommand({
             Bucket: bucketName,
             Key: `compressed-videos/${item.compressedFilename.S}`,
          }), { expiresIn: 60 * 5 });  // URL valid for 5 minutes
 
          return {
             username: item.username.S,
             originalFilename: item.originalFilename.S,
             compressedFilename: item.compressedFilename.S,
             uploadDate: item.uploadDate.S,
             originalSize: item.originalSize.N,
             compressedSize: item.compressedSize.N,
             s3Url: signedUrl  // Add pre-signed S3 URL here
          };
       }));
 
       res.json({ history: userMetadata });
    } catch (error) {
       console.error("Error fetching video history from DynamoDB:", error);
       res.status(500).json({ error: 'Error fetching video history' });
    }
 });

 module.exports = router;