import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdatePlatformInfoSettingsDto {
  @ApiProperty({
    example: 'BuyTikTokCoins',
    description: 'Platform name',
    required: false,
  })
  @IsOptional()
  @IsString()
  platformName?: string;

  @ApiProperty({
    example: 'support@buytiktokcoins.com',
    description: 'Support email address',
    required: false,
  })
  @IsOptional()
  @IsString()
  supportEmail?: string;

  @ApiProperty({
    example: '+2348080957681',
    description: 'Support phone number',
    required: false,
  })
  @IsOptional()
  @IsString()
  supportPhone?: string;

  @ApiProperty({
    example: 'https://buytiktokcoins.com/terms',
    description: 'Terms of service URL',
    required: false,
  })
  @IsOptional()
  @IsUrl({}, { message: 'Terms of service URL must be a valid URL' })
  termsOfServiceUrl?: string;

  @ApiProperty({
    example: 'https://buytiktokcoins.com/privacy',
    description: 'Privacy policy URL',
    required: false,
  })
  @IsOptional()
  @IsUrl({}, { message: 'Privacy policy URL must be a valid URL' })
  privacyPolicyUrl?: string;
}

