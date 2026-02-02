import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { Op } from 'sequelize';
import { WidgetSession, WidgetTriggerType, WidgetSessionStatus, WidgetStep } from './entities/widget-session.entity';
import { User, OnboardingStatus } from '../users/entities/user.entity';
import { OnboardingRequest, OnboardingRequestStatus } from '../onboarding/entities/onboarding-request.entity';
import { OnboardingAuthCode, AuthCodeStatus } from '../support/entities/onboarding-auth-code.entity';
import { SupportService } from '../support/support.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { PayoutsService } from '../payouts/payouts.service';
import { Transaction, TransactionType, TransactionStatus } from '../transactions/entities/transaction.entity';
import { InitWidgetDto } from './dto/init-widget.dto';
import { SubmitStepDto } from './dto/submit-step.dto';
import { AuthCodeUtil } from '../support/utils/auth-code.util';
import { GmailReaderService } from './gmail/gmail-reader.service';

@Injectable()
export class WidgetService {
  private readonly logger = new Logger(WidgetService.name);

  constructor(
    @Inject('SEQUELIZE') private sequelize: Sequelize,
    private supportService: SupportService,
    private onboardingService: OnboardingService,
    private payoutsService: PayoutsService,
    private gmailReaderService: GmailReaderService,
  ) {}

  /**
   * Initialize a new widget session
   */
  async initSession(userId: string, initDto: InitWidgetDto): Promise<WidgetSession> {
    // Check if user exists
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Determine initial step based on trigger type
    let initialStep: WidgetStep;
    switch (initDto.trigger) {
      case WidgetTriggerType.ONBOARDING:
        initialStep = WidgetStep.REQUEST_CREDENTIALS;
        break;
      case WidgetTriggerType.WITHDRAWAL:
      case WidgetTriggerType.DEPOSIT:
        initialStep = WidgetStep.COLLECTING_AMOUNT;
        break;
      default:
        throw new BadRequestException('Invalid trigger type');
    }

    // Set expiry (1 hour from now) - sliding window
    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Create session
    const session = await WidgetSession.create({
      userId,
      triggerType: initDto.trigger,
      context: initDto.context || {},
      currentStep: initialStep,
      completedSteps: [],
      collectedData: {},
      status: WidgetSessionStatus.ACTIVE,
      expiresAt,
      lastActivityAt: now, // Track activity
    } as any);

    this.logger.log(`Widget session created: ${session.id} for user ${userId} (${initDto.trigger})`);

    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string, userId: string): Promise<WidgetSession> {
    const session = await WidgetSession.findOne({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      throw new NotFoundException('Widget session not found');
    }

    // Check if session expired (based on last activity)
    const now = new Date();
    const lastActivity = session.lastActivityAt || session.createdAt;
    const hoursSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);
    
    // Expire if inactive for more than 1 hour
    if (hoursSinceActivity > 1) {
      session.status = WidgetSessionStatus.ABANDONED;
      await session.save();
      throw new BadRequestException('Widget session has expired due to inactivity');
    }

    return session;
  }

  /**
   * Get session by ID (admin access - no userId check)
   */
  async getSessionForAdmin(sessionId: string): Promise<WidgetSession> {
    const session = await WidgetSession.findByPk(sessionId);

    if (!session) {
      throw new NotFoundException('Widget session not found');
    }

    return session;
  }

  /**
   * Submit step data
   */
  async submitStep(
    sessionId: string,
    userId: string,
    submitDto: SubmitStepDto,
  ): Promise<{ session: WidgetSession; nextStep?: WidgetStep; oauthUrl?: string }> {
    const session = await this.getSession(sessionId, userId);

    if (session.status !== WidgetSessionStatus.ACTIVE) {
      throw new BadRequestException(`Session is ${session.status}`);
    }

    // Validate step
    if (session.currentStep !== submitDto.step) {
      throw new BadRequestException(`Expected step ${session.currentStep}, got ${submitDto.step}`);
    }

    // Update collected data
    const collectedData = {
      ...session.collectedData,
      [submitDto.step]: submitDto.data,
    };

    // Mark step as completed
    const completedSteps = [...session.completedSteps];
    if (!completedSteps.includes(submitDto.step)) {
      completedSteps.push(submitDto.step);
    }

    // Determine next step
    const nextStep = this.getNextStep(session.triggerType, submitDto.step, collectedData);

    // Update session with sliding window expiration
    const now = new Date();
    const newExpiresAt = new Date();
    newExpiresAt.setHours(newExpiresAt.getHours() + 1); // Extend by 1 hour from now
    
    session.collectedData = collectedData;
    session.completedSteps = completedSteps;
    session.currentStep = nextStep || WidgetStep.COMPLETED;
    session.lastActivityAt = now; // Update activity timestamp
    session.expiresAt = newExpiresAt; // Extend expiration (sliding window)
    
    if (nextStep === WidgetStep.COMPLETED) {
      session.status = WidgetSessionStatus.COMPLETED;
    }

    await session.save();

    // Handle step-specific logic
    if (submitDto.step === WidgetStep.REQUEST_CREDENTIALS && session.triggerType === WidgetTriggerType.ONBOARDING) {
      // Notify admin to provide credentials
      await this.notifyAdminForCredentials(userId, sessionId);
    }
    // Note: Auth code verification removed - users don't need to verify codes

    return {
      session,
      nextStep,
    };
  }

