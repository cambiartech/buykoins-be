import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, Length } from 'class-validator';

export class UpdateAdminPasswordDto {
  @ApiProperty({
    example: 'NewSecurePassword123!',
    description: 'New password (min 8 characters)',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @IsNotEmpty({ message: 'Password is required' })
  password: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit OTP verification code sent to email',
  })
  @IsNotEmpty({ message: 'Verification code is required' })
  @IsString()
  @Length(6, 6, { message: 'Verification code must be 6 digits' })
  verificationCode: string;
}

