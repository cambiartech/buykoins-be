import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { OnboardingRequest, OnboardingRequestStatus } from './entities/onboarding-request.entity';
import { User, OnboardingStatus } from '../users/entities/user.entity';
import { CreateOnboardingRequestDto } from './dto/create-onboarding-request.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { Admin } from '../admins/entities/admin.entity';
import { SettingsService } from '../settings/settings.service';
import { BusinessRulesSettings } from '../settings/interfaces/settings.interface';
import { EmailService } from '../email/email.service';

@Injectable()
export class OnboardingService {
  constructor(
    @Inject('SEQUELIZE') private sequelize: Sequelize,
    private notificationsService: NotificationsService,
    private notificationsGateway: NotificationsGateway,
    private settingsService: SettingsService,
    private emailService: EmailService,
  ) {}

  /**
   * Submit onboarding request
   */
  async createOnboardingRequest(userId: string, createDto: CreateOnboardingRequestDto) {
    // Check if user already has completed onboarding
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.onboardingStatus === OnboardingStatus.COMPLETED) {
      throw new ConflictException('You have already completed onboarding');
    }

    if (!user.tiktokOpenId) {
      throw new BadRequestException(
        'You must link your TikTok account before requesting onboarding. Use "Add TikTok Account" in your profile or onboarding flow.',
      );
    }

    // Get business rules settings
    const businessRules = await this.settingsService.getSettingsByCategory('business-rules') as BusinessRulesSettings;

    // Check if BVN or NIN is required
    const requiresIdentity = businessRules.requireBvnForOnboarding || businessRules.requireNinForOnboarding;
    
    if (requiresIdentity) {
      const identity = user.sudoCustomerOnboardingData?.identity;
      const isVerified = identity?.verified === true;
      
      // User needs to have verified identity
      if (!isVerified) {
        const requiredDocs = [];
        if (businessRules.requireBvnForOnboarding) requiredDocs.push('BVN');
        if (businessRules.requireNinForOnboarding) requiredDocs.push('NIN');
        
        throw new BadRequestException(
          `${requiredDocs.join(' or ')} verification is required for onboarding. Please verify your identity before submitting an onboarding request.`,
        );
      }
    }

    // Check if user has a pending onboarding request
    const existingPendingRequest = await OnboardingRequest.findOne({
      where: {
        userId,
        status: OnboardingRequestStatus.PENDING,
      },
    });

    if (existingPendingRequest) {
      // Still notify admin (in-app + email) so they are aware and can go process the pending request
      try {
        const admins = await Admin.findAll({
          where: { status: 'active' },
          attributes: ['id'],
        });
        const adminIds = admins.map((a) => a.id);
        const notifications = await this.notificationsService.notifyAdminNewOnboardingRequest(
          adminIds,
          userId,
          existingPendingRequest.id,
        );
        if (notifications?.length > 0) {
          await this.notificationsGateway.sendToAllAdmins(notifications[0]);
        }
        await this.emailService.sendAdminOnboardingRequestAlert(
          userId,
          existingPendingRequest.id,
          user.email,
          user.firstName,
        );
      } catch (notifError) {
        console.error('Failed to send admin notifications (pending request):', notifError);
      }
      throw new ConflictException(
        'You already have a pending onboarding request. Please wait for it to be processed.',
      );
    }

    // Create new onboarding request
    const onboardingRequest = await OnboardingRequest.create({
      userId,
      message: createDto.message || null,
      status: OnboardingRequestStatus.PENDING,
      submittedAt: new Date(),
    } as any);

    // Notify all admins
    try {
      const admins = await Admin.findAll({
        where: { status: 'active' },
        attributes: ['id'],
      });
      const adminIds = admins.map((a) => a.id);

      const notifications = await this.notificationsService.notifyAdminNewOnboardingRequest(
        adminIds,
        userId,
        onboardingRequest.id,
      );

      // Send via WebSocket to online admins
      if (notifications && notifications.length > 0) {
        await this.notificationsGateway.sendToAllAdmins(notifications[0]);
      }

      // Email admin (e.g. operations@buykoins.com) so they see it even when not in dashboard
      await this.emailService.sendAdminOnboardingRequestAlert(
        userId,
        onboardingRequest.id,
        user.email,
        user.firstName,
      );
    } catch (notifError) {
      console.error('Failed to send admin notifications:', notifError);
    }

    return {
      id: onboardingRequest.id,
      message: onboardingRequest.message,
      status: onboardingRequest.status,
      submittedAt: onboardingRequest.submittedAt,
    };
  }

  /**
   * Get onboarding status
   */
  async getOnboardingStatus(userId: string) {
    const user = await User.findByPk(userId, {
      attributes: ['id', 'onboardingStatus', 'sudoCustomerOnboardingData'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get business rules settings
    const businessRules = await this.settingsService.getSettingsByCategory('business-rules') as BusinessRulesSettings;

    // Check identity verification status
    const identity = user.sudoCustomerOnboardingData?.identity;
    const isVerified = identity?.verified === true;
    const identityType = identity?.identityType;

    // User can submit if they have verified identity (when required)
    const requiresIdentity = businessRules.requireBvnForOnboarding || businessRules.requireNinForOnboarding;

    // Get latest onboarding request
    const latestRequest = await OnboardingRequest.findOne({
      where: { userId },
      order: [['submittedAt', 'DESC']],
      attributes: ['id', 'message', 'status', 'submittedAt', 'completedAt', 'notes'],
    });

    return {
      onboardingStatus: user.onboardingStatus,
      requirements: {
        bvnRequired: businessRules.requireBvnForOnboarding,
        ninRequired: businessRules.requireNinForOnboarding,
        hasVerifiedIdentity: isVerified,
        identityType: identityType || null,
        canSubmitRequest: !requiresIdentity || isVerified,
      },
      latestRequest: latestRequest
        ? {
            id: latestRequest.id,
            message: latestRequest.message,
            status: latestRequest.status,
            submittedAt: latestRequest.submittedAt,
            completedAt: latestRequest.completedAt,
            notes: latestRequest.notes,
          }
        : null,
    };
  }
}

