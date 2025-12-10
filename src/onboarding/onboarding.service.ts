import {
  Injectable,
  ConflictException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { OnboardingRequest, OnboardingRequestStatus } from './entities/onboarding-request.entity';
import { User, OnboardingStatus } from '../users/entities/user.entity';
import { CreateOnboardingRequestDto } from './dto/create-onboarding-request.dto';

@Injectable()
export class OnboardingService {
  constructor(
    @Inject('SEQUELIZE') private sequelize: Sequelize,
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

    // Check if user has a pending onboarding request
    const existingPendingRequest = await OnboardingRequest.findOne({
      where: {
        userId,
        status: OnboardingRequestStatus.PENDING,
      },
    });

    if (existingPendingRequest) {
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
      attributes: ['id', 'onboardingStatus'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get latest onboarding request
    const latestRequest = await OnboardingRequest.findOne({
      where: { userId },
      order: [['submittedAt', 'DESC']],
      attributes: ['id', 'message', 'status', 'submittedAt', 'completedAt', 'notes'],
    });

    return {
      onboardingStatus: user.onboardingStatus,
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

