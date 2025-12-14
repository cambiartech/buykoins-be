import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
  UpdatedAt,
  CreatedAt,
} from 'sequelize-typescript';
import { User } from '../../users/entities/user.entity';
import { Admin } from '../../admins/entities/admin.entity';
import { SupportMessage } from './support-message.entity';

export enum ConversationType {
  GENERAL = 'general',
  ONBOARDING = 'onboarding',
  CALL_REQUEST = 'call_request',
}

export enum ConversationStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  RESOLVED = 'resolved',
}

export enum ConversationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Table({
  tableName: 'support_conversations',
  timestamps: true,
})
export class SupportConversation extends Model<SupportConversation> {
  @Column({
    type: DataType.UUID,
    primaryKey: true,
    defaultValue: DataType.UUIDV4,
  })
  declare id: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'user_id',
  })
  declare userId: string | null;

  @Column({
    type: DataType.STRING(100),
    allowNull: true,
    field: 'guest_id',
  })
  declare guestId: string | null; // For anonymous users

  @ForeignKey(() => Admin)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'admin_id',
  })
  declare adminId: string | null;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    defaultValue: ConversationType.GENERAL,
  })
  declare type: ConversationType;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  declare subject: string | null;

  @Column({
    type: DataType.STRING(20),
    defaultValue: ConversationStatus.OPEN,
  })
  declare status: ConversationStatus;

  @Column({
    type: DataType.STRING(20),
    defaultValue: ConversationPriority.NORMAL,
  })
  declare priority: ConversationPriority;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'last_message_at',
  })
  declare lastMessageAt: Date | null;

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at' })
  declare updatedAt: Date;

  // Associations
  @BelongsTo(() => User)
  user: User;

  @BelongsTo(() => Admin)
  admin: Admin;

  @HasMany(() => SupportMessage)
  messages: SupportMessage[];
}

