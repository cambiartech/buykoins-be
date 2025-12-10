import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { User, OnboardingStatus } from './entities/user.entity';
import { CreditRequest, CreditRequestStatus } from '../credit-requests/entities/credit-request.entity';
import { Transaction, TransactionType, TransactionStatus } from '../transactions/entities/transaction.entity';
import { Payout, PayoutStatus } from '../payouts/entities/payout.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @Inject('SEQUELIZE') private sequelize: Sequelize,
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
      attributes: ['id', 'type', 'amount', 'status', 'description', 'date', 'referenceId'],
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
      ...recentTransactions.map((txn) => ({
        id: txn.id,
        type: txn.type,
        amount: Number(txn.amount),
        date: txn.date,
        status: txn.status,
        description: txn.description,
        referenceId: txn.referenceId,
      })),
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
        balance: Number(user.balance),
        emailVerified: user.emailVerified,
      },
      creditRequest: {
        status: creditRequestStatus,
        amount: creditRequestAmount,
        submittedAt: creditRequestSubmittedAt,
      },
      recentTransactions: recentTransactions.map((txn) => ({
        id: txn.id,
        type: txn.type,
        amount: Number(txn.amount),
        date: txn.date,
        status: txn.status,
        description: txn.description,
      })),
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
    };
  }
}

