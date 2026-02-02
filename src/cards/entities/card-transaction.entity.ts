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
import { Card } from './card.entity';
import { User } from '../../users/entities/user.entity';

export enum CardTransactionType {
  PURCHASE = 'purchase',
  FUNDING = 'funding',
  REFUND = 'refund',
  REVERSAL = 'reversal',
  FEE = 'fee',
}

export enum CardTransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REVERSED = 'reversed',
}

@Table({
  tableName: 'card_transactions',
  timestamps: true,
})
export class CardTransaction extends Model<CardTransaction> {
  @Column({
    type: DataType.UUID,
    primaryKey: true,
    defaultValue: DataType.UUIDV4,
  })
  declare id: string;

  @ForeignKey(() => Card)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'card_id',
  })
  declare cardId: string;

  @BelongsTo(() => Card, {
    foreignKey: 'card_id',
  })
  card: Card;

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
    type: DataType.STRING(255),
    allowNull: true,
    unique: true,
    field: 'sudo_transaction_id',
  })
  declare sudoTransactionId: string | null;

  @Column({
    type: DataType.ENUM(...Object.values(CardTransactionType)),
    allowNull: false,
  })
  declare type: CardTransactionType;

  @Column({
    type: DataType.DECIMAL(15, 2),
    allowNull: false,
  })
  declare amount: number;

  @Column({
    type: DataType.STRING(10),
    allowNull: false,
    defaultValue: 'NGN',
  })
  declare currency: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
    field: 'merchant_name',
  })
  declare merchantName: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare description: string | null;

  @Column({
    type: DataType.ENUM(...Object.values(CardTransactionStatus)),
    defaultValue: CardTransactionStatus.PENDING,
  })
  declare status: CardTransactionStatus;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  declare reference: string | null;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare metadata: Record<string, any> | null;

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at' })
  declare updatedAt: Date;
}

