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

// Login route using Cognito
router.post("/login", async (req, res) => {
   // Check if the request's Content-Type is 'application/json'
   if (req.headers['content-type'] !== 'application/json') {
      return res.status(415).json({ error: "Unsupported Media Type. Only application/json is accepted." });
   }

   const { username, password } = req.body;

   // Additional validation to ensure the request body contains the expected data
   if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
   }

   const result = await auth.authenticateUser(username, password);

   if (result.error) {
      return res.status(400).json({ error: result.error });
   }

   res.status(200).json({ authToken: result.token });
});

// Sign up route -- old working
// router.post("/signup", async (req, res) => {
//     const { username, password } = req.body;

//     const result = await auth.registerUser(username, password);

//     if (result.error) {
//         return res.status(400).json({ error: result.error });
//     }

//     res.status(200).json({ message: "User registered successfully" });
// });

// Sign up route using Cognito
router.post("/signup", async (req, res) => {
   const { username, password } = req.body;

   const result = await auth.registerUser(username, password);

   if (result.error) {
      return res.status(400).json({ error: result.error });
   }

   res.status(200).json({ message: "User registered successfully" });
});

// // Protected route example -- old
// router.get("/data", auth.authenticateToken, (req, res) => {
//    if (!req.user.username) {
//       // bad user
//       console.log("Unauthorized request.");
//       return res.sendStatus(403);
//    }
//    res.json({ data: "some data intended only for logged-in users." });
// });

// Example of a protected route
router.get("/data", auth.verifyCognitoToken, (req, res) => {
   if (!req.user.username) {
      return res.sendStatus(403); // Forbidden
   }
   res.json({ data: "some data intended only for logged-in users." });
});

// Admin protected route example
router.get("/adminData", auth.verifyCognitoToken, (req, res) => {
   if (!req.user.username || !req.user.admin) {
      // bad user
      console.log("Unauthorized request.");
      return res.sendStatus(403);
   }
   res.json({ data: "some data intended only for admin users." });
});


// Route to handle file download with headers for download prompt
router.get('/download/:filename', auth.verifyCognitoToken, async (req, res) => {
   const { filename } = req.params;
   // const qutUsername = process.env.QUT_USERNAME; // Replace with the actual value if needed

   try {
      // First, check if the file exists in DynamoDB
      const params = {
         TableName: tableName,
         KeyConditionExpression: '#qutUsername = :qutUsername AND #compressedFilename = :compressedFilename',
         ExpressionAttributeNames: {
            '#qutUsername': 'qut-username',
            '#compressedFilename': 'compressedFilename'
         },
         ExpressionAttributeValues: {
            ':qutUsername': { S: qutUsername },
            ':compressedFilename': { S: filename }
         }
      };

      const data = await dynamoDbClient.send(new QueryCommand(params));

      if (!data.Items || data.Items.length === 0) {
         return res.status(404).json({ error: 'File not found in DynamoDB' });
      }

      // Generate a pre-signed URL for downloading the video from S3
      const getObjectParams = {
         Bucket: bucketName,
         Key: `compressed-videos/${filename}`
      };

      const signedUrl = await getSignedUrl(s3Client, new GetObjectCommand(getObjectParams), { expiresIn: 60 * 5 }); // URL valid for 5 minutes

      // Redirect the user to the signed URL for downloading
      res.json({ downloadUrl: signedUrl });

   } catch (error) {
      console.error("Error generating download URL from S3:", error);
      res.status(500).json({ error: 'Error downloading file' });
   }
});

