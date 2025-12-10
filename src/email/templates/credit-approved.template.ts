/**
 * Credit Approved Email Template
 * Sent when a credit request is approved
 */

export class CreditApprovedEmailTemplate {
  static getHtml(amount: number, balance: number): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Credit Approved - BuyTikTokCoins</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">BuyTikTokCoins</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #28a745; margin-top: 0;">✅ Credit Request Approved</h2>
          <p>Great news! Your credit request has been approved and your account has been credited.</p>
          <div style="background-color: #ffffff; padding: 20px; margin: 20px 0; border-left: 4px solid #28a745; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #666;">Amount Credited:</p>
            <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #28a745;">$${amount.toFixed(2)} USD</p>
          </div>
          <div style="background-color: #ffffff; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #666;">New Balance:</p>
            <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #667eea;">$${balance.toFixed(2)} USD</p>
          </div>
          <p>You can now request a withdrawal to your bank account.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
            © ${new Date().getFullYear()} BuyTikTokCoins. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `;
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

