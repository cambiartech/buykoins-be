import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Sequelize } from 'sequelize-typescript';
import databaseConfig from '../config/database.config';
import { User } from '../users/entities/user.entity';
import { Admin } from '../admins/entities/admin.entity';
import { CreditRequest } from '../credit-requests/entities/credit-request.entity';
import { OnboardingRequest } from '../onboarding/entities/onboarding-request.entity';
import { Payout } from '../payouts/entities/payout.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { BankAccount } from '../bank-accounts/entities/bank-account.entity';
import { PlatformSettings } from '../settings/entities/platform-settings.entity';
import { SupportConversation } from '../support/entities/support-conversation.entity';
import { SupportMessage } from '../support/entities/support-message.entity';
import { OnboardingAuthCode } from '../support/entities/onboarding-auth-code.entity';
import { CallRequest } from '../support/entities/call-request.entity';
import { WidgetSession } from '../widget/entities/widget-session.entity';
import { SudoCustomer } from '../cards/entities/sudo-customer.entity';
import { Card } from '../cards/entities/card.entity';
import { CardTransaction } from '../cards/entities/card-transaction.entity';
import { FundingSource } from '../cards/entities/funding-source.entity';
import { PaymentTransaction } from '../payments/entities/payment-transaction.entity';
import { Notification } from '../notifications/entities/notification.entity';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'SEQUELIZE',
      useFactory: async (configService: ConfigService) => {
        const dbConfig = configService.get('database');
        const sequelize = new Sequelize({
          dialect: 'postgres',
          host: dbConfig.host,
          port: dbConfig.port,
          username: dbConfig.username,
          password: dbConfig.password,
          database: dbConfig.database,
          ssl: dbConfig.ssl,
          logging: dbConfig.logging,
          pool: dbConfig.pool,
          timezone: '+00:00', // Force UTC timezone
          dialectOptions: {
            timezone: 'Etc/GMT',
          },
          models: [
            User,
            Admin,
            CreditRequest,
            OnboardingRequest,
            Payout,
            Transaction,
            BankAccount,
            PlatformSettings,
            SupportConversation,
            SupportMessage,
            OnboardingAuthCode,
            CallRequest,
            WidgetSession,
            SudoCustomer,
            Card,
            CardTransaction,
            FundingSource,
            PaymentTransaction,
            Notification,
          ],
        });
        
        // Test connection
        try {
          await sequelize.authenticate();
          console.log('Database connection established successfully.');
        } catch (error) {
          console.error('Unable to connect to the database:', error);
        }
        
        return sequelize;
      },
      inject: [ConfigService],
    },
  ],
  exports: ['SEQUELIZE'],
})
export class DatabaseModule {}

