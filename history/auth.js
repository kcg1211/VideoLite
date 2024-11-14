const jwt = require("jsonwebtoken");
const getSecrets = require('./getSecrets.js');

const {
  CognitoIdentityProviderClient,
} = require('@aws-sdk/client-cognito-identity-provider');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

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


let cognitoClient, cognitoUserPoolId, cognitoClientId, region, client;

(async () => {
  try {
    const secrets = await getSecrets();
    cognitoUserPoolId = secrets.COGNITO_USER_POOL_ID;
    cognitoClientId = secrets.COGNITO_CLIENT_ID;

    // Fetch AWS_REGION from Parameter Store
    region = await getParameterValue('/n11709596/region');

    // Initialize the Cognito client with fetched secrets
    cognitoClient = new CognitoIdentityProviderClient({
      region: region,
      //  credentials: fromIni({ profile: 'CAB432-STUDENT-901444280953' }),
    });

    // Initialize jwksClient after getting secrets
    jwksUri = `https://cognito-idp.${region}.amazonaws.com/${cognitoUserPoolId}/.well-known/jwks.json`;
    const jwksClient = require('jwks-rsa');

    client = jwksClient({
      jwksUri: jwksUri,
    });

    console.log('JWKS Client initialized successfully with URI:', jwksUri);

  } catch (error) {
    console.error('Failed to initialize Cognito client or JWKS client:', error);
  }
})();



// Middleware to retrieve the signing key
const getKey = (header, callback) => {
  if (!client) {
    console.error("JWKS Client is not initialized yet.");
    return callback(new Error("JWKS Client is not initialized"));
  }

  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      console.error('Error fetching signing key:', err);
      return callback(err);
    }

    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
};

// Middleware to verify Cognito JWT token
const verifyCognitoToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  jwt.verify(token, getKey, {
    issuer: `https://cognito-idp.${region}.amazonaws.com/${cognitoUserPoolId}`,
  }, (err, decoded) => {
    if (err) {
      console.error("Token verification error:", err);
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.user = decoded;
    next();
  });
};

module.exports = { verifyCognitoToken };