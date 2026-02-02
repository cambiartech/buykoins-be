import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  DefaultValuePipe,
  ParseIntPipe,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { GenerateAuthCodeDto } from './dto/generate-auth-code.dto';
import { VerifyAuthCodeDto } from './dto/verify-auth-code.dto';
import { UpdateConversationStatusDto } from './dto/update-conversation-status.dto';
import { UpdateConversationPriorityDto } from './dto/update-conversation-priority.dto';
import { UploadMessageFileDto } from './dto/upload-message-file.dto';
import { ConversationType } from './entities/support-conversation.entity';
import { GuestIdUtil } from './utils/guest-id.util';
import { StorageService } from '../storage/storage.service';

@ApiTags('Support')
@Controller('support')
export class SupportController {
  constructor(
    private readonly supportService: SupportService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Health check endpoint for WebSocket server
   */
  @Get('health')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'WebSocket server health check' })
  @ApiResponse({
    status: 200,
    description: 'WebSocket server is running',
  })
  healthCheck() {
    return {
      success: true,
      message: 'WebSocket server is running',
      timestamp: new Date().toISOString(),
      websocket: {
        namespace: '/support',
        url: process.env.NODE_ENV === 'production' 
          ? `wss://${process.env.DOMAIN || 'yourdomain.com'}/support`
          : 'ws://localhost:3001/support',
      },
    };
  }

  /**
   * Get or create conversation (for authenticated users)
   */
  @Get('conversation')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get or create conversation (authenticated users)' })
  @ApiQuery({
    name: 'type',
    enum: ConversationType,
    required: false,
    description: 'Conversation type',
  })
  @ApiResponse({
    status: 200,
    description: 'Conversation retrieved or created',
  })
  async getOrCreateConversation(
    @CurrentUser() user: any,
    @Query('type') type?: ConversationType,
  ) {
    const conversation = await this.supportService.getOrCreateUserConversation(
      user.id,
      type || ConversationType.GENERAL,
    );
    return {
      success: true,
      data: conversation,
    };
  }

  /**
   * Get or create conversation (for anonymous/guest users)
   */
  @Post('conversation/guest')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get or create conversation (anonymous users)' })
  @ApiResponse({
    status: 200,
    description: 'Conversation retrieved or created',
  })
  async getOrCreateGuestConversation(@Body() createDto: CreateConversationDto) {
    // Generate guest ID if not provided
    const guestId = GuestIdUtil.generate();

    const conversation = await this.supportService.getOrCreateGuestConversation(
      guestId,
      createDto.type || ConversationType.GENERAL,
    );

    return {
      success: true,
      data: {
        conversation,
        guestId, // Return guest ID for client to store
      },
    };
  }

  /**
   * Get conversation messages
   */
  @Get('conversation/:id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get conversation messages' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Messages retrieved successfully',
  })
  async getConversationMessages(
    @Param('id') conversationId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ) {
    const data = await this.supportService.getConversationMessages(
      conversationId,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
    return {
      success: true,
      data,
    };
  }

  /**
   * Generate onboarding auth code (Admin only)
   */
  @Post('onboarding/generate-code')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate onboarding auth code (Admin)' })
  @ApiResponse({
    status: 201,
    description: 'Auth code generated successfully',
  })
  async generateAuthCode(
    @CurrentUser() admin: any,
    @Body() generateDto: GenerateAuthCodeDto,
  ) {
    if (admin.type !== 'admin') {
      throw new Error('Only admins can generate auth codes');
    }

    const authCode = await this.supportService.generateOnboardingAuthCode({
      adminId: admin.id,
      userId: generateDto.userId,
      guestId: generateDto.guestId,
      conversationId: generateDto.conversationId,
      deviceInfo: generateDto.deviceInfo,
    });

    return {
      success: true,
      message: 'Auth code generated successfully',
      data: {
        code: authCode.code,
        expiresAt: authCode.expiresAt,
        conversationId: authCode.conversationId,
      },
    };
  }

  /**
   * Verify onboarding auth code (Public - for users and guests)
   */
  @Post('onboarding/verify-code')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify onboarding auth code' })
  @ApiResponse({
    status: 200,
    description: 'Code verified successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired code',
  })
  async verifyAuthCode(@Body() verifyDto: VerifyAuthCodeDto) {
    const result = await this.supportService.verifyOnboardingAuthCode(
      verifyDto.code,
      verifyDto.userId,
      verifyDto.guestId,
    );

    if (!result.valid) {
      return {
        success: false,
        message: 'Invalid or expired code',
      };
    }

    return {
      success: true,
      message: 'Code verified successfully',
      data: {
        authCodeId: result.authCode?.id,
        userId: result.authCode?.userId,
      },
    };
  }

  /**
   * Get conversation by ID
   */
  @Get('conversation/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get conversation details' })
  @ApiResponse({
    status: 200,
    description: 'Conversation retrieved successfully',
  })
  async getConversation(@Param('id') conversationId: string) {
    const conversation = await this.supportService.getConversationById(
      conversationId,
    );
    return {
      success: true,
      data: conversation,
    };
  }

  /**
   * Upload file/image for support message
   */
  @Post('conversation/:id/upload')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload file/image for support message' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (jpg, jpeg, png, webp, max 10MB)',
        },
        message: {
          type: 'string',
          description: 'Optional message text',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded and message created successfully',
  })
  async uploadMessageFile(
    @Param('id') conversationId: string,
    @CurrentUser() user: any,
    @Body() uploadDto: UploadMessageFileDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({
            fileType: /(jpg|jpeg|png|webp)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    // Upload file to S3
    const fileKey = await this.storageService.uploadFile(file, 'support-messages');
    const fileUrl = await this.storageService.getPublicUrl(fileKey);

    // Create message with file
    const result = await this.supportService.createMessage({
      conversationId,
      senderId: user.id,
      senderType: 'user' as any,
      message: uploadDto.message || '📎 Image attachment',
      messageType: 'file' as any,
      fileUrl,
      fileName: file.originalname,
      fileSize: file.size,
    });

    const message = result.message;

    // Convert to plain object with UTC timestamps
    const messagePayload = {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderType: message.senderType,
      guestId: message.guestId,
      message: message.message,
      messageType: message.messageType,
      fileUrl: message.fileUrl,
      fileName: message.fileName,
      fileSize: message.fileSize,
      isRead: message.isRead,
      readAt: message.readAt ? new Date(message.readAt).toISOString() : null,
      createdAt: message.createdAt ? new Date(message.createdAt).toISOString() : new Date().toISOString(),
    };

    return {
      success: true,
      message: 'File uploaded and message created successfully',
      data: messagePayload,
    };
  }

  /**
   * Get conversation options (OPTIONAL - for categorizing conversation type)
   * Users can skip this and just start typing - conversation will be created automatically
   */
  @Get('conversation-options')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get conversation type options (optional - users can skip and just start typing)',
    description: 'These are just for categorizing the conversation type. Users can ignore this and just start typing messages - a conversation will be created automatically.'
  })
  @ApiResponse({
    status: 200,
    description: 'Conversation options retrieved successfully',
  })
  getConversationOptions() {
    return {
      success: true,
      data: {
        options: [
          {
            id: 'onboarding',
            title: 'I need help with onboarding',
            description: 'Set up your TikTok account and get your PayPal code',
            type: ConversationType.ONBOARDING,
          },
          {
            id: 'credit-request',
            title: 'I want to submit my TikTok earnings',
            description: 'Upload proof of earnings and get paid',
            type: ConversationType.GENERAL,
          },
          {
            id: 'withdrawal',
            title: 'I need help with my withdrawal/payout',
            description: 'Check status or get help with payouts',
            type: ConversationType.GENERAL,
          },
          {
            id: 'other',
            title: 'Other - General Support',
            description: 'Any other questions or issues',
            type: ConversationType.GENERAL,
          },
        ],
        note: 'Users can skip selecting an option and just start typing. A conversation will be created automatically with type "general".',
      },
    };
  }

  /**
   * Get standard messages/templates (ADMIN ONLY - for admin responses)
   */
  @Get('standard-messages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get standard support messages/templates (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Standard messages retrieved successfully',
  })
  getStandardMessages() {
    return {
      success: true,
      data: {
        messages: {
          welcome: {
            onboarding: 'Hello! I\'m here to help you complete your onboarding. Let\'s get your TikTok account set up!',
            general: 'Hello! How can I help you today?',
            withdrawal: 'Hello! I can help you with your withdrawal. What would you like to know?',
          },
          onboarding: {
            step1: 'To get started, I\'ll need to provide you with a special PayPal code. Please provide your TikTok account email.',
            step2: 'Great! Here\'s your PayPal code: [CODE]. Please enter this in your TikTok account settings.',
            step3: 'Once you\'ve entered the code, please send me a screenshot of the confirmation screen so I can verify everything is set up correctly.',
            step4: 'Perfect! Your account is now set up. You can proceed to make withdrawals. Is there anything else you need help with?',
          },
          withdrawal: {
            pending: 'Your withdrawal request is being processed. You\'ll receive a notification once it\'s completed.',
            completed: 'Your withdrawal has been completed successfully!',
            rejected: 'Your withdrawal request was rejected. Please contact support for more information.',
          },
          other: {
            greeting: 'Hello! I\'m here to help. What can I assist you with today?',
            closing: 'Is there anything else I can help you with?',
          },
        },
      },
    };
  }
}

