import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
  Unique,
} from 'sequelize-typescript';
import { User } from '../../users/entities/user.entity';

@Table({
  tableName: 'paypal_connections',
  timestamps: true,
})
export class PayPalConnection extends Model<PayPalConnection> {
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
    type: DataType.STRING(255),
    allowNull: false,
  })
  declare email: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'access_token',
  })
  declare accessToken: string | null; // Encrypted

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'refresh_token',
  })
  declare refreshToken: string | null; // Encrypted

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'token_expires_at',
  })
  declare tokenExpiresAt: Date | null;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
    field: 'paypal_user_id',
  })
  declare paypalUserId: string | null;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  })
  declare isActive: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'verified_at',
  })
  declare verifiedAt: Date | null;

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at' })
  declare updatedAt: Date;
}

