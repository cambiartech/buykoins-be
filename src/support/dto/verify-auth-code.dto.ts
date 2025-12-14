import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class VerifyAuthCodeDto {
  @ApiProperty({
    example: '123456',
    description: '6-digit auth code',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

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
}

