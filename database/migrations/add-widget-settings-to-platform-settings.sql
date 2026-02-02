-- Migration: Add Widget Settings to Platform Settings
-- Created: 2025-01-XX
-- Description: Adds widget automation settings (automatic withdrawals, PayPal email, automatic onboarding)

-- Add widget settings columns
ALTER TABLE platform_settings 
ADD COLUMN IF NOT EXISTS automatic_withdrawals_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS paypal_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS automatic_onboarding_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS gmail_webhook_url VARCHAR(255);

-- Add comments
COMMENT ON COLUMN platform_settings.automatic_withdrawals_enabled IS 'Enable automatic withdrawals (for future Paystack integration)';
COMMENT ON COLUMN platform_settings.paypal_email IS 'PayPal email address for onboarding';
COMMENT ON COLUMN platform_settings.automatic_onboarding_enabled IS 'Enable automatic onboarding via Google Apps Script';
COMMENT ON COLUMN platform_settings.gmail_webhook_url IS 'Gmail webhook URL for Google Apps Script';

