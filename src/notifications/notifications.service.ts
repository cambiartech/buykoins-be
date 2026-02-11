import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Notification, NotificationType, NotificationPriority } from './entities/notification.entity';
import { Admin, AdminStatus } from '../admins/entities/admin.entity';
import { User, UserStatus, OnboardingStatus } from '../users/entities/user.entity';
import { Op } from 'sequelize';
import type { BroadcastAudience } from './dto/broadcast-announcement.dto';

export interface CreateNotificationDto {
  userId?: string;
  adminId?: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  priority?: NotificationPriority;
  actionUrl?: string;
}

@Injectable()
export class NotificationsService {
  /**
   * Create a notification
   */
  async create(dto: CreateNotificationDto): Promise<Notification> {
    const notification = await Notification.create({
      userId: dto.userId,
      adminId: dto.adminId,
      type: dto.type,
      title: dto.title,
      message: dto.message,
      metadata: dto.metadata || {},
      priority: dto.priority || NotificationPriority.MEDIUM,
      actionUrl: dto.actionUrl,
      isRead: false,
    } as any);

    return notification;
  }

  /**
   * Get user notifications with pagination
   */
  async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
    unreadOnly: boolean = false,
  ) {
    const offset = (page - 1) * limit;

    const where: any = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const { rows: notifications, count: total } = await Notification.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return {
      notifications: notifications.map((n) => this.formatNotification(n)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get admin notifications with pagination
   */
  async getAdminNotifications(
    adminId: string,
    page: number = 1,
    limit: number = 20,
    unreadOnly: boolean = false,
  ) {
    const offset = (page - 1) * limit;

    const where: any = { adminId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const { rows: notifications, count: total } = await Notification.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return {
      notifications: notifications.map((n) => this.formatNotification(n)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get unread count for user
   */
  async getUserUnreadCount(userId: string): Promise<number> {
    return await Notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  /**
   * Get unread count for admin
   */
  async getAdminUnreadCount(adminId: string): Promise<number> {
    return await Notification.count({
      where: {
        adminId,
        isRead: false,
      },
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, recipientId: string): Promise<void> {
    const notification = await Notification.findByPk(notificationId);

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    // Verify ownership
    if (notification.userId !== recipientId && notification.adminId !== recipientId) {
      throw new NotFoundException('Notification not found');
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();
    }
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsReadForUser(userId: string): Promise<void> {
    await Notification.update(
      {
        isRead: true,
        readAt: new Date(),
      },
      {
        where: {
          userId,
          isRead: false,
        },
      },
    );
  }

  /**
   * Mark all notifications as read for admin
   */
  async markAllAsReadForAdmin(adminId: string): Promise<void> {
    await Notification.update(
      {
        isRead: true,
        readAt: new Date(),
      },
      {
        where: {
          adminId,
          isRead: false,
        },
      },
    );
  }

  /**
   * Delete notification
   */
  async delete(notificationId: string, recipientId: string): Promise<void> {
    const notification = await Notification.findByPk(notificationId);

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    // Verify ownership
    if (notification.userId !== recipientId && notification.adminId !== recipientId) {
      throw new NotFoundException('Notification not found');
    }

    await notification.destroy();
  }

  /**
   * Delete old read notifications (cleanup)
   */
  async deleteOldReadNotifications(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const deleted = await Notification.destroy({
      where: {
        isRead: true,
        readAt: {
          [Op.lt]: cutoffDate,
        },
      },
    });

    return deleted;
  }

  /**
   * Format notification for response
   */
  private formatNotification(notification: Notification) {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      metadata: notification.metadata,
      priority: notification.priority,
      isRead: notification.isRead,
      readAt: notification.readAt,
      actionUrl: notification.actionUrl,
      createdAt: notification.createdAt,
    };
  }

  // ============================================
  // Helper methods for creating specific notifications
  // ============================================

  /**
   * Notify user: Credit request approved
   */
  async notifyCreditApproved(userId: string, amount: number, balance: number, creditRequestId: string) {
    return await this.create({
      userId,
      type: NotificationType.CREDIT_APPROVED,
      title: 'Credit Request Approved',
      message: `Your credit request of $${amount.toFixed(2)} has been approved. New balance: $${balance.toFixed(2)}`,
      metadata: {
        amount,
        balance,
        creditRequestId,
      },
      priority: NotificationPriority.HIGH,
      actionUrl: `/dashboard`,
    });
  }

  /**
   * Notify user: Credit request rejected
   */
  async notifyCreditRejected(userId: string, reason: string, creditRequestId: string) {
    return await this.create({
      userId,
      type: NotificationType.CREDIT_REJECTED,
      title: 'Credit Request Rejected',
      message: `Your credit request was rejected. Reason: ${reason}`,
      metadata: {
        reason,
        creditRequestId,
      },
      priority: NotificationPriority.MEDIUM,
      actionUrl: `/credit-requests`,
    });
  }

  /**
   * Notify user: Payout completed
   */
  async notifyPayoutCompleted(userId: string, amount: number, payoutId: string) {
    return await this.create({
      userId,
      type: NotificationType.PAYOUT_COMPLETED,
      title: 'Payout Completed',
      message: `Your payout of $${amount.toFixed(2)} has been processed and sent to your bank account.`,
      metadata: {
        amount,
        payoutId,
      },
      priority: NotificationPriority.HIGH,
      actionUrl: `/payouts`,
    });
  }

  /**
   * Notify user: Onboarding completed
   */
  async notifyOnboardingCompleted(userId: string) {
    return await this.create({
      userId,
      type: NotificationType.ONBOARDING_COMPLETED,
      title: 'Welcome to Buykoins',
      message: 'Your account has been verified and you can now start submitting credit requests!',
      metadata: {},
      priority: NotificationPriority.HIGH,
      actionUrl: `/dashboard`,
    });
  }

  /**
   * Notify admin: New credit request
   */
  async notifyAdminNewCreditRequest(adminIds: string[], userId: string, amount: number, creditRequestId: string) {
    const notifications = adminIds.map((adminId) =>
      this.create({
        adminId,
        type: NotificationType.NEW_CREDIT_REQUEST,
        title: 'New Credit Request',
        message: `New credit request of $${amount.toFixed(2)} from user`,
        metadata: {
          userId,
          amount,
          creditRequestId,
        },
        priority: NotificationPriority.MEDIUM,
        actionUrl: `/admin/credit-requests/${creditRequestId}`,
      }),
    );

    return await Promise.all(notifications);
  }

  /**
   * Notify admin: New payout request
   */
  async notifyAdminNewPayoutRequest(adminIds: string[], userId: string, amount: number, payoutId: string) {
    const notifications = adminIds.map((adminId) =>
      this.create({
        adminId,
        type: NotificationType.NEW_PAYOUT_REQUEST,
        title: 'New Payout Request',
        message: `New payout request of $${amount.toFixed(2)} from user`,
        metadata: {
          userId,
          amount,
          payoutId,
        },
        priority: NotificationPriority.MEDIUM,
        actionUrl: `/admin/payouts/${payoutId}`,
      }),
    );

    return await Promise.all(notifications);
  }

  /**
   * Notify admin: New onboarding request
   */
  async notifyAdminNewOnboardingRequest(adminIds: string[], userId: string, onboardingRequestId: string) {
    const notifications = adminIds.map((adminId) =>
      this.create({
        adminId,
        type: NotificationType.NEW_ONBOARDING_REQUEST,
        title: 'New Onboarding Request',
        message: 'A new user has submitted an onboarding request',
        metadata: {
          userId,
          onboardingRequestId,
        },
        priority: NotificationPriority.MEDIUM,
        actionUrl: `/admin/users/${userId}`,
      }),
    );

    return await Promise.all(notifications);
  }

  /**
   * Notify user: Card funded
   */
  async notifyCardFunded(userId: string, amount: number, cardLast4: string) {
    return await this.create({
      userId,
      type: NotificationType.CARD_FUNDED,
      title: 'Card funded',
      message: `Your card ending ${cardLast4} has been funded with ${amount} NGN. It is available for TikTok coins and other digital purchases.`,
      metadata: { amount, cardLast4 },
      priority: NotificationPriority.MEDIUM,
      actionUrl: `/dashboard/cards`,
    });
  }

  /**
   * Notify user: Wallet credited
   */
  async notifyWalletCredited(userId: string, amount: number) {
    return await this.create({
      userId,
      type: NotificationType.WALLET_CREDITED,
      title: 'Wallet credited',
      message: `Your wallet has been credited with ${amount} NGN. You can fund your card or use it for digital purchases.`,
      metadata: { amount },
      priority: NotificationPriority.MEDIUM,
      actionUrl: `/dashboard`,
    });
  }

  /**
   * Notify admin: First support message in conversation (user/guest started)
   */
  async notifyAdminNewSupportMessage(adminIds: string[], conversationId: string, userId?: string) {
    const notifications = adminIds.map((adminId) =>
      this.create({
        adminId,
        type: NotificationType.NEW_SUPPORT_MESSAGE,
        title: 'New support conversation',
        message: 'A user has started a support conversation. Reply from the Support inbox.',
        metadata: { conversationId, userId },
        priority: NotificationPriority.MEDIUM,
        actionUrl: `/admin/support`,
      }),
    );
    return await Promise.all(notifications);
  }

  /**
   * Create announcement (email blast) for one user. Call for each user when broadcasting.
   * Use metadata.messageFormat = 'html' when message is HTML (e.g. from rich text editor).
   */
  async notifyAnnouncement(userId: string, title: string, message: string, metadata?: Record<string, unknown>) {
    return await this.create({
      userId,
      type: NotificationType.ANNOUNCEMENT,
      title,
      message,
      metadata: metadata || {},
      priority: NotificationPriority.MEDIUM,
      actionUrl: `/dashboard`,
    });
  }

  /**
   * Get user IDs for broadcast: by explicit list or by audience filter.
   */
  async getBroadcastUserIds(options: { userIds?: string[]; audience?: BroadcastAudience }): Promise<string[]> {
    const { userIds, audience = 'all' } = options;
    if (userIds && userIds.length > 0) {
      const found = await User.findAll({
        where: { id: { [Op.in]: userIds } },
        attributes: ['id'],
      });
      return found.map((u) => u.id);
    }
    const where: Record<string, unknown> = {};
    if (audience === 'active') {
      where.status = UserStatus.ACTIVE;
    } else if (audience === 'onboarded') {
      where.onboardingStatus = OnboardingStatus.COMPLETED;
    }
    const users = await User.findAll({ where, attributes: ['id'] });
    return users.map((u) => u.id);
  }

  /**
   * Get active admin IDs (for broadcasting admin notifications).
   */
  async getActiveAdminIds(): Promise<string[]> {
    const admins = await Admin.findAll({
      where: { status: AdminStatus.ACTIVE },
      attributes: ['id'],
    });
    return admins.map((a) => a.id);
  }

  /**
   * Broadcast announcement (email blast). Targets users by userIds or audience. Returns list of { userId, notification } for pushing via gateway.
   * messageFormat is stored in notification metadata so clients can render plain vs HTML accordingly.
   */
  async broadcastAnnouncement(options: {
    title: string;
    message: string;
    messageFormat?: 'plain' | 'html';
    userIds?: string[];
    audience?: BroadcastAudience;
  }): Promise<Array<{ userId: string; notification: Notification }>> {
    const { title, message, messageFormat = 'plain', userIds, audience = 'all' } = options;
    const userIdList = await this.getBroadcastUserIds({ userIds, audience });
    const results: Array<{ userId: string; notification: Notification }> = [];
    const metadata = messageFormat === 'html' ? { messageFormat: 'html' } : undefined;
    for (const uid of userIdList) {
      const notification = await this.notifyAnnouncement(uid, title, message, metadata);
      results.push({ userId: uid, notification: notification as Notification });
    }
    return results;
  }
}
