import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ConversationType } from '../entities/support-conversation.entity';

export class CreateConversationDto {
  @ApiProperty({
    enum: ConversationType,
    example: ConversationType.GENERAL,
    description: 'Type of conversation',
    required: false,
  })
  @IsOptional()
  @IsEnum(ConversationType)
  type?: ConversationType;

  @ApiProperty({
    example: 'Need help with onboarding',
    description: 'Subject of the conversation',
    required: false,
  })
  @IsOptional()
  @IsString()
  subject?: string;
}

