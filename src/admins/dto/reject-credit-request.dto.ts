import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectCreditRequestDto {
  @ApiProperty({
    example: 'Proof of earnings is unclear or invalid',
    description: 'Reason for rejection',
    minLength: 10,
  })
  @IsNotEmpty({ message: 'Rejection reason is required' })
  @IsString()
  @MinLength(10, { message: 'Rejection reason must be at least 10 characters' })
  reason: string;
}

