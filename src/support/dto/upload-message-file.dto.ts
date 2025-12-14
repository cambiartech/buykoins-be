import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UploadMessageFileDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Conversation ID',
  })
  @IsUUID()
  @IsNotEmpty()
  conversationId: string;

  @ApiProperty({
    example: 'Optional message text to accompany the image',
    description: 'Message text (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  message?: string;
}

