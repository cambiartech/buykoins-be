import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    domain: string;
    status: string;
    reference: string;
    amount: number;
    message: string;
    gateway_response: string;
    paid_at: string | null;
    created_at: string;
    channel: string;
    currency: string;
    ip_address: string;
    metadata: any;
    log: any;
    fees: number | null;
    fees_split: any;
    authorization: {
      authorization_code: string;
      bin: string;
      last4: string;
      exp_month: string;
      exp_year: string;
      channel: string;
      card_type: string;
      bank: string;
      country_code: string;
      brand: string;
      reusable: boolean;
      signature: string;
      account_name: string | null;
    };
    customer: {
      id: number;
      first_name: string | null;
      last_name: string | null;
      email: string;
      customer_code: string;
      phone: string | null;
      metadata: any;
      risk_action: string;
      international_format_phone: string | null;
    };
    plan: any;
    split: any;
    order_id: any;
    paidAt: string | null;
    createdAt: string;
    requested_amount: number;
    pos_transaction_data: any;
    source: any;
    fees_breakdown: any;
  };
}

@Injectable()
export class PaystackApiService {
  private readonly logger = new Logger(PaystackApiService.name);
  private readonly axiosInstance: AxiosInstance;

  constructor(private configService: ConfigService) {
    const paystackConfig = this.configService.get('paystack');
    const secretKey = paystackConfig.secretKey;

    if (!secretKey) {
      this.logger.warn('Paystack secret key not configured');
    }

    this.axiosInstance = axios.create({
      baseURL: paystackConfig.baseUrl,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Initialize payment transaction
   */
  async initializePayment(data: {
    email: string;
    amount: number; // in kobo (smallest currency unit)
    reference?: string;
    callback_url?: string;
    metadata?: Record<string, any>;
  }): Promise<PaystackInitializeResponse> {
    try {
      const payload: any = {
        email: data.email,
        amount: data.amount,
      };

      if (data.reference) {
        payload.reference = data.reference;
      }

      if (data.callback_url) {
        payload.callback_url = data.callback_url;
      }

      if (data.metadata) {
        payload.metadata = data.metadata;
      }

      this.logger.debug(`Initializing payment: ${JSON.stringify(payload)}`);

      const response = await this.axiosInstance.post('/transaction/initialize', payload);

      if (!response.data.status) {
        throw new HttpException(
          response.data.message || 'Failed to initialize payment',
          HttpStatus.BAD_REQUEST,
        );
      }

      return response.data;
    } catch (error: any) {
      this.logger.error(`Payment initialization failed: ${JSON.stringify(error.response?.data || error.message)}`);
      
      if (error.response) {
        throw new HttpException(
          error.response.data?.message || 'Failed to initialize payment',
          error.response.status || HttpStatus.BAD_REQUEST,
        );
      }
      
      throw new HttpException(
        'Unable to reach Paystack API',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Verify payment transaction
   */
  async verifyPayment(reference: string): Promise<PaystackVerifyResponse> {
    try {
      this.logger.debug(`Verifying payment: ${reference}`);

      const response = await this.axiosInstance.get(`/transaction/verify/${reference}`);

      if (!response.data.status) {
        throw new HttpException(
          response.data.message || 'Failed to verify payment',
          HttpStatus.BAD_REQUEST,
        );
      }

      return response.data;
    } catch (error: any) {
      this.logger.error(`Payment verification failed: ${JSON.stringify(error.response?.data || error.message)}`);
      
      if (error.response) {
        throw new HttpException(
          error.response.data?.message || 'Failed to verify payment',
          error.response.status || HttpStatus.BAD_REQUEST,
        );
      }
      
      throw new HttpException(
        'Unable to reach Paystack API',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const crypto = require('crypto');
    const paystackConfig = this.configService.get('paystack');
    const webhookSecret = paystackConfig.webhookSecret;

    if (!webhookSecret) {
      this.logger.warn('Webhook secret not configured, skipping signature verification');
      return true; // Allow if not configured (for development)
    }

    const hash = crypto
      .createHmac('sha512', webhookSecret)
      .update(payload)
      .digest('hex');

    return hash === signature;
  }
}
