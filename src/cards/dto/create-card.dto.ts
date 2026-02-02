import { IsString, IsOptional, IsEnum, IsObject, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCardDto {
  @ApiPropertyOptional({
    description: 'Currency for the card (default: NGN)',
    example: 'NGN',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Card program ID (if applicable)',
  })
  @IsOptional()
  @IsString()
  cardProgramId?: string;

  @ApiPropertyOptional({
    description: 'Initial funding amount for the card (in kobo for NGN, required for MasterCard). Default: 500',
    example: 500,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  initialAmount?: number;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

