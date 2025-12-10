import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsString, IsNumber, Min } from 'class-validator';

export class UpdateOperationsSettingsDto {
  @ApiProperty({
    example: false,
    description: 'Enable maintenance mode',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @ApiProperty({
    example: 'We are currently performing scheduled maintenance. Please check back soon.',
    description: 'Maintenance message to display to users',
    required: false,
  })
  @IsOptional()
  @IsString()
  maintenanceMessage?: string;

  @ApiProperty({
    example: true,
    description: 'Allow new user registrations',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  allowNewRegistrations?: boolean;

  @ApiProperty({
    example: true,
    description: 'Require email verification',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  requireEmailVerification?: boolean;

  @ApiProperty({
    example: false,
    description: 'Require KYC verification',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  requireKyc?: boolean;

  @ApiProperty({
    example: false,
    description: 'Auto-approve credit requests',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  autoApproveCredits?: boolean;

  @ApiProperty({
    example: 100.00,
    description: 'Auto-approve threshold (amounts below this are auto-approved)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Auto-approve threshold must be non-negative' })
  autoApproveThreshold?: number;

  @ApiProperty({
    example: false,
    description: 'Auto verify for support/admin operations',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  autoVerifySupport?: boolean;
}

