import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SupportGateway } from './support.gateway';
import { SupportService } from './support.service';
import { SupportController, AdminSupportController } from './support.controller';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    StorageModule,
    NotificationsModule,
    EmailModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: any) => ({
        secret: configService.get('jwt.secret'),
        signOptions: { expiresIn: configService.get('jwt.expiresIn') },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [SupportController, AdminSupportController],
  providers: [SupportGateway, SupportService],
  exports: [SupportService],
})
export class SupportModule {}

