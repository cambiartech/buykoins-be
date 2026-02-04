/**
 * Credit Approved Email Template
 * Sent when a credit request is approved
 */

import { BaseEmailTemplate } from './base-email.template';

export class CreditApprovedEmailTemplate {
  static getHtml(amount: number, balance: number, assetsBaseUrl?: string): string {
    const content = `
      <h2 style="color: #28a745; margin-top: 0; font-size: 24px; font-weight: 600;">
        Credit Request Approved
      </h2>
      <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 20px 0;">
        Great news! Your credit request has been approved and your account has been credited.
      </p>
      ${BaseEmailTemplate.getAmountBox('Amount Credited', `$${amount.toFixed(2)}`, 'USD')}
      ${BaseEmailTemplate.getAmountBox('New Balance', `$${balance.toFixed(2)}`, 'USD')}
      <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 20px 0;">
        You can now request a withdrawal to your bank account.
      </p>
    `;

    return BaseEmailTemplate.getBaseHtml(content, {
      title: 'Credit Approved - Buykoins',
      assetsBaseUrl,
    });
  }

  static getText(amount: number, balance: number): string {
    return `
BuyTikTokCoins - Credit Request Approved

Great news! Your credit request has been approved and your account has been credited.

Amount Credited: $${amount.toFixed(2)} USD
New Balance: $${balance.toFixed(2)} USD

You can now request a withdrawal to your bank account.

© ${new Date().getFullYear()} BuyTikTokCoins. All rights reserved.
    `.trim();
  }
}

