import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { Payout, PayoutStatus } from './entities/payout.entity';
import { User, OnboardingStatus } from '../users/entities/user.entity';
import { BankAccount } from '../bank-accounts/entities/bank-account.entity';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { SettingsService } from '../settings/settings.service';
import { Transaction, TransactionType, TransactionStatus } from '../transactions/entities/transaction.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { Admin } from '../admins/entities/admin.entity';

@Injectable()
export class PayoutsService {
  constructor(
    @Inject('SEQUELIZE') private sequelize: Sequelize,
    private settingsService: SettingsService,
    private notificationsService: NotificationsService,
    private notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * Get current exchange rate from settings
   */
  private async getExchangeRate(): Promise<number> {
    const financial = await this.settingsService.getSettingsByCategory('financial');
    return (financial as any).exchangeRateUsdToNgn;
  }

  /**
   * Calculate processing fee from settings
   */
  private async calculateProcessingFee(amountInNgn: number): Promise<number> {
    const financial = await this.settingsService.getSettingsByCategory('financial');
    const feeType = (financial as any).processingFeeType;
    const fee = (financial as any).processingFee;

    if (feeType === 'percentage') {
      const percentage = (financial as any).processingFeePercentage || 0;
      return (amountInNgn * percentage) / 100;
    }

    // Fixed fee
    return fee || 0;
  }

  /**
   * Create payout request
   */
  async createPayout(userId: string, createDto: CreatePayoutDto) {
    // Get user
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user has completed onboarding
    if (user.onboardingStatus !== OnboardingStatus.COMPLETED) {
      throw new ForbiddenException(
        'You must complete onboarding before requesting a payout',
      );
    }

    // Check if user has sufficient earnings
    const currentEarnings = Number(user.earnings || 0);
    if (currentEarnings < createDto.amount) {
      throw new BadRequestException(
        `Insufficient balance. Your current balance is $${currentEarnings.toFixed(2)}`,
      );
    }

    // Check if user has a pending payout
    const existingPendingPayout = await Payout.findOne({
      where: {
        userId,
        status: PayoutStatus.PENDING,
      },
    });

    if (existingPendingPayout) {
      throw new BadRequestException(
        'You already have a pending payout request. Please wait for it to be processed.',
      );
    }

    // Get verified bank account
    let bankAccount: BankAccount | null = null;
    
    if (createDto.bankAccountId) {
      // Use specified bank account
      bankAccount = await BankAccount.findOne({
        where: {
          id: createDto.bankAccountId,
          userId,
          isVerified: true,
        },
      });

      if (!bankAccount) {
        throw new NotFoundException(
          'Bank account not found or not verified. Please add and verify a bank account first.',
        );
      }
    } else {
      // Use primary bank account
      bankAccount = await BankAccount.findOne({
        where: {
          userId,
          isVerified: true,
          isPrimary: true,
        },
      });

      if (!bankAccount) {
        // Try to get any verified bank account
        bankAccount = await BankAccount.findOne({
          where: {
            userId,
            isVerified: true,
          },
          order: [['createdAt', 'DESC']],
        });
      }

      if (!bankAccount) {
        throw new BadRequestException(
          'No verified bank account found. Please add and verify a bank account before requesting a payout.',
        );
      }
    }

    // Get exchange rate
    const exchangeRate = await this.getExchangeRate();

    // Convert USD to NGN
    const amountInNgn = createDto.amount * exchangeRate;

    // Calculate processing fee
    const processingFee = await this.calculateProcessingFee(amountInNgn);

    // Calculate net amount
    const netAmount = amountInNgn - processingFee;

    if (netAmount <= 0) {
      throw new BadRequestException(
        'Amount is too small. Processing fee exceeds the payout amount.',
      );
    }

    // Create payout request with verified bank account
    const payout = await Payout.create({
      userId,
      amount: createDto.amount,
      amountInNgn,
      processingFee,
      netAmount,
      bankAccount: {
        accountNumber: bankAccount.accountNumber,
        accountName: bankAccount.accountName,
        bankName: bankAccount.bankName,
        bankCode: bankAccount.bankCode,
      },
      status: PayoutStatus.PENDING,
      requestedAt: new Date(),
    } as any);

    // Notify all admins
    try {
      const admins = await Admin.findAll({
        where: { status: 'active' },
        attributes: ['id'],
      });
      const adminIds = admins.map((a) => a.id);

      const notifications = await this.notificationsService.notifyAdminNewPayoutRequest(
        adminIds,
        userId,
        createDto.amount,
        payout.id,
      );

      // Send via WebSocket to online admins
      if (notifications && notifications.length > 0) {
        await this.notificationsGateway.sendToAllAdmins(notifications[0]);
      }
    } catch (notifError) {
      console.error('Failed to send admin notifications:', notifError);
    }

    return {
      id: payout.id,
      amount: Number(payout.amount),
      amountInNgn: Number(payout.amountInNgn),
      processingFee: Number(payout.processingFee),
      netAmount: Number(payout.netAmount),
      bankAccount: payout.bankAccount,
      status: payout.status,
      requestedAt: payout.requestedAt,
      exchangeRate,
      bankAccountId: bankAccount.id,
    };
  }

  /**
   * Get payout by ID
   */
  async getPayoutById(userId: string, payoutId: string) {
    const payout = await Payout.findOne({
      where: { id: payoutId, userId },
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    return {
      id: payout.id,
      amount: Number(payout.amount),
      amountInNgn: Number(payout.amountInNgn),
      processingFee: Number(payout.processingFee),
      netAmount: Number(payout.netAmount),
      bankAccount: payout.bankAccount,
      status: payout.status,
      requestedAt: payout.requestedAt,
      processedAt: payout.processedAt,
      completedAt: payout.completedAt,
      transactionReference: payout.transactionReference,
      rejectionReason: payout.rejectionReason,
      notes: payout.notes,
    };
  }

  /**
   * Get payout history
   */
  async getPayoutHistory(userId: string, page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;
    const maxLimit = Math.min(limit, 50); // Max 50 per page

    const { count, rows } = await Payout.findAndCountAll({
      where: { userId },
      order: [['requestedAt', 'DESC']],
      limit: maxLimit,
      offset,
    });

    return {
      payouts: rows.map((payout) => ({
        id: payout.id,
        amount: Number(payout.amount),
        amountInNgn: Number(payout.amountInNgn),
        processingFee: Number(payout.processingFee),
        netAmount: Number(payout.netAmount),
        status: payout.status,
        requestedAt: payout.requestedAt,
        processedAt: payout.processedAt,
        completedAt: payout.completedAt,
        rejectionReason: payout.rejectionReason,
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(count / maxLimit),
        totalItems: count,
        itemsPerPage: maxLimit,
      },
    };
  }
}

