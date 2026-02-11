import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEnum, IsArray, IsUUID, MaxLength, ArrayMaxSize } from 'class-validator';

export type MessageFormat = 'plain' | 'html';
export type BroadcastAudience = 'all' | 'active' | 'onboarded';

export class BroadcastAnnouncementDto {
  @ApiProperty({ example: 'Platform update', description: 'Notification title' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({
    example: 'We have updated our payout schedule. Check your dashboard for details.',
    description: 'Notification body. May be plain text or HTML when messageFormat is "html" (e.g. from rich text editors).',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  message: string;

  @ApiPropertyOptional({
    enum: ['plain', 'html'],
    default: 'plain',
    description: 'How to interpret and render "message": plain text or HTML (e.g. from WYSIWYG/editor). Clients should render HTML only when this is "html" and sanitize on their side.',
  })
  @IsOptional()
  @IsEnum(['plain', 'html'])
  messageFormat?: MessageFormat;

  @ApiPropertyOptional({
    description: 'Send only to these user IDs. When provided, "audience" is ignored. Use either userIds or audience, not both.',
    example: ['uuid-1', 'uuid-2'],
    type: [String],
    maxItems: 5000,
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(5000)
  userIds?: string[];

  @ApiPropertyOptional({
    enum: ['all', 'active', 'onboarded'],
    default: 'all',
    description: 'When userIds is not set: "all" = every user; "active" = users with status active; "onboarded" = users with onboarding completed.',
  })
  @IsOptional()
  @IsEnum(['all', 'active', 'onboarded'])
  audience?: BroadcastAudience;
}
