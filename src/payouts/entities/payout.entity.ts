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

export enum PayoutStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

@Table({
  tableName: 'payouts',
  timestamps: true,
})
export class Payout extends Model<Payout> {
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

  @BelongsTo(() => User, {
    foreignKey: 'user_id',
  })
  user: User;

  @Column({
    type: DataType.DECIMAL(15, 2),
    allowNull: false,
  })
  declare amount: number; // in USD

  @Column({
    type: DataType.DECIMAL(15, 2),
    allowNull: false,
    field: 'amount_in_ngn',
  })
  declare amountInNgn: number;

  @Column({
    type: DataType.DECIMAL(15, 2),
    allowNull: false,
    field: 'processing_fee',
  })
  declare processingFee: number; // in NGN

  @Column({
    type: DataType.DECIMAL(15, 2),
    allowNull: false,
    field: 'net_amount',
  })
  declare netAmount: number; // in NGN

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    field: 'bank_account',
  })
  declare bankAccount: {
    accountNumber: string;
    accountName: string;
    bankName: string;
    bankCode: string;
  };

  @Column({
    type: DataType.ENUM(...Object.values(PayoutStatus)),
    defaultValue: PayoutStatus.PENDING,
  })
  declare status: PayoutStatus;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
    field: 'requested_at',
  })
  declare requestedAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'processed_at',
  })
  declare processedAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'completed_at',
  })
  declare completedAt: Date;

  @ForeignKey(() => Admin)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'processed_by',
  })
  declare processedBy: string;

  @BelongsTo(() => Admin, {
    foreignKey: 'processed_by',
  })
  processedByAdmin: Admin;

  @Column({
    type: DataType.STRING(100),
    allowNull: true,
    field: 'transaction_reference',
  })
  declare transactionReference: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'rejection_reason',
  })
  declare rejectionReason: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare notes: string;

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at' })
  declare updatedAt: Date;
}

