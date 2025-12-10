import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PayoutsService } from './payouts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreatePayoutDto } from './dto/create-payout.dto';

@ApiTags('Payouts')
@Controller('user/payout')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initiate payout/withdrawal request' })
  @ApiResponse({
    status: 201,
    description: 'Payout request created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Insufficient balance or invalid request',
  })
  @ApiResponse({
    status: 403,
    description: 'User has not completed onboarding',
  })
  async createPayout(
    @CurrentUser() user: any,
    @Body() createDto: CreatePayoutDto,
  ) {
    const data = await this.payoutsService.createPayout(user.id, createDto);
    return {
      success: true,
      message: 'Payout request submitted successfully',
      data,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get payout status by ID' })
  @ApiResponse({
    status: 200,
    description: 'Payout retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Payout not found',
  })
  async getPayoutById(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    const data = await this.payoutsService.getPayoutById(user.id, id);
    return {
      success: true,
      data,
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get payout history' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Payout history retrieved successfully',
  })
  async getPayoutHistory(
    @CurrentUser() user: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    const data = await this.payoutsService.getPayoutHistory(user.id, page, limit);
    return {
      success: true,
      data,
    };
  }
}

