import { IsBoolean, IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CardStatus } from '../entities/card.entity';

export class UpdateCardDto {
  @ApiPropertyOptional({
    description: 'Card status (freeze/unfreeze)',
    enum: CardStatus,
  })
  @IsOptional()
  @IsEnum(CardStatus)
  status?: CardStatus;

  @ApiPropertyOptional({
    description: 'Set as default card',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

