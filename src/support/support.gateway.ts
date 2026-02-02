import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SupportService } from './support.service';
import { GuestIdUtil } from './utils/guest-id.util';
import { SenderType, MessageType } from './entities/support-message.entity';

interface SocketAuth {
  userId?: string;
  adminId?: string;
  guestId?: string;
  type: 'user' | 'admin' | 'guest';
}

@WebSocketGateway({
  namespace: '/support',
  cors: {
    origin: true, // Allow all origins (handled by adapter)
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
@Injectable()
export class SupportGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SupportGateway.name);
  private readonly socketAuthMap = new Map<string, SocketAuth>(); // socketId -> auth
  private readonly userRooms = new Map<string, string>(); // userId/guestId -> roomId
  private readonly adminRooms = new Map<string, string[]>(); // adminId -> roomIds[]

  constructor(
    private jwtService: JwtService,
    private supportService: SupportService,
  ) {}

  /**
   * Handle WebSocket connection
   * Supports both authenticated (JWT) and anonymous (guest) connections
   */
  async handleConnection(client: Socket) {
    try {
      const auth = await this.authenticateSocket(client);
      this.socketAuthMap.set(client.id, auth);

      // Join appropriate room
      if (auth.type === 'admin') {
        await this.handleAdminConnection(client, auth);
      } else if (auth.type === 'user') {
        await this.handleUserConnection(client, auth);
      } else {
        await this.handleGuestConnection(client, auth);
      }

      this.logger.log(`Client connected: ${client.id} (${auth.type})`);
    } catch (error) {
      this.logger.error(`Connection error for ${client.id}: ${error.message}`);
      this.logger.error(`Error stack: ${error.stack}`);
      
      // Emit error to client before disconnecting
      client.emit('connection:error', {
        message: error.message || 'Connection failed',
        code: 'CONNECTION_FAILED',
      });
      
      client.disconnect();
    }
  }

  /**
   * Authenticate socket - supports JWT or guest mode
   */
  private async authenticateSocket(client: Socket): Promise<SocketAuth> {
    // Try multiple locations for token (auth object, query params, headers)
    const token = 
      client.handshake.auth?.token || 
      (client.handshake.query?.token as string) ||
      client.handshake.headers?.authorization?.replace('Bearer ', '');

    // Try JWT authentication first
    if (token) {
      try {
        const payload = await this.jwtService.verifyAsync(token);
        
        if (payload.type === 'admin') {
          return {
            adminId: payload.sub || payload.id,
            type: 'admin',
          };
        } else if (payload.type === 'user') {
          return {
            userId: payload.sub || payload.id,
            type: 'user',
          };
        }
      } catch (error) {
        // JWT invalid, fall through to guest mode
        this.logger.warn(`Invalid JWT token: ${error.message}`);
      }
    }

    // Guest/anonymous mode
    // Check if guest ID provided, otherwise generate new one
    let guestId = client.handshake.auth?.guestId;
    
    if (!guestId || !GuestIdUtil.isValid(guestId)) {
      guestId = GuestIdUtil.generate();
    }

    return {
      guestId,
      type: 'guest',
    };
  }

  /**
   * Handle admin connection
   */
  private async handleAdminConnection(client: Socket, auth: SocketAuth) {
    if (!auth.adminId) return;

    // Join admin room
    const adminRoom = `admin:${auth.adminId}`;
    await client.join(adminRoom);

    // Track admin rooms
    const rooms = this.adminRooms.get(auth.adminId) || [];
    rooms.push(adminRoom);
    this.adminRooms.set(auth.adminId, rooms);

    // Join all open conversations (for notifications)
    await client.join('admin:all');

    // Emit connection success
    client.emit('connection:success', {
      type: 'admin',
      adminId: auth.adminId,
    });
  }

  /**
   * Handle authenticated user connection
   */
  private async handleUserConnection(client: Socket, auth: SocketAuth) {
    if (!auth.userId) return;

    try {
      // Join user's personal room
      const userRoom = `user:${auth.userId}`;
      await client.join(userRoom);
      this.userRooms.set(auth.userId, userRoom);

      // Join user's active conversations (wrap in try-catch to prevent connection failure)
      try {
        const conversations = await this.supportService.getUserConversations(auth.userId);
        for (const conv of conversations) {
          await client.join(`conversation:${conv.id}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to load conversations for user ${auth.userId}: ${error.message}`);
        // Continue with connection even if conversations fail to load
      }

      // Emit connection success
      client.emit('connection:success', {
        type: 'user',
        userId: auth.userId,
      });
    } catch (error) {
      this.logger.error(`Error in handleUserConnection: ${error.message}`);
      throw error; // Re-throw to trigger connection error handler
    }
  }

  /**
   * Handle guest/anonymous connection
   */
  private async handleGuestConnection(client: Socket, auth: SocketAuth) {
    if (!auth.guestId) return;

    try {
      // Join guest's personal room
      const guestRoom = `guest:${auth.guestId}`;
      await client.join(guestRoom);
      this.userRooms.set(auth.guestId, guestRoom);

      // Join guest's active conversations (wrap in try-catch to prevent connection failure)
      try {
        const conversations = await this.supportService.getGuestConversations(auth.guestId);
        for (const conv of conversations) {
          await client.join(`conversation:${conv.id}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to load conversations for guest ${auth.guestId}: ${error.message}`);
        // Continue with connection even if conversations fail to load
      }

      // Emit connection success with guest ID
      client.emit('connection:success', {
        type: 'guest',
        guestId: auth.guestId,
      });
    } catch (error) {
      this.logger.error(`Error in handleGuestConnection: ${error.message}`);
      throw error; // Re-throw to trigger connection error handler
    }
  }

  /**
   * Handle disconnection
   */
  handleDisconnect(client: Socket) {
    const auth = this.socketAuthMap.get(client.id);
    
    if (auth) {
      if (auth.type === 'admin' && auth.adminId) {
        // Clean up admin rooms
        const rooms = this.adminRooms.get(auth.adminId) || [];
        this.adminRooms.delete(auth.adminId);
      } else if (auth.type === 'user' && auth.userId) {
        this.userRooms.delete(auth.userId);
      } else if (auth.type === 'guest' && auth.guestId) {
        this.userRooms.delete(auth.guestId);
      }
    }

    this.socketAuthMap.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Send message
   */
  @SubscribeMessage('message:send')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string; message: string; messageType?: string },
  ) {
    const auth = this.socketAuthMap.get(client.id);
    if (!auth) {
      throw new UnauthorizedException('Not authenticated');
    }

    try {
      // Determine sender type and ID
      let senderId: string | null = null;
      let senderType: SenderType;
      let guestId: string | null = null;

      if (auth.type === 'admin' && auth.adminId) {
        senderId = auth.adminId;
        senderType = SenderType.ADMIN;
      } else if (auth.type === 'user' && auth.userId) {
        senderId = auth.userId;
        senderType = SenderType.USER;
      } else if (auth.type === 'guest' && auth.guestId) {
        guestId = auth.guestId;
        senderType = SenderType.GUEST;
      } else {
        throw new UnauthorizedException('Invalid sender type');
      }

      // Create message
      const result = await this.supportService.createMessage({
        conversationId: payload.conversationId,
        senderId,
        senderType,
        guestId,
        message: payload.message,
        messageType: (payload.messageType as MessageType) || MessageType.TEXT,
      });

      const message = result.message;

      // Convert message to plain object with UTC timestamps
      // CRITICAL: Ensure createdAt is explicitly converted to UTC ISO string
      const messageCreatedAt = message.createdAt 
        ? new Date(message.createdAt).toISOString() 
        : new Date().toISOString();
      
      const messagePayload = {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        senderType: message.senderType,
        guestId: message.guestId,
        message: message.message,
        messageType: message.messageType,
        fileUrl: message.fileUrl || null,
        fileName: message.fileName || null,
        fileSize: message.fileSize || null,
        isRead: message.isRead,
        readAt: message.readAt ? new Date(message.readAt).toISOString() : null,
        // CRITICAL: Explicitly set UTC ISO string with 'Z' suffix
        createdAt: messageCreatedAt,
      };

      // Log for debugging
      if (process.env.NODE_ENV === 'development') {
        this.logger.log(`📤 Broadcasting message: ${message.id}`, {
          createdAt: messagePayload.createdAt,
          isUTC: messagePayload.createdAt.endsWith('Z'),
          originalCreatedAt: message.createdAt,
        });
      }

      // Emit to conversation room with UTC timestamps
      this.server.to(`conversation:${payload.conversationId}`).emit('message:received', messagePayload);

      // Notify admins if user/guest sent message
      if (senderType === SenderType.USER || senderType === SenderType.GUEST) {
        this.server.to('admin:all').emit('conversation:new_message', {
          conversationId: payload.conversationId,
          message: messagePayload,
        });
      }

      // Broadcast unread count update
      const unreadCountUpdate = {
        conversationId: result.conversationId,
        unreadCount: result.unreadCount,
      };

      // Broadcast to conversation room
      this.server.to(`conversation:${payload.conversationId}`).emit('conversation:unread_count_updated', unreadCountUpdate);

      // If admin received the message, also broadcast total unread count
      if (result.receiverType === 'admin') {
        const totalUnreadCount = await this.supportService.calculateTotalUnreadCountForAdmin();
        this.server.to('admin:all').emit('conversation:unread_count_updated', {
          ...unreadCountUpdate,
          totalUnreadCount,
        });
      }

      return { success: true, message: messagePayload };
    } catch (error) {
      this.logger.error(`Message error: ${error.message}`);
      client.emit('message:error', { error: error.message });
      throw error;
    }
  }

  /**
   * Typing indicator
   */
  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const auth = this.socketAuthMap.get(client.id);
    if (!auth) return;

    // Broadcast to conversation (except sender)
    client.to(`conversation:${payload.conversationId}`).emit('typing:start', {
      conversationId: payload.conversationId,
      senderId: auth.userId || auth.adminId || auth.guestId,
    });
  }

  @SubscribeMessage('typing:stop')
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const auth = this.socketAuthMap.get(client.id);
    if (!auth) return;

    client.to(`conversation:${payload.conversationId}`).emit('typing:stop', {
      conversationId: payload.conversationId,
      senderId: auth.userId || auth.adminId || auth.guestId,
    });
  }

  /**
   * Mark message as read
   */
  @SubscribeMessage('message:read')
  async handleMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string },
  ) {
    const auth = this.socketAuthMap.get(client.id);
    if (!auth) return;

    const result = await this.supportService.markMessageAsRead(payload.messageId);
    
    // Emit message read event
    this.server.to(`conversation:${result.conversationId}`).emit('message:read', {
      messageId: payload.messageId,
    });

    // Broadcast unread count update
    const unreadCountUpdate = {
      conversationId: result.conversationId,
      unreadCount: result.unreadCount,
    };

    // Broadcast to conversation room
    this.server.to(`conversation:${result.conversationId}`).emit('conversation:unread_count_updated', unreadCountUpdate);

    // If admin read the message, also broadcast total unread count
    if (result.viewerType === 'admin') {
      const totalUnreadCount = await this.supportService.calculateTotalUnreadCountForAdmin();
      this.server.to('admin:all').emit('conversation:unread_count_updated', {
        ...unreadCountUpdate,
        totalUnreadCount,
      });
    }
  }

  /**
   * Join conversation room
   */
  @SubscribeMessage('conversation:join')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    await client.join(`conversation:${payload.conversationId}`);
    client.emit('conversation:joined', { conversationId: payload.conversationId });
  }

  /**
   * Leave conversation room
   */
  @SubscribeMessage('conversation:leave')
  async handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    await client.leave(`conversation:${payload.conversationId}`);
    client.emit('conversation:left', { conversationId: payload.conversationId });
  }
}

