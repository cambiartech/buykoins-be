import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsObject, IsOptional } from 'class-validator';

export class SubmitStepDto {
  @ApiProperty({
    example: 'request-credentials',
    description: 'Current step name',
  })
  @IsString()
  @IsNotEmpty()
  step: string;

  @ApiProperty({
    example: { email: 'user@example.com' },
    description: 'Data collected in this step',
  })
  @IsObject()
  data: Record<string, any>;
}

