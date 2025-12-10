import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
} from '@aws-sdk/client-ses';
import { VerificationEmailTemplate } from './templates/verification-email.template';

@Injectable()
export class EmailService {
  private sesClient: SESClient;
  private fromEmail: string;

  constructor(private configService: ConfigService) {
    const awsConfig = this.configService.get('aws');
    this.fromEmail = awsConfig.ses.fromEmail;

    this.sesClient = new SESClient({
      region: awsConfig.region,
      credentials: {
        accessKeyId: awsConfig.accessKeyId,
        secretAccessKey: awsConfig.secretAccessKey,
      },
    });
  }

  async sendEmail(
    to: string | string[],
    subject: string,
    htmlBody: string,
    textBody?: string,
  ): Promise<void> {
    const recipients = Array.isArray(to) ? to : [to];

    const params: SendEmailCommandInput = {
      Source: this.fromEmail,
      Destination: {
        ToAddresses: recipients,
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8',
          },
          ...(textBody && {
            Text: {
              Data: textBody,
              Charset: 'UTF-8',
            },
          }),
        },
      },
    };

    try {
      const command = new SendEmailCommand(params);
      await this.sesClient.send(command);
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    // For development: console log instead of sending email
    if (!this.configService.get('aws.accessKeyId') || !this.configService.get('aws.secretAccessKey')) {
      console.log('\n📧 ============================================');
      console.log('📧 VERIFICATION CODE (Development Mode)');
      console.log('📧 ============================================');
      console.log(`📧 Email: ${email}`);
      console.log(`📧 Verification Code: ${code}`);
      console.log(`📧 Expires in: 15 minutes`);
      console.log('📧 ============================================\n');
      return;
    }

    // Production: Send actual email
    const subject = 'Verify Your Email - BuyTikTokCoins';
    const htmlBody = VerificationEmailTemplate.getHtml(code);
    const textBody = VerificationEmailTemplate.getText(code);

    await this.sendEmail(email, subject, htmlBody, textBody);
  }

  /**
   * Send bank account verification code
   */
  async sendBankAccountVerificationCode(email: string, code: string) {
    const isDevelopment =
      this.configService.get<string>('app.nodeEnv') !== 'production';

    if (isDevelopment) {
      // Development: Console log the code
      console.log('\n==========================================');
      console.log('🏦 BANK ACCOUNT VERIFICATION CODE (Development Mode)');
      console.log('==========================================');
      console.log(`📧 Email: ${email}`);
      console.log(`🔑 Verification Code: ${code}`);
      console.log(`⏰ Expires in: 15 minutes`);
      console.log('==========================================\n');
      return;
    }

    // Production: Send actual email
    const subject = 'Verify Your Bank Account - BuyTikTokCoins';
    const htmlBody = `
      <h2>Bank Account Verification</h2>
      <p>Your verification code is: <strong>${code}</strong></p>
      <p>This code will expire in 15 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `;
    const textBody = `Your bank account verification code is: ${code}. This code will expire in 15 minutes.`;

    await this.sendEmail(email, subject, htmlBody, textBody);
  }

  /**
   * Send admin password change OTP
   */
  async sendAdminPasswordChangeOtp(email: string, code: string) {
    const isDevelopment =
      this.configService.get<string>('app.nodeEnv') !== 'production';

    if (isDevelopment) {
      // Development: Console log the code
      console.log('\n==========================================');
      console.log('🔐 ADMIN PASSWORD CHANGE OTP (Development Mode)');
      console.log('==========================================');
      console.log(`📧 Email: ${email}`);
      console.log(`🔑 OTP: ${code}`);
      console.log(`⏰ Expires in: 15 minutes`);
      console.log('==========================================\n');
      return;
    }

    // Production: Send actual email
    const subject = 'Password Change Verification - BuyTikTokCoins Admin';
    const htmlBody = `
      <h2>Password Change Verification</h2>
      <p>You requested to change your admin password.</p>
      <p>Your verification code is: <strong>${code}</strong></p>
      <p>This code will expire in 15 minutes.</p>
      <p>If you didn't request this, please contact support immediately.</p>
    `;
    const textBody = `You requested to change your admin password. Your verification code is: ${code}. This code will expire in 15 minutes. If you didn't request this, please contact support immediately.`;

    await this.sendEmail(email, subject, htmlBody, textBody);
  }
}

