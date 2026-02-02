import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';

export interface SudoCustomer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  metadata?: Record<string, any>;
}

export interface SudoCard {
  id?: string;
  _id?: string; // Sudo uses _id
  customerId?: string;
  customer?: string;
  cardNumber?: string; // Legacy field
  maskedPan?: string; // Sudo returns maskedPan (e.g., "506441*********1590")
  expiryMonth?: string;
  expiryYear?: string;
  cvv?: string;
  cardType?: string;
  currency: string;
  status: string;
  balance?: number;
  metadata?: Record<string, any>;
  account?: string;
  fundingSource?: string;
  program?: string | null;
  brand?: string;
  is2FAEnabled?: boolean;
  is2FAEnrolled?: boolean;
  isDefaultPINChanged?: boolean;
  disposable?: boolean;
  refundAccount?: string | null;
  providerReference?: string;
  isDigitalized?: boolean;
  accumulatedFees?: number;
  totalFeesCharged?: number;
  feeChargeDay?: number;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SudoAccount {
  id: string;
  currency: string;
  balance: number;
  status: string;
}

export interface SudoFundingSource {
  id: string;
  type: string;
  currency: string;
  status: string;
}

export interface SudoTransaction {
  id: string;
  cardId: string;
  type: string;
  amount: number;
  currency: string;
  merchantName?: string;
  description?: string;
  status: string;
  reference?: string;
  metadata?: Record<string, any>;
}

export interface CreateCustomerDto {
  type: 'individual' | 'company';
  name: string;
  phoneNumber: string;
  status: 'active' | 'inactive';
  emailAddress?: string;
  billingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  individual?: {
    firstName: string;
    lastName: string;
    dob: string; // YYYY-MM-DD format
    identity: {
      type: 'BVN' | 'NIN';
      number: string;
    };
  };
  company?: {
    name: string;
    registrationNumber?: string;
  };
  metadata?: Record<string, any>;
}

export interface CreateCardDto {
  customerId: string;
  type?: 'virtual' | 'physical' | 'giftcard';
  currency?: string;
  status?: 'active' | 'inactive';
  brand?: 'Verve' | 'MasterCard' | 'Visa' | 'AfriGo';
  fundingSourceId?: string;
  debitAccountId?: string; // Required for virtual cards
  amount?: number; // Required for MasterCard - initial funding amount
  issuerCountry?: string;
  enable2FA?: boolean;
  cardProgramId?: string;
  metadata?: Record<string, any>;
  spendingControls?: {
    allowedCategories?: string[];
    blockedCategories?: string[];
    channels?: {
      atm?: boolean;
      pos?: boolean;
      web?: boolean;
      mobile?: boolean;
    };
    spendingLimits?: Array<{
      amount: number;
      interval: string;
    }>;
  };
}

export interface FundTransferDto {
  debitAccountId: string; // The account to debit from (settlement account)
  creditAccountId: string; // The account to credit to (card account)
  amount: number; // Amount to transfer
  narration?: string; // Optional narration
  paymentReference?: string; // Optional payment reference
  // For external transfers (not used for card funding):
  beneficiaryBankCode?: string;
  beneficiaryAccountNumber?: string;
}

@Injectable()
export class SudoApiService {
  private readonly logger = new Logger(SudoApiService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly apiBaseUrl: string;
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    const sudoConfig = this.configService.get('sudo');
    this.apiBaseUrl = sudoConfig.apiBaseUrl;
    this.apiKey = sudoConfig.apiKey;

    this.axiosInstance = axios.create({
      baseURL: this.apiBaseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        this.logger.debug(`Making ${config.method?.toUpperCase()} request to ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error('Request error:', error);
        return Promise.reject(error);
      },
    );

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        // Log detailed error information
        if (error.response) {
          // API responded with error status
          this.logger.error(
            `Sudo API Error [${error.response.status}]: ${JSON.stringify(error.response.data, null, 2)}`,
          );
          this.logger.error(`Request URL: ${error.config?.method?.toUpperCase()} ${error.config?.url}`);
          this.logger.error(`Request Payload: ${JSON.stringify(error.config?.data, null, 2)}`);
        } else if (error.request) {
          // Request was made but no response received (network error, timeout, etc.)
          this.logger.error(`Sudo API Network Error: ${error.message}`);
          this.logger.error(`Request URL: ${error.config?.method?.toUpperCase()} ${error.config?.url}`);
          this.logger.error(`Request Payload: ${JSON.stringify(error.config?.data, null, 2)}`);
          this.logger.error(`Error Code: ${error.code || 'UNKNOWN'}`);
        } else {
          // Error setting up request
          this.logger.error(`Sudo API Request Setup Error: ${error.message}`);
        }
        return Promise.reject(error);
      },
    );
  }

  /**
   * Create a customer in Sudo
   */
  async createCustomer(data: CreateCustomerDto): Promise<SudoCustomer> {
    try {
      // Build payload according to Sudo API structure
      const payload: any = {
        type: data.type,
        name: data.name,
        phoneNumber: data.phoneNumber,
        status: data.status,
        billingAddress: data.billingAddress,
      };

      if (data.emailAddress) {
        payload.emailAddress = data.emailAddress;
      }

      if (data.individual) {
        payload.individual = data.individual;
      }

      if (data.company) {
        payload.company = data.company;
      }

      if (data.metadata) {
        payload.metadata = data.metadata;
      }

      const response = await this.axiosInstance.post('/customers', payload);
      this.logger.debug(`Customer creation response: ${JSON.stringify(response.data)}`);

      // Handle Sudo API response structure
      // Sudo returns: { statusCode: 200, message: "...", data: { _id: "...", ... } }
      if (response.data.data) {
        const customerData = response.data.data;
        // Normalize _id to id for consistency
        if (customerData._id && !customerData.id) {
          customerData.id = customerData._id;
        }
        return customerData;
      } else if (response.data._id) {
        // If response is the customer object directly
        const customerData = response.data;
        if (!customerData.id) {
          customerData.id = customerData._id;
        }
        return customerData;
      } else if (response.data.id) {
        // Standard id format
        return response.data;
      } else {
        throw new Error('Unexpected response structure from Sudo API');
      }
    } catch (error: any) {
      this.logger.error(
        `Customer creation failed: ${JSON.stringify(error.response?.data || error.message)}`,
      );
      this.handleError(error, 'Failed to create customer');
      throw error;
    }
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId: string): Promise<SudoCustomer> {
    try {
      const response = await this.axiosInstance.get(`/customers/${customerId}`);
      return response.data.data;
    } catch (error: any) {
      this.handleError(error, 'Failed to get customer');
      throw error;
    }
  }

  /**
   * Update customer
   */
  async updateCustomer(
    customerId: string,
    data: Partial<CreateCustomerDto>,
  ): Promise<SudoCustomer> {
    try {
      const response = await this.axiosInstance.put(`/customers/${customerId}`, data);
      return response.data.data;
    } catch (error: any) {
      this.handleError(error, 'Failed to update customer');
      throw error;
    }
  }

  /**
   * Create a virtual card
   */
  async createCard(data: CreateCardDto): Promise<SudoCard> {
    try {
      // Build payload with all required fields according to Sudo API docs
      const payload: any = {
        customerId: data.customerId,
        type: data.type || 'virtual', // Default to virtual
        currency: data.currency || 'NGN',
        status: data.status || 'active', // Required: active or inactive
        brand: data.brand || 'MasterCard', // Required: Verve, MasterCard, Visa, AfriGo
        issuerCountry: data.issuerCountry || 'NGA',
        enable2FA: data.enable2FA !== undefined ? data.enable2FA : false,
      };

      // debitAccountId is required for virtual cards according to docs
      if (data.debitAccountId) {
        payload.debitAccountId = data.debitAccountId;
      }

      // amount is required for MasterCard according to docs
      if (data.amount !== undefined) {
        payload.amount = data.amount;
      }

      // Add optional fields if provided
      if (data.fundingSourceId) {
        payload.fundingSourceId = data.fundingSourceId;
      }
      if (data.cardProgramId) {
        payload.cardProgramId = data.cardProgramId;
      }
      if (data.spendingControls) {
        payload.spendingControls = data.spendingControls;
      }
      if (data.metadata) {
        payload.metadata = data.metadata;
      }

      this.logger.debug(`Card creation payload: ${JSON.stringify(payload)}`);
      const response = await this.axiosInstance.post('/cards', payload);
      
      this.logger.debug(`Card creation response: ${JSON.stringify(response.data, null, 2)}`);
      
      // Handle response structure (Sudo may return _id)
      const cardData = response.data.data || response.data;
      if (!cardData) {
        this.logger.error(`Unexpected response structure: ${JSON.stringify(response.data, null, 2)}`);
        throw new Error('Invalid response structure from Sudo API');
      }
      
      if (cardData._id && !cardData.id) {
        cardData.id = cardData._id;
      }
      
      return cardData;
    } catch (error: any) {
      // Log full error details before handling
      this.logger.error(`Card creation failed with error:`);
      this.logger.error(`Error Type: ${error.constructor.name}`);
      this.logger.error(`Error Message: ${error.message}`);
      
      if (error.response) {
        this.logger.error(`Response Status: ${error.response.status}`);
        this.logger.error(`Response Data: ${JSON.stringify(error.response.data, null, 2)}`);
        this.logger.error(`Response Headers: ${JSON.stringify(error.response.headers, null, 2)}`);
      }
      
      if (error.request) {
        this.logger.error(`Request made but no response: ${JSON.stringify(error.request, null, 2)}`);
      }
      
      this.handleError(error, 'Failed to create card');
      throw error;
    }
  }

  /**
   * Get card by ID
   */
  async getCard(cardId: string): Promise<SudoCard> {
    try {
      const response = await this.axiosInstance.get(`/cards/${cardId}`);
      return response.data.data;
    } catch (error: any) {
      this.handleError(error, 'Failed to get card');
      throw error;
    }
  }

  /**
   * Get cards by customer
   */
  async getCustomerCards(
    customerId: string,
    page: number = 0,
    limit: number = 25,
  ): Promise<{ data: SudoCard[]; pagination: any }> {
    try {
      const response = await this.axiosInstance.get(`/cards`, {
        params: {
          customerId,
          page,
          limit,
        },
      });
      return response.data;
    } catch (error: any) {
      this.handleError(error, 'Failed to get customer cards');
      throw error;
    }
  }

  /**
   * Update card (freeze/unfreeze, etc.)
   */
  async updateCard(cardId: string, data: Partial<SudoCard>): Promise<SudoCard> {
    try {
      const response = await this.axiosInstance.put(`/cards/${cardId}`, data);
      return response.data.data;
    } catch (error: any) {
      this.handleError(error, 'Failed to update card');
      throw error;
    }
  }

  /**
   * Get card transactions
   */
  async getCardTransactions(
    cardId: string,
    page: number = 0,
    limit: number = 25,
  ): Promise<{ data: SudoTransaction[]; pagination: any }> {
    try {
      const response = await this.axiosInstance.get(`/transactions`, {
        params: {
          cardId,
          page,
          limit,
        },
      });
      return response.data;
    } catch (error: any) {
      this.handleError(error, 'Failed to get card transactions');
      throw error;
    }
  }

  /**
   * Get transaction by ID
   */
  async getTransaction(transactionId: string): Promise<SudoTransaction> {
    try {
      const response = await this.axiosInstance.get(`/transactions/${transactionId}`);
      return response.data.data;
    } catch (error: any) {
      this.handleError(error, 'Failed to get transaction');
      throw error;
    }
  }

  /**
   * Create settlement account
   */
  async createAccount(data: {
    currency: string;
    metadata?: Record<string, any>;
  }): Promise<SudoAccount> {
    try {
      const response = await this.axiosInstance.post('/accounts', data);
      return response.data.data;
    } catch (error: any) {
      this.handleError(error, 'Failed to create account');
      throw error;
    }
  }

  /**
   * Get account balance
   */
  async getAccountBalance(accountId: string): Promise<{ balance: number; currency: string }> {
    try {
      const response = await this.axiosInstance.get(`/accounts/${accountId}/balance`);
      return response.data.data;
    } catch (error: any) {
      this.handleError(error, 'Failed to get account balance');
      throw error;
    }
  }

  /**
   * Create funding source
   */
  async createFundingSource(data: {
    type: string;
    currency: string;
    metadata?: Record<string, any>;
  }): Promise<SudoFundingSource> {
    try {
      const response = await this.axiosInstance.post('/funding-sources', data);
      return response.data.data;
    } catch (error: any) {
      this.handleError(error, 'Failed to create funding source');
      throw error;
    }
  }

  /**
   * Fund transfer
   * Transfers funds from one account to another (e.g., settlement account to card account)
   * See: https://docs.sudo.africa/reference/fund-transfer
   */
  async fundTransfer(data: FundTransferDto): Promise<any> {
    try {
      const payload: any = {
        debitAccountId: data.debitAccountId,
        amount: data.amount,
        creditAccountId: data.creditAccountId,
      };

      if (data.narration) {
        payload.narration = data.narration;
      }

      if (data.paymentReference) {
        payload.paymentReference = data.paymentReference;
      }

      // For external transfers (not used for card funding)
      if (data.beneficiaryBankCode) {
        payload.beneficiaryBankCode = data.beneficiaryBankCode;
      }

      if (data.beneficiaryAccountNumber) {
        payload.beneficiaryAccountNumber = data.beneficiaryAccountNumber;
      }

      this.logger.debug(`Fund transfer payload: ${JSON.stringify(payload)}`);
      const response = await this.axiosInstance.post('/accounts/transfer', payload);
      this.logger.debug(`Fund transfer response: ${JSON.stringify(response.data)}`);
      
      // Sudo returns: { statusCode: 200, message: "...", data: {...} }
      return response.data.data || response.data;
    } catch (error: any) {
      this.handleError(error, 'Failed to transfer funds');
      throw error;
    }
  }

  /**
   * Digitalize card (for mobile wallets)
   */
  async digitalizeCard(cardId: string): Promise<SudoCard> {
    try {
      const response = await this.axiosInstance.put(`/cards/${cardId}/digitalize`);
      return response.data.data;
    } catch (error: any) {
      this.handleError(error, 'Failed to digitalize card');
      throw error;
    }
  }

  /**
   * Generate card token
   */
  async generateCardToken(cardId: string): Promise<{ token: string }> {
    try {
      const response = await this.axiosInstance.get(`/cards/${cardId}/token`);
      return response.data.data;
    } catch (error: any) {
      this.handleError(error, 'Failed to generate card token');
      throw error;
    }
  }

  /**
   * Handle API errors
   */
  private handleError(error: any, defaultMessage: string): void {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      let message = defaultMessage;
      if (data?.message) {
        message = data.message;
      } else if (data?.error) {
        message = data.error;
      }

      switch (status) {
        case 400:
          throw new HttpException(message || 'Bad request', HttpStatus.BAD_REQUEST);
        case 401:
          throw new HttpException('Unauthorized - Invalid API key', HttpStatus.UNAUTHORIZED);
        case 403:
          throw new HttpException('Forbidden - Insufficient permissions', HttpStatus.FORBIDDEN);
        case 404:
          throw new HttpException('Resource not found', HttpStatus.NOT_FOUND);
        case 429:
          throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
        default:
          throw new HttpException(
            message || 'Sudo API error',
            status || HttpStatus.INTERNAL_SERVER_ERROR,
          );
      }
    } else if (error.request) {
      throw new HttpException(
        'Unable to reach Sudo API',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    } else {
      throw new HttpException(
        error.message || defaultMessage,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

