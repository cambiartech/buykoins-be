import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Optional,
} from '@nestjs/common';
import { Sequelize, Op, QueryTypes } from 'sequelize';
import { SupportConversation, ConversationType, ConversationStatus, ConversationPriority } from './entities/support-conversation.entity';
import { SupportMessage, MessageType, SenderType } from './entities/support-message.entity';
import { OnboardingAuthCode, AuthCodeStatus } from './entities/onboarding-auth-code.entity';
import { CallRequest, CallRequestStatus, CallType } from './entities/call-request.entity';
import { AuthCodeUtil } from './utils/auth-code.util';
import { GuestIdUtil } from './utils/guest-id.util';

@Injectable()
export class SupportService {
  constructor(
    @Inject('SEQUELIZE') private sequelize: Sequelize,
    @Optional() @Inject('StorageService') private storageService?: any,
  ) {}

  /**
   * Calculate unread message count for a conversation
   * @param conversationId - The conversation ID
   * @param viewerType - 'admin' counts user/guest messages, 'user'/'guest' counts admin/system messages
   * @returns Unread message count
   */
  private async calculateUnreadCount(
    conversationId: string,
    viewerType: 'admin' | 'user' | 'guest',
  ): Promise<number> {
    let senderTypes: string[];
    
    if (viewerType === 'admin') {
      // Admin counts unread messages from users and guests
      senderTypes = [SenderType.USER, SenderType.GUEST];
    } else {
      // User/Guest counts unread messages from admin and system
      senderTypes = [SenderType.ADMIN, SenderType.SYSTEM];
    }

    const result = await this.sequelize.query(
      `SELECT COUNT(*) as count
       FROM support_messages
       WHERE conversation_id = :conversationId
         AND sender_type IN (:senderTypes)
         AND is_read = false`,
      {
        replacements: {
          conversationId,
          senderTypes,
        },
        type: QueryTypes.SELECT,
      },
    ) as Array<{ count: string | number }>;

    return parseInt(String(result[0]?.count || '0'), 10);
  }

  /**
   * Calculate total unread message count for admin across all conversations
   * @returns Total unread count
   */
  async calculateTotalUnreadCountForAdmin(): Promise<number> {
    const result = await this.sequelize.query(
      `SELECT COUNT(*) as count
       FROM support_messages
       WHERE sender_type IN (:senderTypes)
         AND is_read = false`,
      {
        replacements: {
          senderTypes: [SenderType.USER, SenderType.GUEST],
        },
        type: QueryTypes.SELECT,
      },
    ) as Array<{ count: string | number }>;

    return parseInt(String(result[0]?.count || '0'), 10);
  }

  /**
   * Get or create conversation for user
   * If conversation is closed, creates a new one
   */
  async getOrCreateUserConversation(
    userId: string,
    type: ConversationType = ConversationType.GENERAL,
  ): Promise<any> {
    // Find existing open conversation (not closed or resolved)
    let conversation = await SupportConversation.findOne({
      where: {
        userId,
        type,
        status: {
          [Op.in]: [ConversationStatus.OPEN], // Only open conversations
        },
      },
      order: [['createdAt', 'DESC']], // Get most recent
    });

    // If no open conversation or conversation is closed/resolved, create new one
    if (!conversation || conversation.status !== ConversationStatus.OPEN) {
      conversation = await SupportConversation.create({
        userId,
        type,
        status: ConversationStatus.OPEN,
      } as any);
    }

    // Convert to plain object with UTC timestamps and add unreadCount
    const convData: any = conversation.toJSON ? conversation.toJSON() : { ...conversation };
    if (convData.lastMessageAt) {
      convData.lastMessageAt = new Date(convData.lastMessageAt).toISOString();
    }
    if (convData.createdAt) {
      convData.createdAt = new Date(convData.createdAt).toISOString();
    }
    if (convData.updatedAt) {
      convData.updatedAt = new Date(convData.updatedAt).toISOString();
    }
    // Calculate unread count for user
    convData.unreadCount = await this.calculateUnreadCount(convData.id, 'user');
    return convData;
  }

