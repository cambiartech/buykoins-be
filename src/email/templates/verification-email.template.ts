/**
 * Email Verification Template
 * Used for sending verification codes to users
 */

import { BaseEmailTemplate } from './base-email.template';

export class VerificationEmailTemplate {
  static getHtml(
    code: string,
    expiresInMinutes: number = 15,
    assetsBaseUrl?: string,
    title: string = 'Email Verification',
  ): string {
    const content = `
      <h2 style="color: #333; margin-top: 0; font-size: 24px; font-weight: 600;">${title}</h2>
      <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 20px 0;">
        Thank you for signing up! Please verify your email address by entering the code below:
      </p>
      ${BaseEmailTemplate.getCodeBox(code)}
      <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 20px 0;">
        This code will expire in <strong style="color: #333;">${expiresInMinutes} minutes</strong>.
      </p>
      <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 10px 0;">
        If you didn't request this code, please ignore this email.
      </p>
    `;

    return BaseEmailTemplate.getBaseHtml(content, {
      title: `${title} - Buykoins`,
      assetsBaseUrl,
    });
  }

  static getText(code: string, expiresInMinutes: number = 15): string {
    return `
BuyTikTokCoins - Email Verification

Thank you for signing up! Please verify your email address by entering the code below:

Verification Code: ${code}

This code will expire in ${expiresInMinutes} minutes.

If you didn't request this code, please ignore this email.

© ${new Date().getFullYear()} BuyTikTokCoins. All rights reserved.
    `.trim();
  }
}

