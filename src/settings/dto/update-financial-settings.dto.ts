import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsNumber,
  IsEnum,
  Min,
  Max,
  ValidateIf,
  Validate,
} from 'class-validator';

export class UpdateFinancialSettingsDto {
  @ApiProperty({
    example: 1500.00,
    description: 'Exchange rate from USD to NGN',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Exchange rate must be positive' })
  exchangeRateUsdToNgn?: number;

  @ApiProperty({
    example: 50.00,
    description: 'Processing fee amount (if type is fixed)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Processing fee must be non-negative' })
  processingFee?: number;

  @ApiProperty({
    enum: ['fixed', 'percentage'],
    example: 'fixed',
    description: 'Processing fee type',
    required: false,
  })
  @IsOptional()
  @IsEnum(['fixed', 'percentage'])
  processingFeeType?: 'fixed' | 'percentage';

  @ApiProperty({
    example: 0.5,
    description: 'Processing fee percentage (if type is percentage)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Processing fee percentage must be non-negative' })
  @Max(100, { message: 'Processing fee percentage cannot exceed 100%' })
  processingFeePercentage?: number;

  @ApiProperty({
    example: 1000.00,
    description: 'Minimum payout amount',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Minimum payout must be non-negative' })
  minPayout?: number;

  @ApiProperty({
    example: 1000000.00,
    description: 'Maximum payout amount',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Maximum payout must be non-negative' })
  @ValidateIf((o) => o.minPayout !== undefined)
  @Validate((value, args) => {
    const obj = args.object as UpdateFinancialSettingsDto;
    return !obj.minPayout || value > obj.minPayout;
  }, {
    message: 'Maximum payout must be greater than minimum payout',
  })
  maxPayout?: number;

  @ApiProperty({
    example: 50000.00,
    description: 'Daily payout limit per user',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Daily payout limit must be non-negative' })
  dailyPayoutLimit?: number;

  @ApiProperty({
    example: 500000.00,
    description: 'Monthly payout limit per user',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Monthly payout limit must be non-negative' })
  monthlyPayoutLimit?: number;
}

