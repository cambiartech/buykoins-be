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

export enum OnboardingRequestStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
}

@Table({
  tableName: 'onboarding_requests',
  timestamps: true,
})
export class OnboardingRequest extends Model<OnboardingRequest> {
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
    type: DataType.TEXT,
    allowNull: true,
  })
  declare message: string;

  @Column({
    type: DataType.ENUM(...Object.values(OnboardingRequestStatus)),
    defaultValue: OnboardingRequestStatus.PENDING,
  })
  declare status: OnboardingRequestStatus;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
    field: 'submitted_at',
  })
  declare submittedAt: Date;

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
    field: 'completed_by',
  })
  declare completedBy: string;

  @BelongsTo(() => Admin)
  completedByAdmin: Admin;

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

