import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddBankAccountDto {
  @ApiProperty({
    example: '1234567890',
    description: 'Bank account number',
  })
  @IsNotEmpty({ message: 'Account number is required' })
  @IsString()
  @MinLength(10)
  @MaxLength(50)
  accountNumber: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Account holder name',
  })
  @IsNotEmpty({ message: 'Account name is required' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  accountName: string;

  @ApiProperty({
    example: 'First Bank of Nigeria',
    description: 'Bank name',
  })
  @IsNotEmpty({ message: 'Bank name is required' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  bankName: string;

  @ApiProperty({
    example: '011',
    description: 'Bank code',
  })
  @IsNotEmpty({ message: 'Bank code is required' })
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  bankCode: string;
}


