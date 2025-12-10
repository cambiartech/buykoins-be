import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateOnboardingRequestDto } from './dto/create-onboarding-request.dto';

@ApiTags('Onboarding')
@Controller('user/onboarding')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('request')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit onboarding request' })
  @ApiResponse({
    status: 201,
    description: 'Onboarding request submitted successfully',
  })
  @ApiResponse({
    status: 409,
    description: 'User already has a pending request or has completed onboarding',
  })
  async createOnboardingRequest(
    @CurrentUser() user: any,
    @Body() createDto: CreateOnboardingRequestDto,
  ) {
    const data = await this.onboardingService.createOnboardingRequest(
      user.id,
      createDto,
    );
    return {
      success: true,
      message: 'Onboarding request submitted successfully',
      data,
    };
  }

  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get onboarding status' })
  @ApiResponse({
    status: 200,
    description: 'Onboarding status retrieved successfully',
  })
  async getOnboardingStatus(@CurrentUser() user: any) {
    const data = await this.onboardingService.getOnboardingStatus(user.id);
    return {
      success: true,
      data,
    };
  }
}

