import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { PlatformSettings } from './entities/platform-settings.entity';
import {
  PlatformSettingsResponse,
  FinancialSettings,
  OperationsSettings,
  PaymentSettings,
  BusinessRulesSettings,
  PlatformInfoSettings,
  WidgetSettings,
} from './interfaces/settings.interface';
import { UpdateFinancialSettingsDto } from './dto/update-financial-settings.dto';
import { UpdateOperationsSettingsDto } from './dto/update-operations-settings.dto';
import { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto';
import { UpdateBusinessRulesSettingsDto } from './dto/update-business-rules-settings.dto';
import { UpdatePlatformInfoSettingsDto } from './dto/update-platform-info-settings.dto';
import { UpdateWidgetSettingsDto } from '../admins/dto/update-widget-settings.dto';

@Injectable()
export class SettingsService {
  constructor(@Inject('SEQUELIZE') private sequelize: Sequelize) {}

  /**
   * Get or create settings (singleton pattern)
   */
  private async getOrCreateSettings(): Promise<PlatformSettings> {
    let settings = await PlatformSettings.findOne();

    if (!settings) {
      // Create default settings
      settings = await PlatformSettings.create({} as any);
    }

    return settings;
  }

  /**
   * Get all settings grouped by category
   */
  async getAllSettings(): Promise<PlatformSettingsResponse> {
    const settings = await this.getOrCreateSettings();

    return {
      financial: {
        exchangeRateUsdToNgn: Number(settings.exchangeRateUsdToNgn),
        exchangeRateLastUpdated: settings.exchangeRateLastUpdated,
        processingFee: Number(settings.processingFee),
        processingFeeType: settings.processingFeeType,
        processingFeePercentage: settings.processingFeePercentage
          ? Number(settings.processingFeePercentage)
          : null,
        minPayout: Number(settings.minPayout),
        maxPayout: Number(settings.maxPayout),
        dailyPayoutLimit: settings.dailyPayoutLimit
          ? Number(settings.dailyPayoutLimit)
          : null,
        monthlyPayoutLimit: settings.monthlyPayoutLimit
          ? Number(settings.monthlyPayoutLimit)
          : null,
      },
      operations: {
        maintenanceMode: settings.maintenanceMode,
        maintenanceMessage: settings.maintenanceMessage,
        allowNewRegistrations: settings.allowNewRegistrations,
        requireEmailVerification: settings.requireEmailVerification,
        requireKyc: settings.requireKyc,
        autoApproveCredits: settings.autoApproveCredits,
        autoApproveThreshold: settings.autoApproveThreshold
          ? Number(settings.autoApproveThreshold)
          : null,
        autoVerifySupport: settings.autoVerifySupport,
      },
      payment: {
        bankAccountRequired: settings.bankAccountRequired,
        requireVerifiedBankAccount: settings.requireVerifiedBankAccount,
        processingTime: settings.processingTime,
        processingTimeBusinessDays: settings.processingTimeBusinessDays,
      },
      businessRules: {
        minCreditRequestAmount: settings.minCreditRequestAmount
          ? Number(settings.minCreditRequestAmount)
          : null,
        maxCreditRequestAmount: settings.maxCreditRequestAmount
          ? Number(settings.maxCreditRequestAmount)
          : null,
        creditRequestCooldownHours: settings.creditRequestCooldownHours,
        payoutRequestCooldownHours: settings.payoutRequestCooldownHours,
        maxActiveCreditRequests: settings.maxActiveCreditRequests,
        maxActivePayoutRequests: settings.maxActivePayoutRequests,
        requireBvnForOnboarding: settings.requireBvnForOnboarding || false,
        requireNinForOnboarding: settings.requireNinForOnboarding || false,
      },
      platformInfo: {
        platformName: settings.platformName,
        supportEmail: settings.supportEmail,
        supportPhone: settings.supportPhone,
        termsOfServiceUrl: settings.termsOfServiceUrl,
        privacyPolicyUrl: settings.privacyPolicyUrl,
      },
      widget: {
        automaticWithdrawalsEnabled: settings.automaticWithdrawalsEnabled || false,
        paypalEmail: settings.paypalEmail || null,
        automaticOnboardingEnabled: settings.automaticOnboardingEnabled || false,
        gmailWebhookUrl: settings.gmailWebhookUrl || null,
      },
      extended: settings.extendedSettings || {},
      metadata: {
        updatedAt: settings.updatedAt,
        updatedBy: settings.updatedBy,
      },
    };
  }

  /**
   * Get settings by category
   */
  async getSettingsByCategory(
    category: 'financial' | 'operations' | 'payment' | 'business-rules' | 'platform-info' | 'widget',
  ): Promise<
    | FinancialSettings
    | OperationsSettings
    | PaymentSettings
    | BusinessRulesSettings
    | PlatformInfoSettings
    | WidgetSettings
  > {
    const allSettings = await this.getAllSettings();

    switch (category) {
      case 'financial':
        return allSettings.financial;
      case 'operations':
        return allSettings.operations;
      case 'payment':
        return allSettings.payment;
      case 'business-rules':
        return allSettings.businessRules;
      case 'platform-info':
        return allSettings.platformInfo;
      case 'widget':
        return allSettings.widget;
      default:
        throw new BadRequestException(`Invalid category: ${category}`);
    }
  }

  /**
   * Update financial settings
   */
  async updateFinancialSettings(
    dto: UpdateFinancialSettingsDto,
    updatedBy: string,
  ): Promise<FinancialSettings> {
    const settings = await this.getOrCreateSettings();

    if (dto.exchangeRateUsdToNgn !== undefined) {
      settings.exchangeRateUsdToNgn = dto.exchangeRateUsdToNgn;
      settings.exchangeRateLastUpdated = new Date();
    }

    if (dto.processingFee !== undefined) {
      settings.processingFee = dto.processingFee;
    }

    if (dto.processingFeeType !== undefined) {
      settings.processingFeeType = dto.processingFeeType;
    }

    if (dto.processingFeePercentage !== undefined) {
      settings.processingFeePercentage = dto.processingFeePercentage;
    }

    if (dto.minPayout !== undefined) {
      settings.minPayout = dto.minPayout;
    }

    if (dto.maxPayout !== undefined) {
      if (dto.minPayout !== undefined && dto.maxPayout <= dto.minPayout) {
        throw new BadRequestException(
          'Maximum payout must be greater than minimum payout',
        );
      }
      if (settings.minPayout && dto.maxPayout <= settings.minPayout) {
        throw new BadRequestException(
          'Maximum payout must be greater than minimum payout',
        );
      }
      settings.maxPayout = dto.maxPayout;
    }

    if (dto.dailyPayoutLimit !== undefined) {
      settings.dailyPayoutLimit = dto.dailyPayoutLimit;
    }

    if (dto.monthlyPayoutLimit !== undefined) {
      settings.monthlyPayoutLimit = dto.monthlyPayoutLimit;
    }

    settings.updatedBy = updatedBy;
    await settings.save();

    const allSettings = await this.getAllSettings();
    return allSettings.financial;
  }

  /**
   * Update operations settings
   */
  async updateOperationsSettings(
    dto: UpdateOperationsSettingsDto,
    updatedBy: string,
  ): Promise<OperationsSettings> {
    const settings = await this.getOrCreateSettings();

    if (dto.maintenanceMode !== undefined) {
      settings.maintenanceMode = dto.maintenanceMode;
    }

    if (dto.maintenanceMessage !== undefined) {
      settings.maintenanceMessage = dto.maintenanceMessage;
    }

    if (dto.allowNewRegistrations !== undefined) {
      settings.allowNewRegistrations = dto.allowNewRegistrations;
    }

    if (dto.requireEmailVerification !== undefined) {
      settings.requireEmailVerification = dto.requireEmailVerification;
    }

    if (dto.requireKyc !== undefined) {
      settings.requireKyc = dto.requireKyc;
    }

    if (dto.autoApproveCredits !== undefined) {
      settings.autoApproveCredits = dto.autoApproveCredits;
    }

    if (dto.autoApproveThreshold !== undefined) {
      settings.autoApproveThreshold = dto.autoApproveThreshold;
    }

    if (dto.autoVerifySupport !== undefined) {
      settings.autoVerifySupport = dto.autoVerifySupport;
    }

    settings.updatedBy = updatedBy;
    await settings.save();

    const allSettings = await this.getAllSettings();
    return allSettings.operations;
  }

  /**
   * Update payment settings
   */
  async updatePaymentSettings(
    dto: UpdatePaymentSettingsDto,
    updatedBy: string,
  ): Promise<PaymentSettings> {
    const settings = await this.getOrCreateSettings();

    if (dto.bankAccountRequired !== undefined) {
      settings.bankAccountRequired = dto.bankAccountRequired;
    }

    if (dto.requireVerifiedBankAccount !== undefined) {
      settings.requireVerifiedBankAccount = dto.requireVerifiedBankAccount;
    }

    if (dto.processingTime !== undefined) {
      settings.processingTime = dto.processingTime;
    }

    if (dto.processingTimeBusinessDays !== undefined) {
      settings.processingTimeBusinessDays = dto.processingTimeBusinessDays;
    }

    settings.updatedBy = updatedBy;
    await settings.save();

    const allSettings = await this.getAllSettings();
    return allSettings.payment;
  }

  /**
   * Update business rules settings
   */
  async updateBusinessRulesSettings(
    dto: UpdateBusinessRulesSettingsDto,
    updatedBy: string,
  ): Promise<BusinessRulesSettings> {
    const settings = await this.getOrCreateSettings();

    if (dto.minCreditRequestAmount !== undefined) {
      settings.minCreditRequestAmount = dto.minCreditRequestAmount;
    }

    if (dto.maxCreditRequestAmount !== undefined) {
      if (
        dto.minCreditRequestAmount !== undefined &&
        dto.maxCreditRequestAmount <= dto.minCreditRequestAmount
      ) {
        throw new BadRequestException(
          'Maximum credit request amount must be greater than minimum',
        );
      }
      if (
        settings.minCreditRequestAmount &&
        dto.maxCreditRequestAmount <= settings.minCreditRequestAmount
      ) {
        throw new BadRequestException(
          'Maximum credit request amount must be greater than minimum',
        );
      }
      settings.maxCreditRequestAmount = dto.maxCreditRequestAmount;
    }

    if (dto.creditRequestCooldownHours !== undefined) {
      settings.creditRequestCooldownHours = dto.creditRequestCooldownHours;
    }

    if (dto.payoutRequestCooldownHours !== undefined) {
      settings.payoutRequestCooldownHours = dto.payoutRequestCooldownHours;
    }

    if (dto.maxActiveCreditRequests !== undefined) {
      settings.maxActiveCreditRequests = dto.maxActiveCreditRequests;
    }

    if (dto.maxActivePayoutRequests !== undefined) {
      settings.maxActivePayoutRequests = dto.maxActivePayoutRequests;
    }

    if (dto.requireBvnForOnboarding !== undefined) {
      settings.requireBvnForOnboarding = dto.requireBvnForOnboarding;
    }

    if (dto.requireNinForOnboarding !== undefined) {
      settings.requireNinForOnboarding = dto.requireNinForOnboarding;
    }

    settings.updatedBy = updatedBy;
    await settings.save();

    const allSettings = await this.getAllSettings();
    return allSettings.businessRules;
  }

  /**
   * Update platform info settings
   */
  async updatePlatformInfoSettings(
    dto: UpdatePlatformInfoSettingsDto,
    updatedBy: string,
  ): Promise<PlatformInfoSettings> {
    const settings = await this.getOrCreateSettings();

    if (dto.platformName !== undefined) {
      settings.platformName = dto.platformName;
    }

    if (dto.supportEmail !== undefined) {
      settings.supportEmail = dto.supportEmail;
    }

    if (dto.supportPhone !== undefined) {
      settings.supportPhone = dto.supportPhone;
    }

    if (dto.termsOfServiceUrl !== undefined) {
      settings.termsOfServiceUrl = dto.termsOfServiceUrl;
    }

    if (dto.privacyPolicyUrl !== undefined) {
      settings.privacyPolicyUrl = dto.privacyPolicyUrl;
    }

    settings.updatedBy = updatedBy;
    await settings.save();

    const allSettings = await this.getAllSettings();
    return allSettings.platformInfo;
  }

  /**
   * Update extended settings (JSONB)
   */
  async updateExtendedSettings(
    extendedSettings: Record<string, any>,
    updatedBy: string,
  ): Promise<Record<string, any>> {
    const settings = await this.getOrCreateSettings();

    // Merge with existing extended settings
    const currentExtended = settings.extendedSettings || {};
    settings.extendedSettings = { ...currentExtended, ...extendedSettings };
    settings.updatedBy = updatedBy;
    await settings.save();

    return settings.extendedSettings;
  }

  /**
   * Get a specific setting value (helper method)
   */
  async getSettingValue<T>(key: string): Promise<T | null> {
    const settings = await this.getAllSettings();
    
    // Check in extended settings first
    if (settings.extended[key]) {
      return settings.extended[key] as T;
    }

    // Check in structured settings (flattened)
    const flatSettings: any = {
      ...settings.financial,
      ...settings.operations,
      ...settings.payment,
      ...settings.businessRules,
      ...settings.platformInfo,
    };

    return flatSettings[key] || null;
  }

  /**
   * Update widget settings
   */
  async updateWidgetSettings(
    dto: UpdateWidgetSettingsDto,
    updatedBy: string,
  ): Promise<WidgetSettings> {
    const settings = await this.getOrCreateSettings();

    if (dto.automaticWithdrawalsEnabled !== undefined) {
      settings.automaticWithdrawalsEnabled = dto.automaticWithdrawalsEnabled;
    }
    if (dto.paypalEmail !== undefined) {
      settings.paypalEmail = dto.paypalEmail;
    }
    if (dto.automaticOnboardingEnabled !== undefined) {
      settings.automaticOnboardingEnabled = dto.automaticOnboardingEnabled;
    }
    if (dto.gmailWebhookUrl !== undefined) {
      settings.gmailWebhookUrl = dto.gmailWebhookUrl;
    }

    settings.updatedBy = updatedBy;
    await settings.save();

    return {
      automaticWithdrawalsEnabled: settings.automaticWithdrawalsEnabled,
      paypalEmail: settings.paypalEmail,
      automaticOnboardingEnabled: settings.automaticOnboardingEnabled,
      gmailWebhookUrl: settings.gmailWebhookUrl,
    };
  }
}

