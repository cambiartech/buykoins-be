import { IsNotEmpty, IsNumber, Min, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePayoutDto {
  @ApiProperty({
    example: 100.00,
    description: 'Amount to withdraw in USD',
    minimum: 0.01,
  })
  @IsNotEmpty({ message: 'Amount is required' })
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(0.01, { message: 'Amount must be at least $0.01' })
  amount: number;

  @ApiPropertyOptional({
    example: 'bank-account-uuid',
    description: 'ID of verified bank account to use. If not provided, primary bank account will be used.',
  })
  @IsOptional()
  @IsUUID()
  bankAccountId?: string;
}

