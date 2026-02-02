import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
  NotFoundException,
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
import { AdminsService } from './admins.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { UpdateAdminPasswordDto } from './dto/update-admin-password.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { ApproveCreditRequestDto } from './dto/approve-credit-request.dto';
import { RejectCreditRequestDto } from './dto/reject-credit-request.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { ProcessPayoutDto } from './dto/process-payout.dto';
import { RejectPayoutDto } from './dto/reject-payout.dto';
import { ProvideWidgetCredentialsDto } from './dto/provide-widget-credentials.dto';
import { WidgetService } from '../widget/widget.service';
import { WidgetSession } from '../widget/entities/widget-session.entity';
import { User } from '../users/entities/user.entity';
import { Op } from 'sequelize';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles('admin', 'super_admin')
export class AdminsController {
  constructor(
    private readonly adminsService: AdminsService,
    private readonly widgetService: WidgetService,
  ) {}

  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get admin dashboard overview with actionable items' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard overview retrieved successfully',
  })
  async getDashboardOverview() {
    const data = await this.adminsService.getDashboardOverview();
    return {
      success: true,
      data,
    };
  }

  @Get('credit-requests')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all credit requests' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['all', 'pending', 'approved', 'rejected'],
    example: 'pending',
  })
  @ApiResponse({
    status: 200,
    description: 'Credit requests retrieved successfully',
  })
  async getCreditRequests(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ) {
    const data = await this.adminsService.getCreditRequests(page, limit, status);
    return {
      success: true,
      data,
    };
  }

  @Get('credit-requests/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get credit request by ID' })
  @ApiResponse({
    status: 200,
    description: 'Credit request retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Credit request not found' })
  async getCreditRequestById(@Param('id') id: string) {
    const data = await this.adminsService.getCreditRequestById(id);
    return {
      success: true,
      data,
    };
  }

  @Post('credit-requests/:id/approve')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('adminProof'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Approve a credit request with admin proof' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        notes: {
          type: 'string',
          example: 'Approved after verification',
        },
        creditMethod: {
          type: 'string',
          enum: ['balance', 'direct'],
          example: 'balance',
          description: 'balance: credit user balance, direct: remit to bank account',
        },
        amount: {
          type: 'number',
          example: 500.00,
          description: 'Amount to credit (if different from request)',
        },
        adminProof: {
          type: 'string',
          format: 'binary',
          description: 'Admin proof file (image or PDF, max 10MB)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Credit request approved successfully',
  })
  @ApiResponse({ status: 404, description: 'Credit request not found' })
  @ApiResponse({ status: 400, description: 'Credit request already processed or user has no bank account' })
  async approveCreditRequest(
    @Param('id') id: string,
    @CurrentUser() admin: CurrentUserPayload,
    @Body() approveDto: ApproveCreditRequestDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({
            fileType: /(jpg|jpeg|png|webp|pdf)$/,
          }),
        ],
        fileIsRequired: false, // Admin proof is optional
      }),
    )
    adminProofFile?: Express.Multer.File,
  ) {
    const data = await this.adminsService.approveCreditRequest(
      id,
      admin.id,
      approveDto,
      adminProofFile,
    );
    return {
      success: true,
      message: 'Credit request approved successfully',
      data,
    };
  }

  @Post('credit-requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a credit request' })
  @ApiResponse({
    status: 200,
    description: 'Credit request rejected successfully',
    schema: {
      example: {
        success: true,
        message: 'Credit request rejected',
        data: {
          id: 'uuid',
          status: 'rejected',
          processedAt: '2024-01-20T11:00:00Z',
          processedBy: 'admin_uuid',
          rejectionReason: 'Proof of earnings is unclear or invalid',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Credit request not found' })
  @ApiResponse({ status: 400, description: 'Credit request already processed' })
  async rejectCreditRequest(
    @Param('id') id: string,
    @CurrentUser() admin: CurrentUserPayload,
    @Body() rejectDto: RejectCreditRequestDto,
  ) {
    const data = await this.adminsService.rejectCreditRequest(
      id,
      admin.id,
      rejectDto,
    );
    return {
      success: true,
      message: 'Credit request rejected',
      data,
    };
  }

  @Get('users')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all users' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['all', 'active', 'suspended', 'frozen'],
  })
  @ApiQuery({
    name: 'onboardingStatus',
    required: false,
    enum: ['all', 'pending', 'completed'],
    description: 'Filter by onboarding status (useful to see users needing onboarding)',
  })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
  })
  async getUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('onboardingStatus') onboardingStatus?: string,
  ) {
    const data = await this.adminsService.getUsers(
      page,
      limit,
      search,
      status,
      onboardingStatus,
    );
    return {
      success: true,
      data,
    };
  }

  @Get('users/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({
    status: 200,
    description: 'User retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id') id: string) {
    const data = await this.adminsService.getUserById(id);
    return {
      success: true,
      data,
    };
  }

  @Get('users/:id/bank-accounts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user bank accounts' })
  @ApiResponse({
    status: 200,
    description: 'User bank accounts retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserBankAccounts(@Param('id') id: string) {
    const data = await this.adminsService.getUserBankAccounts(id);
    return {
      success: true,
      data,
    };
  }

  @Post('users/:id/complete-onboarding')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete user onboarding with notes' })
  @ApiResponse({
    status: 200,
    description: 'Onboarding completed successfully',
    schema: {
      example: {
        success: true,
        message: 'Onboarding completed successfully',
        data: {
          userId: 'uuid',
          onboardingStatus: 'completed',
          onboardingRequest: {
            id: 'uuid',
            status: 'completed',
            completedAt: '2024-01-20T11:00:00Z',
            completedBy: 'admin_uuid',
            notes: 'Bank: First Bank, Account: 1234567890, PayPal: user@example.com',
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 400, description: 'User already onboarded' })
  async completeOnboarding(
    @Param('id') id: string,
    @CurrentUser() admin: CurrentUserPayload,
    @Body() completeDto: CompleteOnboardingDto,
  ) {
    const data = await this.adminsService.completeOnboarding(
      id,
      admin.id,
      completeDto,
    );
    return {
      success: true,
      message: 'Onboarding completed successfully',
      data,
    };
  }

  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend user account' })
  @ApiResponse({
    status: 200,
    description: 'User suspended successfully',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async suspendUser(
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    if (!reason || reason.length < 10) {
      throw new BadRequestException('Reason is required and must be at least 10 characters');
    }
    const data = await this.adminsService.suspendUser(id, reason);
    return {
      success: true,
      message: 'User suspended successfully',
      data,
    };
  }

  @Post('users/:id/unsuspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unsuspend user account' })
  @ApiResponse({
    status: 200,
    description: 'User unsuspended successfully',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async unsuspendUser(@Param('id') id: string) {
    const data = await this.adminsService.unsuspendUser(id);
    return {
      success: true,
      message: 'User unsuspended successfully',
      data,
    };
  }

  // ========== Payout Management ==========

  @Get('payouts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all payouts' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['all', 'pending', 'processing', 'completed', 'rejected'],
    example: 'pending',
  })
  @ApiResponse({
    status: 200,
    description: 'Payouts retrieved successfully',
  })
  async getPayouts(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ) {
    const data = await this.adminsService.getPayouts(page, limit, status);
    return {
      success: true,
      data,
    };
  }

  @Get('payouts/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get payout by ID' })
  @ApiResponse({
    status: 200,
    description: 'Payout retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Payout not found' })
  async getPayoutById(@Param('id') id: string) {
    const data = await this.adminsService.getPayoutById(id);
    return {
      success: true,
      data,
    };
  }

  @Post('payouts/:id/process')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process/Approve payout' })
  @ApiResponse({
    status: 200,
    description: 'Payout processed successfully',
  })
  @ApiResponse({ status: 404, description: 'Payout not found' })
  @ApiResponse({ status: 400, description: 'Payout already processed or insufficient balance' })
  async processPayout(
    @Param('id') id: string,
    @CurrentUser() admin: CurrentUserPayload,
    @Body() processDto: ProcessPayoutDto,
  ) {
    const data = await this.adminsService.processPayout(id, admin.id, processDto);
    return {
      success: true,
      message: 'Payout processed successfully',
      data,
    };
  }

  @Post('payouts/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject payout' })
  @ApiResponse({
    status: 200,
    description: 'Payout rejected successfully',
  })
  @ApiResponse({ status: 404, description: 'Payout not found' })
  @ApiResponse({ status: 400, description: 'Payout already processed' })
  async rejectPayout(
    @Param('id') id: string,
    @CurrentUser() admin: CurrentUserPayload,
    @Body() rejectDto: RejectPayoutDto,
  ) {
    const data = await this.adminsService.rejectPayout(id, admin.id, rejectDto);
    return {
      success: true,
      message: 'Payout rejected successfully',
      data,
    };
  }

  // ========== Transaction Management ==========

  @Get('transactions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all transactions with flexible filtering' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['all', 'credit', 'withdrawal', 'payout', 'deposit', 'card_funding', 'transfer_earnings_to_wallet', 'card_purchase'],
    example: 'all',
    description: 'Filter by transaction type. Includes: credit, withdrawal, payout, deposit (wallet funding), card_funding, transfer_earnings_to_wallet, card_purchase',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['all', 'completed', 'pending', 'rejected'],
    example: 'all',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    type: String,
    description: 'Filter by specific user ID',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search in description, user email, name, username, or user ID',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    type: String,
    description: 'Start date for date range filter (ISO 8601 format)',
    example: '2025-12-01',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    type: String,
    description: 'End date for date range filter (ISO 8601 format)',
    example: '2025-12-31',
  })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved successfully',
  })
  async getTransactions(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const data = await this.adminsService.getTransactions(page, limit, {
      type,
      status,
      userId,
      search,
      dateFrom,
      dateTo,
    });
    return {
      success: true,
      data,
    };
  }

  @Get('transactions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get transaction by ID' })
  @ApiResponse({
    status: 200,
    description: 'Transaction retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getTransactionById(@Param('id') id: string) {
    const data = await this.adminsService.getTransactionById(id);
    return {
      success: true,
      data,
    };
  }

  @Get('transactions/stats/summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get transaction statistics and summary' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['all', 'credit', 'withdrawal', 'payout', 'deposit', 'card_funding', 'transfer_earnings_to_wallet', 'card_purchase'],
    example: 'all',
    description: 'Filter by transaction type',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['all', 'completed', 'pending', 'rejected'],
    example: 'all',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    type: String,
    description: 'Start date for date range filter (ISO 8601 format)',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    type: String,
    description: 'End date for date range filter (ISO 8601 format)',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction statistics retrieved successfully',
  })
  async getTransactionStatistics(
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const data = await this.adminsService.getTransactionStatistics({
      type,
      status,
      dateFrom,
      dateTo,
    });
    return {
      success: true,
      data,
    };
  }

  // ========== Finance/Charges Reporting ==========

  @Get('finance/report')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get finance/charges report for bookkeeping' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['all', 'payout', 'withdrawal'],
    example: 'all',
    description: 'Filter by transaction type',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    type: String,
    description: 'Start date for date range filter (ISO 8601 format)',
    example: '2025-12-01',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    type: String,
    description: 'End date for date range filter (ISO 8601 format)',
    example: '2025-12-31',
  })
  @ApiResponse({
    status: 200,
    description: 'Finance report retrieved successfully',
  })
  async getFinanceReport(
    @Query('type') type?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const data = await this.adminsService.getFinanceReport({
      type,
      dateFrom,
      dateTo,
    });
    return {
      success: true,
      data,
    };
  }

  // ========== Admin Management ==========

  @Get('admins')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all admins with pagination and filtering' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: ['all', 'admin', 'super_admin'],
    example: 'all',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['all', 'active', 'disabled'],
    example: 'all',
  })
  @ApiResponse({
    status: 200,
    description: 'Admins retrieved successfully',
  })
  @Roles('super_admin')
  async getAdmins(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    const data = await this.adminsService.getAdmins(page, limit, search, role, status);
    return {
      success: true,
      data,
    };
  }

  @Get('admins/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get admin by ID' })
  @ApiResponse({
    status: 200,
    description: 'Admin retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  @Roles('super_admin')
  async getAdminById(@Param('id') id: string) {
    const data = await this.adminsService.getAdminById(id);
    return {
      success: true,
      data,
    };
  }

  @Post('admins')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new admin' })
  @ApiResponse({
    status: 201,
    description: 'Admin created successfully',
  })
  @ApiResponse({ status: 400, description: 'Email already exists' })
  @Roles('super_admin')
  async createAdmin(
    @Body() createDto: CreateAdminDto,
    @CurrentUser() admin: CurrentUserPayload,
  ) {
    const data = await this.adminsService.createAdmin(createDto, admin.id);
    return {
      success: true,
      message: 'Admin created successfully',
      data,
    };
  }

  @Patch('admins/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update admin' })
  @ApiResponse({
    status: 200,
    description: 'Admin updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  @Roles('super_admin')
  async updateAdmin(
    @Param('id') id: string,
    @Body() updateDto: UpdateAdminDto,
    @CurrentUser() admin: CurrentUserPayload,
  ) {
    const data = await this.adminsService.updateAdmin(id, updateDto, admin.id);
    return {
      success: true,
      message: 'Admin updated successfully',
      data,
    };
  }

  @Post('admins/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend admin account' })
  @ApiResponse({
    status: 200,
    description: 'Admin suspended successfully',
  })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  @ApiResponse({ status: 403, description: 'Cannot suspend super admin or self' })
  @Roles('super_admin')
  async suspendAdmin(
    @Param('id') id: string,
    @CurrentUser() admin: CurrentUserPayload,
    @Body('reason') reason?: string,
  ) {
    const data = await this.adminsService.suspendAdmin(id, admin.id, reason);
    return {
      success: true,
      message: 'Admin suspended successfully',
      data,
    };
  }

  @Post('admins/:id/unsuspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unsuspend admin account' })
  @ApiResponse({
    status: 200,
    description: 'Admin unsuspended successfully',
  })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  @Roles('super_admin')
  async unsuspendAdmin(@Param('id') id: string) {
    const data = await this.adminsService.unsuspendAdmin(id);
    return {
      success: true,
      message: 'Admin unsuspended successfully',
      data,
    };
  }

  @Delete('admins/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete admin (soft delete)' })
  @ApiResponse({
    status: 200,
    description: 'Admin deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  @ApiResponse({ status: 403, description: 'Cannot delete super admin or self' })
  @Roles('super_admin')
  async deleteAdmin(@Param('id') id: string, @CurrentUser() admin: any) {
    const data = await this.adminsService.deleteAdmin(id, admin.id);
    return {
      success: true,
      message: 'Admin deleted successfully',
      data,
    };
  }

  @Get('admins/permissions/available')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get available permissions list' })
  @ApiResponse({
    status: 200,
    description: 'Available permissions retrieved successfully',
  })
  @Roles('super_admin')
  async getAvailablePermissions() {
    const data = await this.adminsService.getAvailablePermissions();
    return {
      success: true,
      data,
    };
  }

  @Post('admins/:id/password/request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request OTP for password change' })
  @ApiResponse({
    status: 200,
    description: 'OTP sent to email successfully',
  })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  @Roles('super_admin')
  async requestPasswordChangeOtp(@Param('id') id: string) {
    const data = await this.adminsService.requestPasswordChangeOtp(id);
    return {
      success: true,
      message: data.message,
      data: {
        expiresIn: data.expiresIn,
      },
    };
  }

  @Post('admins/:id/password/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and update password' })
  @ApiResponse({
    status: 200,
    description: 'Password updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  @Roles('super_admin')
  async verifyPasswordChangeOtp(
    @Param('id') id: string,
    @Body() updatePasswordDto: UpdateAdminPasswordDto,
  ) {
    const data = await this.adminsService.verifyPasswordChangeOtp(
      id,
      updatePasswordDto.password,
      updatePasswordDto.verificationCode,
    );
    return {
      success: true,
      message: data.message,
    };
  }

  /**
   * Provide PayPal credentials for widget onboarding
   */
  @Post('widget/:sessionId/provide-credentials')
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Provide PayPal credentials and generate auth code for widget onboarding' })
  @ApiResponse({
    status: 200,
    description: 'Credentials provided and auth code generated successfully',
  })
  async provideWidgetCredentials(
    @CurrentUser() admin: any,
    @Param('sessionId') sessionId: string,
    @Body() provideDto: ProvideWidgetCredentialsDto,
  ) {
    // Get session - admin can access any session
    const session = await this.widgetService.getSessionForAdmin(sessionId);
    const userId = session.userId;

    // Try to get auth code from Gmail (if automated)
    let authCode = await this.widgetService.getAuthCodeFromGmail(userId, sessionId);
    
    // If not found in Gmail, return null - admin will check Gmail manually
    // Admin can then call storeRetrievedAuthCode endpoint with the code

    return {
      success: true,
      data: {
        authCode: authCode || null,
        message: authCode 
          ? 'Auth code retrieved from Gmail. Please send PayPal credentials and this auth code to user via support chat or email.'
          : 'No auth code found in Gmail. Please check Gmail manually for PayPal auth code, then use the store-auth-code endpoint.',
        instructions: [
          '1. Check Gmail for PayPal verification email',
          '2. Extract the 6-digit auth code',
          '3. Use POST /api/admin/widget/:sessionId/store-auth-code to store it',
          '4. Send credentials and code to user via support chat',
        ],
      },
    };
  }

  /**
   * Store auth code retrieved from Gmail
   */
  @Post('widget/:sessionId/store-auth-code')
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Store PayPal auth code retrieved from Gmail' })
  @ApiResponse({
    status: 200,
    description: 'Auth code stored successfully',
  })
  async storeAuthCode(
    @CurrentUser() admin: any,
    @Param('sessionId') sessionId: string,
    @Body() body: { authCode: string; conversationId?: string },
  ) {
    const session = await this.widgetService.getSessionForAdmin(sessionId);
    const userId = session.userId;

    // Store the auth code
    const authCodeRecord = await this.widgetService.storeRetrievedAuthCode(
      userId,
      admin.id,
      sessionId,
      body.authCode,
      body.conversationId,
    );

    return {
      success: true,
      data: {
        authCode: authCodeRecord.code,
        expiresAt: authCodeRecord.expiresAt?.toISOString(),
        message: 'Auth code stored. Please send PayPal credentials and this auth code to user via support chat or email.',
      },
    };
  }

  /**
   * Get all widget sessions (admin view)
   */
  @Get('widget/sessions')
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all widget sessions for admin monitoring' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'completed', 'abandoned', 'error'] })
  @ApiQuery({ name: 'trigger', required: false, enum: ['onboarding', 'withdrawal', 'deposit'] })
  @ApiResponse({
    status: 200,
    description: 'Widget sessions retrieved successfully',
  })
  async getWidgetSessions(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('trigger') trigger?: string,
  ) {

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (trigger) {
      where.triggerType = trigger;
    }

    const offset = (page - 1) * limit;
    const maxLimit = Math.min(limit, 50);

    const { count, rows } = await WidgetSession.findAndCountAll({
      where,
      include: [
        {
          model: User,
          attributes: ['id', 'email', 'firstName', 'lastName'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: maxLimit,
      offset,
    });

    return {
      success: true,
      data: {
        sessions: rows.map(session => ({
          id: session.id,
          userId: session.userId,
          user: session.user ? {
            id: session.user.id,
            email: session.user.email,
            firstName: session.user.firstName,
            lastName: session.user.lastName,
          } : null,
          triggerType: session.triggerType,
          currentStep: session.currentStep,
          status: session.status,
          context: session.context,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          expiresAt: session.expiresAt,
          lastActivityAt: session.lastActivityAt,
        })),
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(count / maxLimit),
          totalItems: count,
          itemsPerPage: maxLimit,
        },
      },
    };
  }

  /**
   * Get widget withdrawal requests (pending withdrawals from widget)
   */
  @Get('widget/withdrawals')
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get withdrawal requests from widget sessions' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Widget withdrawal requests retrieved successfully',
  })
  async getWidgetWithdrawals(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    // Get payouts that were created via widget (we can track this via notes or context)
    // For now, return all pending payouts - they can be from widget or regular flow
    const data = await this.adminsService.getPayouts(page, limit, 'pending');
    
    return {
      success: true,
      data: {
        ...data,
        note: 'These are all pending withdrawal requests. Widget withdrawals are included here.',
      },
    };
  }
}
