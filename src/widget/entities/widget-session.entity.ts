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

export enum WidgetTriggerType {
  ONBOARDING = 'onboarding',
  WITHDRAWAL = 'withdrawal',
  DEPOSIT = 'deposit',
}

export enum WidgetSessionStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
  ERROR = 'error',
}

export enum WidgetStep {
  // Onboarding steps
  REQUEST_CREDENTIALS = 'request-credentials',
  WAITING_FOR_ADMIN = 'waiting-for-admin',
  ENTER_AUTH_CODE = 'enter-auth-code',
  TIKTOK_SETUP_INSTRUCTIONS = 'tiktok-setup-instructions',
  CONFIRM_SETUP = 'confirm-setup',
  PENDING_VERIFICATION = 'pending-verification',
  
  // Withdrawal/Deposit steps
  COLLECTING_AMOUNT = 'collecting-amount',
  COLLECTING_PROOF = 'collecting-proof',
  CONFIRMING_PAYPAL = 'confirming-paypal',
  PENDING_ADMIN = 'pending-admin',
  PROCESSING = 'processing',
  
  // Common
  COMPLETED = 'completed',
  ERROR = 'error',
}

@Table({
  tableName: 'widget_sessions',
  timestamps: true,
})
export class WidgetSession extends Model<WidgetSession> {
  @Column({
    type: DataType.UUID,
    primaryKey: true,
    defaultValue: DataType.UUIDV4,
  })
  declare id: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'user_id',
  })
  declare userId: string;

  @BelongsTo(() => User)
  user: User;

  @Column({
    type: DataType.ENUM(...Object.values(WidgetTriggerType)),
    allowNull: false,
    field: 'trigger_type',
  })
  declare triggerType: WidgetTriggerType;

  @Column({
    type: DataType.JSONB,
    defaultValue: {},
  })
  declare context: Record<string, any>;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    field: 'current_step',
  })
  declare currentStep: string;

  @Column({
    type: DataType.ARRAY(DataType.TEXT),
    defaultValue: [],
    field: 'completed_steps',
  })
  declare completedSteps: string[];

  @Column({
    type: DataType.JSONB,
    defaultValue: {},
    field: 'collected_data',
  })
  declare collectedData: Record<string, any>;

  @Column({
    type: DataType.ENUM(...Object.values(WidgetSessionStatus)),
    defaultValue: WidgetSessionStatus.ACTIVE,
  })
  declare status: WidgetSessionStatus;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'expires_at',
  })
  declare expiresAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'last_activity_at',
  })
  declare lastActivityAt: Date;

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at' })
  declare updatedAt: Date;
}

