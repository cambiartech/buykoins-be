/**
 * Type-safe interfaces for Platform Settings
 */

export interface FinancialSettings {
  exchangeRateUsdToNgn: number;
  exchangeRateLastUpdated: Date;
  processingFee: number;
  processingFeeType: 'fixed' | 'percentage';
  processingFeePercentage: number | null;
  minPayout: number;
  maxPayout: number;
  dailyPayoutLimit: number | null;
  monthlyPayoutLimit: number | null;
}

export interface OperationsSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  allowNewRegistrations: boolean;
  requireEmailVerification: boolean;
  requireKyc: boolean;
  autoApproveCredits: boolean;
  autoApproveThreshold: number | null;
  autoVerifySupport: boolean;
}

export interface PaymentSettings {
  bankAccountRequired: boolean;
  requireVerifiedBankAccount: boolean;
  processingTime: string;
  processingTimeBusinessDays: number;
}

export interface BusinessRulesSettings {
  minCreditRequestAmount: number | null;
  maxCreditRequestAmount: number | null;
  creditRequestCooldownHours: number;
  payoutRequestCooldownHours: number;
  maxActiveCreditRequests: number;
  maxActivePayoutRequests: number;
}

export interface PlatformInfoSettings {
  platformName: string;
  supportEmail: string | null;
  supportPhone: string | null;
  termsOfServiceUrl: string | null;
  privacyPolicyUrl: string | null;
}

export interface PlatformSettingsResponse {
  financial: FinancialSettings;
  operations: OperationsSettings;
  payment: PaymentSettings;
  businessRules: BusinessRulesSettings;
  platformInfo: PlatformInfoSettings;
  extended: Record<string, any>;
  metadata: {
    updatedAt: Date;
    updatedBy: string | null;
  };
}

