import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsArray,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { AdminRole, AdminStatus } from '../entities/admin.entity';
import { Permission } from '../permissions.constants';

export class UpdateAdminDto {
  @ApiProperty({
    example: 'admin@buytiktokcoins.com',
    description: 'Admin email address',
    required: false,
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: 'NewSecurePassword123!',
    description: 'Admin password (min 8 characters)',
    minLength: 8,
    required: false,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @IsOptional()
  password?: string;

  @ApiProperty({
    example: 'John',
    description: 'Admin first name',
    required: false,
  })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Admin last name',
    required: false,
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({
    enum: AdminRole,
    example: AdminRole.ADMIN,
    description: 'Admin role',
    required: false,
  })
  @IsEnum(AdminRole)
  @IsOptional()
  role?: AdminRole;

  @ApiProperty({
    example: [
      Permission.CREDIT_REQUESTS_VIEW,
      Permission.CREDIT_REQUESTS_APPROVE,
      Permission.USERS_VIEW,
    ],
    description: 'Array of permissions to assign to the admin',
    type: [String],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];

  @ApiProperty({
    enum: AdminStatus,
    example: AdminStatus.ACTIVE,
    description: 'Admin status',
    required: false,
  })
  @IsEnum(AdminStatus)
  @IsOptional()
  status?: AdminStatus;
}

