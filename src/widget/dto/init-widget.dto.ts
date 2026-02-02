import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsObject, IsNumber, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { WidgetTriggerType } from '../entities/widget-session.entity';

class WidgetContextDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Withdrawal request ID (for withdrawal trigger)',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  withdrawalRequestId?: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Deposit ID (for deposit trigger)',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  depositId?: string;

  @ApiProperty({
    example: 100.0,
    description: 'Pre-filled amount (for withdrawal/deposit)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  amount?: number;
}

export class InitWidgetDto {
  @ApiProperty({
    example: 'onboarding',
    enum: WidgetTriggerType,
    description: 'Type of widget flow to initialize',
  })
  @IsEnum(WidgetTriggerType)
  trigger: WidgetTriggerType;

  @ApiProperty({
    type: WidgetContextDto,
    description: 'Context data for the widget (amount, request IDs, etc.)',
    required: false,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => WidgetContextDto)
  context?: WidgetContextDto;
}

