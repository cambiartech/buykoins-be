import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  DefaultValuePipe,
  ParseIntPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BroadcastAnnouncementDto } from './dto/broadcast-announcement.dto';

@ApiTags('Notifications')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  // ============================================
  // User Notification Endpoints
  // ============================================

  @Get('user/notifications')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean, example: false })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
    schema: {
      example: {
        success: true,
        data: {
          notifications: [
            {
              id: 'uuid',
              type: 'credit_approved',
              title: 'Credit Request Approved',
              message: 'Your credit request of $100.00 has been approved',
              metadata: { amount: 100, balance: 200 },
              priority: 'high',
              isRead: false,
              readAt: null,
              actionUrl: '/dashboard',
              createdAt: '2026-02-04T12:00:00Z',
            },
          ],
          pagination: {
            page: 1,
            limit: 20,
            total: 5,
            totalPages: 1,
          },
        },
      },
    },
  })
  async getUserNotifications(
    @CurrentUser() user: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('unreadOnly', new DefaultValuePipe(false), ParseBoolPipe) unreadOnly: boolean,
  ) {
    const data = await this.notificationsService.getUserNotifications(
      user.id,
      page,
      limit,
      unreadOnly,
    );
    return {
      success: true,
      data,
    };
  }

  @Get('user/notifications/unread-count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user unread notifications count' })
  @ApiResponse({
    status: 200,
    description: 'Unread count retrieved successfully',
    schema: {
      example: {
        success: true,
        data: { count: 3 },
      },
    },
  })
  async getUserUnreadCount(@CurrentUser() user: any) {
    const count = await this.notificationsService.getUserUnreadCount(user.id);
    return {
      success: true,
      data: { count },
    };
  }

  @Post('user/notifications/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markNotificationAsRead(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    await this.notificationsService.markAsRead(id, user.id);
    return {
      success: true,
      message: 'Notification marked as read',
    };
  }

  @Post('user/notifications/read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read',
  })
  async markAllNotificationsAsRead(@CurrentUser() user: any) {
    await this.notificationsService.markAllAsReadForUser(user.id);
    return {
      success: true,
      message: 'All notifications marked as read',
    };
  }

  @Delete('user/notifications/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete notification' })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted',
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async deleteNotification(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    await this.notificationsService.delete(id, user.id);
    return {
      success: true,
      message: 'Notification deleted',
    };
  }

  // ============================================
  // Admin Notification Endpoints
  // ============================================

  @Get('admin/notifications')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get admin notifications' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean, example: false })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
    schema: {
      example: {
        success: true,
        data: {
          notifications: [
            {
              id: 'uuid',
              type: 'new_credit_request',
              title: 'New Credit Request',
              message: 'New credit request of $100.00 from user',
              metadata: { userId: 'uuid', amount: 100 },
              priority: 'medium',
              isRead: false,
              readAt: null,
              actionUrl: '/admin/credit-requests/uuid',
              createdAt: '2026-02-04T12:00:00Z',
            },
          ],
          pagination: {
            page: 1,
            limit: 20,
            total: 10,
            totalPages: 1,
          },
        },
      },
    },
  })
  async getAdminNotifications(
    @CurrentUser() admin: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('unreadOnly', new DefaultValuePipe(false), ParseBoolPipe) unreadOnly: boolean,
  ) {
    const data = await this.notificationsService.getAdminNotifications(
      admin.id,
      page,
      limit,
      unreadOnly,
    );
    return {
      success: true,
      data,
    };
  }

  @Get('admin/notifications/unread-count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get admin unread notifications count' })
  @ApiResponse({
    status: 200,
    description: 'Unread count retrieved successfully',
    schema: {
      example: {
        success: true,
        data: { count: 5 },
      },
    },
  })
  async getAdminUnreadCount(@CurrentUser() admin: any) {
    const count = await this.notificationsService.getAdminUnreadCount(admin.id);
    return {
      success: true,
      data: { count },
    };
  }

  @Post('admin/notifications/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark admin notification as read' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markAdminNotificationAsRead(
    @CurrentUser() admin: any,
    @Param('id') id: string,
  ) {
    await this.notificationsService.markAsRead(id, admin.id);
    return {
      success: true,
      message: 'Notification marked as read',
    };
  }

  @Post('admin/notifications/read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all admin notifications as read' })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read',
  })
  async markAllAdminNotificationsAsRead(@CurrentUser() admin: any) {
    await this.notificationsService.markAllAsReadForAdmin(admin.id);
    return {
      success: true,
      message: 'All notifications marked as read',
    };
  }

  @Delete('admin/notifications/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete admin notification' })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted',
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async deleteAdminNotification(
    @CurrentUser() admin: any,
    @Param('id') id: string,
  ) {
    await this.notificationsService.delete(id, admin.id);
    return {
      success: true,
      message: 'Notification deleted',
    };
  }

  @Post('admin/notifications/broadcast')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Broadcast announcement (email blast)',
    description: 'Send in-app announcement to users. Supports plain or HTML message (messageFormat), and targeting: all users, active only, onboarded only, or specific userIds. See docs/BROADCAST_API.md for frontend.',
  })
  @ApiBody({ type: BroadcastAnnouncementDto })
  @ApiResponse({
    status: 201,
    description: 'Announcement created and pushed to targeted users',
    schema: { example: { success: true, data: { sent: 42 } } },
  })
  async broadcastAnnouncement(
    @CurrentUser() admin: any,
    @Body() dto: BroadcastAnnouncementDto,
  ) {
    const results = await this.notificationsService.broadcastAnnouncement({
      title: dto.title,
      message: dto.message,
      messageFormat: dto.messageFormat ?? 'plain',
      userIds: dto.userIds,
      audience: dto.audience ?? 'all',
    });
    for (const { userId, notification } of results) {
      try {
        await this.notificationsGateway.sendToUser(userId, notification);
      } catch (err) {
        // Log but continue; user may be offline
      }
    }
    return {
      success: true,
      data: { sent: results.length },
    };
  }
}
