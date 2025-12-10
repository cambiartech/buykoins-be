import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ProcessPayoutDto {
  @ApiPropertyOptional({
    example: 'TXN123456789',
    description: 'Transaction reference for the payout',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  transactionReference?: string;

  @ApiPropertyOptional({
    example: 'Payout processed successfully',
    description: 'Optional notes for processing',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

