import { registerAs } from '@nestjs/config';

export default registerAs('paystack', () => {
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production';
  
  // Use test keys in development/test mode, production keys in production
  const secretKey = isDevelopment
    ? (process.env.PAYSTACK_SECRET_KEY_TEST || process.env.PAYSTACK_SECRET_KEY || '')
    : (process.env.PAYSTACK_SECRET_KEY || '');
  
  const publicKey = isDevelopment
    ? (process.env.PAYSTACK_PUBLIC_KEY_TEST || process.env.PAYSTACK_PUBLIC_KEY || '')
    : (process.env.PAYSTACK_PUBLIC_KEY || '');

  return {
    secretKey,
    publicKey,
    baseUrl: process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co',
    webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET || '',
    currency: process.env.PAYSTACK_CURRENCY || 'NGN',
    environment: isDevelopment ? 'test' : 'live',
  };
});
