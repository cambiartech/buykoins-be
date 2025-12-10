import { IsOptional, IsString, MaxLength, IsEnum, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export enum CreditMethod {
  BALANCE = 'balance', // Credit user's balance on system
  DIRECT = 'direct', // Remit directly to user's bank account
}

export class ApproveCreditRequestDto {
  @ApiPropertyOptional({
    example: 'Approved after verification',
    description: 'Optional notes for approval',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({
    example: 'balance',
    enum: CreditMethod,
    description: 'How to credit the user: balance (update system balance) or direct (remit to bank account)',
    default: CreditMethod.BALANCE,
  })
  @IsOptional()
  @IsEnum(CreditMethod)
  creditMethod?: CreditMethod;

  @ApiPropertyOptional({
    example: 500.00,
    description: 'Amount to credit (if different from request amount)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;
}

