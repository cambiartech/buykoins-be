import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  UpdatedAt,
} from 'sequelize-typescript';
import { Admin } from '../../admins/entities/admin.entity';

@Table({
  tableName: 'platform_settings',
  timestamps: false,
})
export class PlatformSettings extends Model<PlatformSettings> {
  @Column({
    type: DataType.UUID,
    primaryKey: true,
    defaultValue: DataType.UUIDV4,
  })
  declare id: string;

  // Financial Settings
  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 1500.00,
    field: 'exchange_rate_usd_to_ngn',
  })
  declare exchangeRateUsdToNgn: number;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
    field: 'exchange_rate_last_updated',
  })
  declare exchangeRateLastUpdated: Date;

  @Column({
    type: DataType.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 50.00,
    field: 'processing_fee',
  })
  declare processingFee: number;

  @Column({
    type: DataType.STRING(20),
    defaultValue: 'fixed',
    field: 'processing_fee_type',
  })
  declare processingFeeType: 'fixed' | 'percentage';

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
    field: 'processing_fee_percentage',
  })
  declare processingFeePercentage: number | null;

  @Column({
    type: DataType.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 1000.00,
    field: 'min_payout',
  })
  declare minPayout: number;

  @Column({
    type: DataType.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 1000000.00,
    field: 'max_payout',
  })
  declare maxPayout: number;

  @Column({
    type: DataType.DECIMAL(15, 2),
    allowNull: true,
    field: 'daily_payout_limit',
  })
  declare dailyPayoutLimit: number | null;

  @Column({
    type: DataType.DECIMAL(15, 2),
    allowNull: true,
    field: 'monthly_payout_limit',
  })
  declare monthlyPayoutLimit: number | null;

  // Platform Operations
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    field: 'maintenance_mode',
  })
  declare maintenanceMode: boolean;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'maintenance_message',
  })
  declare maintenanceMessage: string | null;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
    field: 'allow_new_registrations',
  })
  declare allowNewRegistrations: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
    field: 'require_email_verification',
  })
  declare requireEmailVerification: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    field: 'require_kyc',
  })
  declare requireKyc: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    field: 'auto_approve_credits',
  })
  declare autoApproveCredits: boolean;

  @Column({
    type: DataType.DECIMAL(15, 2),
    allowNull: true,
    field: 'auto_approve_threshold',
  })
  declare autoApproveThreshold: number | null;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    field: 'auto_verify_support',
  })
  declare autoVerifySupport: boolean;

  // Payment & Banking
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
    field: 'bank_account_required',
  })
  declare bankAccountRequired: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
    field: 'require_verified_bank_account',
  })
  declare requireVerifiedBankAccount: boolean;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    defaultValue: '24-48 hours',
    field: 'processing_time',
  })
  declare processingTime: string;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 2,
    field: 'processing_time_business_days',
  })
  declare processingTimeBusinessDays: number;

  // Business Rules
  @Column({
    type: DataType.DECIMAL(15, 2),
    allowNull: true,
    field: 'min_credit_request_amount',
  })
  declare minCreditRequestAmount: number | null;

  @Column({
    type: DataType.DECIMAL(15, 2),
    allowNull: true,
    field: 'max_credit_request_amount',
  })
  declare maxCreditRequestAmount: number | null;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 24,
    field: 'credit_request_cooldown_hours',
  })
  declare creditRequestCooldownHours: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 24,
    field: 'payout_request_cooldown_hours',
  })
  declare payoutRequestCooldownHours: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 1,
    field: 'max_active_credit_requests',
  })
  declare maxActiveCreditRequests: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 1,
    field: 'max_active_payout_requests',
  })
  declare maxActivePayoutRequests: number;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    field: 'require_bvn_for_onboarding',
  })
  declare requireBvnForOnboarding: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    field: 'require_nin_for_onboarding',
  })
  declare requireNinForOnboarding: boolean;

  // Platform Information
  @Column({
    type: DataType.STRING(100),
    defaultValue: 'BuyTikTokCoins',
    field: 'platform_name',
  })
  declare platformName: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
    field: 'support_email',
  })
  declare supportEmail: string | null;

  @Column({
    type: DataType.STRING(20),
    allowNull: true,
    field: 'support_phone',
  })
  declare supportPhone: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'terms_of_service_url',
  })
  declare termsOfServiceUrl: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'privacy_policy_url',
  })
  declare privacyPolicyUrl: string | null;

  // Widget & Automation Settings
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    field: 'automatic_withdrawals_enabled',
  })
  declare automaticWithdrawalsEnabled: boolean;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
    field: 'paypal_email',
  })
  declare paypalEmail: string | null;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    field: 'automatic_onboarding_enabled',
  })
  declare automaticOnboardingEnabled: boolean;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
    field: 'gmail_webhook_url',
  })
  declare gmailWebhookUrl: string | null;

  // Extended Settings
  @Column({
    type: DataType.JSONB,
    defaultValue: {},
    field: 'extended_settings',
  })
  declare extendedSettings: Record<string, any>;

  // Metadata
  @UpdatedAt
  @Column({ field: 'updated_at' })
  declare updatedAt: Date;

  @ForeignKey(() => Admin)
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'updated_by',
  })
  declare updatedBy: string | null;

  @BelongsTo(() => Admin, {
    foreignKey: 'updated_by',
  })
  updatedByAdmin: Admin;
}

