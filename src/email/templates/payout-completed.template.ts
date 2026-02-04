/**
 * Payout Completed Email Template
 * Sent when a payout is completed
 */

import { BaseEmailTemplate } from './base-email.template';

export class PayoutCompletedEmailTemplate {
  static getHtml(amount: number, amountInNgn: number, transactionReference: string, assetsBaseUrl?: string): string {
    const content = `
      <h2 style="color: #28a745; margin-top: 0; font-size: 24px; font-weight: 600;">
        Payout Completed
      </h2>
      <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 20px 0;">
        Your withdrawal request has been processed and the funds have been transferred to your bank account.
      </p>
      ${BaseEmailTemplate.getAmountBox('Amount (USD)', `$${amount.toFixed(2)}`, 'USD')}
      ${BaseEmailTemplate.getAmountBox('Amount (NGN)', `₦${amountInNgn.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'NGN')}
      <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 4px; border-left: 4px solid #667eea;">
        <p style="margin: 0; font-size: 12px; color: #666; font-weight: 500;">Transaction Reference:</p>
        <p style="margin: 5px 0 0 0; font-size: 14px; font-family: 'Courier New', monospace; color: #333; word-break: break-all;">
          ${transactionReference}
        </p>
      </div>
      <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 20px 0;">
        The funds should appear in your bank account within 24-48 hours.
      </p>
    `;

    return BaseEmailTemplate.getBaseHtml(content, {
      title: 'Payout Completed - Buykoins',
      assetsBaseUrl,
    });
  }

  static getText(amount: number, amountInNgn: number, transactionReference: string): string {
    return `
BuyTikTokCoins - Payout Completed

Your withdrawal request has been processed and the funds have been transferred to your bank account.

Amount (USD): $${amount.toFixed(2)}
Amount (NGN): ₦${amountInNgn.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

Transaction Reference: ${transactionReference}

The funds should appear in your bank account within 24-48 hours.

© ${new Date().getFullYear()} BuyTikTokCoins. All rights reserved.
    `.trim();
  }
}

