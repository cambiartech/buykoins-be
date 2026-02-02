import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateWidgetSettingsDto {
  @ApiProperty({
    example: false,
    description: 'Enable automatic withdrawals (for future Paystack integration)',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  automaticWithdrawalsEnabled?: boolean;

  @ApiProperty({
    example: 'platform@paypal.com',
    description: 'PayPal email address for onboarding',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  paypalEmail?: string;

  @ApiProperty({
    example: false,
    description: 'Enable automatic onboarding via Google Apps Script',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  automaticOnboardingEnabled?: boolean;

  @ApiProperty({
    example: 'https://your-api.com/api/gmail/webhook',
    description: 'Gmail webhook URL for Google Apps Script',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  gmailWebhookUrl?: string;
}

