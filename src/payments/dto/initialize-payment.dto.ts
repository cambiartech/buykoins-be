import { IsEmail, IsNumber, Min, IsOptional, IsString, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InitializePaymentDto {
  @ApiProperty({
    description: 'Amount to deposit in NGN (in kobo, e.g., 100000 for 1000 NGN)',
    example: 100000,
    minimum: 100, // Minimum 1 NGN
  })
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(100, { message: 'Minimum deposit is 1 NGN (100 kobo)' })
  amount: number;

  @ApiPropertyOptional({
    description: 'Callback URL after payment (optional)',
    example: 'https://yourapp.com/payment/callback',
  })
  @IsOptional()
  @IsString()
  callbackUrl?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
