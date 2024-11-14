const jwt = require("jsonwebtoken");
const getSecrets = require('./getSecrets.js');

const tokenSecret = "your-secret-key";  // Make sure to replace this with a strong secret key

const {
  CognitoIdentityProviderClient,
  SignUpCommand,
  AdminInitiateAuthCommand,
  InitiateAuthCommand,
  AdminGetUserCommand
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


// Create a token with username embedded, setting the validity period.
const generateAccessToken = (username, isAdmin = false) => {
  const userData = { username, admin: isAdmin };
  return jwt.sign(userData, tokenSecret, { expiresIn: "30m" });  // Token expires in 30 minutes
};


// Register a new user
const registerUser = async (username, password) => {
  try {
    const command = new SignUpCommand({
      ClientId: cognitoClientId,
      Username: username,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: username }
      ],
    });

    await cognitoClient.send(command);
    return { success: true };
  } catch (error) {
    console.error("Cognito registration error:", error);
    return { error: error.message };
  }
};

// Authenticate user using Cognito
const authenticateUser = async (username, password) => {
  try {
    const command = new InitiateAuthCommand({
      //   UserPoolId: cognitoUserPoolId,
      ClientId: cognitoClientId,
      AuthFlow: 'USER_PASSWORD_AUTH', // non-admin authentication 
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    });

    const response = await cognitoClient.send(command);
    // Check if the response contains AuthenticationResult
    if (!response.AuthenticationResult) {
      console.error("Authentication failed:", response);
      return { error: 'Authentication failed' };
    }

    // Extract and return the access token
    return { token: response.AuthenticationResult.AccessToken };
  } catch (error) {
    console.error("Cognito authentication error:", error);
    return { error: 'Invalid username or password' };
  }
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

module.exports = { registerUser, authenticateUser, generateAccessToken, verifyCognitoToken };


// ======================================
// // Register a new user -- old working
// const registerUser = async (username, password) => {

//    // Email validation using regex
//    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//    if (!emailRegex.test(username)) {
//       console.log("Invalid username:", username);
//       return { error: "Please input an email as username" };  // Return error if username is not a valid email
//    }

//    if (password.length < 8) {
//       console.log("Password is too short:", password);
//       return { error: "Password must be longer than 8 characters" };  // Return error if password is too short
//    }

//    const users = loadUsersFromFile();  // Load users from users.json

//    // Check if the user already exists
//    if (users[username]) {
//       console.log("User already exists:", username);
//       return { error: "User already exists" };  // User already registered
//    }

//    // Hash the password
//    const hashedPassword = await bcrypt.hash(password, 10);  // Use bcrypt to hash password with salt rounds of 10
//    users[username] = { password: hashedPassword, admin: false };  // Add the new user

//    // Save the new user to users.json
//    try {
//       saveUsersToFile(users);  // Save users back to the file
//       console.log("User saved to file:", username);
//       return { success: true };  // Return success if registration works
//    } catch (err) {
//       console.error("Error saving user to file:", err);
//       return { error: "Error saving user data" };  // Return error if something goes wrong
//    }
// };

// // Authenticate user on login (checking against users.json) -- old working
// const authenticateUser = async (username, password) => {
//    const users = loadUsersFromFile();  // Load users from users.json
//    const user = users[username];  // Get the user by username

//    if (!user) {
//       console.log("User does not exist:", username);
//       return { error: "User does not exist" };  // Return error if user not found
//    }

//    // Compare the provided password with the stored hashed password
//    const isMatch = await bcrypt.compare(password, user.password);  // Use bcrypt to compare hashed passwords
//    if (!isMatch) {
//       console.log("Invalid password for user:", username);
//       return { error: "Invalid username or password" };  // Return error if password doesn't match
//    }

//    // Generate JWT token if authentication is successful
//    return { token: generateAccessToken(username, user.admin) };
// };

// // Middleware to verify a token and respond with user information -- old working
// const authenticateToken = (req, res, next) => {
//    const authHeader = req.headers['authorization'];
//    const token = authHeader && authHeader.split(' ')[1];  // Extract the token from the Bearer scheme

//    if (!token) {
//       return res.sendStatus(401);  // Unauthorized if no token is present
//    }

//    // Verify the token
//    jwt.verify(token, tokenSecret, (err, user) => {
//       if (err) {
//          return res.sendStatus(403);  // Forbidden if token verification fails
//       }

//       req.user = user;  // Attach the user information to the request
//       next();  // Proceed to the next middleware or route handler
//    });
// };
