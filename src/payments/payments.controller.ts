import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { TransferEarningsToWalletDto } from './dto/transfer-earnings-to-wallet.dto';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initialize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initialize Paystack payment' })
  @ApiResponse({
    status: 200,
    description: 'Payment initialized successfully',
  })
  async initializePayment(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: InitializePaymentDto,
  ) {
    const result = await this.paymentsService.initializePayment(user.id, dto);
    return {
      success: true,
      data: result,
    };
  }

  @Post('verify/:reference')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify Paystack payment (can be called by frontend after payment)' })
  @ApiResponse({
    status: 200,
    description: 'Payment verified successfully',
  })
  async verifyPayment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('reference') reference: string,
  ) {
    const paymentTransaction = await this.paymentsService.verifyPayment(reference);
    
    // Verify user owns this payment
    if (paymentTransaction.userId !== user.id) {
      throw new Error('Unauthorized');
    }

    return {
      success: true,
      data: {
        reference: paymentTransaction.paystackReference,
        amount: paymentTransaction.amount,
        status: paymentTransaction.status,
        paymentMethod: paymentTransaction.paymentMethod,
      },
    };
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Paystack webhook endpoint (no auth required)' })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed',
  })
  async handleWebhook(
    @Req() req: any,
    @Headers('x-paystack-signature') signature: string,
  ) {
    // Verify webhook signature
    const paystackService = (this.paymentsService as any).paystackApiService;
    const isValid = paystackService.verifyWebhookSignature(
      JSON.stringify(req.body),
      signature,
    );

    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }

    const event = req.body;
    
    // Handle payment.success event
    if (event.event === 'charge.success') {
      const reference = event.data.reference;
      await this.paymentsService.verifyPayment(reference);
    }

    return { success: true };
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get user balances (earnings and wallet)' })
  @ApiResponse({
    status: 200,
    description: 'Balances retrieved successfully',
  })
  async getBalances(@CurrentUser() user: CurrentUserPayload) {
    const balances = await this.paymentsService.getUserBalances(user.id);
    return {
      success: true,
      data: balances,
    };
  }

  @Post('transfer-earnings-to-wallet')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer funds from earnings to wallet' })
  @ApiResponse({
    status: 200,
    description: 'Transfer completed successfully',
  })
  async transferEarningsToWallet(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: TransferEarningsToWalletDto,
  ) {
    const result = await this.paymentsService.transferEarningsToWallet(user.id, dto);
    return {
      success: true,
      data: result,
    };
  }
}
