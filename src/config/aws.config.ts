import { registerAs } from '@nestjs/config';

export default registerAs('aws', () => ({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  endpoint: process.env.AWS_ENDPOINT, // For Cloudflare R2 or other S3-compatible services
  s3: {
    bucketName: process.env.AWS_S3_BUCKET_NAME || 'buytiktokcoins-proofs',
  },
  r2: {
    // Cloudflare R2 specific settings
    accountId: process.env.CLOUDFLARE_R2_ACCOUNT_ID,
    publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL, // Custom domain or R2.dev URL
  },
  ses: {
    fromEmail: process.env.AWS_SES_FROM_EMAIL || 'noreply@buytiktokcoins.com',
  },
}));

