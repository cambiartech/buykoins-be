import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { Op, QueryTypes } from 'sequelize';
import { CreditRequest, CreditRequestStatus } from '../credit-requests/entities/credit-request.entity';
import { User, UserStatus, OnboardingStatus } from '../users/entities/user.entity';
import { Transaction, TransactionType, TransactionStatus } from '../transactions/entities/transaction.entity';
import { OnboardingRequest, OnboardingRequestStatus } from '../onboarding/entities/onboarding-request.entity';
import { ApproveCreditRequestDto, CreditMethod } from './dto/approve-credit-request.dto';
import { RejectCreditRequestDto } from './dto/reject-credit-request.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { BankAccount } from '../bank-accounts/entities/bank-account.entity';
import { StorageService } from '../storage/storage.service';
import { Payout, PayoutStatus } from '../payouts/entities/payout.entity';
import { ProcessPayoutDto } from './dto/process-payout.dto';
import { RejectPayoutDto } from './dto/reject-payout.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { Admin, AdminRole, AdminStatus } from './entities/admin.entity';
import { DEFAULT_ADMIN_PERMISSIONS, PermissionGroups, ALL_PERMISSIONS } from './permissions.constants';
import { PasswordUtil } from '../auth/utils/password.util';
import { EmailService } from '../email/email.service';
import { VerificationCodeUtil } from '../auth/utils/verification-code.util';

@Injectable()
export class AdminsService {
  constructor(
    @Inject('SEQUELIZE') private sequelize: Sequelize,
    private storageService: StorageService,
    private emailService: EmailService,
  ) {}

