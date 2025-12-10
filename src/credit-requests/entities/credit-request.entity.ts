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

export enum CreditRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Table({
  tableName: 'credit_requests',
  timestamps: true,
})
export class CreditRequest extends Model<CreditRequest> {
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
  declare amount: number;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    field: 'proof_url',
  })
  declare proofUrl: string;

  @Column({
    type: DataType.ENUM(...Object.values(CreditRequestStatus)),
    defaultValue: CreditRequestStatus.PENDING,
  })
  declare status: CreditRequestStatus;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
    field: 'submitted_at',
  })
  declare submittedAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'processed_at',
  })
  declare processedAt: Date;

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

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'admin_proof_url',
  })
  declare adminProofUrl: string;

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at' })
  declare updatedAt: Date;
}


