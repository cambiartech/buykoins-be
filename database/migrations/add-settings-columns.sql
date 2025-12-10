-- Migration: Add new columns to platform_settings table
-- Run this after updating the database schema

-- Add new financial settings columns
ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS processing_fee_type VARCHAR(20) DEFAULT 'fixed',
ADD COLUMN IF NOT EXISTS processing_fee_percentage DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS daily_payout_limit DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS monthly_payout_limit DECIMAL(15, 2);

-- Add new operations settings columns
ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS maintenance_message TEXT,
ADD COLUMN IF NOT EXISTS require_email_verification BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_approve_threshold DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS auto_verify_support BOOLEAN DEFAULT false;

-- Add new payment settings columns
ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS require_verified_bank_account BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS processing_time_business_days INTEGER DEFAULT 2;

-- Add new business rules columns
ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS min_credit_request_amount DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS max_credit_request_amount DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS credit_request_cooldown_hours INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS payout_request_cooldown_hours INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS max_active_credit_requests INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS max_active_payout_requests INTEGER DEFAULT 1;

-- Add new platform info columns
ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS platform_name VARCHAR(100) DEFAULT 'BuyTikTokCoins',
ADD COLUMN IF NOT EXISTS support_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS support_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS terms_of_service_url TEXT,
ADD COLUMN IF NOT EXISTS privacy_policy_url TEXT;

-- Add extended settings JSONB column
ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS extended_settings JSONB DEFAULT '{}'::jsonb;

-- Create index for JSONB queries (if needed)
CREATE INDEX IF NOT EXISTS idx_platform_settings_extended ON platform_settings USING GIN (extended_settings);

