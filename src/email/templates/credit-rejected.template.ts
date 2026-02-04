/**
 * Credit Rejected Email Template
 * Sent when a credit request is rejected
 */

import { BaseEmailTemplate } from './base-email.template';

export class CreditRejectedEmailTemplate {
  static getHtml(reason: string, assetsBaseUrl?: string): string {
    const content = `
      <h2 style="color: #dc3545; margin-top: 0; font-size: 24px; font-weight: 600;">
        Credit Request Rejected
      </h2>
      <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 20px 0;">
        We're sorry, but your credit request has been rejected.
      </p>
      ${BaseEmailTemplate.getInfoBox(
        `<strong>Reason:</strong><br/>${reason}`,
        'error'
      )}
      <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 20px 0;">
        You can submit a new credit request with updated information.
      </p>
      <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 10px 0;">
        If you have any questions, please contact our support team.
      </p>
    `;

    return BaseEmailTemplate.getBaseHtml(content, {
      title: 'Credit Request Rejected - Buykoins',
      assetsBaseUrl,
    });
  }

  static getText(reason: string): string {
    return `
BuyTikTokCoins - Credit Request Rejected

We're sorry, but your credit request has been rejected.

Reason: ${reason}

You can submit a new credit request with updated information.

If you have any questions, please contact our support team.

© ${new Date().getFullYear()} BuyTikTokCoins. All rights reserved.
    `.trim();
  }
}

