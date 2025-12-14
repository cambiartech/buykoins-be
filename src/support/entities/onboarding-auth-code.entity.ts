import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
} from 'sequelize-typescript';
import { User } from '../../users/entities/user.entity';
import { Admin } from '../../admins/entities/admin.entity';
import { SupportConversation } from './support-conversation.entity';

export enum AuthCodeStatus {
  PENDING = 'pending',
  USED = 'used',
  EXPIRED = 'expired',
}

@Table({
  tableName: 'onboarding_auth_codes',
  timestamps: false,
})
export class OnboardingAuthCode extends Model<OnboardingAuthCode> {
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
    allowNull: false,
    field: 'admin_id',
  })
  declare adminId: string;

  @Column({
    type: DataType.STRING(10),
    allowNull: false,
    unique: true,
  })
  declare code: string;

  @ForeignKey(() => SupportConversation)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'conversation_id',
  })
  declare conversationId: string | null;

  @Column({
    type: DataType.STRING(20),
    defaultValue: AuthCodeStatus.PENDING,
  })
  declare status: AuthCodeStatus;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'expires_at',
  })
  declare expiresAt: Date | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'used_at',
  })
  declare usedAt: Date | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'device_info',
  })
  declare deviceInfo: string | null; // JSON string

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  // Associations
  @BelongsTo(() => User)
  user: User;

  @BelongsTo(() => Admin)
  admin: Admin;

  @BelongsTo(() => SupportConversation)
  conversation: SupportConversation;
}

