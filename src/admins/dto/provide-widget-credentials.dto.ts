import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ProvideWidgetCredentialsDto {
  @ApiProperty({
    example: 'platform@paypal.com',
    description: 'PayPal email to provide to user',
  })
  @IsString()
  @IsNotEmpty()
  paypalEmail: string;

  @ApiProperty({
    example: 'Optional notes about the credentials',
    description: 'Notes for admin reference',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