  /**
   * Get next step based on current step and collected data
   */
  private getNextStep(
    triggerType: WidgetTriggerType,
    currentStep: string,
    collectedData: Record<string, any>,
  ): WidgetStep | null {
    switch (triggerType) {
      case WidgetTriggerType.ONBOARDING:
        if (currentStep === WidgetStep.REQUEST_CREDENTIALS) {
          return WidgetStep.WAITING_FOR_ADMIN;
        }
        if (currentStep === WidgetStep.WAITING_FOR_ADMIN) {
          // Skip auth code step - go directly to TikTok setup instructions
          return WidgetStep.TIKTOK_SETUP_INSTRUCTIONS;
        }
        // ENTER_AUTH_CODE step removed from flow
        if (currentStep === WidgetStep.TIKTOK_SETUP_INSTRUCTIONS) {
          return WidgetStep.CONFIRM_SETUP;
        }
        if (currentStep === WidgetStep.CONFIRM_SETUP) {
          return WidgetStep.PENDING_VERIFICATION;
        }
        if (currentStep === WidgetStep.PENDING_VERIFICATION) {
          return WidgetStep.COMPLETED;
        }
        break;

      case WidgetTriggerType.WITHDRAWAL:
      case WidgetTriggerType.DEPOSIT:
        if (currentStep === WidgetStep.COLLECTING_AMOUNT) {
          return WidgetStep.COLLECTING_PROOF;
        }
        if (currentStep === WidgetStep.COLLECTING_PROOF) {
          return WidgetStep.CONFIRMING_PAYPAL;
        }
        if (currentStep === WidgetStep.CONFIRMING_PAYPAL) {
          return WidgetStep.PENDING_ADMIN;
        }
        if (currentStep === WidgetStep.PENDING_ADMIN) {
          return WidgetStep.PROCESSING;
        }
        if (currentStep === WidgetStep.PROCESSING) {
          return WidgetStep.COMPLETED;
        }
        break;
    }

    return null;
  }

  /**
   * Complete widget session
   */
  async completeSession(sessionId: string, userId: string): Promise<WidgetSession> {
    const session = await this.getSession(sessionId, userId);

    if (session.status === WidgetSessionStatus.COMPLETED) {
      return session;
    }

    // Process based on trigger type
    switch (session.triggerType) {
      case WidgetTriggerType.ONBOARDING:
        await this.completeOnboarding(session);
        break;
      case WidgetTriggerType.WITHDRAWAL:
        await this.completeWithdrawal(session);
        break;
      case WidgetTriggerType.DEPOSIT:
        await this.completeDeposit(session);
        break;
    }

    session.status = WidgetSessionStatus.COMPLETED;
    session.currentStep = WidgetStep.COMPLETED;
    await session.save();

    return session;
  }

  /**
   * Complete onboarding flow
   */
  private async completeOnboarding(session: WidgetSession): Promise<void> {
    const user = await User.findByPk(session.userId);
    if (!user) return;

    // Create or update onboarding request
    let onboardingRequest = await OnboardingRequest.findOne({
      where: {
        userId: session.userId,
        status: OnboardingRequestStatus.PENDING,
      },
    });

    if (!onboardingRequest) {
      onboardingRequest = await OnboardingRequest.create({
        userId: session.userId,
        status: OnboardingRequestStatus.PENDING,
        submittedAt: new Date(),
        message: 'Onboarding completed via widget',
      } as any);
    }

    // Note: Admin will mark onboarding as complete via admin panel
    // We just ensure the request exists
    this.logger.log(`Onboarding widget completed for user ${session.userId} via widget session ${session.id}`);
  }

