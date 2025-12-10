-- BuyTikTokCoins Database Setup Script
-- Run this script to create the database and all tables

-- Create database
CREATE DATABASE buytiktokcoins;

-- Connect to the database
\c buytiktokcoins;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  username VARCHAR(50) UNIQUE,
  phone VARCHAR(20),
  email_verified BOOLEAN DEFAULT false,
  verification_code VARCHAR(6),
  verification_code_expires_at TIMESTAMP WITH TIME ZONE,
  onboarding_status VARCHAR(20) DEFAULT 'pending',
  balance DECIMAL(15, 2) DEFAULT 0.00,
  status VARCHAR(20) DEFAULT 'active',
  wallet_status VARCHAR(20) DEFAULT 'active',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_username ON users(username);

-- Admins Table
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'admin',
  permissions TEXT[] DEFAULT ARRAY[]::TEXT[],
  status VARCHAR(20) DEFAULT 'active',
  password_change_otp VARCHAR(6),
  password_change_otp_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admins_email ON admins(email);
CREATE INDEX idx_admins_status ON admins(status);
CREATE INDEX idx_admins_role ON admins(role);

-- Credit Requests Table
CREATE TABLE IF NOT EXISTS credit_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL,
  proof_url TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP,
  processed_by UUID REFERENCES admins(id),
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_credit_requests_user_id ON credit_requests(user_id);
CREATE INDEX idx_credit_requests_status ON credit_requests(status);

-- Onboarding Requests Table
CREATE TABLE IF NOT EXISTS onboarding_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  completed_by UUID REFERENCES admins(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_onboarding_requests_user_id ON onboarding_requests(user_id);
CREATE INDEX idx_onboarding_requests_status ON onboarding_requests(status);

-- Bank Accounts Table
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_number VARCHAR(50) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  bank_name VARCHAR(100) NOT NULL,
  bank_code VARCHAR(20) NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  is_primary BOOLEAN DEFAULT false,
  verification_code VARCHAR(6),
  verification_code_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bank_accounts_user_id ON bank_accounts(user_id);
CREATE INDEX idx_bank_accounts_is_primary ON bank_accounts(user_id, is_primary) WHERE is_primary = true;

-- Payouts Table
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL,
  amount_in_ngn DECIMAL(15, 2) NOT NULL,
  processing_fee DECIMAL(15, 2) NOT NULL,
  net_amount DECIMAL(15, 2) NOT NULL,
  bank_account JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP,
  completed_at TIMESTAMP,
  processed_by UUID REFERENCES admins(id),
  transaction_reference VARCHAR(100),
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payouts_user_id ON payouts(user_id);
CREATE INDEX idx_payouts_status ON payouts(status);

-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  amount_in_ngn DECIMAL(15, 2),
  exchange_rate DECIMAL(10, 4),
  processing_fee DECIMAL(15, 2),
  net_amount DECIMAL(15, 2),
  status VARCHAR(20) DEFAULT 'pending',
  description TEXT,
  reference_id UUID,
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);

-- Platform Settings Table
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Financial Settings
  exchange_rate_usd_to_ngn DECIMAL(10, 2) NOT NULL DEFAULT 1500.00,
  exchange_rate_last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processing_fee DECIMAL(15, 2) NOT NULL DEFAULT 50.00,
  processing_fee_type VARCHAR(20) DEFAULT 'fixed',
  processing_fee_percentage DECIMAL(5, 2),
  min_payout DECIMAL(15, 2) NOT NULL DEFAULT 1000.00,
  max_payout DECIMAL(15, 2) NOT NULL DEFAULT 1000000.00,
  daily_payout_limit DECIMAL(15, 2),
  monthly_payout_limit DECIMAL(15, 2),
  
  -- Platform Operations
  maintenance_mode BOOLEAN DEFAULT false,
  maintenance_message TEXT,
  allow_new_registrations BOOLEAN DEFAULT true,
  require_email_verification BOOLEAN DEFAULT true,
  require_kyc BOOLEAN DEFAULT false,
  auto_approve_credits BOOLEAN DEFAULT false,
  auto_approve_threshold DECIMAL(15, 2),
  auto_verify_support BOOLEAN DEFAULT false, -- Auto verify for support/admin operations
  
  -- Payment & Banking
  bank_account_required BOOLEAN DEFAULT true,
  require_verified_bank_account BOOLEAN DEFAULT true,
  processing_time VARCHAR(50) NOT NULL DEFAULT '24-48 hours',
  processing_time_business_days INTEGER DEFAULT 2,
  
  -- Business Rules
  min_credit_request_amount DECIMAL(15, 2),
  max_credit_request_amount DECIMAL(15, 2),
  credit_request_cooldown_hours INTEGER DEFAULT 24,
  payout_request_cooldown_hours INTEGER DEFAULT 24,
  max_active_credit_requests INTEGER DEFAULT 1,
  max_active_payout_requests INTEGER DEFAULT 1,
  
  -- Platform Information
  platform_name VARCHAR(100) DEFAULT 'BuyTikTokCoins',
  support_email VARCHAR(255),
  support_phone VARCHAR(20),
  terms_of_service_url TEXT,
  privacy_policy_url TEXT,
  
  -- Extended Settings (JSONB for flexibility)
  extended_settings JSONB DEFAULT '{}'::jsonb,
  
  -- Metadata
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES admins(id)
);

-- Insert default platform settings
INSERT INTO platform_settings (id) 
VALUES (uuid_generate_v4())
ON CONFLICT DO NOTHING;

-- Refresh Tokens Table (Optional - for token management)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