  /**
   * Get or create conversation for guest
   * If conversation is closed, creates a new one
   */
  async getOrCreateGuestConversation(
    guestId: string,
    type: ConversationType = ConversationType.GENERAL,
  ): Promise<any> {
    if (!GuestIdUtil.isValid(guestId)) {
      throw new BadRequestException('Invalid guest ID');
    }

    // Find existing open conversation (not closed or resolved)
    let conversation = await SupportConversation.findOne({
      where: {
        guestId,
        type,
        status: {
          [Op.in]: [ConversationStatus.OPEN], // Only open conversations
        },
      },
      order: [['createdAt', 'DESC']], // Get most recent
    });

    // If no open conversation or conversation is closed/resolved, create new one
    if (!conversation || conversation.status !== ConversationStatus.OPEN) {
      conversation = await SupportConversation.create({
        guestId,
        type,
        status: ConversationStatus.OPEN,
      } as any);
    }

    // Convert to plain object with UTC timestamps and add unreadCount
    const convData: any = conversation.toJSON ? conversation.toJSON() : { ...conversation };
    if (convData.lastMessageAt) {
      convData.lastMessageAt = new Date(convData.lastMessageAt).toISOString();
    }
    if (convData.createdAt) {
      convData.createdAt = new Date(convData.createdAt).toISOString();
    }
    if (convData.updatedAt) {
      convData.updatedAt = new Date(convData.updatedAt).toISOString();
    }
    // Calculate unread count for guest
    convData.unreadCount = await this.calculateUnreadCount(convData.id, 'guest');
    return convData;
  }

  /**
   * Get user conversations
   */
  async getUserConversations(userId: string): Promise<any[]> {
    const conversations = await SupportConversation.findAll({
      where: { userId },
      order: [['lastMessageAt', 'DESC'], ['createdAt', 'DESC']],
      limit: 50,
    });

    // Convert to plain objects with UTC timestamps and add unreadCount
    const conversationsWithCounts = await Promise.all(
      conversations.map(async (conv) => {
        const convData: any = conv.toJSON ? conv.toJSON() : { ...conv };
        if (convData.lastMessageAt) {
          convData.lastMessageAt = new Date(convData.lastMessageAt).toISOString();
        }
        if (convData.createdAt) {
          convData.createdAt = new Date(convData.createdAt).toISOString();
        }
        if (convData.updatedAt) {
          convData.updatedAt = new Date(convData.updatedAt).toISOString();
        }
        // Calculate unread count for user
        convData.unreadCount = await this.calculateUnreadCount(convData.id, 'user');
        return convData;
      }),
    );

    return conversationsWithCounts;
  }

  /**
   * Get guest conversations
   */
  async getGuestConversations(guestId: string): Promise<any[]> {
    if (!GuestIdUtil.isValid(guestId)) {
      return [];
    }

    const conversations = await SupportConversation.findAll({
      where: { guestId },
      order: [['lastMessageAt', 'DESC'], ['createdAt', 'DESC']],
      limit: 50,
    });

    // Convert to plain objects with UTC timestamps and add unreadCount
    const conversationsWithCounts = await Promise.all(
      conversations.map(async (conv) => {
        const convData: any = conv.toJSON ? conv.toJSON() : { ...conv };
        if (convData.lastMessageAt) {
          convData.lastMessageAt = new Date(convData.lastMessageAt).toISOString();
        }
        if (convData.createdAt) {
          convData.createdAt = new Date(convData.createdAt).toISOString();
        }
        if (convData.updatedAt) {
          convData.updatedAt = new Date(convData.updatedAt).toISOString();
        }
        // Calculate unread count for guest
        convData.unreadCount = await this.calculateUnreadCount(convData.id, 'guest');
        return convData;
      }),
    );

    return conversationsWithCounts;
  }

