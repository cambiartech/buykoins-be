import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class NameEnquiryDto {
  @ApiProperty({
    example: '011',
    description: 'Bank code (3 digits)',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{3}$/, {
    message: 'Bank code must be exactly 3 digits',
  })
  bankCode: string;

  @ApiProperty({
    example: '1234567890',
    description: 'Bank account number (10 digits)',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{10}$/, {
    message: 'Account number must be exactly 10 digits',
  })
  accountNumber: string;
}