/**
 * Admin Support Controller - Separate controller for admin support endpoints
 */
@ApiTags('Admin Support')
@Controller('admin/support')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles('admin', 'super_admin')
export class AdminSupportController {
  constructor(private readonly supportService: SupportService) {}

  /**
   * Get all support conversations (Admin)
   */
  @Get('conversations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all support conversations (Admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['all', 'open', 'closed', 'resolved'],
    example: 'all',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['all', 'general', 'onboarding', 'call_request'],
    example: 'all',
  })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'guestId', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Conversations retrieved successfully',
  })
  async getConversations(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('userId') userId?: string,
    @Query('guestId') guestId?: string,
    @Query('search') search?: string,
  ) {
    const data = await this.supportService.getAllConversations({
      page,
      limit,
      status: status as any,
      type: type as any,
      userId,
      guestId,
      search,
    });

    return {
      success: true,
      data,
    };
  }

  /**
   * Get conversation by ID (Admin)
   */
  @Get('conversations/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get conversation details (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Conversation retrieved successfully',
  })
  async getConversation(@Param('id') conversationId: string) {
    const conversation = await this.supportService.getConversationById(
      conversationId,
    );
    return {
      success: true,
      data: conversation,
    };
  }

  /**
   * Update conversation status (Admin)
   */
  @Patch('conversations/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update conversation status (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Conversation status updated successfully',
  })
  async updateConversationStatus(
    @Param('id') conversationId: string,
    @Body() updateDto: UpdateConversationStatusDto,
    @CurrentUser() admin: any,
  ) {
    const conversation = await this.supportService.updateConversationStatus(
      conversationId,
      updateDto.status,
      admin.id,
    );
    return {
      success: true,
      message: 'Conversation status updated successfully',
      data: conversation,
    };
  }

  /**
   * Assign conversation to admin
   */
  @Patch('conversations/:id/assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign conversation to admin' })
  @ApiResponse({
    status: 200,
    description: 'Conversation assigned successfully',
  })
  async assignConversation(
    @Param('id') conversationId: string,
    @CurrentUser() admin: any,
  ) {
    const conversation = await this.supportService.assignConversation(
      conversationId,
      admin.id,
    );
    return {
      success: true,
      message: 'Conversation assigned successfully',
      data: conversation,
    };
  }

  /**
   * Get conversation messages (Admin)
   */
  @Get('conversations/:id/messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get conversation messages (Admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiResponse({
    status: 200,
    description: 'Messages retrieved successfully',
  })
  async getConversationMessages(
    @Param('id') conversationId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    const data = await this.supportService.getConversationMessages(
      conversationId,
      page,
      limit,
    );
    return {
      success: true,
      data,
    };
  }

  /**
   * Update conversation priority (Admin)
   */
  @Patch('conversations/:id/priority')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update conversation priority (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Conversation priority updated successfully',
  })
  async updateConversationPriority(
    @Param('id') conversationId: string,
    @Body() updateDto: UpdateConversationPriorityDto,
    @CurrentUser() admin: any,
  ) {
    const conversation = await this.supportService.updateConversationPriority(
      conversationId,
      updateDto.priority,
    );
    return {
      success: true,
      message: 'Conversation priority updated successfully',
      data: conversation,
    };
  }
}

