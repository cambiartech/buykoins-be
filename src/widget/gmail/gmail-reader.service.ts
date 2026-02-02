import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Gmail Reader Service
 * 
 * This service reads PayPal auth codes from Gmail.
 * Two approaches:
 * 1. Google Apps Script webhook (recommended) - receives emails via webhook
 * 2. Gmail API (alternative) - directly reads from Gmail
 */
@Injectable()
export class GmailReaderService {
  private readonly logger = new Logger(GmailReaderService.name);
  private readonly gmailEmail: string;
  private readonly webhookUrl?: string;

  constructor(private configService: ConfigService) {
    this.gmailEmail = this.configService.get<string>('GMAIL_EMAIL') || '';
    this.webhookUrl = this.configService.get<string>('GMAIL_WEBHOOK_URL');
  }

  /**
   * Extract auth code from email content
   * PayPal emails typically contain codes like "Your code is: 123456"
   */
  extractAuthCodeFromEmail(emailBody: string): string | null {
    // Common patterns for PayPal auth codes
    const patterns = [
      /(?:code|verification code|auth code|security code)[\s:]*(\d{4,8})/i,
      /(\d{4,8})[\s]*(?:is your|is the|code)/i,
      /(?:enter|use|code)[\s:]*(\d{6})/i,
      /(\d{6})/g, // Fallback: any 6-digit number
    ];

    for (const pattern of patterns) {
      const match = emailBody.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Process incoming email from Google Apps Script webhook
   * This is called when Google Apps Script sends email data via webhook
   */
  async processIncomingEmail(emailData: {
    from: string;
    subject: string;
    body: string;
    receivedAt: Date;
  }): Promise<{ authCode: string | null; userId?: string } | null> {
    // Check if email is from PayPal
    const isPayPalEmail = 
      emailData.from.toLowerCase().includes('paypal') ||
      emailData.subject.toLowerCase().includes('paypal') ||
      emailData.subject.toLowerCase().includes('verification') ||
      emailData.subject.toLowerCase().includes('code');

    if (!isPayPalEmail) {
      return null;
    }

    // Extract auth code
    const authCode = this.extractAuthCodeFromEmail(emailData.body);
    
    if (!authCode) {
      this.logger.warn(`Could not extract auth code from PayPal email: ${emailData.subject}`);
      return null;
    }

    this.logger.log(`Extracted PayPal auth code from email: ${authCode}`);

    return {
      authCode,
      // userId can be extracted from email body if PayPal includes user info
    };
  }

  /**
   * Get latest PayPal auth code from Gmail
   * This can be called manually by admin or via scheduled job
   */
  async getLatestPayPalAuthCode(): Promise<string | null> {
    // Option 1: If using Google Apps Script webhook, codes are already processed
    // Option 2: If using Gmail API, implement here
    // For now, this is a placeholder - implement based on chosen approach
    
    this.logger.log('Getting latest PayPal auth code from Gmail...');
    
    // TODO: Implement Gmail API integration or webhook handler
    return null;
  }
}

