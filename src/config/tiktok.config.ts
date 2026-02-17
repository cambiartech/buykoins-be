import { registerAs } from '@nestjs/config';

export default registerAs('tiktok', () => ({
  clientKey: process.env.TIKTOK_CLIENT_KEY || '',
  clientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
  /** Must match a redirect URI registered in TikTok Developer Portal (Login Kit for Web). */
  redirectUri: process.env.TIKTOK_REDIRECT_URI || '',
  /** Scopes requested (comma-separated). e.g. user.info.basic for display name and avatar. */
  scope: process.env.TIKTOK_SCOPE || 'user.info.basic',
  /** TikTok OAuth authorize URL (v2). */
  authorizeUrl: 'https://www.tiktok.com/v2/auth/authorize/',
  /** Token endpoint. */
  tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
  /** User info endpoint (requires Bearer access_token). */
  userInfoUrl: 'https://open.tiktokapis.com/v2/user/info/',
}));
