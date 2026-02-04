import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { EmailModule } from './email/email.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';
import { CreditRequestsModule } from './credit-requests/credit-requests.module';
import { AdminsModule } from './admins/admins.module';
import { BankAccountsModule } from './bank-accounts/bank-accounts.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { PayoutsModule } from './payouts/payouts.module';
import { SettingsModule } from './settings/settings.module';
import { SupportModule } from './support/support.module';
import { WidgetModule } from './widget/widget.module';
import { CardsModule } from './cards/cards.module';
import { PaymentsModule } from './payments/payments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import awsConfig from './config/aws.config';
import appConfig from './config/app.config';
import sudoConfig from './config/sudo.config';
import paystackConfig from './config/paystack.config';
import postmarkConfig from './config/postmark.config';

@Module({
  imports: [
    // Configuration Module
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, awsConfig, appConfig, sudoConfig, paystackConfig, postmarkConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    // Rate Limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.get<number>('app.rateLimit.ttl', 60) * 1000,
            limit: configService.get<number>('app.rateLimit.max', 100),
          },
        ],
      }),
      inject: [ConfigService],
    }),
    // Database Module
    DatabaseModule,
    // Auth Module
    AuthModule,
    // Email Module
    EmailModule,
    // Storage Module
    StorageModule,
    // Users Module
    UsersModule,
    // Credit Requests Module
    CreditRequestsModule,
    // Admins Module
    AdminsModule,
    // Bank Accounts Module
    BankAccountsModule,
    // Onboarding Module
    OnboardingModule,
    // Payouts Module
    PayoutsModule,
    // Settings Module
    SettingsModule,
    // Support Module
    SupportModule,
    // Widget Module
    WidgetModule,
    // Cards Module
    CardsModule,
    // Payments Module
    PaymentsModule,
    // Notifications Module
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
