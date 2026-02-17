import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TikTokCallbackController } from './tiktok-callback.controller';
import { TikTokAuthService } from './tiktok-auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { EmailModule } from '../email/email.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const expiresIn = configService.get<string>('jwt.expiresIn') || '24h';
        return {
          secret: configService.get<string>('jwt.secret') || 'default-secret',
          signOptions: {
            expiresIn: expiresIn as any,
          },
        };
      },
      inject: [ConfigService],
    }),
    EmailModule,
  ],
  controllers: [AuthController, TikTokCallbackController],
  providers: [AuthService, TikTokAuthService, JwtStrategy],
  exports: [AuthService, TikTokAuthService, JwtModule, PassportModule],
})
export class AuthModule {}

