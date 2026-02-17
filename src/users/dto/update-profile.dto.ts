import { IsOptional, IsString, IsEmail, IsPhoneNumber, MinLength, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** Placeholder email we assign to TikTok-only sign-ups (no email from TikTok Login Kit). */
export const TIKTOK_PLACEHOLDER_EMAIL_DOMAIN = '@users.buykoins.com';

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith(TIKTOK_PLACEHOLDER_EMAIL_DOMAIN);
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'user@example.com', description: 'For TikTok sign-up users only: set a real email once (for notifications and account recovery).' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsPhoneNumber(undefined, { message: 'Please provide a valid phone number' })
  phone?: string;
}

