/**
 * Credit Rejected Email Template
 * Sent when a credit request is rejected
 */

export class CreditRejectedEmailTemplate {
  static getHtml(reason: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Credit Request Rejected - BuyTikTokCoins</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">BuyTikTokCoins</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #dc3545; margin-top: 0;">❌ Credit Request Rejected</h2>
          <p>We're sorry, but your credit request has been rejected.</p>
          <div style="background-color: #fff3cd; padding: 20px; margin: 20px 0; border-left: 4px solid #dc3545; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #666; font-weight: bold;">Reason:</p>
            <p style="margin: 10px 0 0 0; color: #333;">${reason}</p>
          </div>
          <p>You can submit a new credit request with updated information.</p>
          <p style="color: #666; font-size: 14px;">If you have any questions, please contact our support team.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
            © ${new Date().getFullYear()} BuyTikTokCoins. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `;
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

