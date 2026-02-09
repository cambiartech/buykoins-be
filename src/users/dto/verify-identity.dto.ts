import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsNotEmpty, Matches, IsOptional, IsDateString } from 'class-validator';

export enum IdentityType {
  BVN = 'BVN',
  NIN = 'NIN',
}

export class VerifyIdentityDto {
  @ApiProperty({
    enum: IdentityType,
    example: 'BVN',
    description: 'Type of identity document (BVN or NIN)',
  })
  @IsEnum(IdentityType, { message: 'Identity type must be either BVN or NIN' })
  @IsNotEmpty()
  identityType: IdentityType;

  @ApiProperty({
    example: '22123456789',
    description: 'Identity number (11 digits for BVN or NIN)',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{11}$/, {
    message: 'Identity number must be exactly 11 digits',
  })
  identityNumber: string;

  @ApiProperty({
    example: '1990-01-15',
    description: 'Date of birth (YYYY-MM-DD format)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dob?: string;
}
