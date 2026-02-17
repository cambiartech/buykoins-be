import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from '../../users/entities/user.entity';
import { Admin } from '../../admins/entities/admin.entity';

export enum NotificationType {
  // User notifications
  CREDIT_APPROVED = 'credit_approved',
  CREDIT_REJECTED = 'credit_rejected',
  PAYOUT_COMPLETED = 'payout_completed',
  PAYOUT_REJECTED = 'payout_rejected',
  ONBOARDING_COMPLETED = 'onboarding_completed',
  ACCOUNT_SUSPENDED = 'account_suspended',
  CARD_FUNDED = 'card_funded',
  WALLET_CREDITED = 'wallet_credited',
  ANNOUNCEMENT = 'announcement',

  // Admin notifications
  NEW_CREDIT_REQUEST = 'new_credit_request',
  NEW_PAYOUT_REQUEST = 'new_payout_request',
  NEW_ONBOARDING_REQUEST = 'new_onboarding_request',
  NEW_SUPPORT_MESSAGE = 'new_support_message',
  FRAUD_ALERT = 'fraud_alert',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Table({
  tableName: 'notifications',
  timestamps: true,
})
export class Notification extends Model<Notification> {
  @Column({
    type: DataType.UUID,
    primaryKey: true,
    defaultValue: DataType.UUIDV4,
  })
  declare id: string;

  // User notification (if applicable)
  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'user_id',
  })
  declare userId: string;

  @BelongsTo(() => User, { foreignKey: 'user_id' })
  user: User;

  // Admin notification (if applicable)
  @ForeignKey(() => Admin)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'admin_id',
  })
  declare adminId: string;

  @BelongsTo(() => Admin, { foreignKey: 'admin_id' })
  admin: Admin;

  /** For admin notifications: the user who triggered this (e.g. who sent the support message). */
  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'related_user_id',
  })
  declare relatedUserId: string;

  @BelongsTo(() => User, { foreignKey: 'related_user_id' })
  relatedUser: User;

  @Column({
    type: DataType.ENUM(...Object.values(NotificationType)),
    allowNull: false,
  })
  declare type: NotificationType;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  declare title: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  declare message: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare metadata: Record<string, any>;

  @Column({
    type: DataType.ENUM(...Object.values(NotificationPriority)),
    defaultValue: NotificationPriority.MEDIUM,
  })
  declare priority: NotificationPriority;

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
  declare readAt: Date;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
    field: 'action_url',
  })
  declare actionUrl: string;

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at' })
  declare updatedAt: Date;
}
