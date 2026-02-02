import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WidgetController } from './widget.controller';
import { WidgetService } from './widget.service';
import { WidgetGateway } from './widget.gateway';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { SupportModule } from '../support/support.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { StorageModule } from '../storage/storage.module';
import { GmailReaderModule } from './gmail/gmail-reader.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    SupportModule,
    OnboardingModule,
    PayoutsModule,
    StorageModule,
    GmailReaderModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('jwt.secret'),
        signOptions: { expiresIn: configService.get('jwt.expiresIn') },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [WidgetController],
  providers: [WidgetService, WidgetGateway],
  exports: [WidgetService],
})
export class WidgetModule {}

