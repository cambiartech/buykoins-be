import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { CreditRequest, CreditRequestStatus } from './entities/credit-request.entity';
import { User, OnboardingStatus } from '../users/entities/user.entity';
import { StorageService } from '../storage/storage.service';
import { CreateCreditRequestDto } from './dto/create-credit-request.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { Admin } from '../admins/entities/admin.entity';

@Injectable()
export class CreditRequestsService {
  constructor(
    @Inject('SEQUELIZE') private sequelize: Sequelize,
    private storageService: StorageService,
    private notificationsService: NotificationsService,
    private notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * Validate file
   */
  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('Proof file is required');
    }

    // Check file size (10MB = 10 * 1024 * 1024 bytes)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('File size must not exceed 10MB');
    }

    // Check file type
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only images (jpg, jpeg, png, webp) and PDF files are allowed',
      );
    }
  }

  /**
   * Create credit request
   */
  async createCreditRequest(
    userId: string,
    createCreditRequestDto: CreateCreditRequestDto,
    file: Express.Multer.File,
  ) {
    // Validate file
    this.validateFile(file);

    // Get user
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user is onboarded
    if (user.onboardingStatus !== OnboardingStatus.COMPLETED) {
      throw new ForbiddenException(
        'You must complete onboarding before submitting credit requests',
      );
    }

    // Check if user has a pending credit request
    const existingPendingRequest = await CreditRequest.findOne({
      where: {
        userId,
        status: CreditRequestStatus.PENDING,
      },
    });

    if (existingPendingRequest) {
      throw new ConflictException(
        'You already have a pending credit request. Please wait for it to be processed.',
      );
    }

    // Upload file to S3
    const fileKey = await this.storageService.uploadFile(file, 'credit-proofs');

    // Get public URL for the file
    const proofUrl = await this.storageService.getPublicUrl(fileKey);

    // Create credit request
    const creditRequest = await CreditRequest.create({
      userId,
      amount: createCreditRequestDto.amount,
      proofUrl,
      status: CreditRequestStatus.PENDING,
      submittedAt: new Date(),
    } as any);

    // Notify all admins
    try {
      const admins = await Admin.findAll({
        where: { status: 'active' },
        attributes: ['id'],
      });
      const adminIds = admins.map((a) => a.id);

      const notifications = await this.notificationsService.notifyAdminNewCreditRequest(
        adminIds,
        userId,
        createCreditRequestDto.amount,
        creditRequest.id,
      );

      // Send via WebSocket to online admins
      if (notifications && notifications.length > 0) {
        await this.notificationsGateway.sendToAllAdmins(notifications[0]);
      }
    } catch (notifError) {
      console.error('Failed to send admin notifications:', notifError);
    }

    return {
      id: creditRequest.id,
      userId: creditRequest.userId,
      amount: Number(creditRequest.amount),
      status: creditRequest.status,
      submittedAt: creditRequest.submittedAt,
      proofUrl: creditRequest.proofUrl,
    };
  }

  /**
   * Get credit request status
   */
  async getCreditRequestStatus(userId: string) {
    const latestRequest = await CreditRequest.findOne({
      where: { userId },
      order: [['submittedAt', 'DESC']],
      attributes: [
        'id',
        'amount',
        'status',
        'submittedAt',
        'processedAt',
        'rejectionReason',
      ],
    });

    if (!latestRequest) {
      return {
        status: 'none',
        amount: null,
        submittedAt: null,
        processedAt: null,
        rejectionReason: null,
      };
    }

    // Map status for response
    let status: 'none' | 'pending' | 'sent' | 'rejected' = 'none';
    if (latestRequest.status === CreditRequestStatus.PENDING) {
      status = 'pending';
    } else if (latestRequest.status === CreditRequestStatus.APPROVED) {
      status = 'sent';
    } else if (latestRequest.status === CreditRequestStatus.REJECTED) {
      status = 'rejected';
    }

    return {
      status,
      amount: Number(latestRequest.amount),
      submittedAt: latestRequest.submittedAt,
      processedAt: latestRequest.processedAt,
      rejectionReason: latestRequest.rejectionReason,
    };
  }

  /**
   * Get credit request history
   */
  async getCreditRequestHistory(userId: string) {
    const creditRequests = await CreditRequest.findAll({
      where: { userId },
      order: [['submittedAt', 'DESC']],
      attributes: [
        'id',
        'amount',
        'status',
        'submittedAt',
        'processedAt',
        'rejectionReason',
        'proofUrl',
      ],
    });

    return creditRequests.map((request) => ({
      id: request.id,
      amount: Number(request.amount),
      status: request.status,
      submittedAt: request.submittedAt,
      processedAt: request.processedAt,
      rejectionReason: request.rejectionReason,
      proofUrl: request.proofUrl,
    }));
  }
}

