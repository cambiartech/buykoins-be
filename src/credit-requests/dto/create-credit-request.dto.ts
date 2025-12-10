import { IsNumber, Min, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateCreditRequestDto {
  @ApiProperty({
    example: 500.00,
    description: 'Amount in USD',
    minimum: 1.00,
  })
  @IsNotEmpty({ message: 'Amount is required' })
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(1.0, { message: 'Amount must be at least 1.00' })
  @Type(() => Number)
  amount: number;
}

