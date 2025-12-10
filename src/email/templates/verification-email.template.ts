/**
 * Email Verification Template
 * Used for sending verification codes to users
 */

export class VerificationEmailTemplate {
  static getHtml(code: string, expiresInMinutes: number = 15): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification - BuyTikTokCoins</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">BuyTikTokCoins</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Email Verification</h2>
          <p>Thank you for signing up! Please verify your email address by entering the code below:</p>
          <div style="background-color: #ffffff; padding: 30px; text-align: center; font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 30px 0; border: 2px dashed #667eea; border-radius: 8px;">
            ${code}
          </div>
          <p style="color: #666; font-size: 14px;">This code will expire in <strong>${expiresInMinutes} minutes</strong>.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
            © ${new Date().getFullYear()} BuyTikTokCoins. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `;
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

