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

export enum TransactionType {
  CREDIT = 'credit',
  WITHDRAWAL = 'withdrawal',
  PAYOUT = 'payout',
}

export enum TransactionStatus {
  COMPLETED = 'completed',
  PENDING = 'pending',
  REJECTED = 'rejected',
}

@Table({
  tableName: 'transactions',
  timestamps: true,
})
export class Transaction extends Model<Transaction> {
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
    type: DataType.ENUM(...Object.values(TransactionType)),
    allowNull: false,
  })
  declare type: TransactionType;

  @Column({
    type: DataType.DECIMAL(15, 2),
    allowNull: false,
  })
  declare amount: number; // in USD

  @Column({
    type: DataType.DECIMAL(15, 2),
    allowNull: true,
    field: 'amount_in_ngn',
  })
  declare amountInNgn: number | null; // NGN equivalent (for withdrawals/payouts)

  @Column({
    type: DataType.DECIMAL(10, 4),
    allowNull: true,
    field: 'exchange_rate',
  })
  declare exchangeRate: number | null; // Exchange rate used (USD to NGN)

  @Column({
    type: DataType.DECIMAL(15, 2),
    allowNull: true,
    field: 'processing_fee',
  })
  declare processingFee: number | null; // Processing fee in NGN

  @Column({
    type: DataType.DECIMAL(15, 2),
    allowNull: true,
    field: 'net_amount',
  })
  declare netAmount: number | null; // Net amount in NGN (after fees)

  @Column({
    type: DataType.ENUM(...Object.values(TransactionStatus)),
    defaultValue: TransactionStatus.PENDING,
  })
  declare status: TransactionStatus;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare description: string;

  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'reference_id',
  })
  declare referenceId: string; // Reference to credit_request, payout, etc.

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  declare date: Date;

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at' })
  declare updatedAt: Date;
}

