import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { CardsService } from './cards.service';
import { CardStatus } from './entities/card.entity';

@ApiTags('Admin - Cards')
@ApiBearerAuth()
@Controller('admin/cards')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'super_admin')
export class AdminCardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all cards (admin)' })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: CardStatus })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Cards retrieved successfully',
  })
  async getAllCards(
    @CurrentUser() admin: CurrentUserPayload,
    @Query('userId') userId?: string,
    @Query('status') status?: CardStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.cardsService.getAllCards({
      userId,
      status,
      page: parseInt(page || '0', 10),
      limit: parseInt(limit || '25', 10),
    });
    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get card details (admin)' })
  @ApiResponse({
    status: 200,
    description: 'Card retrieved successfully',
  })
  async getCard(@Param('id') cardId: string) {
    // Admin can view any card, so we don't need userId validation
    const card = await this.cardsService.getCardById(cardId);
    return {
      success: true,
      data: card,
    };
  }

  @Get(':id/transactions')
  @ApiOperation({ summary: 'Get card transactions (admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved successfully',
  })
  async getCardTransactions(
    @Param('id') cardId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // For admin, we need to get the card first to get userId
    const card = await this.cardsService.getCardById(cardId);
    const result = await this.cardsService.getCardTransactions(
      cardId,
      card.userId,
      parseInt(page || '0', 10),
      parseInt(limit || '25', 10),
    );
    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Post(':id/freeze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Freeze card (admin)' })
  @ApiResponse({
    status: 200,
    description: 'Card frozen successfully',
  })
  async freezeCard(@Param('id') cardId: string) {
    // Get card to find userId
    const card = await this.cardsService.getCardById(cardId);
    const updatedCard = await this.cardsService.freezeCard(cardId, card.userId);
    return {
      success: true,
      data: updatedCard,
    };
  }

  @Post(':id/unfreeze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unfreeze card (admin)' })
  @ApiResponse({
    status: 200,
    description: 'Card unfrozen successfully',
  })
  async unfreezeCard(@Param('id') cardId: string) {
    // Get card to find userId
    const card = await this.cardsService.getCardById(cardId);
    const updatedCard = await this.cardsService.unfreezeCard(cardId, card.userId);
    return {
      success: true,
      data: updatedCard,
    };
  }
}

