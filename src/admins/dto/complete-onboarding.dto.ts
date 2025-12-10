import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteOnboardingDto {
  @ApiProperty({
    example: 'Bank: First Bank, Account: 1234567890, PayPal: user@example.com. Payment method set up on device. Meeting scheduled for 2024-01-25.',
    description: 'Onboarding notes including bank account, PayPal, and setup details',
    minLength: 10,
  })
  @IsNotEmpty({ message: 'Onboarding notes are required' })
  @IsString()
  @MinLength(10, { message: 'Onboarding notes must be at least 10 characters' })
  notes: string;
}

