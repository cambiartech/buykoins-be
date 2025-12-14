import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class GenerateAuthCodeDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'User ID (if authenticated)',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({
    example: 'guest_1234567890_abc123',
    description: 'Guest ID (if anonymous)',
    required: false,
  })
  @IsOptional()
  @IsString()
  guestId?: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Conversation ID',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @ApiProperty({
    example: '{"device": "iPhone", "os": "iOS 17"}',
    description: 'Device information (JSON string)',
    required: false,
  })
  @IsOptional()
  @IsString()
  deviceInfo?: string;
}

