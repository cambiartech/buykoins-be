import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { MessageType } from '../entities/support-message.entity';

export class SendMessageDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Conversation ID',
  })
  @IsUUID()
  @IsNotEmpty()
  conversationId: string;

  @ApiProperty({
    example: 'Hello, I need help with my account',
    description: 'Message content',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    enum: MessageType,
    example: MessageType.TEXT,
    description: 'Type of message',
    required: false,
  })
  @IsOptional()
  @IsEnum(MessageType)
  messageType?: MessageType;
}

