const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretsManagerClient = new SecretsManagerClient({ region: 'ap-southeast-2' });

let cachedSecrets = null;

const getSecrets = async () => {
  if (cachedSecrets) return cachedSecrets;

  try {
    const command = new GetSecretValueCommand({ SecretId: 'arn:aws:secretsmanager:ap-southeast-2:901444280953:secret:group-107-credentials-WAEyGM' });
    const response = await secretsManagerClient.send(command);

    if ('SecretString' in response) {
      cachedSecrets = JSON.parse(response.SecretString);
      return cachedSecrets;
    } else {
      throw new Error('SecretsManager: SecretString not found');
    }
  } catch (error) {
    console.error('Error retrieving secrets:', error);
    throw error;
  }
};

module.exports = getSecrets;