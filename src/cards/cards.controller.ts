import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
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
import { CreateCardDto } from './dto/create-card.dto';
import { FundCardDto } from './dto/fund-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { SaveOnboardingStepDto } from './dto/save-onboarding-step.dto';
import { CardStatus } from './entities/card.entity';

@ApiTags('Cards')
@ApiBearerAuth()
@Controller('cards')
@UseGuards(JwtAuthGuard)
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new virtual card' })
  @ApiResponse({
    status: 201,
    description: 'Card created successfully',
  })
  async createCard(
    @CurrentUser() user: CurrentUserPayload,
    @Body() createCardDto: CreateCardDto,
  ) {
    const card = await this.cardsService.createCardForUser(user.id, createCardDto);
    return {
      success: true,
      data: card,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all user cards' })
  @ApiResponse({
    status: 200,
    description: 'Cards retrieved successfully',
  })
  async getUserCards(@CurrentUser() user: CurrentUserPayload) {
    const cards = await this.cardsService.getUserCards(user.id);
    return {
      success: true,
      data: cards,
    };
  }

  @Get(':id/token')
  @ApiOperation({ summary: 'Generate card token for displaying sensitive card data' })
  @ApiResponse({
    status: 200,
    description: 'Card token generated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Card not found',
  })
  async generateCardToken(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') cardId: string,
  ) {
    const result = await this.cardsService.generateCardToken(cardId, user.id);
    return {
      success: true,
      data: result,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get card details' })
  @ApiResponse({
    status: 200,
    description: 'Card retrieved successfully',
  })
  async getCard(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') cardId: string,
  ) {
    const card = await this.cardsService.getCardById(cardId, user.id);
    return {
      success: true,
      data: card,
    };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update card (freeze/unfreeze, set default)' })
  @ApiResponse({
    status: 200,
    description: 'Card updated successfully',
  })
  async updateCard(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') cardId: string,
    @Body() updateCardDto: UpdateCardDto,
  ) {
    const card = await this.cardsService.updateCard(cardId, user.id, updateCardDto);
    return {
      success: true,
      data: card,
    };
  }

  @Post(':id/fund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fund card from wallet' })
  @ApiResponse({
    status: 200,
    description: 'Card funded successfully',
  })
  async fundCard(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') cardId: string,
    @Body() fundCardDto: FundCardDto,
  ) {
    const result = await this.cardsService.fundCardFromWallet(
      cardId,
      user.id,
      fundCardDto,
    );
    return {
      success: true,
      data: result,
    };
  }

  @Get(':id/transactions')
  @ApiOperation({ summary: 'Get card transactions' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved successfully',
  })
  async getCardTransactions(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') cardId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.cardsService.getCardTransactions(
      cardId,
      user.id,
      parseInt(page || '0', 10),
      parseInt(limit || '25', 10),
    );
    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Post(':id/set-default')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set card as default' })
  @ApiResponse({
    status: 200,
    description: 'Card set as default successfully',
  })
  async setDefaultCard(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') cardId: string,
  ) {
    const card = await this.cardsService.setDefaultCard(cardId, user.id);
    return {
      success: true,
      data: card,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete/deactivate card' })
  @ApiResponse({
    status: 200,
    description: 'Card deleted successfully',
  })
  async deleteCard(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') cardId: string,
  ) {
    await this.cardsService.deleteCard(cardId, user.id);
    return {
      success: true,
      message: 'Card deleted successfully',
    };
  }

  @Post('onboarding/save-step')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save onboarding step data' })
  @ApiResponse({
    status: 200,
    description: 'Step saved successfully',
  })
  async saveOnboardingStep(
    @CurrentUser() user: CurrentUserPayload,
    @Body() saveStepDto: SaveOnboardingStepDto,
  ) {
    return await this.cardsService.saveOnboardingStep(user.id, saveStepDto);
  }

  @Get('onboarding/status')
  @ApiOperation({ summary: 'Get onboarding status' })
  @ApiResponse({
    status: 200,
    description: 'Onboarding status retrieved successfully',
  })
  async getOnboardingStatus(@CurrentUser() user: CurrentUserPayload) {
    return await this.cardsService.getOnboardingStatus(user.id);
  }

  @Post('onboarding/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete onboarding and create Sudo customer' })
  @ApiResponse({
    status: 200,
    description: 'Onboarding completed successfully',
  })
  async completeOnboarding(@CurrentUser() user: CurrentUserPayload) {
    return await this.cardsService.completeOnboarding(user.id);
  }
}

