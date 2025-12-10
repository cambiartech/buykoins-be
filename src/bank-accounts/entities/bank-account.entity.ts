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

@Table({
  tableName: 'bank_accounts',
  timestamps: true,
})
export class BankAccount extends Model<BankAccount> {
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
    type: DataType.STRING(50),
    allowNull: false,
    field: 'account_number',
  })
  declare accountNumber: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    field: 'account_name',
  })
  declare accountName: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
    field: 'bank_name',
  })
  declare bankName: string;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    field: 'bank_code',
  })
  declare bankCode: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    field: 'is_verified',
  })
  declare isVerified: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    field: 'is_primary',
  })
  declare isPrimary: boolean;

  @Column({
    type: DataType.STRING(6),
    allowNull: true,
    field: 'verification_code',
  })
  declare verificationCode: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'verification_code_expires_at',
  })
  declare verificationCodeExpiresAt: Date;

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at' })
  declare updatedAt: Date;
}


