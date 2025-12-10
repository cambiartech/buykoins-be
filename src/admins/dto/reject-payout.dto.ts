import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectPayoutDto {
  @ApiProperty({
    example: 'Insufficient funds or invalid bank account',
    description: 'Reason for rejecting the payout',
  })
  @IsNotEmpty({ message: 'Rejection reason is required' })
  @IsString()
  @MaxLength(500)
  rejectionReason: string;
}

