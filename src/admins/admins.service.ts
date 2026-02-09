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
import { CompleteManualPayoutDto } from './dto/complete-manual-payout.dto';
import { RejectPayoutDto } from './dto/reject-payout.dto';
import { Admin, AdminRole, AdminStatus } from './entities/admin.entity';
import { DEFAULT_ADMIN_PERMISSIONS, PermissionGroups, ALL_PERMISSIONS } from './permissions.constants';
import { PasswordUtil } from '../auth/utils/password.util';
import { EmailService } from '../email/email.service';
import { VerificationCodeUtil } from '../auth/utils/verification-code.util';
import { SupportConversation, ConversationStatus } from '../support/entities/support-conversation.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { SenderType } from '../support/entities/support-message.entity';
import { SupportService } from '../support/support.service';
import { SudoApiService } from '../cards/sudo/sudo-api.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminsService {
  constructor(
    @Inject('SEQUELIZE') private sequelize: Sequelize,
    private storageService: StorageService,
    private emailService: EmailService,
    private supportService: SupportService,
    private notificationsService: NotificationsService,
    private notificationsGateway: NotificationsGateway,
    private sudoApiService: SudoApiService,
    private configService: ConfigService,
  ) {}

  /**
   * Get all credit requests with pagination and filtering
   */
  async getCreditRequests(page: number = 1, limit: number = 10, status?: string) {
    const offset = (page - 1) * limit;
    const maxLimit = Math.min(limit, 50); // Max 50 per page

    const where: { status?: string } = {};
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
          attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'earnings', 'wallet', 'onboardingStatus'],
          required: false,
        },
      ],
    });

    if (!creditRequest) {
      throw new NotFoundException('Credit request not found');
    }

    // Manually load user if association didn't work
    let userData: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      phone: string;
      earnings: number;
      wallet: number;
      balance: number; // Backward compatibility
      onboardingStatus: OnboardingStatus;
    } | null = null;

    if (creditRequest.user) {
      userData = {
        id: creditRequest.user.id,
        email: creditRequest.user.email,
        firstName: creditRequest.user.firstName,
        lastName: creditRequest.user.lastName,
        phone: creditRequest.user.phone,
        earnings: Number(creditRequest.user.earnings || 0),
        wallet: Number(creditRequest.user.wallet || 0),
        balance: Number(creditRequest.user.earnings || 0), // Backward compatibility
        onboardingStatus: creditRequest.user.onboardingStatus,
      };
    } else {
      // Fallback: manually fetch user if association failed
      const user = await User.findByPk(creditRequest.userId, {
        attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'earnings', 'wallet', 'onboardingStatus'],
      });
      if (user) {
        userData = {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          earnings: Number(user.earnings || 0),
          wallet: Number(user.wallet || 0),
          balance: Number(user.earnings || 0), // Backward compatibility
          onboardingStatus: user.onboardingStatus,
        };
      }
    }

    return {
      id: creditRequest.id,
      userId: creditRequest.userId,
      user: userData,
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
        // Update user earnings (TikTok earnings go to earnings balance)
        const currentEarnings = Number(user.earnings || 0);
        user.earnings = currentEarnings + creditAmount;
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

      // Send credit approved email
      try {
        await this.emailService.sendCreditApprovedEmail(
          user.email,
          creditAmount,
          Number(user.earnings || 0),
        );
      } catch (emailError) {
        // Log error but don't fail the approval process
        console.error('Failed to send credit approved email:', emailError);
      }

      // Send notification
      try {
        const notification = await this.notificationsService.notifyCreditApproved(
          user.id,
          creditAmount,
          Number(user.earnings || 0),
          creditRequestId,
        );
        await this.notificationsGateway.sendToUser(user.id, notification);
      } catch (notifError) {
        console.error('Failed to send notification:', notifError);
      }

      const response = {
        id: creditRequest.id,
        status: creditRequest.status,
        processedAt: creditRequest.processedAt,
        processedBy: creditRequest.processedBy,
        creditMethod,
        amount: creditAmount,
        userBalance: Number(user.earnings || 0),
        adminProofUrl,
        bankAccount: creditMethod === CreditMethod.DIRECT && primaryBankAccount ? {
          bankName: primaryBankAccount.bankName,
          accountNumber: primaryBankAccount.accountNumber,
          accountName: primaryBankAccount.accountName,
        } : null,
      };

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

    // Get user for email
    const user = await User.findByPk(creditRequest.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update credit request
    creditRequest.status = CreditRequestStatus.REJECTED;
    creditRequest.processedAt = new Date();
    creditRequest.processedBy = adminId;
    creditRequest.rejectionReason = rejectDto.reason;
    await creditRequest.save();

    // Send credit rejected email
    try {
      await this.emailService.sendCreditRejectedEmail(user.email, rejectDto.reason);
    } catch (emailError) {
      // Log error but don't fail the rejection process
      console.error('Failed to send credit rejected email:', emailError);
    }

    // Send notification
    try {
      const notification = await this.notificationsService.notifyCreditRejected(
        user.id,
        rejectDto.reason,
        creditRequestId,
      );
      await this.notificationsGateway.sendToUser(user.id, notification);
    } catch (notifError) {
      console.error('Failed to send notification:', notifError);
    }

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
      // Using Op from sequelize (already imported at top)
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
        earnings: Number(user.earnings || 0),
        wallet: Number(user.wallet || 0),
        balance: Number(user.earnings || 0), // Backward compatibility
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
      earnings: Number(user.earnings || 0),
      wallet: Number(user.wallet || 0),
      balance: Number(user.earnings || 0), // Backward compatibility
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

      // Send welcome email after successful onboarding
      try {
        await this.emailService.sendWelcomeEmail(
          user.email,
          user.firstName || 'there', // Fallback if firstName is not set
        );
      } catch (emailError) {
        // Log error but don't fail the onboarding process
        console.error('Failed to send welcome email:', emailError);
      }

      // Send notification
      try {
        const notification = await this.notificationsService.notifyOnboardingCompleted(user.id);
        await this.notificationsGateway.sendToUser(user.id, notification);
      } catch (notifError) {
        console.error('Failed to send notification:', notifError);
      }

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
          attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'earnings', 'wallet'],
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
      earnings: number;
      wallet: number;
      balance: number; // Backward compatibility
    } | null = null;

    if (payout.user) {
      userData = {
        id: payout.user.id,
        email: payout.user.email,
        firstName: payout.user.firstName,
        lastName: payout.user.lastName,
        phone: payout.user.phone,
        earnings: Number(payout.user.earnings || 0),
        wallet: Number(payout.user.wallet || 0),
        balance: Number(payout.user.earnings || 0), // Backward compatibility
      };
    } else {
      // Fallback: manually fetch user if association failed
      const user = await User.findByPk(payout.userId, {
        attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'earnings', 'wallet'],
      });
      if (user) {
        userData = {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          earnings: Number(user.earnings || 0),
          wallet: Number(user.wallet || 0),
          balance: Number(user.earnings || 0), // Backward compatibility
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
   * Process/Approve payout - Settles via Sudo (debit settlement account, credit user bank)
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

    const user = await User.findByPk(payout.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const currentEarnings = Number(user.earnings || 0);
    const payoutAmount = Number(payout.amount);
    if (currentEarnings < payoutAmount) {
      throw new BadRequestException(
        `User has insufficient balance. Current balance: $${currentEarnings.toFixed(2)}, Required: $${payoutAmount.toFixed(2)}`,
      );
    }

    const bankAccount = payout.bankAccount as { accountNumber: string; accountName: string; bankName: string; bankCode: string };
    if (!bankAccount?.bankCode || !bankAccount?.accountNumber) {
      throw new BadRequestException('Payout bank account details (bankCode, accountNumber) are required');
    }

    const sudoConfig = this.configService.get('sudo');
    const settlementAccountId = sudoConfig?.defaultSettlementAccountId || sudoConfig?.defaultDebitAccountId;
    if (!settlementAccountId) {
      throw new BadRequestException(
        'Settlement account not configured. Please set SUDO_DEFAULT_SETTLEMENT_ACCOUNT_ID or SUDO_DEFAULT_DEBIT_ACCOUNT_ID.',
      );
    }

    const netAmountNgn = Number(payout.netAmount);
    const paymentReference = `PAYOUT_${payoutId}_${Date.now()}`;
    const narration = `Buykoins payout to ${bankAccount.accountName || 'user'} - Payout ${payoutId}`;

    let transferResult: any;
    try {
      transferResult = await this.sudoApiService.fundTransfer({
        debitAccountId: settlementAccountId,
        amount: netAmountNgn,
        beneficiaryBankCode: bankAccount.bankCode,
        beneficiaryAccountNumber: bankAccount.accountNumber,
        narration,
        paymentReference,
      });
    } catch (sudoError: any) {
      const sudoMessage = sudoError.response?.data?.message || sudoError.message || 'Sudo transfer failed';
      throw new BadRequestException({
        message: `Payout settlement failed: ${sudoMessage}`,
        errorCode: 'SUDO_TRANSFER_FAILED',
        sudoError: sudoMessage,
        hint: 'You can complete this payout manually (admin will add reference/screenshot) or cancel.',
      });
    }

    const sudoTransferId = (transferResult as any)?._id || (transferResult as any)?.id || paymentReference;
    return this.applyPayoutCompletion(payout, user, adminId, processDto.transactionReference || sudoTransferId, processDto.notes);
  }

  /**
   * Apply payout completion (update DB, deduct balance, create transaction, email, notification).
   * Used by processPayout (after Sudo success) and completeManualPayout.
   */
  private async applyPayoutCompletion(
    payout: Payout,
    user: User,
    adminId: string,
    transactionReference: string,
    notes?: string,
  ) {
    const payoutAmount = Number(payout.amount);
    const currentEarnings = Number(user.earnings || 0);
    const bankAccount = payout.bankAccount as { accountNumber: string; accountName: string; bankName: string; bankCode: string };
    const payoutId = payout.id;

    const transaction = await this.sequelize.transaction();
    try {
      payout.status = PayoutStatus.COMPLETED;
      payout.processedAt = new Date();
      payout.completedAt = new Date();
      payout.processedBy = adminId;
      payout.transactionReference = transactionReference;
      if (notes != null) payout.notes = notes;
      await payout.save({ transaction });

      user.earnings = currentEarnings - payoutAmount;
      await user.save({ transaction });

      const exchangeRate = Number(payout.amountInNgn) / Number(payout.amount);
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
          description: `Payout to ${bankAccount?.bankName || 'bank'} ${bankAccount?.accountNumber || ''} - Payout ${payoutId}`,
          referenceId: payoutId,
          date: new Date(),
        } as any,
        { transaction },
      );

      await transaction.commit();

      try {
        await this.emailService.sendPayoutCompletedEmail(
          user.email,
          Number(payout.amount),
          Number(payout.amountInNgn),
          payout.transactionReference || 'N/A',
        );
      } catch (emailError) {
        console.error('Failed to send payout completed email:', emailError);
      }

      try {
        const notification = await this.notificationsService.notifyPayoutCompleted(
          user.id,
          Number(payout.amount),
          payoutId,
        );
        await this.notificationsGateway.sendToUser(user.id, notification);
      } catch (notifError) {
        console.error('Failed to send notification:', notifError);
      }

      return {
        id: payout.id,
        status: payout.status,
        processedAt: payout.processedAt,
        completedAt: payout.completedAt,
        processedBy: payout.processedBy,
        transactionReference: payout.transactionReference,
        userBalance: Number(user.earnings || 0),
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Complete a payout manually (no Sudo). Use when Sudo transfer failed and admin has credited the user externally.
   * Requires transactionReference (e.g. bank ref or screenshot ID).
   */
  async completeManualPayout(payoutId: string, adminId: string, dto: CompleteManualPayoutDto) {
    const payout = await Payout.findByPk(payoutId, {
      include: [{ model: User, as: 'user' }],
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    if (payout.status !== PayoutStatus.PENDING) {
      throw new BadRequestException(
        `Payout is already ${payout.status}. Only pending payouts can be completed manually.`,
      );
    }

    const user = await User.findByPk(payout.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const currentEarnings = Number(user.earnings || 0);
    const payoutAmount = Number(payout.amount);
    if (currentEarnings < payoutAmount) {
      throw new BadRequestException(
        `User has insufficient balance. Current balance: $${currentEarnings.toFixed(2)}, Required: $${payoutAmount.toFixed(2)}`,
      );
    }

    return this.applyPayoutCompletion(payout, user, adminId, dto.transactionReference, dto.notes);
  }

  /**
   * Get Sudo transfer status (for reconciliation/disputes)
   */
  async getPayoutTransferStatus(transferId: string) {
    return this.sudoApiService.getTransferStatus(transferId);
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

        // Determine currency based on transaction type and amountInNgn
        // Priority: 1) Transaction type, 2) amountInNgn presence, 3) Default USD
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
          userId: txn.userId,
          user: userData,
          type: txn.type,
          amount: Number(txn.amount),
          currency: currency,
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
          attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'username', 'earnings', 'wallet'],
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
      earnings: number;
      wallet: number;
      balance: number; // Backward compatibility
    } | null = null;

    if (transaction.user) {
      userData = {
        id: transaction.user.id,
        email: transaction.user.email,
        firstName: transaction.user.firstName,
        lastName: transaction.user.lastName,
        phone: transaction.user.phone,
        username: transaction.user.username,
        earnings: Number(transaction.user.earnings || 0),
        wallet: Number(transaction.user.wallet || 0),
        balance: Number(transaction.user.earnings || 0), // Backward compatibility
      };
    } else {
      const user = await User.findByPk(transaction.userId, {
        attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'username', 'earnings', 'wallet'],
      });
      if (user) {
        userData = {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          username: user.username,
          earnings: Number(user.earnings || 0),
          wallet: Number(user.wallet || 0),
          balance: Number(user.earnings || 0), // Backward compatibility
        };
      }
    }

    // Determine currency based on transaction type and amountInNgn
    // Priority: 1) Transaction type, 2) amountInNgn presence, 3) Default USD
    let currency = 'USD'; // Default
    
    // NGN transactions (wallet-related)
    if (
      transaction.type === TransactionType.DEPOSIT ||
      transaction.type === TransactionType.CARD_FUNDING ||
      transaction.type === TransactionType.TRANSFER_EARNINGS_TO_WALLET ||
      transaction.type === TransactionType.CARD_PURCHASE
    ) {
      currency = 'NGN';
    }
    // If amountInNgn is present, it's definitely NGN
    else if (transaction.amountInNgn !== null && transaction.amountInNgn !== undefined) {
      currency = 'NGN';
    }
    // USD transactions (earnings-related)
    else if (
      transaction.type === TransactionType.CREDIT ||
      transaction.type === TransactionType.WITHDRAWAL ||
      transaction.type === TransactionType.PAYOUT
    ) {
      currency = 'USD';
    }

    return {
      id: transaction.id,
      userId: transaction.userId,
      user: userData,
      type: transaction.type,
      amount: Number(transaction.amount),
      currency: currency,
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

    // Wallet-related transactions
    const totalWalletDeposits = await Transaction.sum('amount', {
      where: { ...where, type: TransactionType.DEPOSIT },
    });

    const totalCardFunding = await Transaction.sum('amount', {
      where: { ...where, type: TransactionType.CARD_FUNDING },
    });

    const totalEarningsToWalletTransfers = await Transaction.sum('amount', {
      where: { ...where, type: TransactionType.TRANSFER_EARNINGS_TO_WALLET },
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
        // Wallet-related totals
        totalWalletDeposits: totalWalletDeposits ? Number(totalWalletDeposits) : 0,
        totalCardFunding: totalCardFunding ? Number(totalCardFunding) : 0,
        totalEarningsToWalletTransfers: totalEarningsToWalletTransfers ? Number(totalEarningsToWalletTransfers) : 0,
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

      // Determine currency for finance report transactions
      let currency = 'USD';
      if (
        txn.type === TransactionType.DEPOSIT ||
        txn.type === TransactionType.CARD_FUNDING ||
        txn.type === TransactionType.TRANSFER_EARNINGS_TO_WALLET ||
        txn.type === TransactionType.CARD_PURCHASE
      ) {
        currency = 'NGN';
      } else if (txn.amountInNgn !== null && txn.amountInNgn !== undefined) {
        currency = 'NGN';
      }

      return {
        id: txn.id,
        userId: txn.userId,
        user: userData,
        type: txn.type,
        amount: Number(txn.amount),
        currency: currency,
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
    ) as Array<{ password_change_otp: string | null; password_change_otp_expires_at: Date | null }>;

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

  /**
   * Get available permissions
   */
  async getAvailablePermissions() {
    return {
      permissions: ALL_PERMISSIONS,
      groups: PermissionGroups,
      defaultAdminPermissions: DEFAULT_ADMIN_PERMISSIONS,
    };
  }

  /**
   * Get admin dashboard overview with actionable items
   */
  async getDashboardOverview() {
    // Get summary statistics
    const [
      pendingCreditRequestsCount,
      pendingOnboardingCount,
      pendingPayoutsCount,
      totalUsersCount,
      totalTransactionsCount,
    ] = await Promise.all([
      CreditRequest.count({ where: { status: CreditRequestStatus.PENDING } }),
      OnboardingRequest.count({ where: { status: OnboardingRequestStatus.PENDING } }),
      Payout.count({ where: { status: PayoutStatus.PENDING } }),
      User.count({ where: { status: UserStatus.ACTIVE } }),
      Transaction.count(),
    ]);

    // Get recent support conversations with unread messages
    const recentSupportConversations = await SupportConversation.findAll({
      where: {
        status: ConversationStatus.OPEN,
      },
      include: [
        { association: 'user', required: false },
      ],
      order: [['lastMessageAt', 'DESC NULLS LAST'], ['createdAt', 'DESC']],
      limit: 10,
    });

    // Calculate unread counts for each conversation
    const supportConversationsWithUnread = await Promise.all(
      recentSupportConversations.map(async (conv) => {
        // Get unread count for this specific conversation
        const convUnreadCount = await this.sequelize.query(
          `SELECT COUNT(*) as count
           FROM support_messages
           WHERE conversation_id = :conversationId
             AND sender_type IN (:senderTypes)
             AND is_read = false`,
          {
            replacements: {
              conversationId: conv.id,
              senderTypes: [SenderType.USER, SenderType.GUEST],
            },
            type: QueryTypes.SELECT,
          },
        ) as Array<{ count: string | number }>;

        const unread = parseInt(String(convUnreadCount[0]?.count || '0'), 10);

        return {
          id: conv.id,
          conversationId: conv.id, // For navigation
          type: conv.type,
          status: conv.status,
          userId: conv.userId,
          guestId: conv.guestId,
          user: conv.user
            ? {
                id: conv.user.id,
                email: conv.user.email,
                firstName: conv.user.firstName,
                lastName: conv.user.lastName,
                username: conv.user.username,
              }
            : null,
          unreadCount: unread,
          lastMessageAt: conv.lastMessageAt ? new Date(conv.lastMessageAt).toISOString() : null,
          createdAt: conv.createdAt ? new Date(conv.createdAt).toISOString() : null,
        };
      }),
    );

    // Filter to only conversations with unread messages
    const newSupportMessages = supportConversationsWithUnread.filter((conv) => conv.unreadCount > 0);

    // Get recent pending onboarding requests
    const recentOnboardingRequests = await OnboardingRequest.findAll({
      where: {
        status: OnboardingRequestStatus.PENDING,
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName', 'username', 'phone'],
        },
      ],
      order: [['submittedAt', 'DESC']],
      limit: 10,
    });

    const onboardingRequests = recentOnboardingRequests.map((req) => ({
      id: req.id,
      onboardingRequestId: req.id, // For navigation
      userId: req.userId,
      user: req.user
        ? {
            id: req.user.id,
            email: req.user.email,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
            username: req.user.username,
            phone: req.user.phone,
          }
        : null,
      message: req.message,
      submittedAt: req.submittedAt ? new Date(req.submittedAt).toISOString() : null,
      createdAt: req.createdAt ? new Date(req.createdAt).toISOString() : null,
    }));

    // Get recent pending payout requests
    const recentPayoutRequests = await Payout.findAll({
      where: {
        status: PayoutStatus.PENDING,
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName', 'username', 'phone', 'earnings', 'wallet'],
        },
      ],
      order: [['requestedAt', 'DESC']],
      limit: 10,
    });

    const payoutRequests = recentPayoutRequests.map((payout) => ({
      id: payout.id,
      payoutId: payout.id, // For navigation
      userId: payout.userId,
      user: payout.user
        ? {
            id: payout.user.id,
            email: payout.user.email,
            firstName: payout.user.firstName,
            lastName: payout.user.lastName,
            username: payout.user.username,
            phone: payout.user.phone,
            earnings: Number(payout.user.earnings || 0),
            wallet: Number(payout.user.wallet || 0),
            balance: Number(payout.user.earnings || 0), // Backward compatibility
          }
        : null,
      amount: Number(payout.amount),
      amountInNgn: Number(payout.amountInNgn),
      processingFee: Number(payout.processingFee),
      netAmount: Number(payout.netAmount),
      bankAccount: payout.bankAccount,
      requestedAt: payout.requestedAt ? new Date(payout.requestedAt).toISOString() : null,
      createdAt: payout.createdAt ? new Date(payout.createdAt).toISOString() : null,
    }));

    // Get recent pending credit requests
    const recentCreditRequests = await CreditRequest.findAll({
      where: {
        status: CreditRequestStatus.PENDING,
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName', 'username', 'phone', 'earnings', 'wallet'],
        },
      ],
      order: [['submittedAt', 'DESC']],
      limit: 10,
    });

    const creditRequests = recentCreditRequests.map((req) => ({
      id: req.id,
      creditRequestId: req.id, // For navigation
      userId: req.userId,
      user: req.user
        ? {
            id: req.user.id,
            email: req.user.email,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
            username: req.user.username,
            phone: req.user.phone,
            earnings: Number(req.user.earnings || 0),
            wallet: Number(req.user.wallet || 0),
            balance: Number(req.user.earnings || 0), // Backward compatibility
          }
        : null,
      amount: Number(req.amount),
      proofUrl: req.proofUrl,
      submittedAt: req.submittedAt ? new Date(req.submittedAt).toISOString() : null,
      createdAt: req.createdAt ? new Date(req.createdAt).toISOString() : null,
    }));

    // Fraud Detection: Find users with suspicious activity
    const fraudAlerts = await this.detectFraudPatterns();

    return {
      summary: {
        pendingCreditRequests: pendingCreditRequestsCount,
        pendingOnboarding: pendingOnboardingCount,
        pendingPayouts: pendingPayoutsCount,
        totalUsers: totalUsersCount,
        totalTransactions: totalTransactionsCount,
      },
      newSupportMessages: newSupportMessages,
      newOnboardingRequests: onboardingRequests,
      newPayoutRequests: payoutRequests,
      newCreditRequests: creditRequests,
      fraudAlerts: fraudAlerts,
    };
  }

  /**
   * Detect fraud patterns and suspicious activity
   */
  private async detectFraudPatterns(): Promise<any[]> {
    const fraudAlerts: any[] = [];

    // 1. Users with too many pending credit requests (more than 3)
    const usersWithMultipleCreditRequests = await this.sequelize.query(
      `SELECT 
        user_id,
        COUNT(*) as pending_count
      FROM credit_requests
      WHERE status = 'pending'
      GROUP BY user_id
      HAVING COUNT(*) > 3
      ORDER BY pending_count DESC
      LIMIT 10`,
      {
        type: QueryTypes.SELECT,
      },
    ) as Array<{ user_id: string; pending_count: string | number }>;

    for (const alert of usersWithMultipleCreditRequests) {
      const user = await User.findByPk(String(alert.user_id), {
        attributes: ['id', 'email', 'firstName', 'lastName', 'username', 'phone'],
      });

      if (user) {
        fraudAlerts.push({
          type: 'multiple_pending_credit_requests',
          severity: 'high',
          message: `User has ${alert.pending_count} pending credit requests`,
          userId: user.id,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
          },
          count: Number(alert.pending_count),
          action: 'Review credit requests',
          link: `/admin/credit-requests?userId=${user.id}`,
        });
      }
    }

    // 2. Users with too many rejected credit requests (potential abuse)
    const usersWithManyRejections = await this.sequelize.query(
      `SELECT 
        user_id,
        COUNT(*) as rejected_count
      FROM credit_requests
      WHERE status = 'rejected'
        AND submitted_at >= NOW() - INTERVAL '30 days'
      GROUP BY user_id
      HAVING COUNT(*) > 5
      ORDER BY rejected_count DESC
      LIMIT 10`,
      {
        type: QueryTypes.SELECT,
      },
    ) as Array<{ user_id: string; rejected_count: string | number }>;

    for (const alert of usersWithManyRejections) {
      const user = await User.findByPk(String(alert.user_id), {
        attributes: ['id', 'email', 'firstName', 'lastName', 'username', 'phone'],
      });

      if (user) {
        fraudAlerts.push({
          type: 'multiple_rejected_credit_requests',
          severity: 'medium',
          message: `User has ${alert.rejected_count} rejected credit requests in the last 30 days`,
          userId: user.id,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
          },
          count: Number(alert.rejected_count),
          action: 'Review user activity',
          link: `/admin/users/${user.id}`,
        });
      }
    }

    // 3. Users with too many pending payouts (more than 2)
    const usersWithMultiplePayouts = await this.sequelize.query(
      `SELECT 
        user_id,
        COUNT(*) as pending_count
      FROM payouts
      WHERE status = 'pending'
      GROUP BY user_id
      HAVING COUNT(*) > 2
      ORDER BY pending_count DESC
      LIMIT 10`,
      {
        type: QueryTypes.SELECT,
      },
    ) as Array<{ user_id: string; pending_count: string | number }>;

    for (const alert of usersWithMultiplePayouts) {
      const user = await User.findByPk(String(alert.user_id), {
        attributes: ['id', 'email', 'firstName', 'lastName', 'username', 'phone'],
      });

      if (user) {
        fraudAlerts.push({
          type: 'multiple_pending_payouts',
          severity: 'medium',
          message: `User has ${alert.pending_count} pending payout requests`,
          userId: user.id,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
          },
          count: Number(alert.pending_count),
          action: 'Review payout requests',
          link: `/admin/payouts?userId=${user.id}`,
        });
      }
    }

    // 4. Users with rapid credit requests (multiple in short time)
    const rapidCreditRequests = await this.sequelize.query(
      `SELECT 
        user_id,
        COUNT(*) as request_count,
        MIN(submitted_at) as first_request,
        MAX(submitted_at) as last_request
      FROM credit_requests
      WHERE submitted_at >= NOW() - INTERVAL '24 hours'
      GROUP BY user_id
      HAVING COUNT(*) > 3
      ORDER BY request_count DESC
      LIMIT 10`,
      {
        type: QueryTypes.SELECT,
      },
    ) as Array<{ user_id: string; request_count: string | number }>;

    for (const alert of rapidCreditRequests) {
      const user = await User.findByPk(String(alert.user_id), {
        attributes: ['id', 'email', 'firstName', 'lastName', 'username', 'phone'],
      });

      if (user) {
        fraudAlerts.push({
          type: 'rapid_credit_requests',
          severity: 'high',
          message: `User submitted ${alert.request_count} credit requests in the last 24 hours`,
          userId: user.id,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
          },
          count: Number(alert.request_count),
          timeWindow: '24 hours',
          action: 'Review for potential abuse',
          link: `/admin/credit-requests?userId=${user.id}`,
        });
      }
    }

    // 5. Users with large credit requests (potential fraud)
    const largeCreditRequests = await CreditRequest.findAll({
      where: {
        status: CreditRequestStatus.PENDING,
        amount: {
          [Op.gte]: 10000, // $10,000 or more
        },
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName', 'username', 'phone'],
        },
      ],
      order: [['amount', 'DESC']],
      limit: 10,
    });

    for (const req of largeCreditRequests) {
      if (req.user) {
        fraudAlerts.push({
          type: 'large_credit_request',
          severity: 'medium',
          message: `Large credit request: $${Number(req.amount).toLocaleString()}`,
          userId: req.userId,
          creditRequestId: req.id,
          user: {
            id: req.user.id,
            email: req.user.email,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
            username: req.user.username,
          },
          amount: Number(req.amount),
          action: 'Review large request',
          link: `/admin/credit-requests/${req.id}`,
        });
      }
    }

    return fraudAlerts;
  }
}

