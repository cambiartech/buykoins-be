/**
 * Base Email Template
 * Provides consistent branding and layout for all emails
 */

export class BaseEmailTemplate {
  /**
   * Get the base HTML structure with branding
   */
  static getBaseHtml(
    content: string,
    options: {
      title?: string;
      assetsBaseUrl?: string;
      logoUrl?: string;
      patternUrl?: string;
    } = {},
  ): string {
    const {
      title = 'Buykoins',
      assetsBaseUrl = process.env.EMAIL_ASSETS_BASE_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL || 'https://storage.buykoins.com',
      logoUrl = `${assetsBaseUrl}/email-assets/logo-white.png`,
      patternUrl = `${assetsBaseUrl}/email-assets/pattern.png`,
    } = options;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5; padding: 20px;">
          <tr>
            <td align="center" style="padding: 20px 0;">
              <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header with Pattern Background -->
                <tr>
                  <td style="background-image: url('${patternUrl}'); background-size: cover; background-position: center; background-repeat: no-repeat; padding: 40px 30px; text-align: center;">
                    <img src="${logoUrl}" alt="Buykoins" style="max-width: 200px; height: auto; display: block; margin: 0 auto;" />
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px; background-color: #ffffff;">
                    ${content}
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding: 30px; background-color: #f9f9f9; text-align: center; border-top: 1px solid #eeeeee;">
                    <p style="margin: 0; color: #999999; font-size: 12px; line-height: 1.6;">
                      © ${new Date().getFullYear()} Buykoins. All rights reserved.<br/>
                      <a href="https://buykoins.com" style="color: #667eea; text-decoration: none;">buykoins.com</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  /**
   * Get a styled code box for verification codes
   */
  static getCodeBox(code: string): string {
    return `
      <div style="background-color: #f8f9fa; padding: 30px; text-align: center; margin: 30px 0; border-radius: 8px; border: 2px solid #e9ecef;">
        <p style="margin: 0; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #333; font-family: 'Courier New', monospace;">
          ${code}
        </p>
      </div>
    `;
  }

  /**
   * Get a styled info box
   */
  static getInfoBox(content: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): string {
    const colors = {
      success: { bg: '#d4edda', border: '#28a745', text: '#155724' },
      error: { bg: '#f8d7da', border: '#dc3545', text: '#721c24' },
      warning: { bg: '#fff3cd', border: '#ffc107', text: '#856404' },
      info: { bg: '#d1ecf1', border: '#17a2b8', text: '#0c5460' },
    };

    const color = colors[type];

    return `
      <div style="background-color: ${color.bg}; padding: 20px; margin: 20px 0; border-left: 4px solid ${color.border}; border-radius: 4px;">
        <p style="margin: 0; color: ${color.text}; font-size: 14px; line-height: 1.6;">
          ${content}
        </p>
      </div>
    `;
  }

  /**
   * Get a styled amount display box
   */
  static getAmountBox(label: string, amount: string, currency: string = 'USD'): string {
    return `
      <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea; border-radius: 4px;">
        <p style="margin: 0; font-size: 14px; color: #666666; font-weight: 500;">${label}:</p>
        <p style="margin: 10px 0 0 0; font-size: 28px; font-weight: bold; color: #667eea;">
          ${amount} ${currency}
        </p>
      </div>
    `;
  }
}
