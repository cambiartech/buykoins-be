import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { User, OnboardingStatus } from './entities/user.entity';
import { CreditRequest, CreditRequestStatus } from '../credit-requests/entities/credit-request.entity';
import { Transaction, TransactionType, TransactionStatus } from '../transactions/entities/transaction.entity';
import { Payout, PayoutStatus } from '../payouts/entities/payout.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { VerifyIdentityDto } from './dto/verify-identity.dto';
import { SudoApiService } from '../cards/sudo/sudo-api.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersService {
  constructor(
    @Inject('SEQUELIZE') private sequelize: Sequelize,
    private sudoApiService: SudoApiService,
    private configService: ConfigService,
  ) {}

  /**
   * Get user dashboard data
   */
  async getDashboard(userId: string) {
    // Get user with associations
    const user = await User.findByPk(userId, {
      attributes: {
        exclude: ['password', 'verificationCode', 'verificationCodeExpiresAt'],
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get latest credit request
    const latestCreditRequest = await CreditRequest.findOne({
      where: { userId },
      order: [['submittedAt', 'DESC']],
      attributes: ['id', 'amount', 'status', 'submittedAt', 'processedAt', 'rejectionReason'],
    });

    // Determine credit request status for dashboard
    let creditRequestStatus: 'none' | 'pending' | 'sent' | 'rejected' = 'none';
    let creditRequestAmount: number | null = null;
    let creditRequestSubmittedAt: Date | null = null;

    if (latestCreditRequest) {
      if (latestCreditRequest.status === CreditRequestStatus.PENDING) {
        creditRequestStatus = 'pending';
      } else if (latestCreditRequest.status === CreditRequestStatus.APPROVED) {
        creditRequestStatus = 'sent';
      } else if (latestCreditRequest.status === CreditRequestStatus.REJECTED) {
        creditRequestStatus = 'rejected';
      }
      creditRequestAmount = Number(latestCreditRequest.amount);
      creditRequestSubmittedAt = latestCreditRequest.submittedAt;
    }

    // Get recent transactions (last 10)
    const recentTransactions = await Transaction.findAll({
      where: { userId },
      order: [['date', 'DESC']],
      limit: 10,
      attributes: ['id', 'type', 'amount', 'amountInNgn', 'status', 'description', 'date', 'referenceId'],
    });

    // Get recent credit requests (last 5) for recent activities
    const recentCreditRequests = await CreditRequest.findAll({
      where: { userId },
      order: [['submittedAt', 'DESC']],
      limit: 5,
      attributes: ['id', 'amount', 'status', 'submittedAt', 'processedAt', 'rejectionReason'],
    });

    // Get recent payout requests (last 5) for recent activities
    const recentPayoutRequests = await Payout.findAll({
      where: { userId },
      order: [['requestedAt', 'DESC']],
      limit: 5,
      attributes: ['id', 'amount', 'amountInNgn', 'netAmount', 'status', 'requestedAt', 'processedAt', 'completedAt', 'rejectionReason'],
    });

    // Combine transactions, credit requests, and payout requests for recent activities
    const recentActivities = [
      // Add credit requests as activities
      ...recentCreditRequests.map((cr) => ({
        id: cr.id,
        type: 'credit_request',
        amount: Number(cr.amount),
        date: cr.submittedAt,
        status: cr.status,
        description: `Credit request - ${cr.status}`,
        referenceId: cr.id,
      })),
      // Add payout requests as activities
      ...recentPayoutRequests.map((payout) => ({
        id: payout.id,
        type: 'payout_request',
        amount: Number(payout.amount),
        amountInNgn: Number(payout.amountInNgn),
        netAmount: Number(payout.netAmount),
        date: payout.requestedAt,
        status: payout.status,
        description: `Payout request - ${payout.status}`,
        referenceId: payout.id,
      })),
      // Add transactions as activities
      ...recentTransactions.map((txn) => {
        // Determine currency based on transaction type and amountInNgn
        let currency = 'USD'; // Default
        
        // NGN transactions (wallet-related)
        if (
          txn.type === TransactionType.DEPOSIT ||
          txn.type === TransactionType.CARD_FUNDING ||
          txn.type === TransactionType.TRANSFER_EARNINGS_TO_WALLET ||
          txn.type === TransactionType.CARD_PURCHASE
        ) {
          currency = 'NGN';
        }
        // If amountInNgn is present, it's definitely NGN
        else if (txn.amountInNgn !== null && txn.amountInNgn !== undefined) {
          currency = 'NGN';
        }
        // USD transactions (earnings-related)
        else if (
          txn.type === TransactionType.CREDIT ||
          txn.type === TransactionType.WITHDRAWAL ||
          txn.type === TransactionType.PAYOUT
        ) {
          currency = 'USD';
        }

        return {
          id: txn.id,
          type: txn.type,
          amount: Number(txn.amount),
          currency: currency,
          amountInNgn: txn.amountInNgn ? Number(txn.amountInNgn) : null,
          date: txn.date,
          status: txn.status,
          description: txn.description,
          referenceId: txn.referenceId,
        };
      }),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10); // Get top 10 most recent

    // Get exchange rate (hardcoded for now, will be dynamic when admin settings are implemented)
    // TODO: Fetch from platform_settings table when admin module is ready
    const exchangeRate = {
      usdToNgn: 1500.00, // Default rate
      lastUpdated: new Date(),
    };

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        username: user.username,
        onboardingStatus: user.onboardingStatus,
        earnings: Number(user.earnings || 0),
        wallet: Number(user.wallet || 0),
        balance: Number(user.earnings || 0), // Backward compatibility
        emailVerified: user.emailVerified,
      },
      creditRequest: {
        status: creditRequestStatus,
        amount: creditRequestAmount,
        submittedAt: creditRequestSubmittedAt,
      },
      recentTransactions: recentTransactions.map((txn) => {
        // Determine currency based on transaction type and amountInNgn
        let currency = 'USD'; // Default
        
        // NGN transactions (wallet-related)
        if (
          txn.type === TransactionType.DEPOSIT ||
          txn.type === TransactionType.CARD_FUNDING ||
          txn.type === TransactionType.TRANSFER_EARNINGS_TO_WALLET ||
          txn.type === TransactionType.CARD_PURCHASE
        ) {
          currency = 'NGN';
        }
        // If amountInNgn is present, it's definitely NGN
        else if (txn.amountInNgn !== null && txn.amountInNgn !== undefined) {
          currency = 'NGN';
        }
        // USD transactions (earnings-related)
        else if (
          txn.type === TransactionType.CREDIT ||
          txn.type === TransactionType.WITHDRAWAL ||
          txn.type === TransactionType.PAYOUT
        ) {
          currency = 'USD';
        }

        return {
          id: txn.id,
          type: txn.type,
          amount: Number(txn.amount),
          currency: currency,
          amountInNgn: txn.amountInNgn ? Number(txn.amountInNgn) : null,
          date: txn.date,
          status: txn.status,
          description: txn.description,
        };
      }),
      recentActivities, // New: Combined activities including credit requests
      todayRate: exchangeRate,
    };
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string) {
    const user = await User.findByPk(userId, {
      attributes: {
        exclude: ['password', 'verificationCode', 'verificationCodeExpiresAt'],
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      phone: user.phone,
      emailVerified: user.emailVerified,
      onboardingStatus: user.onboardingStatus,
      balance: Number(user.balance),
      status: user.status,
      walletStatus: user.walletStatus,
      joinedAt: user.joinedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      authType: user.authType ?? 'email',
      tiktokDisplayName: user.tiktokDisplayName ?? null,
      tiktokAvatarUrl: user.tiktokAvatarUrl ?? null,
      hasTikTok: !!user.tiktokOpenId,
    };
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update only provided fields
    if (updateProfileDto.firstName !== undefined) {
      user.firstName = updateProfileDto.firstName;
    }
    if (updateProfileDto.lastName !== undefined) {
      user.lastName = updateProfileDto.lastName;
    }
    if (updateProfileDto.phone !== undefined) {
      user.phone = updateProfileDto.phone;
    }

    await user.save();

    // Return updated profile (excluding sensitive data)
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      phone: user.phone,
      emailVerified: user.emailVerified,
      onboardingStatus: user.onboardingStatus,
      balance: Number(user.balance),
      status: user.status,
      walletStatus: user.walletStatus,
      joinedAt: user.joinedAt,
      updatedAt: user.updatedAt,
      authType: user.authType ?? 'email',
      tiktokDisplayName: user.tiktokDisplayName ?? null,
      tiktokAvatarUrl: user.tiktokAvatarUrl ?? null,
      hasTikTok: !!user.tiktokOpenId,
    };
  }

  /**
   * Verify user identity with Sudo API (BVN or NIN)
   * Creates Sudo customer if needed, using organization billing address
   */
  async verifyIdentity(userId: string, verifyIdentityDto: VerifyIdentityDto) {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user already has Sudo customer (already verified)
    const existingSudoCustomer = await this.sequelize.models.SudoCustomer.findOne({
      where: { userId },
    });

    if (existingSudoCustomer) {
      // User already has Sudo customer - mark as verified
      const currentData = user.sudoCustomerOnboardingData || {};
      user.sudoCustomerOnboardingData = {
        ...currentData,
        identity: {
          identityType: verifyIdentityDto.identityType,
          verified: true,
          verifiedAt: new Date().toISOString(),
        },
        onboardingCompleted: true,
      };
      await user.save();

      return {
        success: true,
        message: `${verifyIdentityDto.identityType} already verified (Sudo customer exists)`,
        identity: {
          identityType: verifyIdentityDto.identityType,
          verified: true,
        },
      };
    }

    try {
      // Get organization billing address from config
      const billingAddress = {
        line1: this.configService.get<string>('sudo.defaultBillingLine1') || '123 Main Street',
        line2: this.configService.get<string>('sudo.defaultBillingLine2') || '',
        city: this.configService.get<string>('sudo.defaultBillingCity') || 'Lagos',
        state: this.configService.get<string>('sudo.defaultBillingState') || 'Lagos',
        postalCode: this.configService.get<string>('sudo.defaultBillingPostalCode') || '100001',
        country: this.configService.get<string>('sudo.defaultBillingCountry') || 'NG',
      };

      // Create Sudo customer with identity verification
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;
      const customerData = {
        type: 'individual' as const,
        name: fullName,
        phoneNumber: user.phone || '+2348000000000',
        emailAddress: user.email,
        status: 'active' as const,
        billingAddress,
        individual: {
          firstName: user.firstName || user.username,
          lastName: user.lastName || user.username,
          dob: verifyIdentityDto.dob || '1990-01-01',
          identity: {
            type: verifyIdentityDto.identityType,
            number: verifyIdentityDto.identityNumber,
          },
        },
        metadata: {
          platformUserId: userId,
          username: user.username,
        },
      };

      // Call Sudo API to create customer and verify identity
      const sudoCustomerData = await this.sudoApiService.createCustomer(customerData);

      // Get customer ID (Sudo uses _id)
      const customerId = (sudoCustomerData as any)?._id || sudoCustomerData.id;
      if (!customerId) {
        throw new BadRequestException('Failed to create Sudo customer: No customer ID returned');
      }

      // Store Sudo customer in database
      await this.sequelize.models.SudoCustomer.create({
        userId,
        sudoCustomerId: customerId,
      } as any);

      // Update user with verified identity (but NOT the BVN/NIN number!)
      const currentData = user.sudoCustomerOnboardingData || {};
      user.sudoCustomerOnboardingData = {
        ...currentData,
        dob: verifyIdentityDto.dob || currentData.dob,
        sudoCustomerId: customerId,
        billingAddress, // Store organization billing address used
        identity: {
          identityType: verifyIdentityDto.identityType,
          verified: true,
          verifiedAt: new Date().toISOString(),
          // DO NOT store identityNumber!
        },
        onboardingCompleted: true,
      };

      await user.save();

      return {
        success: true,
        message: `${verifyIdentityDto.identityType} verified successfully with Sudo`,
        identity: {
          identityType: verifyIdentityDto.identityType,
          verified: true,
        },
      };
    } catch (error: any) {
      // Handle Sudo API errors
      if (error.response?.data) {
        const sudoError = error.response.data;
        throw new BadRequestException(
          `Identity verification failed: ${sudoError.message || 'Invalid BVN/NIN or data mismatch'}`,
        );
      }
      throw new BadRequestException(
        `Identity verification failed: ${error.message || 'Unable to verify identity'}`,
      );
    }
  }
}

