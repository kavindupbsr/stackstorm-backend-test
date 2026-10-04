const { S3Client } = require('@aws-sdk/client-s3');

const isMock =
  !process.env.AWS_ACCESS_KEY_ID ||
  process.env.AWS_ACCESS_KEY_ID.startsWith('mock') ||
  process.env.NODE_ENV === 'test';

const s3Config = {
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'mock_access_key',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'mock_secret_key',
  },
};

if (process.env.AWS_S3_ENDPOINT) {
  s3Config.endpoint = process.env.AWS_S3_ENDPOINT;
  s3Config.forcePathStyle = true;
}

const s3Client = new S3Client(s3Config);
const S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'stackstorm-assets';
const CDN_BASE_URL =
  process.env.CDN_BASE_URL || `https://${S3_BUCKET_NAME}.s3.${s3Config.region}.amazonaws.com`;

module.exports = {
  s3Client,
  S3_BUCKET_NAME,
  CDN_BASE_URL,
  isMock,
};
