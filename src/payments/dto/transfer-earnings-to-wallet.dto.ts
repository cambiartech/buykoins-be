import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TransferEarningsToWalletDto {
  @ApiProperty({
    description: 'Amount to transfer from earnings to wallet (in NGN)',
    example: 1000.0,
    minimum: 0.01,
  })
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(0.01, { message: 'Minimum transfer amount is 0.01 NGN' })
  amount: number;
}