// Route to handle video deletion
router.delete('/delete/:filename', auth.verifyCognitoToken, async (req, res) => {
   const { filename } = req.params;
   // const qutUsername = process.env.QUT_USERNAME; // Replace with the actual value if needed

   try {
      // Check if the video exists in DynamoDB
      const params = {
         TableName: tableName,
         Key: {
            "qut-username": { S: qutUsername },
            compressedFilename: { S: filename }
         }
      };

      // Delete the entry from DynamoDB
      await dynamoDbClient.send(new DeleteItemCommand(params));
      console.log("Metadata deleted from DynamoDB for file:", filename);

      // Delete the file from S3
      const deleteParams = {
         Bucket: bucketName,
         Key: `compressed-videos/${filename}`
      };

      try {
         await s3Client.send(new DeleteObjectCommand(deleteParams));
         console.log("File deleted from S3:", filename);
         res.send('Video deleted successfully');
      } catch (error) {
         console.error("Error deleting video from S3:", error);
         res.status(500).json({ error: 'Error deleting video from S3' });
      }
   } catch (error) {
      console.error("Error deleting video from DynamoDB:", error);
      res.status(500).json({ error: 'Error deleting video' });
   }
});


// Upload endpoint -- working before adding SQS
// router.post("/upload", auth.verifyCognitoToken, (req, res) => {
//    if (!req.files) {
//       console.error("No file uploaded");
//       return res.status(400).json({ error: 'No file uploaded' });
//    }

//    const file = req.files.file;
//    const originalPath = path.join(__dirname, "../uploads", file.name);

//    // Save the original file
//    file.mv(originalPath, (err) => {
//       if (err) {
//          console.error("Error saving original file:", err);
//          return res.status(500).send("Error saving file. " + err.message);
//       }

//       // Store the latest uploaded filename
//       latestUploadedFile = file.name;
//       console.log("File uploaded successfully:", file.name);
//       res.json({ message: "File uploaded successfully", filename: file.name });
//    });
// });


// Process endpoint -- old working
// router.post("/process", auth.authenticateToken, (req, res) => {
//    if (!latestUploadedFile) {
//       console.error("No file available for processing.");
//       return res.status(400).json({ error: 'No file available for processing.' });
//    }

//    const username = req.user.username;
//    const originalPath = path.join(__dirname, "../uploads", latestUploadedFile);
//    const uniqueId = Date.now(); // Add a unique ID for each compressed file
//    const compressedFilename = latestUploadedFile.replace(/\.[^/.]+$/, "") + `-compressed-${uniqueId}.${req.body.format || 'mp4'}`;
//    const compressedPath = path.join(__dirname, "../uploads", compressedFilename);

//    const format = req.body.format || 'mp4';
//    const resolution = req.body.resolution || '720p';
//    const bitrate = req.body.bitrate || 'medium';
//    const frameRate = req.body.frameRate || '30';

//    const resolutionMap = {
//       '1080p': '1920x1080',
//       '720p': '1280x720',
//       '480p': '640x480',
//       '360p': '480x360',
//    };

//    const bitrateMap = {
//       'low': '500k',
//       'medium': '1000k',
//       'high': '2000k',
//    };

//    ffmpeg(originalPath)
//       .outputOptions([
//          `-s ${resolutionMap[resolution]}`,
//          `-b:v ${bitrateMap[bitrate]}`,
//          `-r ${frameRate}`,
//          "-c:v libx264",
//          "-crf 28",
//          "-preset fast"
//       ])
//       .on("end", () => {
//          console.log("Compression finished for:", compressedFilename);

//          const videoMetadata = {
//             username: username,
//             originalFilename: latestUploadedFile,
//             compressedFilename: compressedFilename,
//             uploadDate: new Date().toISOString(),
//             originalSize: (fs.statSync(originalPath).size / (1024 * 1024)).toFixed(2),
//             compressedSize: (fs.statSync(compressedPath).size / (1024 * 1024)).toFixed(2)
//          };

//          fs.readFile(metadataFilePath, (err, data) => {
//             let metadataArray = [];
//             if (!err && data.length > 0) {
//                metadataArray = JSON.parse(data);
//             }
//             metadataArray.push(videoMetadata);
//             fs.writeFile(metadataFilePath, JSON.stringify(metadataArray, null, 2), (err) => {
//                if (err) {
//                   console.error("Error writing metadata:", err);
//                }
//             });
//          });

//          fs.unlink(originalPath, (err) => {
//             if (err) console.error("Error deleting original file:", err);
//          });

//          latestUploadedFile = '';
//          res.json({ message: "Processing successful", compressedFilename });
//       })
//       .on("error", (err) => {
//          console.error("Error during compression:", err);
//          res.status(500).send("Error compressing video.");
//       })
//       .save(compressedPath);
// });


