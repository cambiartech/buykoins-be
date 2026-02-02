import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  HasMany,
} from 'sequelize-typescript';
import { CreditRequest } from '../../credit-requests/entities/credit-request.entity';
import { OnboardingRequest } from '../../onboarding/entities/onboarding-request.entity';
import { Payout } from '../../payouts/entities/payout.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';

export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  FROZEN = 'frozen',
}

export enum WalletStatus {
  ACTIVE = 'active',
  FROZEN = 'frozen',
}

export enum OnboardingStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
}

@Table({
  tableName: 'users',
  timestamps: true,
})
export class User extends Model<User> {
  @Column({
    type: DataType.UUID,
    primaryKey: true,
    defaultValue: DataType.UUIDV4,
  })
  declare id: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  })
  declare email: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  declare password: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: true,
    field: 'first_name',
  })
  declare firstName: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: true,
    field: 'last_name',
  })
  declare lastName: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: true,
    unique: true,
  })
  declare username: string;

  @Column({
    type: DataType.STRING(20),
    allowNull: true,
  })
  declare phone: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    field: 'email_verified',
  })
  declare emailVerified: boolean;

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

  @Column({
    type: DataType.ENUM(...Object.values(OnboardingStatus)),
    defaultValue: OnboardingStatus.PENDING,
    field: 'onboarding_status',
  })
  declare onboardingStatus: OnboardingStatus;

  @Column({
    type: DataType.DECIMAL(15, 2),
    defaultValue: 0.0,
    allowNull: false,
    field: 'earnings', // Database column name
  })
  declare earnings: number; // TikTok earnings balance

  @Column({
    type: DataType.DECIMAL(15, 2),
    defaultValue: 0.0,
    allowNull: false,
  })
  declare wallet: number; // Spending wallet (for cards, airtime, etc.)

  // Backward compatibility: balance maps to earnings
  get balance(): number {
    return this.earnings;
  }

  set balance(value: number) {
    this.earnings = value;
  }

  @Column({
    type: DataType.ENUM(...Object.values(UserStatus)),
    defaultValue: UserStatus.ACTIVE,
  })
  declare status: UserStatus;

  @Column({
    type: DataType.ENUM(...Object.values(WalletStatus)),
    defaultValue: WalletStatus.ACTIVE,
    field: 'wallet_status',
  })
  declare walletStatus: WalletStatus;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
    field: 'joined_at',
  })
  declare joinedAt: Date;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
    field: 'sudo_customer_onboarding_data',
  })
  declare sudoCustomerOnboardingData: {
    dob?: string;
    billingAddress?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
    identity?: {
      identityType?: 'BVN' | 'NIN';
      identityNumber?: string;
    };
    onboardingStep?: string;
    onboardingCompleted?: boolean;
  } | null;

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at' })
  declare updatedAt: Date;

  // Associations
  @HasMany(() => CreditRequest)
  creditRequests: CreditRequest[];

  @HasMany(() => OnboardingRequest)
  onboardingRequests: OnboardingRequest[];

  @HasMany(() => Payout)
  payouts: Payout[];

  @HasMany(() => Transaction)
  transactions: Transaction[];
}

