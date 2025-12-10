import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOnboardingRequestDto {
  @ApiPropertyOptional({
    example: 'I need help setting up my payment method',
    description: 'Optional message for the onboarding request',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}

