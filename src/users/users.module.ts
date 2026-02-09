import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { DatabaseModule } from '../database/database.module';
import { SudoApiService } from '../cards/sudo/sudo-api.service';

@Module({
  imports: [DatabaseModule, ConfigModule],
  controllers: [UsersController],
  providers: [UsersService, SudoApiService],
  exports: [UsersService],
})
export class UsersModule {}

