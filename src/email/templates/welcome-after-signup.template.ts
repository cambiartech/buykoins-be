/**
 * Welcome email sent after signup (before onboarding).
 * Promotional: link TikTok payout, onboarding steps, card feature.
 */

import { BaseEmailTemplate } from './base-email.template';

export class WelcomeAfterSignupTemplate {
  static getHtml(firstName: string, assetsBaseUrl?: string): string {
    const displayName = firstName || 'there';
    const content = `
      <h2 style="color: #333; margin-top: 0; font-size: 28px; font-weight: 600; text-align: center;">
        Welcome to Buykoins, ${displayName}
      </h2>
      <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 20px 0; text-align: center;">
        Your account is ready. To start receiving payouts from your TikTok earnings, complete these steps.
      </p>

      <div style="margin: 30px 0;">
        <h3 style="color: #333; font-size: 18px; font-weight: 600; margin: 0 0 15px 0;">1. Link your TikTok payout account</h3>
        <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
          Complete onboarding and submit your details. Our team will verify your account so you can receive payouts to your bank account.
        </p>

        <h3 style="color: #333; font-size: 18px; font-weight: 600; margin: 0 0 15px 0;">2. Use your wallet and card</h3>
        <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
          After verification, you can fund your Buykoins card from your wallet and use it for TikTok coins and other digital purchases. One balance, multiple ways to spend.
        </p>

        <h3 style="color: #333; font-size: 18px; font-weight: 600; margin: 0 0 15px 0;">3. Submit earnings and request payouts</h3>
        <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 0;">
          Upload proof of your TikTok coins transactions to get credited in USD, then request withdrawals to your verified bank account.
        </p>
      </div>

      <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 30px 0 20px 0; text-align: center;">
        If you have any questions, reply to this email or use the Support section in your dashboard.
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://buykoins.com/dashboard" style="display: inline-block; padding: 15px 40px; background-color: #667eea; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
          Go to Dashboard
        </a>
      </div>

      <p style="color: #999; font-size: 12px; line-height: 1.5; margin: 20px 0 0 0; text-align: center;">
        Best regards,<br>The Buykoins Team
      </p>
    `;
    return BaseEmailTemplate.getBaseHtml(content, {
      title: 'Welcome to Buykoins',
      assetsBaseUrl,
    });
  }

  static getText(firstName: string): string {
    const displayName = firstName || 'there';
    return `
Welcome to Buykoins, ${displayName}

Your account is ready. To start receiving payouts from your TikTok earnings, complete these steps.

1. Link your TikTok payout account
Complete onboarding and submit your details. Our team will verify your account so you can receive payouts to your bank account.

2. Use your wallet and card
After verification, you can fund your Buykoins card from your wallet and use it for TikTok coins and other digital purchases. One balance, multiple ways to spend.

3. Submit earnings and request payouts
Upload proof of your TikTok coins transactions to get credited in USD, then request withdrawals to your verified bank account.

If you have any questions, reply to this email or use the Support section in your dashboard.

Visit your dashboard: https://buykoins.com/dashboard

Best regards,
The Buykoins Team
    `.trim();
  }
}
