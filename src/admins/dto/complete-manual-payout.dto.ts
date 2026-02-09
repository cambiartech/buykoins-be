import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

export class CompleteManualPayoutDto {
  @ApiProperty({
    example: 'TXN123456789',
    description: 'Transaction/reference number (e.g. bank transfer ref, screenshot ID)',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  transactionReference: string;

  @ApiPropertyOptional({
    example: 'Paid via bank transfer, screenshot in Slack',
    description: 'Optional notes for manual payout',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
