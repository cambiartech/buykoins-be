-- Creates platform_settings so add-settings-columns.sql can ALTER it.
-- Idempotent: IF NOT EXISTS. Run once per DB (new deploys skip if already in schema_migrations).

CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exchange_rate_usd_to_ngn DECIMAL(10, 2) NOT NULL DEFAULT 1500.00,
  exchange_rate_last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processing_fee DECIMAL(15, 2) NOT NULL DEFAULT 50.00,
  processing_fee_type VARCHAR(20) DEFAULT 'fixed',
  processing_fee_percentage DECIMAL(5, 2),
  min_payout DECIMAL(15, 2) NOT NULL DEFAULT 1000.00,
  max_payout DECIMAL(15, 2) NOT NULL DEFAULT 1000000.00,
  daily_payout_limit DECIMAL(15, 2),
  monthly_payout_limit DECIMAL(15, 2),
  maintenance_mode BOOLEAN DEFAULT false,
  maintenance_message TEXT,
  allow_new_registrations BOOLEAN DEFAULT true,
  require_email_verification BOOLEAN DEFAULT true,
  require_kyc BOOLEAN DEFAULT false,
  auto_approve_credits BOOLEAN DEFAULT false,
  auto_approve_threshold DECIMAL(15, 2),
  auto_verify_support BOOLEAN DEFAULT false,
  bank_account_required BOOLEAN DEFAULT true,
  require_verified_bank_account BOOLEAN DEFAULT true,
  processing_time VARCHAR(50) NOT NULL DEFAULT '24-48 hours',
  processing_time_business_days INTEGER DEFAULT 2,
  min_credit_request_amount DECIMAL(15, 2),
  max_credit_request_amount DECIMAL(15, 2),
  credit_request_cooldown_hours INTEGER DEFAULT 24,
  payout_request_cooldown_hours INTEGER DEFAULT 24,
  max_active_credit_requests INTEGER DEFAULT 1,
  max_active_payout_requests INTEGER DEFAULT 1,
  platform_name VARCHAR(100) DEFAULT 'BuyTikTokCoins',
  support_email VARCHAR(255),
  support_phone VARCHAR(20),
  terms_of_service_url TEXT,
  privacy_policy_url TEXT,
  extended_settings JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES admins(id)
);

INSERT INTO platform_settings (id)
SELECT uuid_generate_v4()
WHERE NOT EXISTS (SELECT 1 FROM platform_settings LIMIT 1);
