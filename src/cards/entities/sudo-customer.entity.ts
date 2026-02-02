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
import { Card } from './card.entity';

export enum SudoCustomerStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

@Table({
  tableName: 'sudo_customers',
  timestamps: true,
})
export class SudoCustomer extends Model<SudoCustomer> {
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
    unique: true,
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
    field: 'sudo_customer_id',
  })
  declare sudoCustomerId: string;

  @Column({
    type: DataType.ENUM(...Object.values(SudoCustomerStatus)),
    defaultValue: SudoCustomerStatus.ACTIVE,
  })
  declare status: SudoCustomerStatus;

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
  @HasMany(() => Card)
  cards: Card[];
}

