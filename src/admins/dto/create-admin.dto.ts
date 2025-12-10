import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsEnum,
  ArrayMinSize,
} from 'class-validator';
import { AdminRole } from '../entities/admin.entity';
import { Permission } from '../permissions.constants';

export class CreateAdminDto {
  @ApiProperty({
    example: 'admin@buytiktokcoins.com',
    description: 'Admin email address',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    example: 'SecurePassword123!',
    description: 'Admin password (min 8 characters)',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @IsNotEmpty({ message: 'Password is required' })
  password: string;

  @ApiProperty({
    example: 'John',
    description: 'Admin first name',
  })
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  firstName: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Admin last name',
  })
  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  lastName: string;

  @ApiProperty({
    enum: AdminRole,
    example: AdminRole.ADMIN,
    description: 'Admin role',
    default: AdminRole.ADMIN,
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
}

