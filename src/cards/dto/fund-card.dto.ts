import { IsNumber, IsPositive, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FundCardDto {
  @ApiProperty({
    description: 'Amount to fund the card',
    example: 1000.0,
    minimum: 0.01,
  })
  @IsNumber()
  @IsPositive()
  @Min(0.01)
  amount: number;
}

