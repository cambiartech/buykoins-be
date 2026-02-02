import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GmailReaderService } from './gmail-reader.service';
import { GmailReaderController } from './gmail-reader.controller';

@Module({
  imports: [ConfigModule],
  controllers: [GmailReaderController],
  providers: [GmailReaderService],
  exports: [GmailReaderService],
})
export class GmailReaderModule {}

