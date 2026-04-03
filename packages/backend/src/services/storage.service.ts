import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

const s3 = new S3Client({
  region: config.S3_REGION,
  endpoint: config.S3_ENDPOINT || undefined,
  credentials: {
    accessKeyId: config.S3_ACCESS_KEY,
    secretAccessKey: config.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

/**
 * Upload a buffer to S3 and return the public URL
 */
export async function uploadBuffer(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<string> {
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: config.S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read',
      }),
    );

    const url = config.S3_ENDPOINT
      ? `${config.S3_ENDPOINT}/${config.S3_BUCKET}/${key}`
      : `https://${config.S3_BUCKET}.s3.${config.S3_REGION}.amazonaws.com/${key}`;

    return url;
  } catch (err) {
    logger.error(err, 'S3 upload failed');
    throw err;
  }
}
