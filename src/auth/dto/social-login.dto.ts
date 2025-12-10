import { IsEmail, IsString, IsIn, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SocialLoginDto {
  @ApiProperty({ example: 'google', enum: ['google', 'tiktok'] })
  @IsString()
  @IsIn(['google', 'tiktok'], { message: 'Provider must be either google or tiktok' })
  provider: 'google' | 'tiktok';

  @ApiProperty({ example: 'oauth_access_token_here' })
  @IsString()
  accessToken: string;

  @ApiProperty({ example: 'user@example.com', required: false })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;
}