  /**
   * Get all credit requests with pagination and filtering
   */
  async getCreditRequests(page: number = 1, limit: number = 10, status?: string) {
    const offset = (page - 1) * limit;
    const maxLimit = Math.min(limit, 50); // Max 50 per page

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    const { count, rows } = await CreditRequest.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName', 'phone'],
          required: false, // Left join - include even if user doesn't exist
        },
      ],
      order: [['submittedAt', 'DESC']],
      limit: maxLimit,
      offset,
    });

    // Manually load users if association didn't work
    const creditRequestsWithUsers = await Promise.all(
      rows.map(async (request) => {
        let userData: {
          id: string;
          email: string;
          firstName: string;
          lastName: string;
          phone: string;
        } | null = null;
        if (request.user) {
          userData = {
            id: request.user.id,
            email: request.user.email,
            firstName: request.user.firstName,
            lastName: request.user.lastName,
            phone: request.user.phone,
          };
        } else {
          // Fallback: manually fetch user if association failed
          const user = await User.findByPk(request.userId, {
            attributes: ['id', 'email', 'firstName', 'lastName', 'phone'],
          });
          if (user) {
            userData = {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              phone: user.phone,
            };
          }
        }

        return {
          id: request.id,
          userId: request.userId,
          user: userData,
          amount: Number(request.amount),
          proofUrl: request.proofUrl,
          status: request.status,
          submittedAt: request.submittedAt,
          processedAt: request.processedAt,
          processedBy: request.processedBy,
          rejectionReason: request.rejectionReason,
          notes: request.notes,
          adminProofUrl: request.adminProofUrl || null,
        };
      }),
    );

    return {
      creditRequests: creditRequestsWithUsers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(count / maxLimit),
        totalItems: count,
        itemsPerPage: maxLimit,
      },
    };
  }

  /**
   * Get credit request by ID
   */
  async getCreditRequestById(id: string) {
    const creditRequest = await CreditRequest.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'balance', 'onboardingStatus'],
        },
      ],
    });

    if (!creditRequest) {
      throw new NotFoundException('Credit request not found');
    }

    return {
      id: creditRequest.id,
      userId: creditRequest.userId,
      user: creditRequest.user
        ? {
            id: creditRequest.user.id,
            email: creditRequest.user.email,
            firstName: creditRequest.user.firstName,
            lastName: creditRequest.user.lastName,
            phone: creditRequest.user.phone,
            balance: Number(creditRequest.user.balance),
            onboardingStatus: creditRequest.user.onboardingStatus,
          }
        : null,
      amount: Number(creditRequest.amount),
      proofUrl: creditRequest.proofUrl,
      status: creditRequest.status,
      submittedAt: creditRequest.submittedAt,
      processedAt: creditRequest.processedAt,
      processedBy: creditRequest.processedBy,
      rejectionReason: creditRequest.rejectionReason,
      notes: creditRequest.notes,
    };
  }

  /**
   * Approve credit request
   */
  async approveCreditRequest(
    creditRequestId: string,
    adminId: string,
    approveDto: ApproveCreditRequestDto,
    adminProofFile?: Express.Multer.File,
  ) {
    // Get credit request with user
    const creditRequest = await CreditRequest.findByPk(creditRequestId, {
      include: [{ model: User, as: 'user' }],
    });

    if (!creditRequest) {
      throw new NotFoundException('Credit request not found');
    }

    if (creditRequest.status !== CreditRequestStatus.PENDING) {
      throw new BadRequestException(
        `Credit request is already ${creditRequest.status}. Only pending requests can be approved.`,
      );
    }

    // Get user
    const user = await User.findByPk(creditRequest.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Determine credit amount (use provided amount or request amount)
    const creditAmount = approveDto.amount
      ? Number(approveDto.amount)
      : Number(creditRequest.amount);

    // Determine credit method (default to balance)
    const creditMethod = approveDto.creditMethod || CreditMethod.BALANCE;

    // If direct remittance, check for user's primary bank account
    let primaryBankAccount: BankAccount | null = null;
    if (creditMethod === CreditMethod.DIRECT) {
      primaryBankAccount = await BankAccount.findOne({
        where: { userId: user.id, isVerified: true, isPrimary: true },
      });

      if (!primaryBankAccount) {
        throw new BadRequestException(
          'User does not have a verified primary bank account. Cannot process direct remittance.',
        );
      }
    }

    // Upload admin proof if provided
    let adminProofUrl: string | null = null;
    if (adminProofFile) {
      adminProofUrl = await this.storageService.getPublicUrl(
        await this.storageService.uploadFile(adminProofFile, 'admin-proofs'),
      );
    }

    // Use transaction to ensure atomicity
    const transaction = await this.sequelize.transaction();

    try {
      // Update credit request
      creditRequest.status = CreditRequestStatus.APPROVED;
      creditRequest.processedAt = new Date();
      creditRequest.processedBy = adminId;
      if (approveDto.notes) {
        creditRequest.notes = approveDto.notes;
      }
      if (adminProofUrl) {
        creditRequest.adminProofUrl = adminProofUrl;
      }
      await creditRequest.save({ transaction });

      if (creditMethod === CreditMethod.BALANCE) {
        // Update user balance
        const currentBalance = Number(user.balance);
        user.balance = currentBalance + creditAmount;
        await user.save({ transaction });

        // Create transaction record for balance credit
        await Transaction.create(
          {
            userId: user.id,
            type: TransactionType.CREDIT,
            amount: creditAmount,
            status: TransactionStatus.COMPLETED,
            description: `Credit from TikTok earnings - Request ${creditRequestId}`,
            referenceId: creditRequestId,
            date: new Date(),
          } as any,
          { transaction },
        );
      } else if (creditMethod === CreditMethod.DIRECT && primaryBankAccount) {
        // Direct remittance - create transaction record (balance not updated)
        await Transaction.create(
          {
            userId: user.id,
            type: TransactionType.CREDIT,
            amount: creditAmount,
            status: TransactionStatus.COMPLETED,
            description: `Direct remittance to bank account - ${primaryBankAccount.bankName} ${primaryBankAccount.accountNumber} - Request ${creditRequestId}`,
            referenceId: creditRequestId,
            date: new Date(),
          } as any,
          { transaction },
        );
      }

      await transaction.commit();

      const response: any = {
        id: creditRequest.id,
        status: creditRequest.status,
        processedAt: creditRequest.processedAt,
        processedBy: creditRequest.processedBy,
        creditMethod,
        amount: creditAmount,
        userBalance: Number(user.balance),
        adminProofUrl,
      };

      if (creditMethod === CreditMethod.DIRECT && primaryBankAccount) {
        response.bankAccount = {
          bankName: primaryBankAccount.bankName,
          accountNumber: primaryBankAccount.accountNumber,
          accountName: primaryBankAccount.accountName,
        };
      } else {
        response.bankAccount = null;
      }

      return response;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Reject credit request
   */
  async rejectCreditRequest(
    creditRequestId: string,
    adminId: string,
    rejectDto: RejectCreditRequestDto,
  ) {
    const creditRequest = await CreditRequest.findByPk(creditRequestId);

    if (!creditRequest) {
      throw new NotFoundException('Credit request not found');
    }

    if (creditRequest.status !== CreditRequestStatus.PENDING) {
      throw new BadRequestException(
        `Credit request is already ${creditRequest.status}. Only pending requests can be rejected.`,
      );
    }

    // Update credit request
    creditRequest.status = CreditRequestStatus.REJECTED;
    creditRequest.processedAt = new Date();
    creditRequest.processedBy = adminId;
    creditRequest.rejectionReason = rejectDto.reason;
    await creditRequest.save();

    return {
      id: creditRequest.id,
      status: creditRequest.status,
      processedAt: creditRequest.processedAt,
      processedBy: creditRequest.processedBy,
      rejectionReason: creditRequest.rejectionReason,
    };
  }

  /**
   * Get all users with pagination and filtering
   */
  async getUsers(
    page: number = 1,
    limit: number = 10,
    search?: string,
    status?: string,
    onboardingStatus?: string,
  ) {
    const offset = (page - 1) * limit;
    const maxLimit = Math.min(limit, 50); // Max 50 per page

    const where: any = {};

    if (status && status !== 'all') {
      where.status = status;
    }

    if (onboardingStatus && onboardingStatus !== 'all') {
      where.onboardingStatus = onboardingStatus;
    }

    // Search functionality
    if (search) {
      const { Op } = require('sequelize');
      where[Op.or] = [
        { email: { [Op.iLike]: `%${search}%` } },
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
        { username: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: {
        exclude: ['password', 'verificationCode', 'verificationCodeExpiresAt'],
      },
      order: [['joinedAt', 'DESC']],
      limit: maxLimit,
      offset,
    });

    return {
      users: rows.map((user) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        phone: user.phone,
        balance: Number(user.balance),
        status: user.status,
        onboardingStatus: user.onboardingStatus,
        emailVerified: user.emailVerified,
        walletStatus: user.walletStatus,
        joinedAt: user.joinedAt,
        createdAt: user.createdAt,
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(count / maxLimit),
        totalItems: count,
        itemsPerPage: maxLimit,
      },
    };
  }

  /**
   * Get user by ID with full details
   */
  async getUserById(userId: string) {
    const user = await User.findByPk(userId, {
      attributes: {
        exclude: ['password', 'verificationCode', 'verificationCodeExpiresAt'],
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get latest onboarding request separately
    const latestOnboardingRequest = await OnboardingRequest.findOne({
      where: { userId },
      order: [['submittedAt', 'DESC']],
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      phone: user.phone,
      balance: Number(user.balance),
      status: user.status,
      onboardingStatus: user.onboardingStatus,
      emailVerified: user.emailVerified,
      walletStatus: user.walletStatus,
      joinedAt: user.joinedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      onboardingRequest: latestOnboardingRequest
        ? {
            id: latestOnboardingRequest.id,
            message: latestOnboardingRequest.message,
            status: latestOnboardingRequest.status,
            submittedAt: latestOnboardingRequest.submittedAt,
            completedAt: latestOnboardingRequest.completedAt,
            notes: latestOnboardingRequest.notes,
          }
        : null,
    };
  }

  /**
   * Get user bank accounts
   */
  async getUserBankAccounts(userId: string) {
    // Verify user exists
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get all bank accounts for the user
    const bankAccounts = await BankAccount.findAll({
      where: { userId },
      order: [
        ['isPrimary', 'DESC'], // Primary accounts first
        ['createdAt', 'DESC'],
      ],
    });

    return bankAccounts.map((account) => ({
      id: account.id,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      bankName: account.bankName,
      bankCode: account.bankCode,
      isVerified: account.isVerified,
      isPrimary: account.isPrimary,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    }));
  }

  /**
   * Complete user onboarding
   */
  async completeOnboarding(
    userId: string,
    adminId: string,
    completeDto: CompleteOnboardingDto,
  ) {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.onboardingStatus === OnboardingStatus.COMPLETED) {
      throw new BadRequestException('User is already onboarded');
    }

    // Get or create onboarding request
    let onboardingRequest = await OnboardingRequest.findOne({
      where: { userId, status: OnboardingRequestStatus.PENDING },
      order: [['submittedAt', 'DESC']],
    });

    if (!onboardingRequest) {
      // Create onboarding request if it doesn't exist
      onboardingRequest = await OnboardingRequest.create({
        userId,
        status: OnboardingRequestStatus.PENDING,
        submittedAt: new Date(),
      } as any);
    }

    // Use transaction to ensure atomicity
    const transaction = await this.sequelize.transaction();

    try {
      // Update user onboarding status
      user.onboardingStatus = OnboardingStatus.COMPLETED;
      await user.save({ transaction });

      // Update onboarding request
      onboardingRequest.status = OnboardingRequestStatus.COMPLETED;
      onboardingRequest.completedAt = new Date();
      onboardingRequest.completedBy = adminId;
      onboardingRequest.notes = completeDto.notes;
      await onboardingRequest.save({ transaction });

      await transaction.commit();

      return {
        userId: user.id,
        onboardingStatus: user.onboardingStatus,
        onboardingRequest: {
          id: onboardingRequest.id,
          status: onboardingRequest.status,
          completedAt: onboardingRequest.completedAt,
          completedBy: onboardingRequest.completedBy,
          notes: onboardingRequest.notes,
        },
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Suspend user
   */
  async suspendUser(userId: string, reason: string) {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new BadRequestException('User is already suspended');
    }

    user.status = UserStatus.SUSPENDED;
    await user.save();

    return {
      id: user.id,
      status: user.status,
    };
  }

  /**
   * Unsuspend user
   */
  async unsuspendUser(userId: string) {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status !== UserStatus.SUSPENDED) {
      throw new BadRequestException('User is not suspended');
    }

    user.status = UserStatus.ACTIVE;
    await user.save();

    return {
      id: user.id,
      status: user.status,
    };
  }

  /**
   * Get all payouts with pagination and filtering
   */
  async getPayouts(page: number = 1, limit: number = 10, status?: string) {
    const offset = (page - 1) * limit;
    const maxLimit = Math.min(limit, 50); // Max 50 per page

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    const { count, rows } = await Payout.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName', 'phone'],
          required: false,
        },
      ],
      order: [['requestedAt', 'DESC']],
      limit: maxLimit,
      offset,
    });

    // Manually load users if association didn't work
    const payoutsWithUsers = await Promise.all(
      rows.map(async (payout) => {
        let userData: {
          id: string;
          email: string;
          firstName: string;
          lastName: string;
          phone: string;
        } | null = null;
        if (payout.user) {
          userData = {
            id: payout.user.id,
            email: payout.user.email,
            firstName: payout.user.firstName,
            lastName: payout.user.lastName,
            phone: payout.user.phone,
          };
        } else {
          const user = await User.findByPk(payout.userId, {
            attributes: ['id', 'email', 'firstName', 'lastName', 'phone'],
          });
          if (user) {
            userData = {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              phone: user.phone,
            };
          }
        }

        return {
          id: payout.id,
          userId: payout.userId,
          user: userData,
          amount: Number(payout.amount),
          amountInNgn: Number(payout.amountInNgn),
          processingFee: Number(payout.processingFee),
          netAmount: Number(payout.netAmount),
          bankAccount: payout.bankAccount,
          status: payout.status,
          requestedAt: payout.requestedAt,
          processedAt: payout.processedAt,
          completedAt: payout.completedAt,
          processedBy: payout.processedBy,
          transactionReference: payout.transactionReference,
          rejectionReason: payout.rejectionReason,
          notes: payout.notes,
        };
      }),
    );

    return {
      payouts: payoutsWithUsers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(count / maxLimit),
        totalItems: count,
        itemsPerPage: maxLimit,
      },
    };
  }

  /**
   * Get payout by ID
   */
  async getPayoutById(id: string) {
    const payout = await Payout.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'balance'],
          required: false,
        },
      ],
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    // Manually load user if association didn't work
    let userData: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      phone: string;
      balance: number;
    } | null = null;

    if (payout.user) {
      userData = {
        id: payout.user.id,
        email: payout.user.email,
        firstName: payout.user.firstName,
        lastName: payout.user.lastName,
        phone: payout.user.phone,
        balance: Number(payout.user.balance),
      };
    } else {
      // Fallback: manually fetch user if association failed
      const user = await User.findByPk(payout.userId, {
        attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'balance'],
      });
      if (user) {
        userData = {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          balance: Number(user.balance),
        };
      }
    }

    return {
      id: payout.id,
      userId: payout.userId,
      user: userData,
      amount: Number(payout.amount),
      amountInNgn: Number(payout.amountInNgn),
      processingFee: Number(payout.processingFee),
      netAmount: Number(payout.netAmount),
      bankAccount: payout.bankAccount,
      status: payout.status,
      requestedAt: payout.requestedAt,
      processedAt: payout.processedAt,
      completedAt: payout.completedAt,
      processedBy: payout.processedBy,
      transactionReference: payout.transactionReference,
      rejectionReason: payout.rejectionReason,
      notes: payout.notes,
    };
  }

  /**
   * Process/Approve payout
   */
  async processPayout(payoutId: string, adminId: string, processDto: ProcessPayoutDto) {
    const payout = await Payout.findByPk(payoutId, {
      include: [{ model: User, as: 'user' }],
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    if (payout.status !== PayoutStatus.PENDING) {
      throw new BadRequestException(
        `Payout is already ${payout.status}. Only pending payouts can be processed.`,
      );
    }

    // Get user
    const user = await User.findByPk(payout.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user has sufficient balance
    const currentBalance = Number(user.balance);
    const payoutAmount = Number(payout.amount);
    if (currentBalance < payoutAmount) {
      throw new BadRequestException(
        `User has insufficient balance. Current balance: $${currentBalance.toFixed(2)}, Required: $${payoutAmount.toFixed(2)}`,
      );
    }

    // Use transaction to ensure atomicity
    const transaction = await this.sequelize.transaction();

    try {
      // Update payout status
      payout.status = PayoutStatus.COMPLETED;
      payout.processedAt = new Date();
      payout.completedAt = new Date();
      payout.processedBy = adminId;
      if (processDto.transactionReference) {
        payout.transactionReference = processDto.transactionReference;
      }
      if (processDto.notes) {
        payout.notes = processDto.notes;
      }
      await payout.save({ transaction });

      // Deduct from user balance
      user.balance = currentBalance - payoutAmount;
      await user.save({ transaction });

      // Calculate exchange rate used (from payout data)
      const exchangeRate = Number(payout.amountInNgn) / Number(payout.amount);

      // Create transaction record with finance data
      await Transaction.create(
        {
          userId: user.id,
          type: TransactionType.PAYOUT,
          amount: payoutAmount,
          amountInNgn: Number(payout.amountInNgn),
          exchangeRate: exchangeRate,
          processingFee: Number(payout.processingFee),
          netAmount: Number(payout.netAmount),
          status: TransactionStatus.COMPLETED,
          description: `Payout to ${payout.bankAccount.bankName} ${payout.bankAccount.accountNumber} - Payout ${payoutId}`,
          referenceId: payoutId,
          date: new Date(),
        } as any,
        { transaction },
      );

      await transaction.commit();

      return {
        id: payout.id,
        status: payout.status,
        processedAt: payout.processedAt,
        completedAt: payout.completedAt,
        processedBy: payout.processedBy,
        userBalance: Number(user.balance),
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Reject payout
   */
  async rejectPayout(payoutId: string, adminId: string, rejectDto: RejectPayoutDto) {
    const payout = await Payout.findByPk(payoutId);

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    if (payout.status !== PayoutStatus.PENDING) {
      throw new BadRequestException(
        `Payout is already ${payout.status}. Only pending payouts can be rejected.`,
      );
    }

    payout.status = PayoutStatus.REJECTED;
    payout.processedAt = new Date();
    payout.processedBy = adminId;
    payout.rejectionReason = rejectDto.rejectionReason;
    await payout.save();

    return {
      id: payout.id,
      status: payout.status,
      processedAt: payout.processedAt,
      processedBy: payout.processedBy,
      rejectionReason: payout.rejectionReason,
    };
  }

  /**
   * Get all transactions with pagination and flexible filtering
   */
  async getTransactions(
    page: number = 1,
    limit: number = 10,
    filters?: {
      type?: string;
      status?: string;
      userId?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const offset = (page - 1) * limit;
    const maxLimit = Math.min(limit, 100); // Max 100 per page for transactions

    const where: any = {};

    // Filter by type
    if (filters?.type && filters.type !== 'all') {
      where.type = filters.type;
    }

    // Filter by status
    if (filters?.status && filters.status !== 'all') {
      where.status = filters.status;
    }

    // Filter by user
    if (filters?.userId) {
      where.userId = filters.userId;
    }

    // Date range filter
    if (filters?.dateFrom || filters?.dateTo) {
      where.date = {};
      if (filters.dateFrom) {
        where.date[Op.gte] = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        // Add one day to include the entire end date
        const endDate = new Date(filters.dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.date[Op.lte] = endDate;
      }
    }

    // Search functionality (searches in description and user email/name via join)
    let includeUser = true;
    if (filters?.search) {
      includeUser = true; // Need user for search
    }

    const { count, rows } = await Transaction.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'username'],
          required: false,
        },
      ],
      order: [['date', 'DESC']],
      limit: maxLimit,
      offset,
    });

    // If search is provided, filter by user details
    let filteredRows = rows;
    if (filters?.search) {
      const searchTerm = filters.search.toLowerCase();
      filteredRows = rows.filter((txn) => {
        const matchesDescription = txn.description?.toLowerCase().includes(searchTerm);
        const matchesUserEmail = txn.user?.email?.toLowerCase().includes(searchTerm);
        const matchesUserName = txn.user?.username?.toLowerCase().includes(searchTerm);
        const matchesUserFirstName = txn.user?.firstName?.toLowerCase().includes(searchTerm);
        const matchesUserLastName = txn.user?.lastName?.toLowerCase().includes(searchTerm);
        const matchesUserId = txn.userId.toLowerCase().includes(searchTerm);
        return (
          matchesDescription ||
          matchesUserEmail ||
          matchesUserName ||
          matchesUserFirstName ||
          matchesUserLastName ||
          matchesUserId
        );
      });
    }

    // Manually load users if association didn't work
    const transactionsWithUsers = await Promise.all(
      filteredRows.map(async (txn) => {
        let userData: {
          id: string;
          email: string;
          firstName: string;
          lastName: string;
          phone: string;
          username: string;
        } | null = null;

        if (txn.user) {
          userData = {
            id: txn.user.id,
            email: txn.user.email,
            firstName: txn.user.firstName,
            lastName: txn.user.lastName,
            phone: txn.user.phone,
            username: txn.user.username,
          };
        } else {
          const user = await User.findByPk(txn.userId, {
            attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'username'],
          });
          if (user) {
            userData = {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              phone: user.phone,
              username: user.username,
            };
          }
        }

        return {
          id: txn.id,
          userId: txn.userId,
          user: userData,
          type: txn.type,
          amount: Number(txn.amount),
          amountInNgn: txn.amountInNgn ? Number(txn.amountInNgn) : null,
          exchangeRate: txn.exchangeRate ? Number(txn.exchangeRate) : null,
          processingFee: txn.processingFee ? Number(txn.processingFee) : null,
          netAmount: txn.netAmount ? Number(txn.netAmount) : null,
          status: txn.status,
          description: txn.description,
          referenceId: txn.referenceId,
          date: txn.date,
          createdAt: txn.createdAt,
        };
      }),
    );

    // Recalculate count if search was applied
    const finalCount = filters?.search ? transactionsWithUsers.length : count;

    return {
      transactions: transactionsWithUsers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(finalCount / maxLimit),
        totalItems: finalCount,
        itemsPerPage: maxLimit,
      },
      filters: {
        type: filters?.type || 'all',
        status: filters?.status || 'all',
        userId: filters?.userId || null,
        search: filters?.search || null,
        dateFrom: filters?.dateFrom || null,
        dateTo: filters?.dateTo || null,
      },
    };
  }

  /**
   * Get transaction by ID
   */
  async getTransactionById(id: string) {
    const transaction = await Transaction.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'username', 'balance'],
          required: false,
        },
      ],
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Manually load user if association didn't work
    let userData: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      phone: string;
      username: string;
      balance: number;
    } | null = null;

    if (transaction.user) {
      userData = {
        id: transaction.user.id,
        email: transaction.user.email,
        firstName: transaction.user.firstName,
        lastName: transaction.user.lastName,
        phone: transaction.user.phone,
        username: transaction.user.username,
        balance: Number(transaction.user.balance),
      };
    } else {
      const user = await User.findByPk(transaction.userId, {
        attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'username', 'balance'],
      });
      if (user) {
        userData = {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          username: user.username,
          balance: Number(user.balance),
        };
      }
    }

    return {
      id: transaction.id,
      userId: transaction.userId,
      user: userData,
      type: transaction.type,
      amount: Number(transaction.amount),
      amountInNgn: transaction.amountInNgn ? Number(transaction.amountInNgn) : null,
      exchangeRate: transaction.exchangeRate ? Number(transaction.exchangeRate) : null,
      processingFee: transaction.processingFee ? Number(transaction.processingFee) : null,
      netAmount: transaction.netAmount ? Number(transaction.netAmount) : null,
      status: transaction.status,
      description: transaction.description,
      referenceId: transaction.referenceId,
      date: transaction.date,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }

  /**
   * Get transaction statistics/summary
   */
  async getTransactionStatistics(filters?: {
    type?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: any = {};

    if (filters?.type && filters.type !== 'all') {
      where.type = filters.type;
    }

    if (filters?.status && filters.status !== 'all') {
      where.status = filters.status;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.date = {};
      if (filters.dateFrom) {
        where.date[Op.gte] = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        const endDate = new Date(filters.dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.date[Op.lte] = endDate;
      }
    }

    // Get total count
    const totalCount = await Transaction.count({ where });

    // Get count by type - using raw SQL for aggregation
    const countByTypeResult = await Transaction.findAll({
      where,
      attributes: [
        'type',
        [this.sequelize.fn('COUNT', this.sequelize.col('id')), 'count'],
        [this.sequelize.fn('SUM', this.sequelize.col('amount')), 'totalAmount'],
      ],
      group: ['type'],
      raw: true,
    });

    // Get count by status
    const countByStatusResult = await Transaction.findAll({
      where,
      attributes: [
        'status',
        [this.sequelize.fn('COUNT', this.sequelize.col('id')), 'count'],
      ],
      group: ['status'],
      raw: true,
    });

    // Calculate smart totals - separate credits from withdrawals/payouts
    const totalCredits = await Transaction.sum('amount', {
      where: { ...where, type: TransactionType.CREDIT },
    });

    const totalWithdrawals = await Transaction.sum('amount', {
      where: {
        ...where,
        type: { [Op.in]: [TransactionType.WITHDRAWAL, TransactionType.PAYOUT] },
      },
    });

    // Net balance = credits - withdrawals (actual value in system)
    const netBalance = (totalCredits ? Number(totalCredits) : 0) - (totalWithdrawals ? Number(totalWithdrawals) : 0);

    // Total transaction volume (sum of absolute values - shows activity level)
    const allTransactions = await Transaction.findAll({
      where,
      attributes: ['amount'],
      raw: true,
    });
    const totalVolume = allTransactions.reduce((sum, txn: any) => sum + Math.abs(Number(txn.amount || 0)), 0);

    // Completed amounts
    const completedCredits = await Transaction.sum('amount', {
      where: { ...where, type: TransactionType.CREDIT, status: TransactionStatus.COMPLETED },
    });

    const completedWithdrawals = await Transaction.sum('amount', {
      where: {
        ...where,
        type: { [Op.in]: [TransactionType.WITHDRAWAL, TransactionType.PAYOUT] },
        status: TransactionStatus.COMPLETED,
      },
    });

    const completedNetBalance =
      (completedCredits ? Number(completedCredits) : 0) - (completedWithdrawals ? Number(completedWithdrawals) : 0);

    return {
      summary: {
        totalTransactions: totalCount,
        // Smart breakdown
        totalCredits: totalCredits ? Number(totalCredits) : 0,
        totalWithdrawals: totalWithdrawals ? Number(totalWithdrawals) : 0,
        netBalance: netBalance, // Actual value in system (credits - withdrawals)
        totalVolume: totalVolume, // Total transaction volume (sum of absolute values)
        // Completed breakdown
        completedCredits: completedCredits ? Number(completedCredits) : 0,
        completedWithdrawals: completedWithdrawals ? Number(completedWithdrawals) : 0,
        completedNetBalance: completedNetBalance,
      },
      byType: countByTypeResult.map((item: any) => ({
        type: item.type,
        count: Number(item.count),
        totalAmount: Number(item.totalAmount || 0),
      })),
      byStatus: countByStatusResult.map((item: any) => ({
        status: item.status,
        count: Number(item.count),
      })),
    };
  }

  /**
   * Get finance/charges report for bookkeeping
   * Returns all fees, conversion charges, and financial metrics
   */
  async getFinanceReport(filters?: {
    dateFrom?: string;
    dateTo?: string;
    type?: string;
  }) {
    const where: any = {};

    if (filters?.type && filters.type !== 'all') {
      where.type = filters.type;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.date = {};
      if (filters.dateFrom) {
        where.date[Op.gte] = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        const endDate = new Date(filters.dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.date[Op.lte] = endDate;
      }
    }

    // Get all payout/withdrawal transactions (these have fees)
    const withdrawalTransactions = await Transaction.findAll({
      where: {
        ...where,
        type: { [Op.in]: [TransactionType.PAYOUT, TransactionType.WITHDRAWAL] },
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName'],
          required: false,
        },
      ],
      order: [['date', 'DESC']],
    });

    // Calculate totals
    const totalProcessingFees = await Transaction.sum('processingFee', {
      where: {
        ...where,
        type: { [Op.in]: [TransactionType.PAYOUT, TransactionType.WITHDRAWAL] },
        processingFee: { [Op.ne]: null },
      },
    });

    const totalAmountInNgn = await Transaction.sum('amountInNgn', {
      where: {
        ...where,
        type: { [Op.in]: [TransactionType.PAYOUT, TransactionType.WITHDRAWAL] },
        amountInNgn: { [Op.ne]: null },
      },
    });

    const totalNetAmount = await Transaction.sum('netAmount', {
      where: {
        ...where,
        type: { [Op.in]: [TransactionType.PAYOUT, TransactionType.WITHDRAWAL] },
        netAmount: { [Op.ne]: null },
      },
    });

    const totalAmountUsd = await Transaction.sum('amount', {
      where: {
        ...where,
        type: { [Op.in]: [TransactionType.PAYOUT, TransactionType.WITHDRAWAL] },
      },
    });

    // Get average exchange rate
    const avgExchangeRateResult = await Transaction.findAll({
      where: {
        ...where,
        type: { [Op.in]: [TransactionType.PAYOUT, TransactionType.WITHDRAWAL] },
        exchangeRate: { [Op.ne]: null },
      },
      attributes: [
        [this.sequelize.fn('AVG', this.sequelize.col('exchange_rate')), 'avgRate'],
      ],
      raw: true,
    });

    const avgExchangeRate = (avgExchangeRateResult[0] as any)?.avgRate
      ? Number((avgExchangeRateResult[0] as any).avgRate)
      : null;

    // Format transaction details
    const transactionDetails = withdrawalTransactions.map((txn) => {
      let userData: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
      } | null = null;

      if (txn.user) {
        userData = {
          id: txn.user.id,
          email: txn.user.email,
          firstName: txn.user.firstName,
          lastName: txn.user.lastName,
        };
      }

      return {
        id: txn.id,
        userId: txn.userId,
        user: userData,
        type: txn.type,
        amount: Number(txn.amount),
        amountInNgn: txn.amountInNgn ? Number(txn.amountInNgn) : null,
        exchangeRate: txn.exchangeRate ? Number(txn.exchangeRate) : null,
        processingFee: txn.processingFee ? Number(txn.processingFee) : null,
        netAmount: txn.netAmount ? Number(txn.netAmount) : null,
        status: txn.status,
        description: txn.description,
        date: txn.date,
        createdAt: txn.createdAt,
      };
    });

    return {
      summary: {
        totalTransactions: withdrawalTransactions.length,
        totalAmountUsd: totalAmountUsd ? Number(totalAmountUsd) : 0,
        totalAmountNgn: totalAmountInNgn ? Number(totalAmountInNgn) : 0,
        totalProcessingFees: totalProcessingFees ? Number(totalProcessingFees) : 0,
        totalNetAmount: totalNetAmount ? Number(totalNetAmount) : 0,
        averageExchangeRate: avgExchangeRate,
      },
      transactions: transactionDetails,
      filters: {
        dateFrom: filters?.dateFrom || null,
        dateTo: filters?.dateTo || null,
        type: filters?.type || 'all',
      },
    };
  }

  // ========== Admin Management ==========

  /**
   * Get all admins with pagination and filtering
   */
  async getAdmins(
    page: number = 1,
    limit: number = 10,
    search?: string,
    role?: string,
    status?: string,
  ) {
    const offset = (page - 1) * limit;
    const maxLimit = Math.min(limit, 50);

    const where: any = {};

    if (role && role !== 'all') {
      where.role = role;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      where[Op.or] = [
        { email: { [Op.iLike]: `%${search}%` } },
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Admin.findAndCountAll({
      where,
      attributes: {
        exclude: ['password'],
      },
      order: [['createdAt', 'DESC']],
      limit: maxLimit,
      offset,
    });

    return {
      admins: rows.map((admin) => ({
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role,
        permissions: admin.permissions || [],
        status: admin.status,
        lastLoginAt: admin.lastLoginAt,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(count / maxLimit),
        totalItems: count,
        itemsPerPage: maxLimit,
      },
    };
  }

  /**
   * Get admin by ID
   */
  async getAdminById(adminId: string) {
    const admin = await Admin.findByPk(adminId, {
      attributes: {
        exclude: ['password'],
      },
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: admin.role,
      permissions: admin.permissions || [],
      status: admin.status,
      lastLoginAt: admin.lastLoginAt,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
  }

  /**
   * Create new admin
   */
  async createAdmin(createDto: any, createdBy: string) {
    // Check if email already exists
    const existingAdmin = await Admin.findOne({
      where: { email: createDto.email },
    });

    if (existingAdmin) {
      throw new BadRequestException('Admin with this email already exists');
    }

    // Hash password
    const hashedPassword = await PasswordUtil.hash(createDto.password);

    // Set default permissions if not provided
    const permissions = createDto.permissions || [];
    if (createDto.role === AdminRole.ADMIN && permissions.length === 0) {
      permissions.push(...DEFAULT_ADMIN_PERMISSIONS);
    }

    // Create admin
    const admin = await Admin.create({
      email: createDto.email,
      password: hashedPassword,
      firstName: createDto.firstName,
      lastName: createDto.lastName,
      role: createDto.role || AdminRole.ADMIN,
      permissions: permissions as any,
      status: AdminStatus.ACTIVE,
    } as any);

    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: admin.role,
      permissions: admin.permissions || [],
      status: admin.status,
      createdAt: admin.createdAt,
    };
  }

  /**
   * Update admin
   */
  async updateAdmin(adminId: string, updateDto: any, updatedBy: string) {
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    // Prevent updating super admin role (only super admins can do this)
    const updater = await Admin.findByPk(updatedBy);
    if (admin.role === AdminRole.SUPER_ADMIN && updater?.role !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admins can modify super admin accounts');
    }

    // Check if email is being changed and if it already exists
    if (updateDto.email && updateDto.email !== admin.email) {
      const existingAdmin = await Admin.findOne({
        where: { email: updateDto.email },
      });

      if (existingAdmin) {
        throw new BadRequestException('Admin with this email already exists');
      }
      admin.email = updateDto.email;
    }

    // Password updates require OTP verification (handled separately)
    // This method should not update password directly - use requestPasswordChangeOtp and verifyPasswordChangeOtp instead
    if (updateDto.password) {
      throw new BadRequestException(
        'Password cannot be updated directly. Please use the password change OTP flow.',
      );
    }

    if (updateDto.firstName) {
      admin.firstName = updateDto.firstName;
    }

    if (updateDto.lastName) {
      admin.lastName = updateDto.lastName;
    }

    if (updateDto.role) {
      admin.role = updateDto.role;
    }

    if (updateDto.permissions !== undefined) {
      admin.permissions = updateDto.permissions;
    }

    if (updateDto.status) {
      admin.status = updateDto.status;
    }

    await admin.save();

    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: admin.role,
      permissions: admin.permissions || [],
      status: admin.status,
      updatedAt: admin.updatedAt,
    };
  }

  /**
   * Suspend admin
   */
  async suspendAdmin(adminId: string, suspendedBy: string, reason?: string) {
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    // Prevent suspending super admin
    if (admin.role === AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot suspend super admin account');
    }

    // Prevent self-suspension
    if (admin.id === suspendedBy) {
      throw new BadRequestException('You cannot suspend your own account');
    }

    admin.status = AdminStatus.DISABLED;
    await admin.save();

    return {
      id: admin.id,
      status: admin.status,
      updatedAt: admin.updatedAt,
    };
  }

  /**
   * Unsuspend admin
   */
  async unsuspendAdmin(adminId: string) {
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    admin.status = AdminStatus.ACTIVE;
    await admin.save();

    return {
      id: admin.id,
      status: admin.status,
      updatedAt: admin.updatedAt,
    };
  }

  /**
   * Delete admin (soft delete by setting status to disabled)
   */
  async deleteAdmin(adminId: string, deletedBy: string) {
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    // Prevent deleting super admin
    if (admin.role === AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot delete super admin account');
    }

    // Prevent self-deletion
    if (admin.id === deletedBy) {
      throw new BadRequestException('You cannot delete your own account');
    }

    // Soft delete by setting status to disabled
    admin.status = AdminStatus.DISABLED;
    await admin.save();

    return {
      id: admin.id,
      status: admin.status,
      deletedAt: new Date(),
    };
  }

  /**
   * Get available permissions list
   */
  async getAvailablePermissions() {
    return {
      permissions: ALL_PERMISSIONS,
      groups: PermissionGroups,
    };
  }

  /**
   * Request OTP for password change
   */
  async requestPasswordChangeOtp(adminId: string) {
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    // Generate OTP
    const otp = VerificationCodeUtil.generate();
    const expiresAt = VerificationCodeUtil.getExpirationDate(15); // 15 minutes

    // Save OTP using raw SQL to handle timezone correctly
    await this.sequelize.query(
      `UPDATE admins 
       SET password_change_otp = :otp,
           password_change_otp_expires_at = :expiresAt::timestamp with time zone,
           updated_at = NOW()
       WHERE id = :adminId`,
      {
        replacements: {
          otp,
          expiresAt: expiresAt.toISOString(),
          adminId,
        },
        type: QueryTypes.UPDATE,
      },
    );

    // Send OTP via email
    try {
      await this.emailService.sendAdminPasswordChangeOtp(admin.email, otp);
    } catch (error) {
      // Log error but don't fail the request
      console.error('Failed to send password change OTP email:', error);
      // In development, log to console
      if (process.env.NODE_ENV === 'development') {
        console.log('===========================================');
        console.log('PASSWORD CHANGE OTP (Development Mode)');
        console.log('===========================================');
        console.log(`Email: ${admin.email}`);
        console.log(`OTP: ${otp}`);
        console.log(`Expires in: 15 minutes`);
        console.log('===========================================');
      }
    }

    return {
      message: 'OTP sent to your email address',
      expiresIn: 15, // minutes
    };
  }

  /**
   * Verify and update password with OTP
   */
  async verifyPasswordChangeOtp(adminId: string, password: string, verificationCode: string) {
    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    // Get OTP from database with raw SQL
    const result = await this.sequelize.query(
      `SELECT password_change_otp, password_change_otp_expires_at
       FROM admins 
       WHERE id = :adminId`,
      {
        replacements: { adminId },
        type: QueryTypes.SELECT,
      },
    ) as any[];

    const dbOtp = result[0]?.password_change_otp;
    const dbOtpExpiresAt = result[0]?.password_change_otp_expires_at;

    if (!dbOtp) {
      throw new BadRequestException(
        'No OTP found. Please request a new password change OTP.',
      );
    }

    if (verificationCode !== dbOtp) {
      throw new BadRequestException('Invalid verification code');
    }

    if (!dbOtpExpiresAt) {
      throw new BadRequestException('OTP has expired');
    }

    // Check expiration
    const expirationDate = new Date(dbOtpExpiresAt);
    const now = new Date();
    const nowTimestamp = now.getTime();
    const expirationTimestamp = expirationDate.getTime();

    if (nowTimestamp > expirationTimestamp) {
      const diffMs = nowTimestamp - expirationTimestamp;
      const diffMinutes = Math.round(diffMs / 60000);
      throw new BadRequestException(`OTP expired ${diffMinutes} minute(s) ago`);
    }

    // Hash new password
    const hashedPassword = await PasswordUtil.hash(password);

    // Update password and clear OTP
    await this.sequelize.query(
      `UPDATE admins 
       SET password = :hashedPassword,
           password_change_otp = NULL,
           password_change_otp_expires_at = NULL,
           updated_at = NOW()
       WHERE id = :adminId`,
      {
        replacements: {
          hashedPassword,
          adminId,
        },
        type: QueryTypes.UPDATE,
      },
    );

    return {
      message: 'Password updated successfully',
    };
  }
}

