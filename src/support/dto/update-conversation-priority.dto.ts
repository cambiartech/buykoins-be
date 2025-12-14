import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ConversationPriority } from '../entities/support-conversation.entity';

export class UpdateConversationPriorityDto {
  @ApiProperty({
    enum: ConversationPriority,
    description: 'New priority for the conversation',
    example: ConversationPriority.HIGH,
  })
  @IsEnum(ConversationPriority, {
    message: 'Priority must be one of: low, normal, high, urgent',
  })
  @IsNotEmpty()
  priority: ConversationPriority;
}

