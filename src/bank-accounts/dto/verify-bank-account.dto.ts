import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyBankAccountDto {
  @ApiProperty({
    example: '123456',
    description: '6-digit OTP verification code',
  })
  @IsNotEmpty({ message: 'Verification code is required' })
  @IsString()
  @Length(6, 6, { message: 'Verification code must be 6 digits' })
  verificationCode: string;
}


