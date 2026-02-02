import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from '../../users/entities/user.entity';
import { SudoCustomer } from './sudo-customer.entity';
import { CardTransaction } from './card-transaction.entity';

export enum CardStatus {
  ACTIVE = 'active',
  FROZEN = 'frozen',
  CLOSED = 'closed',
  PENDING = 'pending',
}

export enum CardType {
  VIRTUAL = 'virtual',
  PHYSICAL = 'physical',
}

@Table({
  tableName: 'cards',
  timestamps: true,
})
export class Card extends Model<Card> {
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

  @ForeignKey(() => SudoCustomer)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'sudo_customer_id',
  })
  declare sudoCustomerId: string;

  @BelongsTo(() => SudoCustomer, {
    foreignKey: 'sudo_customer_id',
  })
  sudoCustomer: SudoCustomer;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    unique: true,
    field: 'sudo_card_id',
  })
  declare sudoCardId: string;

  @Column({
    type: DataType.STRING(20),
    allowNull: true,
    field: 'card_number',
  })
  declare cardNumber: string | null; // Masked card number

  @Column({
    type: DataType.ENUM(...Object.values(CardType)),
    defaultValue: CardType.VIRTUAL,
    field: 'card_type',
  })
  declare cardType: CardType;

  @Column({
    type: DataType.STRING(10),
    allowNull: false,
    defaultValue: 'NGN',
  })
  declare currency: string;

  @Column({
    type: DataType.ENUM(...Object.values(CardStatus)),
    defaultValue: CardStatus.ACTIVE,
  })
  declare status: CardStatus;

  @Column({
    type: DataType.DECIMAL(15, 2),
    defaultValue: 0.0,
    allowNull: false,
  })
  declare balance: number;

  @Column({
    type: DataType.STRING(2),
    allowNull: true,
    field: 'expiry_month',
  })
  declare expiryMonth: string | null;

  @Column({
    type: DataType.STRING(4),
    allowNull: true,
    field: 'expiry_year',
  })
  declare expiryYear: string | null;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    field: 'is_default',
  })
  declare isDefault: boolean;

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

  // Associations
  @HasMany(() => CardTransaction)
  transactions: CardTransaction[];
}

