import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaystackApiService } from './paystack/paystack-api.service';
import paystackConfig from '../config/paystack.config';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule.forFeature(paystackConfig),
    NotificationsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaystackApiService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