// Latest Compressed Video Endpoint -- old working code
// router.get('/uploads/latest', auth.authenticateToken, (req, res) => {
//    fs.readFile(metadataFilePath, (err, data) => {
//       if (err) {
//          console.error("Error reading metadata file:", err);
//          return res.status(500).json({ error: 'Error fetching latest video' });
//       }

//       const metadataArray = JSON.parse(data);
//       const latestCompressed = metadataArray.filter(video => video.compressedFilename.endsWith('.mp4')).pop();

//       if (!latestCompressed) {
//          return res.status(404).json({ error: 'No compressed videos found' });
//       }

//       res.json({
//          videoUrl: `/uploads/${latestCompressed.compressedFilename}`,
//          fileSize: latestCompressed.compressedSize
//       });
//    });
// });

// router.get('/uploads/latest', auth.verifyCognitoToken, async (req, res) => {
//    const username = req.user.username;

//    try {
//       const params = {
//          TableName: tableName,
//          KeyConditionExpression: '#qutUsername = :qutUsername',
//          ExpressionAttributeNames: {
//             '#qutUsername': 'qut-username' // Mapping 'qut-username' attribute name
//          },
//          ExpressionAttributeValues: {
//             ':qutUsername': { S: qutUsername }
//          },
//          ScanIndexForward: false, // To get the latest video (descending order by `uploadDate`)
//          Limit: 1, // Fetch only the latest entry
//       };

//       const data = await dynamoDbClient.send(new QueryCommand(params));

//       if (data.Items.length === 0) {
//          return res.status(404).json({ error: 'No compressed videos found' });
//       }

//       // Extract the relevant fields
//       const latestVideo = data.Items[0];
//       const compressedFilename = latestVideo.compressedFilename.S;

//       // Generate a pre-signed URL for the compressed video
//       const getObjectParams = {
//          Bucket: bucketName,
//          Key: `compressed-videos/${compressedFilename}`
//       };

//       const signedUrl = await getSignedUrl(s3Client, new GetObjectCommand(getObjectParams), {
//          expiresIn: 60 * 5, // 5 minutes
//       });

//       res.json({
//          "qut-username": latestVideo["qut-username"].S,
//          username: latestVideo.username.S,
//          originalFilename: latestVideo.originalFilename.S,
//          compressedFilename: latestVideo.compressedFilename.S,
//          originalSize: latestVideo.originalSize.N,
//          compressedSize: latestVideo.compressedSize.N,
//          uploadDate: latestVideo.uploadDate.S,
//          s3Url: signedUrl, // Return the pre-signed URL
//       });
//    } catch (error) {
//       console.error('Error fetching metadata from DynamoDB:', error);
//       res.status(500).json({ error: 'Failed to fetch latest video metadata' });
//    }
// });



//================================================================================

// // Upload route to generate pre-signed URL for uploading video to S3
// router.post('/upload-url', auth.authenticateToken, async (req, res) => {
//    const { fileName, fileType } = req.body;

//    console.log("User making request:", req.user);  // Log user info
//    console.log("File Name:", fileName);
//    console.log("File Type:", fileType);

//    try {
//       const uploadUrl = await generateUploadURL(fileName, fileType);
//       res.json({ uploadUrl });
//    } catch (error) {
//       console.error('Error generating upload URL:', error); // Log the error
//       res.status(500).json({ error: 'Error generating upload URL' });  // Return 500 if there's an issue
//    }
// });


// // Route to generate pre-signed URL for downloading video from S3
// router.get('/download-url/:filename', auth.authenticateToken, async (req, res) => {
//    const { filename } = req.params;

//    try {
//       const downloadUrl = await generateDownloadURL(filename);
//       res.json({ downloadUrl });
//    } catch (error) {
//       console.error('Error generating download URL:', error);
//       res.status(500).json({ error: 'Error generating download URL' });
//    }
// });


// router.use("/", express.static(path.join(__dirname, "../uploads")));

module.exports = router;
