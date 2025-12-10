import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsString, IsNumber, Min } from 'class-validator';

export class UpdatePaymentSettingsDto {
  @ApiProperty({
    example: true,
    description: 'Require bank account for payouts',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  bankAccountRequired?: boolean;

  @ApiProperty({
    example: true,
    description: 'Require verified bank account for payouts',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  requireVerifiedBankAccount?: boolean;

  @ApiProperty({
    example: '24-48 hours',
    description: 'Processing time description',
    required: false,
  })
  @IsOptional()
  @IsString()
  processingTime?: string;

  @ApiProperty({
    example: 2,
    description: 'Processing time in business days',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Processing time must be non-negative' })
  processingTimeBusinessDays?: number;
}

