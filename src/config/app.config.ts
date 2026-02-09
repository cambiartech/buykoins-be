import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  apiPrefix: process.env.API_PREFIX || 'api',
  // Comma-separated list of allowed origins, e.g. "http://localhost:3000,https://buykoins.vercel.app,https://www.buykoins.com"
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  verificationCodeExpiresIn: parseInt(
    process.env.VERIFICATION_CODE_EXPIRES_IN || '900000',
    10,
  ), // 15 minutes
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
}));

