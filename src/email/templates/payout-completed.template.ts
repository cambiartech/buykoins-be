/**
 * Payout Completed Email Template
 * Sent when a payout is completed
 */

export class PayoutCompletedEmailTemplate {
  static getHtml(amount: number, amountInNgn: number, transactionReference: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payout Completed - BuyTikTokCoins</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">BuyTikTokCoins</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #28a745; margin-top: 0;">✅ Payout Completed</h2>
          <p>Your withdrawal request has been processed and the funds have been transferred to your bank account.</p>
          <div style="background-color: #ffffff; padding: 20px; margin: 20px 0; border-left: 4px solid #28a745; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #666;">Amount (USD):</p>
            <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #28a745;">$${amount.toFixed(2)} USD</p>
            <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Amount (NGN):</p>
            <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: #667eea;">₦${amountInNgn.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NGN</p>
          </div>
          <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 12px; color: #666;">Transaction Reference:</p>
            <p style="margin: 5px 0 0 0; font-size: 14px; font-family: monospace; color: #333;">${transactionReference}</p>
          </div>
          <p style="color: #666; font-size: 14px;">The funds should appear in your bank account within 24-48 hours.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
            © ${new Date().getFullYear()} BuyTikTokCoins. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `;
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

