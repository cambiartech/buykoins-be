import { registerAs } from '@nestjs/config';

export default registerAs('postmark', () => ({
  apiKey: process.env.POSTMARK_API_KEY,
  serverToken: process.env.POSTMARK_SERVER_TOKEN, // Alias for apiKey
  fromEmail: process.env.POSTMARK_FROM_EMAIL || 'noreply@buykoins.com',
  fromName: process.env.POSTMARK_FROM_NAME || 'Buykoins',
  replyTo: process.env.POSTMARK_REPLY_TO_EMAIL,
  // Base URL for email assets (logos, patterns, etc.)
  assetsBaseUrl: process.env.EMAIL_ASSETS_BASE_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL || 'https://storage.buykoins.com',
}));
