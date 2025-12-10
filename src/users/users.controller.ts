import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('Users')
@Controller('user')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user dashboard' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard data retrieved successfully',
    schema: {
      example: {
        success: true,
        data: {
          user: {
            id: 'user_123456',
            email: 'user@example.com',
            firstName: 'John',
            lastName: 'Doe',
            phone: '+1234567890',
            onboardingStatus: 'completed',
            balance: 1250.50,
            emailVerified: true,
          },
          creditRequest: {
            status: 'none',
            amount: null,
            submittedAt: null,
          },
          recentTransactions: [
            {
              id: 'txn_1',
              type: 'credit',
              amount: 500.00,
              date: '2024-01-15T10:30:00Z',
              status: 'completed',
              description: 'Credit from TikTok earnings',
            },
          ],
          todayRate: {
            usdToNgn: 1500.00,
            lastUpdated: '2024-01-20T10:00:00Z',
          },
        },
      },
    },
  })
  async getDashboard(@CurrentUser() user: any) {
    const data = await this.usersService.getDashboard(user.id);
    return {
      success: true,
      data,
    };
  }

  @Get('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    schema: {
      example: {
        success: true,
        data: {
          id: 'user_123456',
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
          username: 'user_1234',
          phone: '+1234567890',
          emailVerified: true,
          onboardingStatus: 'completed',
          balance: 1250.50,
          status: 'active',
          walletStatus: 'active',
          joinedAt: '2024-01-15T10:30:00Z',
          createdAt: '2024-01-15T10:30:00Z',
          updatedAt: '2024-01-20T10:30:00Z',
        },
      },
    },
  })
  async getProfile(@CurrentUser() user: any) {
    const data = await this.usersService.getProfile(user.id);
    return {
      success: true,
      data,
    };
  }

  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    schema: {
      example: {
        success: true,
        message: 'Profile updated successfully',
        data: {
          id: 'user_123456',
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
          username: 'user_1234',
          phone: '+1234567890',
          emailVerified: true,
          onboardingStatus: 'completed',
          balance: 1250.50,
          status: 'active',
          walletStatus: 'active',
          joinedAt: '2024-01-15T10:30:00Z',
          updatedAt: '2024-01-20T10:30:00Z',
        },
      },
    },
  })
  async updateProfile(
    @CurrentUser() user: any,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    const data = await this.usersService.updateProfile(
      user.id,
      updateProfileDto,
    );
    return {
      success: true,
      message: 'Profile updated successfully',
      data,
    };
  }
}

