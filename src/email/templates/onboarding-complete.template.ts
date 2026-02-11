/**
 * Email when admin approves onboarding (account verified).
 */

import { BaseEmailTemplate } from './base-email.template';

export class OnboardingCompleteTemplate {
  static getHtml(firstName: string, assetsBaseUrl?: string): string {
    const displayName = firstName || 'there';
    const content = `
      <h2 style="color: #333; margin-top: 0; font-size: 28px; font-weight: 600; text-align: center;">
        Your account is verified, ${displayName}
      </h2>
      <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 20px 0; text-align: center;">
        Your Buykoins account has been verified. You can now:
      </p>
      <ul style="color: #666; font-size: 15px; line-height: 1.8; margin: 20px 0; padding-left: 24px;">
        <li>Submit credit requests for your TikTok earnings</li>
        <li>Request payouts to your verified bank account</li>
        <li>Fund your card and use it for TikTok coins and digital purchases</li>
      </ul>
      <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 25px 0; text-align: center;">
        Log in to your dashboard to submit your first payout request.
      </p>
      <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 15px 0 20px 0; text-align: center;">
        If you need help, contact us through Support.
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
      title: 'Account verified – Buykoins',
      assetsBaseUrl,
    });
  }

  static getText(firstName: string): string {
    const displayName = firstName || 'there';
    return `
Your account is verified, ${displayName}

Your Buykoins account has been verified. You can now:

- Submit credit requests for your TikTok earnings
- Request payouts to your verified bank account
- Fund your card and use it for TikTok coins and digital purchases

Log in to your dashboard to submit your first payout request: https://buykoins.com/dashboard

If you need help, contact us through Support.

Best regards,
The Buykoins Team
    `.trim();
  }
}
