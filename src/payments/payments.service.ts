import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Sequelize } from 'sequelize-typescript';
import { User } from '../users/entities/user.entity';
import { Transaction, TransactionType, TransactionStatus } from '../transactions/entities/transaction.entity';
import { PaystackApiService } from './paystack/paystack-api.service';
import { PaymentTransaction, PaymentStatus } from './entities/payment-transaction.entity';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { TransferEarningsToWalletDto } from './dto/transfer-earnings-to-wallet.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject('SEQUELIZE') private sequelize: Sequelize,
    private paystackApiService: PaystackApiService,
    private configService: ConfigService,
  ) {}

  /**
   * Initialize Paystack payment
   */
  async initializePayment(
    userId: string,
    dto: InitializePaymentDto,
  ): Promise<{ authorizationUrl: string; reference: string; accessCode: string }> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate unique reference
    const reference = `PAY_${uuidv4().replace(/-/g, '').toUpperCase()}`;

    // Initialize payment with Paystack
    const paystackResponse = await this.paystackApiService.initializePayment({
      email: user.email,
      amount: dto.amount, // Amount in kobo
      reference,
      callback_url: dto.callbackUrl,
      metadata: {
        userId,
        username: user.username,
        ...dto.metadata,
      },
    });

    // Create payment transaction record
    await PaymentTransaction.create({
      userId,
      paystackReference: reference,
      amount: dto.amount / 100, // Convert from kobo to NGN
      currency: 'NGN',
      status: PaymentStatus.PENDING,
      metadata: dto.metadata || {},
      paystackResponse: paystackResponse.data,
    } as any);

    this.logger.log(`Payment initialized for user ${userId}: ${reference}`);

    return {
      authorizationUrl: paystackResponse.data.authorization_url,
      reference: paystackResponse.data.reference,
      accessCode: paystackResponse.data.access_code,
    };
  }

  /**
   * Verify and process Paystack payment
   * This should be called from webhook or after user completes payment
   */
  async verifyPayment(reference: string): Promise<PaymentTransaction> {
    // Find existing payment transaction
    let paymentTransaction = await PaymentTransaction.findOne({
      where: { paystackReference: reference },
      include: [{ model: User, as: 'user' }],
    });

    if (!paymentTransaction) {
      throw new NotFoundException('Payment transaction not found');
    }

    // If already processed, return existing
    if (paymentTransaction.status === PaymentStatus.SUCCESS) {
      this.logger.warn(`Payment ${reference} already processed`);
      return paymentTransaction;
    }

    // Verify with Paystack
    const verifyResponse = await this.paystackApiService.verifyPayment(reference);

    // Check if payment was successful
    if (verifyResponse.data.status !== 'success') {
      // Update payment transaction status
      paymentTransaction.status = PaymentStatus.FAILED;
      paymentTransaction.paystackResponse = verifyResponse.data;
      await paymentTransaction.save();

      throw new BadRequestException(
        `Payment ${verifyResponse.data.gateway_response || 'failed'}`,
      );
    }

    // Use database transaction to ensure atomicity
    const dbTransaction = await this.sequelize.transaction();

    try {
      // Update payment transaction
      paymentTransaction.status = PaymentStatus.SUCCESS;
      paymentTransaction.paymentMethod = verifyResponse.data.channel;
      paymentTransaction.paystackResponse = verifyResponse.data;
      await paymentTransaction.save({ transaction: dbTransaction });

      // Credit user's wallet
      const user = await User.findByPk(paymentTransaction.userId, {
        transaction: dbTransaction,
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const amountInNgn = verifyResponse.data.amount / 100; // Convert from kobo to NGN
      user.wallet = Number(user.wallet || 0) + amountInNgn;
      await user.save({ transaction: dbTransaction });

      // Create transaction record
      await Transaction.create(
        {
          userId: user.id,
          type: TransactionType.DEPOSIT,
          amount: amountInNgn,
          amountInNgn: amountInNgn,
          status: TransactionStatus.COMPLETED,
          description: `Wallet deposit via Paystack - ${reference}`,
          referenceId: paymentTransaction.id,
          date: new Date(),
        } as any,
        { transaction: dbTransaction },
      );

      await dbTransaction.commit();

      this.logger.log(
        `Payment ${reference} verified and wallet credited: ${amountInNgn} NGN`,
      );

      return paymentTransaction;
    } catch (error) {
      await dbTransaction.rollback();
      this.logger.error(`Failed to process payment ${reference}:`, error);
      throw error;
    }
  }

  /**
   * Transfer funds from earnings to wallet
   */
  async transferEarningsToWallet(
    userId: string,
    dto: TransferEarningsToWalletDto,
  ): Promise<{ success: boolean; earnings: number; wallet: number }> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const currentEarnings = Number(user.earnings || 0);
    const currentWallet = Number(user.wallet || 0);

    if (currentEarnings < dto.amount) {
      throw new BadRequestException('Insufficient earnings balance');
    }

    // Use database transaction
    const dbTransaction = await this.sequelize.transaction();

    try {
      // Update balances
      user.earnings = currentEarnings - dto.amount;
      user.wallet = currentWallet + dto.amount;
      await user.save({ transaction: dbTransaction });

      // Create transaction record
      await Transaction.create(
        {
          userId,
          type: TransactionType.TRANSFER_EARNINGS_TO_WALLET,
          amount: dto.amount,
          amountInNgn: dto.amount,
          status: TransactionStatus.COMPLETED,
          description: `Transfer from earnings to wallet`,
          date: new Date(),
        } as any,
        { transaction: dbTransaction },
      );

      await dbTransaction.commit();

      this.logger.log(
        `User ${userId} transferred ${dto.amount} NGN from earnings to wallet`,
      );

      return {
        success: true,
        earnings: Number(user.earnings),
        wallet: Number(user.wallet),
      };
    } catch (error) {
      await dbTransaction.rollback();
      this.logger.error(`Failed to transfer earnings to wallet:`, error);
      throw error;
    }
  }

  /**
   * Get user balances
   */
  async getUserBalances(userId: string): Promise<{
    earnings: number;
    wallet: number;
  }> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      earnings: Number(user.earnings || 0),
      wallet: Number(user.wallet || 0),
    };
  }

  /**
   * Get payment transaction by reference
   */
  async getPaymentTransaction(reference: string): Promise<PaymentTransaction> {
    const paymentTransaction = await PaymentTransaction.findOne({
      where: { paystackReference: reference },
      include: [{ model: User, as: 'user' }],
    });

    if (!paymentTransaction) {
      throw new NotFoundException('Payment transaction not found');
    }

    return paymentTransaction;
  }
}
