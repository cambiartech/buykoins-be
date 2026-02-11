import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CardsController } from './cards.controller';
import { AdminCardsController } from './admin-cards.controller';
import { CardsService } from './cards.service';
import { SudoApiService } from './sudo/sudo-api.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ConfigModule, NotificationsModule],
  controllers: [CardsController, AdminCardsController],
  providers: [CardsService, SudoApiService],
  exports: [CardsService, SudoApiService],
})
export class CardsModule {}

