import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BankAccountsController } from './bank-accounts.controller';
import { BankAccountsService } from './bank-accounts.service';
import { DatabaseModule } from '../database/database.module';
import { EmailModule } from '../email/email.module';
import { SudoApiService } from '../cards/sudo/sudo-api.service';

@Module({
  imports: [DatabaseModule, EmailModule, ConfigModule],
  controllers: [BankAccountsController],
  providers: [BankAccountsService, SudoApiService],
  exports: [BankAccountsService],
})
export class BankAccountsModule {}

