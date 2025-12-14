import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ConversationStatus } from '../entities/support-conversation.entity';

export class UpdateConversationStatusDto {
  @ApiProperty({
    enum: ConversationStatus,
    description: 'New status for the conversation',
    example: ConversationStatus.CLOSED,
  })
  @IsEnum(ConversationStatus, {
    message: 'Status must be one of: open, closed, resolved',
  })
  @IsNotEmpty()
  status: ConversationStatus;
}

