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

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  REVERSED = 'reversed',
}

@Table({
  tableName: 'payment_transactions',
  timestamps: true,
})
export class PaymentTransaction extends Model<PaymentTransaction> {
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
    type: DataType.STRING(255),
    allowNull: false,
    unique: true,
    field: 'paystack_reference',
  })
  declare paystackReference: string;

  @Column({
    type: DataType.DECIMAL(15, 2),
    allowNull: false,
  })
  declare amount: number; // Amount in NGN

  @Column({
    type: DataType.STRING(3),
    defaultValue: 'NGN',
  })
  declare currency: string;

  @Column({
    type: DataType.ENUM(...Object.values(PaymentStatus)),
    defaultValue: PaymentStatus.PENDING,
  })
  declare status: PaymentStatus;

  @Column({
    type: DataType.STRING(50),
    allowNull: true,
    field: 'payment_method',
  })
  declare paymentMethod: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
    field: 'paystack_response',
  })
  declare paystackResponse: any;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare metadata: Record<string, any>;

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at' })
  declare updatedAt: Date;
}
