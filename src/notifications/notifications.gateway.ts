import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';

interface SocketAuth {
  userId?: string;
  adminId?: string;
  type: 'user' | 'admin';
}

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: true,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
@Injectable()
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private readonly socketAuthMap = new Map<string, SocketAuth>();
  private readonly userSockets = new Map<string, Set<string>>(); // userId -> Set of socketIds
  private readonly adminSockets = new Map<string, Set<string>>(); // adminId -> Set of socketIds

  constructor(
    private jwtService: JwtService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Handle WebSocket connection
   */
  async handleConnection(client: Socket) {
    try {
      const auth = await this.authenticateSocket(client);
      this.socketAuthMap.set(client.id, auth);

      // Track socket by user/admin ID
      if (auth.type === 'user' && auth.userId) {
        if (!this.userSockets.has(auth.userId)) {
          this.userSockets.set(auth.userId, new Set());
        }
        this.userSockets.get(auth.userId).add(client.id);
        
        // Join user-specific room
        client.join(`user:${auth.userId}`);
        
        // Send unread count on connection
        const unreadCount = await this.notificationsService.getUserUnreadCount(auth.userId);
        client.emit('unread_count', { count: unreadCount });
        
        this.logger.log(`User ${auth.userId} connected: ${client.id}`);
      } else if (auth.type === 'admin' && auth.adminId) {
        if (!this.adminSockets.has(auth.adminId)) {
          this.adminSockets.set(auth.adminId, new Set());
        }
        this.adminSockets.get(auth.adminId).add(client.id);
        
        // Join admin-specific room
        client.join(`admin:${auth.adminId}`);
        
        // Send unread count on connection
        const unreadCount = await this.notificationsService.getAdminUnreadCount(auth.adminId);
        client.emit('unread_count', { count: unreadCount });
        
        this.logger.log(`Admin ${auth.adminId} connected: ${client.id}`);
      }
    } catch (error) {
      this.logger.error(`Connection error for ${client.id}: ${error.message}`);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  handleDisconnect(client: Socket) {
    const auth = this.socketAuthMap.get(client.id);
    
    if (auth) {
      if (auth.type === 'user' && auth.userId) {
        const sockets = this.userSockets.get(auth.userId);
        if (sockets) {
          sockets.delete(client.id);
          if (sockets.size === 0) {
            this.userSockets.delete(auth.userId);
          }
        }
        this.logger.log(`User ${auth.userId} disconnected: ${client.id}`);
      } else if (auth.type === 'admin' && auth.adminId) {
        const sockets = this.adminSockets.get(auth.adminId);
        if (sockets) {
          sockets.delete(client.id);
          if (sockets.size === 0) {
            this.adminSockets.delete(auth.adminId);
          }
        }
        this.logger.log(`Admin ${auth.adminId} disconnected: ${client.id}`);
      }
    }
    
    this.socketAuthMap.delete(client.id);
  }

  /**
   * Authenticate socket connection
   */
  private async authenticateSocket(client: Socket): Promise<SocketAuth> {
    const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);

      if (payload.role === 'admin' || payload.role === 'super_admin') {
        return {
          adminId: payload.id,
          type: 'admin',
        };
      } else {
        return {
          userId: payload.id,
          type: 'user',
        };
      }
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Subscribe to mark notification as read
   */
  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    payload: { notificationId: string },
  ) {
    const auth = this.socketAuthMap.get(client.id);
    if (!auth) {
      return { success: false, message: 'Not authenticated' };
    }

    try {
      const recipientId = auth.userId || auth.adminId;
      await this.notificationsService.markAsRead(payload.notificationId, recipientId);
      
      // Send updated unread count
      const unreadCount = auth.type === 'user'
        ? await this.notificationsService.getUserUnreadCount(auth.userId)
        : await this.notificationsService.getAdminUnreadCount(auth.adminId);
      
      client.emit('unread_count', { count: unreadCount });
      
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Subscribe to mark all notifications as read
   */
  @SubscribeMessage('mark_all_read')
  async handleMarkAllRead(@ConnectedSocket() client: Socket) {
    const auth = this.socketAuthMap.get(client.id);
    if (!auth) {
      return { success: false, message: 'Not authenticated' };
    }

    try {
      if (auth.type === 'user') {
        await this.notificationsService.markAllAsReadForUser(auth.userId);
      } else {
        await this.notificationsService.markAllAsReadForAdmin(auth.adminId);
      }
      
      client.emit('unread_count', { count: 0 });
      
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Subscribe to get unread count
   */
  @SubscribeMessage('get_unread_count')
  async handleGetUnreadCount(@ConnectedSocket() client: Socket) {
    const auth = this.socketAuthMap.get(client.id);
    if (!auth) {
      return { success: false, message: 'Not authenticated' };
    }

    try {
      const unreadCount = auth.type === 'user'
        ? await this.notificationsService.getUserUnreadCount(auth.userId)
        : await this.notificationsService.getAdminUnreadCount(auth.adminId);
      
      return { success: true, count: unreadCount };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // ============================================
  // Methods to emit notifications to clients
  // ============================================

  /**
   * Send notification to user
   */
  async sendToUser(userId: string, notification: any) {
    this.server.to(`user:${userId}`).emit('notification', notification);
    
    // Also send updated unread count
    const unreadCount = await this.notificationsService.getUserUnreadCount(userId);
    this.server.to(`user:${userId}`).emit('unread_count', { count: unreadCount });
  }

  /**
   * Send notification to admin
   */
  async sendToAdmin(adminId: string, notification: any) {
    this.server.to(`admin:${adminId}`).emit('notification', notification);
    
    // Also send updated unread count
    const unreadCount = await this.notificationsService.getAdminUnreadCount(adminId);
    this.server.to(`admin:${adminId}`).emit('unread_count', { count: unreadCount });
  }

  /**
   * Send notification to all admins
   */
  async sendToAllAdmins(notification: any) {
    // Emit to all connected admin sockets
    for (const [adminId, socketIds] of this.adminSockets.entries()) {
      await this.sendToAdmin(adminId, notification);
    }
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId).size > 0;
  }

  /**
   * Check if admin is online
   */
  isAdminOnline(adminId: string): boolean {
    return this.adminSockets.has(adminId) && this.adminSockets.get(adminId).size > 0;
  }
}
