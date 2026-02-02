import {
  IsString,
  IsObject,
  IsOptional,
  IsIn,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class PersonalInfoData {
  @ApiPropertyOptional({
    description: 'Date of birth in YYYY-MM-DD format',
    example: '1990-01-15',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Date of birth must be in YYYY-MM-DD format',
  })
  dob?: string;
}

class BillingAddressData {
  @ApiPropertyOptional({ description: 'Street address line 1' })
  @IsOptional()
  @IsString()
  line1?: string;

  @ApiPropertyOptional({ description: 'Street address line 2' })
  @IsOptional()
  @IsString()
  line2?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'State/Province' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({
    description: 'Postal code (6 digits)',
    example: '100001',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Postal code must be 6 digits' })
  postalCode?: string;

  @ApiPropertyOptional({ description: 'Country code', example: 'NG' })
  @IsOptional()
  @IsString()
  country?: string;
}

class IdentityData {
  @ApiPropertyOptional({
    description: 'Identity type',
    enum: ['BVN', 'NIN'],
  })
  @IsOptional()
  @IsIn(['BVN', 'NIN'])
  identityType?: 'BVN' | 'NIN';

  @ApiPropertyOptional({
    description: 'Identity number (11 digits)',
    example: '12345678901',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/, { message: 'Identity number must be 11 digits' })
  identityNumber?: string;
}

export class SaveOnboardingStepDto {
  @ApiProperty({
    description: 'Onboarding step',
    enum: ['personal-info', 'billing-address', 'identity'],
  })
  @IsString()
  @IsIn(['personal-info', 'billing-address', 'identity'])
  step: 'personal-info' | 'billing-address' | 'identity';

  @ApiProperty({
    description: 'Step data',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  data: PersonalInfoData | BillingAddressData | IdentityData;
}

