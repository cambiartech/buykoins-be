import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as postmark from 'postmark';
import { VerificationEmailTemplate } from './templates/verification-email.template';
import { WelcomeEmailTemplate } from './templates/welcome-email.template';
import { CreditApprovedEmailTemplate } from './templates/credit-approved.template';
import { CreditRejectedEmailTemplate } from './templates/credit-rejected.template';
import { PayoutCompletedEmailTemplate } from './templates/payout-completed.template';

@Injectable()
export class EmailService {
  private postmarkClient: postmark.ServerClient;
  private fromEmail: string;
  private fromName: string;
  private replyTo?: string;

  constructor(private configService: ConfigService) {
    const postmarkConfig = this.configService.get('postmark');
    const apiKey = postmarkConfig?.apiKey || postmarkConfig?.serverToken;

    this.fromEmail = postmarkConfig?.fromEmail || 'noreply@buykoins.com';
    this.fromName = postmarkConfig?.fromName || 'Buykoins';
    this.replyTo = postmarkConfig?.replyTo;

    // Initialize Postmark client if API key is provided
    if (apiKey) {
      this.postmarkClient = new postmark.ServerClient(apiKey);
    }
  }

  async sendEmail(
    to: string | string[],
    subject: string,
    htmlBody: string,
    textBody?: string,
  ): Promise<void> {
    const recipients = Array.isArray(to) ? to : [to];

    // Development mode: log email instead of sending
    if (!this.postmarkClient) {
      console.log('\n📧 ============================================');
      console.log('📧 EMAIL (Development Mode - Postmark not configured)');
      console.log('📧 ============================================');
      console.log(`📧 To: ${recipients.join(', ')}`);
      console.log(`📧 Subject: ${subject}`);
      console.log(`📧 HTML Body Length: ${htmlBody.length} chars`);
      if (textBody) {
        console.log(`📧 Text Body Length: ${textBody.length} chars`);
      }
      console.log('📧 ============================================\n');
      return;
    }

    try {
      // Send to all recipients
      const emailPromises = recipients.map((recipient) => {
        const email: postmark.Models.Message = {
          From: `${this.fromName} <${this.fromEmail}>`,
          To: recipient,
          Subject: subject,
          HtmlBody: htmlBody,
          ...(textBody && { TextBody: textBody }),
          ...(this.replyTo && { ReplyTo: this.replyTo }),
          MessageStream: 'outbound', // Default transactional stream
        };

        return this.postmarkClient.sendEmail(email);
      });

      await Promise.all(emailPromises);
    } catch (error) {
      console.error('Error sending email via Postmark:', error);
      throw error;
    }
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    const subject = 'Verify Your Email - Buykoins';
    const assetsBaseUrl = this.configService.get('postmark.assetsBaseUrl') || 
                         this.configService.get('aws.r2.publicUrl') || 
                         'https://storage.buykoins.com';
    
    const htmlBody = VerificationEmailTemplate.getHtml(code, 15, assetsBaseUrl);
    const textBody = VerificationEmailTemplate.getText(code, 15);

    await this.sendEmail(email, subject, htmlBody, textBody);
  }

  /**
   * Send bank account verification code
   */
  async sendBankAccountVerificationCode(email: string, code: string) {
    const subject = 'Verify Your Bank Account - Buykoins';
    const assetsBaseUrl = this.configService.get('postmark.assetsBaseUrl') || 
                         this.configService.get('aws.r2.publicUrl') || 
                         'https://storage.buykoins.com';
    
    const htmlBody = VerificationEmailTemplate.getHtml(code, 15, assetsBaseUrl, 'Bank Account Verification');
    const textBody = `Your bank account verification code is: ${code}. This code will expire in 15 minutes.`;

    await this.sendEmail(email, subject, htmlBody, textBody);
  }

  /**
   * Send admin password change OTP
   */
  async sendAdminPasswordChangeOtp(email: string, code: string) {
    const subject = 'Password Change Verification - Buykoins Admin';
    const assetsBaseUrl = this.configService.get('postmark.assetsBaseUrl') || 
                         this.configService.get('aws.r2.publicUrl') || 
                         'https://storage.buykoins.com';
    
    const htmlBody = VerificationEmailTemplate.getHtml(code, 15, assetsBaseUrl, 'Password Change Verification');
    const textBody = `You requested to change your admin password. Your verification code is: ${code}. This code will expire in 15 minutes. If you didn't request this, please contact support immediately.`;

    await this.sendEmail(email, subject, htmlBody, textBody);
  }

  /**
   * Send welcome email after onboarding completion
   */
  async sendWelcomeEmail(email: string, firstName: string) {
    const subject = 'Welcome to Buykoins - You\'re All Set! 🎉';
    const assetsBaseUrl = this.configService.get('postmark.assetsBaseUrl') || 
                         this.configService.get('aws.r2.publicUrl') || 
                         'https://storage.buykoins.com';
    
    const htmlBody = WelcomeEmailTemplate.getHtml(firstName, assetsBaseUrl);
    const textBody = WelcomeEmailTemplate.getText(firstName);

    await this.sendEmail(email, subject, htmlBody, textBody);
  }

  /**
   * Send credit approved email
   */
  async sendCreditApprovedEmail(email: string, amount: number, balance: number) {
    const subject = 'Credit Request Approved - Buykoins';
    const assetsBaseUrl = this.configService.get('postmark.assetsBaseUrl') || 
                         this.configService.get('aws.r2.publicUrl') || 
                         'https://storage.buykoins.com';
    
    const htmlBody = CreditApprovedEmailTemplate.getHtml(amount, balance, assetsBaseUrl);
    const textBody = CreditApprovedEmailTemplate.getText(amount, balance);

    await this.sendEmail(email, subject, htmlBody, textBody);
  }

  /**
   * Send credit rejected email
   */
  async sendCreditRejectedEmail(email: string, reason: string) {
    const subject = 'Credit Request Update - Buykoins';
    const assetsBaseUrl = this.configService.get('postmark.assetsBaseUrl') || 
                         this.configService.get('aws.r2.publicUrl') || 
                         'https://storage.buykoins.com';
    
    const htmlBody = CreditRejectedEmailTemplate.getHtml(reason, assetsBaseUrl);
    const textBody = CreditRejectedEmailTemplate.getText(reason);

    await this.sendEmail(email, subject, htmlBody, textBody);
  }

  /**
   * Send payout completed email
   */
  async sendPayoutCompletedEmail(
    email: string,
    amount: number,
    amountInNgn: number,
    transactionReference: string,
  ) {
    const subject = 'Payout Completed - Buykoins';
    const assetsBaseUrl = this.configService.get('postmark.assetsBaseUrl') || 
                         this.configService.get('aws.r2.publicUrl') || 
                         'https://storage.buykoins.com';
    
    const htmlBody = PayoutCompletedEmailTemplate.getHtml(
      amount,
      amountInNgn,
      transactionReference,
      assetsBaseUrl,
    );
    const textBody = PayoutCompletedEmailTemplate.getText(amount, amountInNgn, transactionReference);

    await this.sendEmail(email, subject, htmlBody, textBody);
  }
}

