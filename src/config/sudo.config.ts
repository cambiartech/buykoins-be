import { registerAs } from '@nestjs/config';

export default registerAs('sudo', () => ({
  apiKey: process.env.SUDO_API_KEY || '',
  apiBaseUrl:
    process.env.SUDO_API_BASE_URL ||
    (process.env.SUDO_ENVIRONMENT === 'production'
      ? 'https://api.sudo.africa'
      : 'https://api.sandbox.sudo.cards'),
  environment: process.env.SUDO_ENVIRONMENT || 'sandbox',
  vaultId:
    process.env.SUDO_VAULT_ID ||
    (process.env.SUDO_ENVIRONMENT === 'production'
      ? process.env.SUDO_VAULT_ID_PROD
      : 'we0dsa28s'), // Default sandbox vault ID
  defaultCurrency: process.env.SUDO_DEFAULT_CURRENCY || 'NGN',
  defaultFundingSourceId: process.env.SUDO_DEFAULT_FUNDING_SOURCE_ID || '',
  defaultSettlementAccountId: process.env.SUDO_DEFAULT_SETTLEMENT_ACCOUNT_ID || '',
  defaultDebitAccountId: process.env.SUDO_DEFAULT_DEBIT_ACCOUNT_ID || '', // Required for virtual cards
  defaultCardBrand: process.env.SUDO_DEFAULT_CARD_BRAND || 'MasterCard', // Verve, MasterCard, Visa, AfriGo
  defaultCardCreationAmount: parseInt(process.env.SUDO_DEFAULT_CARD_CREATION_AMOUNT || '500', 10), // Initial funding amount for card creation (in kobo for NGN)
  // Default billing address for customers
  defaultBillingAddress: {
    line1: process.env.SUDO_DEFAULT_BILLING_LINE1 || '123 Main Street',
    line2: process.env.SUDO_DEFAULT_BILLING_LINE2 || '',
    city: process.env.SUDO_DEFAULT_BILLING_CITY || 'Lagos',
    state: process.env.SUDO_DEFAULT_BILLING_STATE || 'Lagos',
    postalCode: process.env.SUDO_DEFAULT_BILLING_POSTAL_CODE || '100001',
    country: process.env.SUDO_DEFAULT_BILLING_COUNTRY || 'NG',
  },
}));

