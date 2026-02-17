import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Sequelize, Op } from 'sequelize';
import { User } from '../users/entities/user.entity';
import { SudoCustomer, SudoCustomerStatus } from './entities/sudo-customer.entity';
import { Card, CardStatus, CardType } from './entities/card.entity';
import { CardTransaction, CardTransactionType, CardTransactionStatus } from './entities/card-transaction.entity';
import { Transaction, TransactionType, TransactionStatus } from '../transactions/entities/transaction.entity';
import { SudoApiService, CreateCustomerDto, CreateCardDto } from './sudo/sudo-api.service';
import { CreateCardDto as CreateCardRequestDto } from './dto/create-card.dto';
import { FundCardDto } from './dto/fund-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { SaveOnboardingStepDto } from './dto/save-onboarding-step.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Injectable()
export class CardsService {
  private readonly logger = new Logger(CardsService.name);
  constructor(
    @Inject('SEQUELIZE') private sequelize: Sequelize,
    private sudoApiService: SudoApiService,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
    private notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * Get or create Sudo customer for user
   */
  private async getOrCreateSudoCustomer(userId: string): Promise<SudoCustomer> {
    // Check if customer already exists
    let sudoCustomer = await SudoCustomer.findOne({
      where: { userId },
    });

    if (sudoCustomer) {
      return sudoCustomer;
    }

    // Get user details
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // This method should not be used anymore - use completeOnboarding instead
    // Keeping for backward compatibility but it will use default values
    const sudoConfig = this.configService.get('sudo');
    const defaultBillingAddress = sudoConfig.defaultBillingAddress;
    
    // Combine firstName and lastName for the name field
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';
    
    const customerData: CreateCustomerDto = {
      type: 'individual',
      name: fullName,
      phoneNumber: user.phone || '',
      status: 'active',
      emailAddress: user.email,
      billingAddress: {
        line1: defaultBillingAddress.line1,
        line2: defaultBillingAddress.line2 || '',
        city: defaultBillingAddress.city,
        state: defaultBillingAddress.state,
        postalCode: defaultBillingAddress.postalCode,
        country: defaultBillingAddress.country,
      },
      // Note: individual object with identity is required by Sudo but we don't have it here
      // This method should redirect to onboarding flow
      metadata: {
        platformUserId: userId,
        username: user.username,
      },
    };

    const sudoCustomerData = await this.sudoApiService.createCustomer(customerData);

    // Validate that we got a customer ID
    if (!sudoCustomerData || !sudoCustomerData.id) {
      throw new BadRequestException(
        'Failed to create customer in Sudo: Invalid response from API',
      );
    }

    // Store in database
    sudoCustomer = await SudoCustomer.create({
      userId,
      sudoCustomerId: sudoCustomerData.id,
      status: SudoCustomerStatus.ACTIVE,
      metadata: sudoCustomerData.metadata || null,
    } as any);

    return sudoCustomer;
  }

  /**
   * Create a virtual card for user
   */
  async createCardForUser(
    userId: string,
    createCardDto: CreateCardRequestDto,
  ): Promise<Card> {
    // Check if user has Sudo customer
    let sudoCustomer = await SudoCustomer.findOne({
      where: { userId },
    });

    if (!sudoCustomer) {
      // Check if onboarding is completed
      const user = await User.findByPk(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const onboardingData = user.sudoCustomerOnboardingData || {};

      if (!onboardingData.onboardingCompleted) {
        throw new BadRequestException({
          message: 'To create cards, complete your profile setup including NIN or BVN verification.',
          onboardingRequired: true,
        });
      }

      // Onboarding completed but customer not created - try to create now
      try {
        await this.completeOnboarding(userId);
        // Refresh to get the created customer
        sudoCustomer = await SudoCustomer.findOne({
          where: { userId },
        });
        if (!sudoCustomer) {
          throw new BadRequestException(
            'Failed to create Sudo customer. Please try again.',
          );
        }
      } catch (error: any) {
        throw new BadRequestException({
          message: error.message || 'Failed to create Sudo customer',
          onboardingRequired: true,
        });
      }
    }

    // Prepare card data for Sudo API
    const sudoConfig = this.configService.get('sudo');
    
    // debitAccountId is required for virtual cards
    if (!sudoConfig.defaultDebitAccountId) {
      throw new BadRequestException(
        'Debit account not configured. Please set SUDO_DEFAULT_DEBIT_ACCOUNT_ID in environment variables.',
      );
    }
    
    const cardData: CreateCardDto = {
      customerId: sudoCustomer.sudoCustomerId,
      type: 'virtual', // Default to virtual cards
      currency: createCardDto.currency || sudoConfig.defaultCurrency,
      status: 'active', // Required by Sudo API
      brand: sudoConfig.defaultCardBrand || 'MasterCard', // Required by Sudo API
      debitAccountId: sudoConfig.defaultDebitAccountId, // Required for virtual cards
      amount: createCardDto.initialAmount || sudoConfig.defaultCardCreationAmount, // Required for MasterCard - initial funding amount
      issuerCountry: 'NGA', // Nigeria
      enable2FA: false, // Default to false per Sudo docs
      cardProgramId: createCardDto.cardProgramId,
      metadata: {
        ...createCardDto.metadata,
        platformUserId: userId,
      },
    };

    // Create card in Sudo
    let sudoCard;
    try {
      sudoCard = await this.sudoApiService.createCard(cardData);
    } catch (error: any) {
      // Log the error and rethrow with more context
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Unknown error from Sudo API';
      const errorDetails = error.response?.data 
        ? JSON.stringify(error.response.data, null, 2)
        : error.toString();
      
      throw new BadRequestException(
        `Failed to create card in Sudo: ${errorMessage}. Details: ${errorDetails}`,
      );
    }

    // Handle Sudo's _id format (normalize to id)
    const cardId = sudoCard?.id || (sudoCard as any)?._id;
    if (!cardId) {
      this.logger.error(`Invalid card response structure: ${JSON.stringify(sudoCard, null, 2)}`);
      throw new BadRequestException(
        'Failed to create card in Sudo: Invalid response from API - missing card ID',
      );
    }

    // Store card in database
    // Sudo returns maskedPan, not cardNumber
    const maskedPan = (sudoCard as any).maskedPan || sudoCard.cardNumber || null;
    
    const card = await Card.create({
      userId,
      sudoCustomerId: sudoCustomer.id,
      sudoCardId: cardId,
      cardNumber: maskedPan, // Store masked PAN (e.g., "506441*********1590")
      cardType: CardType.VIRTUAL,
      currency: sudoCard.currency || sudoConfig.defaultCurrency,
      status: CardStatus.ACTIVE,
      balance: sudoCard.balance || (sudoCard as any).balance || 0,
      expiryMonth: sudoCard.expiryMonth || (sudoCard as any).expiryMonth || null,
      expiryYear: sudoCard.expiryYear || (sudoCard as any).expiryYear || null,
      isDefault: false,
      metadata: sudoCard.metadata || null,
    } as any);

    // If this is the first card, set it as default
    const cardCount = await Card.count({ where: { userId } });
    if (cardCount === 1) {
      card.isDefault = true;
      await card.save();
    }

    return card;
  }

  /**
   * Get all cards for a user
   */
  async getUserCards(userId: string): Promise<Card[]> {
    return await Card.findAll({
      where: { userId },
      include: [
        {
          model: SudoCustomer,
          as: 'sudoCustomer',
        },
      ],
      order: [['isDefault', 'DESC'], ['createdAt', 'DESC']],
    });
  }

  /**
   * Get card by ID (with optional user validation)
   */
  async getCardById(cardId: string, userId?: string): Promise<Card> {
    const where: any = { id: cardId };
    if (userId) {
      where.userId = userId;
    }

    const card = await Card.findOne({
      where,
      include: [
        {
          model: SudoCustomer,
          as: 'sudoCustomer',
        },
      ],
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    // Sync balance and card number from Sudo
    try {
      const sudoCard = await this.sudoApiService.getCard(card.sudoCardId);
      if (sudoCard.balance !== undefined) {
        card.balance = sudoCard.balance;
      }
      // Update masked PAN if available
      const maskedPan = (sudoCard as any).maskedPan || sudoCard.cardNumber;
      if (maskedPan && maskedPan !== card.cardNumber) {
        card.cardNumber = maskedPan;
      }
      await card.save();
    } catch (error) {
      // Log but don't fail if sync fails
      this.logger.error('Failed to sync card balance:', error);
    }

    return card;
  }

  /**
   * Map internal card status to Sudo API status
   * Sudo accepts: active, inactive, canceled
   * We use: active, frozen, closed, pending
   */
  private mapStatusToSudo(internalStatus: CardStatus): string {
    const statusMap: Record<CardStatus, string> = {
      [CardStatus.ACTIVE]: 'active',
      [CardStatus.FROZEN]: 'inactive', // Sudo doesn't have "frozen", use "inactive"
      [CardStatus.CLOSED]: 'canceled', // Sudo uses "canceled" instead of "closed"
      [CardStatus.PENDING]: 'inactive', // Map pending to inactive
    };
    return statusMap[internalStatus] || 'active';
  }

  /**
   * Map Sudo API status to internal card status
   */
  private mapStatusFromSudo(sudoStatus: string): CardStatus {
    const statusMap: Record<string, CardStatus> = {
      active: CardStatus.ACTIVE,
      inactive: CardStatus.FROZEN, // Map Sudo's "inactive" to our "frozen"
      canceled: CardStatus.CLOSED,
    };
    return statusMap[sudoStatus.toLowerCase()] || CardStatus.ACTIVE;
  }

  /**
   * Update card (freeze/unfreeze, set default)
   */
  async updateCard(
    cardId: string,
    userId: string,
    updateCardDto: UpdateCardDto,
  ): Promise<Card> {
    const card = await this.getCardById(cardId, userId);

    // Update status if provided
    if (updateCardDto.status) {
      // Map internal status to Sudo API status
      const sudoStatus = this.mapStatusToSudo(updateCardDto.status);
      
      // Update in Sudo
      await this.sudoApiService.updateCard(card.sudoCardId, {
        status: sudoStatus,
      } as any);

      // Update local status
      card.status = updateCardDto.status;
    }

    // Set as default if requested
    if (updateCardDto.isDefault === true) {
      // Unset other default cards
      await Card.update(
        { isDefault: false },
        {
          where: {
            userId,
            id: { [Op.ne]: cardId },
          },
        },
      );

      card.isDefault = true;
    } else if (updateCardDto.isDefault === false) {
      card.isDefault = false;
    }

    await card.save();
    return card;
  }

  /**
   * Freeze card
   */
  async freezeCard(cardId: string, userId: string): Promise<Card> {
    return await this.updateCard(cardId, userId, { status: CardStatus.FROZEN });
  }

  /**
   * Unfreeze card
   */
  async unfreezeCard(cardId: string, userId: string): Promise<Card> {
    return await this.updateCard(cardId, userId, { status: CardStatus.ACTIVE });
  }

  /**
   * Fund card from user wallet
   */
  async fundCardFromWallet(
    cardId: string,
    userId: string,
    fundCardDto: FundCardDto,
  ): Promise<{ card: Card; transaction: Transaction }> {
    const card = await this.getCardById(cardId, userId);

    // Get user
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check wallet balance (use wallet, not earnings)
    const walletBalance = Number(user.wallet || 0);
    if (walletBalance < fundCardDto.amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    // Get default settlement account (debit account) for funding
    // This is the account we debit from to fund cards
    const sudoConfig = this.configService.get('sudo');
    // Use settlement account if available, otherwise fall back to debit account
    const settlementAccountId = sudoConfig.defaultSettlementAccountId || sudoConfig.defaultDebitAccountId;

    if (!settlementAccountId) {
      throw new BadRequestException(
        'Settlement account not configured. Please set SUDO_DEFAULT_SETTLEMENT_ACCOUNT_ID or SUDO_DEFAULT_DEBIT_ACCOUNT_ID in your .env file.',
      );
    }

    // Use transaction to ensure atomicity
    const transaction = await this.sequelize.transaction();

    try {
      // Deduct from user wallet (not earnings)
      user.wallet = walletBalance - fundCardDto.amount;
      await user.save({ transaction });

      // Get card details from Sudo to get the card's account ID
      const sudoCard = await this.sudoApiService.getCard(card.sudoCardId);
      
      // Get the card's account ID (Sudo card has an account field)
      // Account can be either a string ID or an object with _id
      let cardAccountId: string;
      if (typeof sudoCard.account === 'string') {
        cardAccountId = sudoCard.account;
      } else if (sudoCard.account && typeof sudoCard.account === 'object') {
        // Extract _id from account object
        cardAccountId = (sudoCard.account as any)._id || (sudoCard.account as any).id;
      } else {
        throw new BadRequestException('Card account not found in Sudo. Please contact support.');
      }
      
      if (!cardAccountId) {
        throw new BadRequestException('Card account ID is invalid. Please contact support.');
      }

      // Transfer funds from settlement account to card account via Sudo
      const transferResult = await this.sudoApiService.fundTransfer({
        debitAccountId: settlementAccountId, // Our settlement account
        creditAccountId: cardAccountId, // Card's account
        amount: fundCardDto.amount,
        narration: `Card funding for card ending ${card.cardNumber?.slice(-4) || '****'}`,
        paymentReference: `CARD_FUND_${card.id}_${Date.now()}`,
      });

      this.logger.log(`Fund transfer successful: ${JSON.stringify(transferResult)}`);

      // Update local card balance (sync with Sudo)
      // Get updated balance from Sudo or use the transfer amount
      const updatedSudoCard = await this.sudoApiService.getCard(card.sudoCardId);
      if (updatedSudoCard.balance !== undefined) {
        card.balance = updatedSudoCard.balance;
      } else {
        // Fallback: increment local balance if Sudo doesn't return balance
        card.balance = Number(card.balance || 0) + fundCardDto.amount;
      }
      await card.save({ transaction });

      // Create transaction record
      const walletTransaction = await Transaction.create(
        {
          userId,
          type: TransactionType.CARD_FUNDING, // Card funding transaction type
          amount: fundCardDto.amount,
          amountInNgn: card.currency === 'NGN' ? fundCardDto.amount : null, // Store NGN amount if card is NGN
          status: TransactionStatus.COMPLETED,
          description: `Card funding for card ending ${card.cardNumber?.slice(-4) || '****'}`,
          referenceId: card.id,
        } as any,
        { transaction },
      );

      // Create card transaction record
      const cardTransaction = await CardTransaction.create(
        {
          cardId: card.id,
          userId,
          type: CardTransactionType.FUNDING,
          amount: fundCardDto.amount,
          currency: card.currency,
          status: CardTransactionStatus.COMPLETED,
          description: 'Card funding from wallet',
          reference: walletTransaction.id,
        } as any,
        { transaction },
      );

      await transaction.commit();

      try {
        const last4 = card.cardNumber?.slice(-4) || '****';
        const notification = await this.notificationsService.notifyCardFunded(userId, fundCardDto.amount, last4);
        await this.notificationsGateway.sendToUser(userId, notification);
      } catch (notifError) {
        this.logger.warn('Failed to send card funded notification:', notifError);
      }

      return {
        card,
        transaction: walletTransaction,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get card transactions
   */
  async getCardTransactions(
    cardId: string,
    userId: string,
    page: number = 0,
    limit: number = 25,
  ): Promise<{ data: CardTransaction[]; pagination: any }> {
    const card = await this.getCardById(cardId, userId);

    const offset = page * limit;

    const { count, rows } = await CardTransaction.findAndCountAll({
      where: { cardId: card.id, userId },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return {
      data: rows,
      pagination: {
        total: count,
        pages: Math.ceil(count / limit),
        page,
        limit,
      },
    };
  }

  /**
   * Set default card
   */
  async setDefaultCard(cardId: string, userId: string): Promise<Card> {
    return await this.updateCard(cardId, userId, { isDefault: true });
  }

  /**
   * Delete/deactivate card
   */
  async deleteCard(cardId: string, userId: string): Promise<void> {
    const card = await this.getCardById(cardId, userId);

    // Close card in Sudo (use "canceled" as per Sudo API)
    try {
      await this.sudoApiService.updateCard(card.sudoCardId, {
        status: 'canceled',
      } as any);
    } catch (error) {
      // Log but continue with local deletion
      this.logger.error('Failed to close card in Sudo:', error);
    }

    // Update status locally
    card.status = CardStatus.CLOSED;
    await card.save();

    // If this was the default card, set another card as default
    if (card.isDefault) {
      const otherCard = await Card.findOne({
        where: {
          userId,
          id: { [Op.ne]: cardId },
          status: { [Op.ne]: CardStatus.CLOSED },
        },
        order: [['createdAt', 'DESC']],
      });

      if (otherCard) {
        otherCard.isDefault = true;
        await otherCard.save();
      }
    }
  }

  /**
   * Sync card transactions from Sudo (webhook handler)
   */
  async syncCardTransaction(
    sudoTransactionId: string,
    cardId: string,
    transactionData: any,
  ): Promise<CardTransaction> {
    // Find card by Sudo card ID
    const card = await Card.findOne({
      where: { sudoCardId: cardId },
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    // Check if transaction already exists
    let cardTransaction = await CardTransaction.findOne({
      where: { sudoTransactionId },
    });

    if (cardTransaction) {
      // Update existing transaction
      cardTransaction.status = this.mapSudoStatusToLocal(transactionData.status);
      cardTransaction.amount = transactionData.amount;
      cardTransaction.merchantName = transactionData.merchantName || null;
      cardTransaction.description = transactionData.description || null;
      await cardTransaction.save();
      return cardTransaction;
    }

    // Create new transaction
    cardTransaction = await CardTransaction.create({
      cardId: card.id,
      userId: card.userId,
      sudoTransactionId,
      type: this.mapSudoTypeToLocal(transactionData.type),
      amount: transactionData.amount,
      currency: transactionData.currency || card.currency,
      merchantName: transactionData.merchantName || null,
      description: transactionData.description || null,
      status: this.mapSudoStatusToLocal(transactionData.status),
      reference: transactionData.reference || null,
      metadata: transactionData.metadata || null,
    } as any);

    // Update card balance if needed
    if (transactionData.type === 'purchase' && transactionData.status === 'completed') {
      card.balance = Number(card.balance) - transactionData.amount;
      await card.save();
    }

    return cardTransaction;
  }

  /**
   * Map Sudo transaction type to local type
   */
  private mapSudoTypeToLocal(sudoType: string): CardTransactionType {
    const typeMap: Record<string, CardTransactionType> = {
      purchase: CardTransactionType.PURCHASE,
      funding: CardTransactionType.FUNDING,
      refund: CardTransactionType.REFUND,
      reversal: CardTransactionType.REVERSAL,
      fee: CardTransactionType.FEE,
    };

    return typeMap[sudoType.toLowerCase()] || CardTransactionType.PURCHASE;
  }

  /**
   * Map Sudo transaction status to local status
   */
  private mapSudoStatusToLocal(sudoStatus: string): CardTransactionStatus {
    const statusMap: Record<string, CardTransactionStatus> = {
      pending: CardTransactionStatus.PENDING,
      completed: CardTransactionStatus.COMPLETED,
      failed: CardTransactionStatus.FAILED,
      reversed: CardTransactionStatus.REVERSED,
    };

    return statusMap[sudoStatus.toLowerCase()] || CardTransactionStatus.PENDING;
  }

  /**
   * Generate card token for displaying sensitive card data
   * This token is used with Secure Proxy Show to display card number, CVV, and PIN
   */
  async generateCardToken(cardId: string, userId: string): Promise<{ token: string }> {
    const card = await this.getCardById(cardId, userId);
    
    // Generate token from Sudo
    const tokenData = await this.sudoApiService.generateCardToken(card.sudoCardId);
    
    return {
      token: tokenData.token,
    };
  }

  /**
   * Get all cards (admin)
   */
  async getAllCards(
    filters: {
      userId?: string;
      status?: CardStatus;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{ data: Card[]; pagination: any }> {
    const page = filters.page || 0;
    const limit = filters.limit || 25;
    const offset = page * limit;

    const where: any = {};
    if (filters.userId) {
      where.userId = filters.userId;
    }
    if (filters.status) {
      where.status = filters.status;
    }

    const { count, rows } = await Card.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
        },
        {
          model: SudoCustomer,
          as: 'sudoCustomer',
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return {
      data: rows,
      pagination: {
        total: count,
        pages: Math.ceil(count / limit),
        page,
        limit,
      },
    };
  }

  /**
   * Save onboarding step
   */
  async saveOnboardingStep(
    userId: string,
    dto: SaveOnboardingStepDto,
  ): Promise<any> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get existing onboarding data or initialize
    const existingData = user.sudoCustomerOnboardingData || {};

    // Update based on step
    const updatedData: any = { ...existingData };

    switch (dto.step) {
      case 'personal-info':
        updatedData.dob = (dto.data as any).dob;
        updatedData.onboardingStep = 'personal-info';
        break;

      case 'billing-address':
        updatedData.billingAddress = {
          line1: (dto.data as any).line1,
          line2: (dto.data as any).line2,
          city: (dto.data as any).city,
          state: (dto.data as any).state,
          postalCode: (dto.data as any).postalCode,
          country: (dto.data as any).country || 'NG',
        };
        updatedData.onboardingStep = 'billing-address';
        break;

      case 'identity':
        updatedData.identity = {
          identityType: (dto.data as any).identityType,
          identityNumber: (dto.data as any).identityNumber,
        };
        updatedData.onboardingStep = 'identity';
        break;
    }

    // Save to user
    user.sudoCustomerOnboardingData = updatedData as any;
    await user.save();

    return {
      success: true,
      message: 'Step saved successfully',
      data: {
        currentStep: updatedData.onboardingStep,
        onboardingData: updatedData,
      },
    };
  }

  /**
   * Get onboarding status
   */
  async getOnboardingStatus(userId: string): Promise<any> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const onboardingData = user.sudoCustomerOnboardingData || {};
    const sudoCustomer = await SudoCustomer.findOne({
      where: { userId },
    });
    const hasSudoCustomer = !!sudoCustomer;

    return {
      success: true,
      data: {
        hasSudoCustomer,
        sudoCustomerId: sudoCustomer?.sudoCustomerId || null,
        onboardingCompleted: onboardingData.onboardingCompleted || false,
        currentStep: onboardingData.onboardingStep || 'welcome',
        onboardingData: onboardingData,
      },
    };
  }

  /**
   * Complete onboarding and create Sudo customer
   */
  async completeOnboarding(userId: string): Promise<any> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if already has Sudo customer
    const existingSudoCustomer = await SudoCustomer.findOne({
      where: { userId },
    });

    if (existingSudoCustomer) {
      return {
        success: true,
        message: 'Sudo customer already exists',
        data: {
          sudoCustomerId: existingSudoCustomer.sudoCustomerId,
        },
      };
    }

    const onboardingData = user.sudoCustomerOnboardingData || {};

    // Validate all required fields
    if (!onboardingData.dob) {
      throw new BadRequestException('Date of birth is required');
    }

    if (
      !onboardingData.billingAddress?.line1 ||
      !onboardingData.billingAddress?.city ||
      !onboardingData.billingAddress?.state ||
      !onboardingData.billingAddress?.postalCode
    ) {
      throw new BadRequestException('Complete billing address is required');
    }

    if (
      !onboardingData.identity?.identityType ||
      !onboardingData.identity?.identityNumber
    ) {
      throw new BadRequestException('Identity verification is required');
    }

    // Validate identity number format (11 digits)
    if (!/^\d{11}$/.test(onboardingData.identity.identityNumber)) {
      throw new BadRequestException('Identity number must be 11 digits');
    }

    // Validate DOB (must be 18+)
    const dob = new Date(onboardingData.dob);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    const actualAge =
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < dob.getDate())
        ? age - 1
        : age;

    if (actualAge < 18) {
      throw new BadRequestException('You must be at least 18 years old');
    }

    try {
      // Create Sudo customer
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
      const customerData: CreateCustomerDto = {
        type: 'individual',
        name: fullName,
        phoneNumber: user.phone || '',
        status: 'active',
        emailAddress: user.email,
        billingAddress: {
          line1: onboardingData.billingAddress.line1,
          line2: onboardingData.billingAddress.line2 || '',
          city: onboardingData.billingAddress.city,
          state: onboardingData.billingAddress.state,
          postalCode: onboardingData.billingAddress.postalCode,
          country: onboardingData.billingAddress.country || 'NG',
        },
        individual: {
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          dob: onboardingData.dob, // Format: YYYY-MM-DD
          identity: {
            type: onboardingData.identity.identityType,
            number: onboardingData.identity.identityNumber,
          },
        },
        metadata: {
          platformUserId: userId,
          username: user.username,
        },
      };

      const sudoCustomerData = await this.sudoApiService.createCustomer(customerData);

      // Validate that we got a customer ID (Sudo uses _id, we normalize it to id)
      const customerId = sudoCustomerData?.id || (sudoCustomerData as any)?._id;
      if (!sudoCustomerData || !customerId) {
        throw new BadRequestException(
          'Failed to create customer in Sudo: Invalid response from API',
        );
      }

      // Create SudoCustomer record
      const sudoCustomer = await SudoCustomer.create({
        userId,
        sudoCustomerId: customerId,
        status: SudoCustomerStatus.ACTIVE,
        metadata: sudoCustomerData.metadata || null,
      } as any);

      // Update user onboarding data
      user.sudoCustomerOnboardingData = {
        ...onboardingData,
        onboardingCompleted: true,
        onboardingStep: 'completed',
      } as any;
      await user.save();

      return {
        success: true,
        message: 'Onboarding completed successfully',
        data: {
          sudoCustomerId: customerId,
        },
      };
    } catch (error: any) {
      // Handle Sudo API errors
      if (error.response) {
        const errorMessage =
          error.response.data?.message || 'Failed to create Sudo customer';
        throw new BadRequestException(errorMessage);
      }
      throw error;
    }
  }
}