  /**
   * Create message
   * @returns Object with message, conversationId, unreadCount, and receiverType
   */
  async createMessage(data: {
    conversationId: string;
    senderId?: string | null;
    senderType: SenderType;
    guestId?: string | null;
    message: string;
    messageType?: MessageType;
    fileUrl?: string | null;
    fileName?: string | null;
    fileSize?: number | null;
  }): Promise<{
    message: SupportMessage;
    conversationId: string;
    unreadCount: number;
    receiverType: 'admin' | 'user' | 'guest';
  }> {
    const conversation = await SupportConversation.findByPk(data.conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Use raw SQL to ensure UTC timestamp is stored correctly
    const nowUTC = new Date().toISOString();
    
    // Log for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('📨 Creating message:', {
        localTime: new Date().toLocaleString(),
        utcTime: nowUTC,
        serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        offset: new Date().getTimezoneOffset(),
      });
    }

    // Insert message using raw SQL to ensure UTC timestamp
    const result = await this.sequelize.query(
      `INSERT INTO support_messages 
       (id, conversation_id, sender_id, sender_type, guest_id, message, message_type, 
        file_url, file_name, file_size, is_read, created_at)
       VALUES 
       (uuid_generate_v4(), :conversationId, :senderId, :senderType, :guestId, 
        :message, :messageType, :fileUrl, :fileName, :fileSize, false, :createdAt::timestamp with time zone)
       RETURNING id`,
      {
        replacements: {
          conversationId: data.conversationId,
          senderId: data.senderId || null,
          senderType: data.senderType,
          guestId: data.guestId || null,
          message: data.message,
          messageType: data.messageType || MessageType.TEXT,
          fileUrl: data.fileUrl || null,
          fileName: data.fileName || null,
          fileSize: data.fileSize || null,
          createdAt: nowUTC,
        },
        type: QueryTypes.SELECT,
      },
    ) as Array<{ id: string }>;

    const messageId = result[0]?.id;
    if (!messageId) {
      throw new Error('Failed to create message');
    }

    // Fetch the created message
    const message = await SupportMessage.findByPk(messageId);
    if (!message) {
      throw new Error('Failed to retrieve created message');
    }

    // Update conversation last message time using UTC
    await this.sequelize.query(
      `UPDATE support_conversations 
       SET last_message_at = :nowUTC::timestamp with time zone
       WHERE id = :conversationId`,
      {
        replacements: {
          nowUTC,
          conversationId: data.conversationId,
        },
        type: QueryTypes.UPDATE,
      },
    );

    // Log saved message for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Message created:', {
        id: message.id,
        createdAt: message.createdAt,
        createdAtISO: message.createdAt ? new Date(message.createdAt).toISOString() : null,
      });
    }

    // Determine receiver type for unread count calculation
    let receiverType: 'admin' | 'user' | 'guest';
    if (data.senderType === SenderType.USER || data.senderType === SenderType.GUEST) {
      receiverType = 'admin'; // User/guest sent, admin receives
    } else {
      // Admin/system sent, user/guest receives
      if (conversation.userId) {
        receiverType = 'user';
      } else if (conversation.guestId) {
        receiverType = 'guest';
      } else {
        receiverType = 'admin'; // Fallback
      }
    }

    // Calculate updated unread count for receiver
    const unreadCount = await this.calculateUnreadCount(data.conversationId, receiverType);

    return {
      message,
      conversationId: data.conversationId,
      unreadCount,
      receiverType,
    };
  }

  /**
   * Mark message as read
   * @returns Object with conversationId and updated unreadCount
   */
  async markMessageAsRead(messageId: string): Promise<{
    conversationId: string;
    unreadCount: number;
    viewerType: 'admin' | 'user' | 'guest';
  }> {
    // Get message to find conversationId and senderType
    const message = await SupportMessage.findByPk(messageId);
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Update message as read
    await SupportMessage.update(
      {
        isRead: true,
        readAt: new Date(),
      },
      {
        where: { id: messageId },
      },
    );

    // Determine viewer type based on who read it (opposite of sender)
    let viewerType: 'admin' | 'user' | 'guest';
    if (message.senderType === SenderType.USER || message.senderType === SenderType.GUEST) {
      viewerType = 'admin'; // Admin read user/guest message
    } else {
      // Admin or system sent it, so user/guest read it
      // We need to determine from conversation
      const conversation = await SupportConversation.findByPk(message.conversationId);
      if (conversation?.userId) {
        viewerType = 'user';
      } else if (conversation?.guestId) {
        viewerType = 'guest';
      } else {
        viewerType = 'admin'; // Fallback
      }
    }

    // Recalculate unread count
    const unreadCount = await this.calculateUnreadCount(message.conversationId, viewerType);

    return {
      conversationId: message.conversationId,
      unreadCount,
      viewerType,
    };
  }

  /**
   * Get conversation messages
   */
  async getConversationMessages(
    conversationId: string,
    page: number = 1,
    limit: number = 50,
  ) {
    const offset = (page - 1) * limit;
    const maxLimit = Math.min(limit, 100);

    const { count, rows } = await SupportMessage.findAndCountAll({
      where: { conversationId },
      order: [['createdAt', 'ASC']],
      limit: maxLimit,
      offset,
    });

    // Convert messages to plain objects with UTC ISO timestamps
    const messages = rows.map((msg) => ({
      id: msg.id,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      senderType: msg.senderType,
      guestId: msg.guestId,
      message: msg.message,
      messageType: msg.messageType,
      fileUrl: msg.fileUrl,
      fileName: msg.fileName,
      fileSize: msg.fileSize,
      isRead: msg.isRead,
      readAt: msg.readAt ? new Date(msg.readAt).toISOString() : null,
      createdAt: msg.createdAt ? new Date(msg.createdAt).toISOString() : new Date().toISOString(),
    }));

    return {
      messages,
      pagination: {
        total: count,
        page,
        limit: maxLimit,
        totalPages: Math.ceil(count / maxLimit),
      },
    };
  }

  /**
   * Generate onboarding auth code
   */
  async generateOnboardingAuthCode(data: {
    adminId: string;
    userId?: string | null;
    guestId?: string | null;
    conversationId?: string | null;
    deviceInfo?: string | null;
  }): Promise<OnboardingAuthCode> {
    // Generate unique code
    let code: string;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      code = AuthCodeUtil.generate(6);
      const existing = await OnboardingAuthCode.findOne({ where: { code } });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new BadRequestException('Failed to generate unique code');
    }

    const expiresAt = AuthCodeUtil.getExpirationDate(15); // 15 minutes

    const authCode = await OnboardingAuthCode.create({
      adminId: data.adminId,
      userId: data.userId,
      guestId: data.guestId,
      conversationId: data.conversationId,
      code: code!,
      status: AuthCodeStatus.PENDING,
      expiresAt,
      deviceInfo: data.deviceInfo,
    } as any);

    return authCode;
  }

  /**
   * Verify onboarding auth code
   */
  async verifyOnboardingAuthCode(
    code: string,
    userId?: string,
    guestId?: string,
  ): Promise<{ valid: boolean; authCode?: OnboardingAuthCode }> {
    const authCode = await OnboardingAuthCode.findOne({
      where: { code, status: AuthCodeStatus.PENDING },
    });

    if (!authCode) {
      return { valid: false };
    }

    // Check expiration
    if (AuthCodeUtil.isExpired(authCode.expiresAt)) {
      authCode.status = AuthCodeStatus.EXPIRED;
      await authCode.save();
      return { valid: false };
    }

    // Verify user/guest matches (if provided)
    if (userId && authCode.userId !== userId) {
      return { valid: false };
    }

    if (guestId && authCode.guestId !== guestId) {
      return { valid: false };
    }

    // Mark as used
    authCode.status = AuthCodeStatus.USED;
    authCode.usedAt = new Date();
    if (userId) {
      authCode.userId = userId; // Link to user if they sign up
    }
    await authCode.save();

    return { valid: true, authCode };
  }

  /**
   * Get conversation by ID
   * @param conversationId - The conversation ID
   * @param viewerType - Optional: 'admin' | 'user' | 'guest' to determine unread count perspective
   */
  async getConversationById(
    conversationId: string,
    viewerType?: 'admin' | 'user' | 'guest',
  ): Promise<any> {
    const conversation = await SupportConversation.findByPk(conversationId, {
      include: [
        { association: 'user' },
        { association: 'admin' },
        { association: 'messages', limit: 50, order: [['createdAt', 'DESC']] },
      ],
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Convert to plain object with UTC timestamps
    const conversationData: any = conversation.toJSON ? conversation.toJSON() : conversation;
    
    // Ensure all timestamps are UTC ISO strings
    if (conversationData.lastMessageAt) {
      conversationData.lastMessageAt = new Date(conversationData.lastMessageAt).toISOString();
    }
    if (conversationData.createdAt) {
      conversationData.createdAt = new Date(conversationData.createdAt).toISOString();
    }
    if (conversationData.updatedAt) {
      conversationData.updatedAt = new Date(conversationData.updatedAt).toISOString();
    }

    // Convert messages timestamps
    if (conversationData.messages && Array.isArray(conversationData.messages)) {
      conversationData.messages = conversationData.messages.map((msg: any) => ({
        ...msg,
        createdAt: msg.createdAt ? new Date(msg.createdAt).toISOString() : new Date().toISOString(),
        readAt: msg.readAt ? new Date(msg.readAt).toISOString() : null,
      }));
    }

    // Calculate unread count based on viewer type
    // If not specified, determine from conversation (has userId = user, has guestId = guest, else admin)
    if (!viewerType) {
      if (conversationData.userId) {
        viewerType = 'user';
      } else if (conversationData.guestId) {
        viewerType = 'guest';
      } else {
        viewerType = 'admin';
      }
    }
    conversationData.unreadCount = await this.calculateUnreadCount(conversationId, viewerType);

    return conversationData;
  }

  /**
   * Get all conversations (Admin only) with filtering
   */
  async getAllConversations(filters: {
    page?: number;
    limit?: number;
    status?: ConversationStatus | 'all';
    type?: ConversationType | 'all';
    userId?: string;
    guestId?: string;
    search?: string;
  }): Promise<{ conversations: SupportConversation[]; pagination: any }> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 100);
    const offset = (page - 1) * limit;

    const where: any = {};

    if (filters.status && filters.status !== 'all') {
      where.status = filters.status;
    }

    if (filters.type && filters.type !== 'all') {
      where.type = filters.type;
    }

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.guestId) {
      where.guestId = filters.guestId;
    }

    // Search in subject
    if (filters.search) {
      where[Op.or] = [
        { subject: { [Op.iLike]: `%${filters.search}%` } },
      ];
    }

    const { count, rows } = await SupportConversation.findAndCountAll({
      where,
      include: [
        { association: 'user', required: false },
        { association: 'admin', required: false },
      ],
      order: [['lastMessageAt', 'DESC NULLS LAST'], ['createdAt', 'DESC']],
      limit,
      offset,
    });

    return {
      conversations: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  /**
   * Update conversation status (Admin only)
   */
  async updateConversationStatus(
    conversationId: string,
    status: ConversationStatus,
    adminId?: string,
  ): Promise<SupportConversation> {
    const conversation = await SupportConversation.findByPk(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    conversation.status = status;
    if (adminId) {
      conversation.adminId = adminId;
    }
    await conversation.save();

    return conversation;
  }

  /**
   * Assign conversation to admin
   */
  async assignConversation(
    conversationId: string,
    adminId: string,
  ): Promise<SupportConversation> {
    const conversation = await SupportConversation.findByPk(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    conversation.adminId = adminId;
    await conversation.save();

    return conversation;
  }

  /**
   * Update conversation priority (Admin only)
   */
  async updateConversationPriority(
    conversationId: string,
    priority: ConversationPriority,
  ): Promise<SupportConversation> {
    const conversation = await SupportConversation.findByPk(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    conversation.priority = priority;
    await conversation.save();

    return conversation;
  }
}

