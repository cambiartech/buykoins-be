import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min } from 'class-validator';

export class UpdateBusinessRulesSettingsDto {
  @ApiProperty({
    example: 10.00,
    description: 'Minimum credit request amount',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Minimum credit request amount must be non-negative' })
  minCreditRequestAmount?: number;

  @ApiProperty({
    example: 10000.00,
    description: 'Maximum credit request amount',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Maximum credit request amount must be non-negative' })
  maxCreditRequestAmount?: number;

  @ApiProperty({
    example: 24,
    description: 'Cooldown hours between credit requests',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Credit request cooldown must be non-negative' })
  creditRequestCooldownHours?: number;

  @ApiProperty({
    example: 24,
    description: 'Cooldown hours between payout requests',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Payout request cooldown must be non-negative' })
  payoutRequestCooldownHours?: number;

  @ApiProperty({
    example: 1,
    description: 'Maximum active credit requests per user',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Max active credit requests must be at least 1' })
  maxActiveCreditRequests?: number;

  @ApiProperty({
    example: 1,
    description: 'Maximum active payout requests per user',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Max active payout requests must be at least 1' })
  maxActivePayoutRequests?: number;
}

