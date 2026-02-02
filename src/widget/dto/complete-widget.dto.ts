import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class CompleteWidgetDto {
  @ApiProperty({
    example: {
      email: 'user@example.com',
      paypalConnected: true,
      amount: 100.0,
    },
    description: 'Final collected data',
    required: false,
  })
  @IsOptional()
  @IsObject()
  finalData?: Record<string, any>;
}

