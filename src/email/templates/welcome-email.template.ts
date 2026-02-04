/**
 * Welcome Email Template
 * Sent when a user completes onboarding
 */

import { BaseEmailTemplate } from './base-email.template';

export class WelcomeEmailTemplate {
  static getHtml(
    firstName: string,
    assetsBaseUrl?: string,
  ): string {
    const content = `
      <h2 style="color: #333; margin-top: 0; font-size: 28px; font-weight: 600; text-align: center;">
        Welcome to Buykoins, ${firstName}!
      </h2>
      <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 20px 0; text-align: center;">
        You're all set and ready to start maximizing your creator earnings!
      </p>
      
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; margin: 30px 0; border-radius: 12px; text-align: center;">
        <h3 style="color: #ffffff; font-size: 20px; font-weight: 600; margin: 0 0 15px 0;">
          Here's how it works
        </h3>
        <p style="color: #ffffff; font-size: 14px; line-height: 1.6; margin: 0; opacity: 0.95;">
          Submit your TikTok coins transactions → Get credited in USD → Request instant payouts to your bank account
        </p>
      </div>

      <div style="margin: 30px 0;">
        <h3 style="color: #333; font-size: 18px; font-weight: 600; margin: 0 0 20px 0;">
          What you can do now:
        </h3>
        
        <div style="margin: 20px 0;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 15px; background-color: #f8f9fa; border-radius: 8px; margin-bottom: 10px;">
                <div>
                  <strong style="color: #333; font-size: 16px; display: block; margin-bottom: 5px;">Submit Credit Requests</strong>
                    <p style="color: #666; font-size: 14px; margin: 0; line-height: 1.5;">
                      Upload proof of your TikTok coins transactions and get credited in USD
                    </p>
                  </div>
                </div>
              </td>
            </tr>
          </table>
        </div>

        <div style="margin: 20px 0;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
                <div>
                  <strong style="color: #333; font-size: 16px; display: block; margin-bottom: 5px;">Request Payouts</strong>
                    <p style="color: #666; font-size: 14px; margin: 0; line-height: 1.5;">
                      Withdraw your earnings directly to your verified bank account
                    </p>
                  </div>
                </div>
              </td>
            </tr>
          </table>
        </div>

        <div style="margin: 20px 0;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
                <div>
                  <strong style="color: #333; font-size: 16px; display: block; margin-bottom: 5px;">Track Your Earnings</strong>
                    <p style="color: #666; font-size: 14px; margin: 0; line-height: 1.5;">
                      View your transaction history and monitor your balance in real-time
                    </p>
                  </div>
                </div>
              </td>
            </tr>
          </table>
        </div>
      </div>

      <div style="background-color: #e8f4f8; padding: 20px; margin: 30px 0; border-radius: 8px; border-left: 4px solid #17a2b8;">
        <p style="margin: 0; color: #0c5460; font-size: 14px; line-height: 1.6;">
          <strong>Pro Tip:</strong> Keep your transaction proofs organized and submit them regularly to maintain a steady cash flow!
        </p>
      </div>

      <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 30px 0 20px 0; text-align: center;">
        Need help? Our support team is here for you!
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://buykoins.com/dashboard" style="display: inline-block; padding: 15px 40px; background-color: #667eea; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
          Go to Dashboard
        </a>
      </div>
    `;

    return BaseEmailTemplate.getBaseHtml(content, {
      title: 'Welcome to Buykoins',
      assetsBaseUrl,
    });
  }

  static getText(firstName: string): string {
    return `
Welcome to Buykoins, ${firstName}!

You're all set and ready to start maximizing your creator earnings!

Here's how it works:
Submit your TikTok coins transactions → Get credited in USD → Request instant payouts to your bank account

What you can do now:

Submit Credit Requests
Upload proof of your TikTok coins transactions and get credited in USD

Request Payouts
Withdraw your earnings directly to your verified bank account

Track Your Earnings
View your transaction history and monitor your balance in real-time

Pro Tip: Keep your transaction proofs organized and submit them regularly to maintain a steady cash flow!

Need help? Our support team is here for you!

Visit your dashboard: https://buykoins.com/dashboard

© ${new Date().getFullYear()} Buykoins. All rights reserved.
    `.trim();
  }
}
