import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  UpdatedAt,
  CreatedAt,
} from 'sequelize-typescript';
import { User } from '../../users/entities/user.entity';
import { Admin } from '../../admins/entities/admin.entity';
import { SupportConversation } from './support-conversation.entity';

export enum CallType {
  VOICE = 'voice',
  VIDEO = 'video',
}

export enum CallRequestStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Table({
  tableName: 'call_requests',
  timestamps: true,
})
export class CallRequest extends Model<CallRequest> {
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

  @ForeignKey(() => SupportConversation)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'conversation_id',
  })
  declare conversationId: string | null;

  @Column({
    type: DataType.STRING(20),
    defaultValue: CallType.VOICE,
    field: 'call_type',
  })
  declare callType: CallType;

  @Column({
    type: DataType.STRING(20),
    defaultValue: CallRequestStatus.PENDING,
  })
  declare status: CallRequestStatus;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'scheduled_at',
  })
  declare scheduledAt: Date | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'started_at',
  })
  declare startedAt: Date | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'ended_at',
  })
  declare endedAt: Date | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'duration_seconds',
  })
  declare durationSeconds: number | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare reason: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'admin_notes',
  })
  declare adminNotes: string | null;

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

  @BelongsTo(() => SupportConversation)
  conversation: SupportConversation;
}

