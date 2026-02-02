import { Module } from '@nestjs/common';
import { AdminsController } from './admins.controller';
import { AdminAuthController } from './admin-auth.controller';
import { AdminsService } from './admins.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { EmailModule } from '../email/email.module';
import { SupportModule } from '../support/support.module';
import { WidgetModule } from '../widget/widget.module';

@Module({
  imports: [DatabaseModule, AuthModule, StorageModule, EmailModule, SupportModule, WidgetModule],
  controllers: [AdminsController, AdminAuthController],
  providers: [AdminsService],
  exports: [AdminsService],
})
export class AdminsModule {}

