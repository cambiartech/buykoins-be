import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CardsController } from './cards.controller';
import { AdminCardsController } from './admin-cards.controller';
import { CardsService } from './cards.service';
import { SudoApiService } from './sudo/sudo-api.service';

@Module({
  imports: [ConfigModule],
  controllers: [CardsController, AdminCardsController],
  providers: [CardsService, SudoApiService],
  exports: [CardsService, SudoApiService],
})
export class CardsModule {}

