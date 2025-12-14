import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
} from 'sequelize-typescript';
import { SupportConversation } from './support-conversation.entity';

export enum MessageType {
  TEXT = 'text',
  FILE = 'file',
  SYSTEM = 'system',
  AUTH_CODE = 'auth_code',
}

export enum SenderType {
  USER = 'user',
  ADMIN = 'admin',
  GUEST = 'guest',
  SYSTEM = 'system',
}

@Table({
  tableName: 'support_messages',
  timestamps: false,
})
export class SupportMessage extends Model<SupportMessage> {
  @Column({
    type: DataType.UUID,
    primaryKey: true,
    defaultValue: DataType.UUIDV4,
  })
  declare id: string;

  @ForeignKey(() => SupportConversation)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'conversation_id',
  })
  declare conversationId: string;

  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'sender_id',
  })
  declare senderId: string | null; // User or Admin ID

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    field: 'sender_type',
  })
  declare senderType: SenderType;

  @Column({
    type: DataType.STRING(100),
    allowNull: true,
    field: 'guest_id',
  })
  declare guestId: string | null; // For anonymous users

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  declare message: string;

  @Column({
    type: DataType.STRING(20),
    defaultValue: MessageType.TEXT,
    field: 'message_type',
  })
  declare messageType: MessageType;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'file_url',
  })
  declare fileUrl: string | null;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
    field: 'file_name',
  })
  declare fileName: string | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'file_size',
  })
  declare fileSize: number | null;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    field: 'is_read',
  })
  declare isRead: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'read_at',
  })
  declare readAt: Date | null;

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  // Associations
  @BelongsTo(() => SupportConversation)
  conversation: SupportConversation;
}