  /**
   * Complete withdrawal flow
   */
  private async completeWithdrawal(session: WidgetSession): Promise<void> {
    const amount = session.collectedData?.[WidgetStep.COLLECTING_AMOUNT]?.amount;
    if (!amount) {
      throw new BadRequestException('Amount is required for withdrawal');
    }

    // Create payout request using existing service
    try {
      await this.payoutsService.createPayout(session.userId, {
        amount: Number(amount),
      });
      this.logger.log(`Withdrawal request created for user ${session.userId} via widget session ${session.id}`);
    } catch (error) {
      this.logger.error(`Failed to create withdrawal request: ${error.message}`);
      throw error;
    }
  }

  /**
   * Complete deposit flow
   */
  private async completeDeposit(session: WidgetSession): Promise<void> {
    const amount = session.collectedData?.[WidgetStep.COLLECTING_AMOUNT]?.amount;
    if (!amount) {
      throw new BadRequestException('Amount is required for deposit');
    }

    const user = await User.findByPk(session.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Credit user wallet
    const transaction = await this.sequelize.transaction();
    try {
      // Widget deposits go to earnings (TikTok earnings)
      const currentEarnings = Number(user.earnings || 0);
      const depositAmount = Number(amount);
      user.earnings = currentEarnings + depositAmount;
      await user.save({ transaction });

      // Create transaction record
      await Transaction.create({
        userId: session.userId,
        type: TransactionType.CREDIT,
        amount: depositAmount,
        status: TransactionStatus.COMPLETED,
        description: `Deposit via widget - Session ${session.id}`,
        date: new Date(),
      } as any, { transaction });

      await transaction.commit();
      this.logger.log(`Deposit credited for user ${session.userId}: $${depositAmount} via widget session ${session.id}`);
    } catch (error) {
      await transaction.rollback();
      this.logger.error(`Failed to credit deposit: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get active sessions for user
   */
  async getUserSessions(userId: string): Promise<WidgetSession[]> {
    return WidgetSession.findAll({
      where: {
        userId,
        status: WidgetSessionStatus.ACTIVE,
        expiresAt: {
          [Op.gt]: new Date(),
        },
      },
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Notify admin to provide PayPal credentials
   */
  private async notifyAdminForCredentials(userId: string, sessionId: string): Promise<void> {
    try {
      // Get or create support conversation for onboarding
      const user = await User.findByPk(userId);
      if (!user) return;

      // Create onboarding request if it doesn't exist
      await this.onboardingService.createOnboardingRequest(userId, {
        message: 'User requested PayPal credentials via widget',
      });

      // Create support conversation for admin notification
      // This will be handled by the support system
      this.logger.log(`Admin notification sent for credentials request: user ${userId}, session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to notify admin for credentials: ${error.message}`);
      // Don't throw - allow flow to continue
    }
  }

  /**
   * Validate auth code
   */
  private async validateAuthCode(userId: string, sessionId: string, code: string): Promise<boolean> {
    // Use existing support service method for consistency
    try {
      const result = await this.supportService.verifyOnboardingAuthCode(code, userId, null);
      return result.valid;
    } catch (error) {
      this.logger.error(`Auth code validation error: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate auth code (called by admin) - uses existing support service
   */
  async generateAuthCode(userId: string, adminId: string, sessionId: string, conversationId?: string): Promise<string> {
    // Use existing support service method for consistency
    const result = await this.supportService.generateOnboardingAuthCode({
      userId,
      adminId,
      conversationId: conversationId || null,
    });

    this.logger.log(`Auth code generated for user ${userId} by admin ${adminId} via widget session ${sessionId}: ${result.code}`);
    return result.code;
  }

  /**
   * Get auth code from Gmail (called by admin)
   * Admin retrieves code from Gmail after user logs into PayPal
   */
  async getAuthCodeFromGmail(userId: string, sessionId: string): Promise<string | null> {
    // Try to get latest code from Gmail
    const authCode = await this.gmailReaderService.getLatestPayPalAuthCode();
    
    if (authCode) {
      this.logger.log(`Retrieved PayPal auth code from Gmail for user ${userId}: ${authCode}`);
    } else {
      this.logger.warn(`No PayPal auth code found in Gmail for user ${userId}`);
    }
    
    return authCode;
  }

  /**
   * Store auth code retrieved from Gmail (called by admin after retrieving from Gmail)
   */
  async storeRetrievedAuthCode(
    userId: string,
    adminId: string,
    sessionId: string,
    authCode: string,
    conversationId?: string,
  ): Promise<OnboardingAuthCode> {
    // Store in onboarding_auth_codes table
    const result = await this.supportService.generateOnboardingAuthCode({
      userId,
      adminId,
      conversationId: conversationId || null,
    });

    // Update the code with the one from Gmail
    result.code = authCode;
    await result.save();

    this.logger.log(`Stored PayPal auth code from Gmail for user ${userId} by admin ${adminId}: ${authCode}`);
    return result;
  }
}

