-- Migration: Add wallet balance and rename balance to earnings
-- This migration adds a separate wallet balance for spending (cards, airtime, etc.)
-- and renames the existing balance field to earnings (for TikTok earnings)

-- Step 1: Add wallet column (defaults to 0)
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet DECIMAL(15, 2) DEFAULT 0.00 NOT NULL;

-- Step 2: Rename balance to earnings
-- Note: We'll keep balance for backward compatibility during migration
-- In the application code, we'll use earnings field
DO $$
BEGIN
    -- Check if earnings column doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'earnings'
    ) THEN
        -- Rename balance to earnings
        ALTER TABLE users RENAME COLUMN balance TO earnings;
    END IF;
END $$;

-- Step 3: Add index for wallet queries
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet);
CREATE INDEX IF NOT EXISTS idx_users_earnings ON users(earnings);

-- Step 4: Add payment_transactions table for Paystack payments
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  paystack_reference VARCHAR(255) UNIQUE NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NGN',
  status VARCHAR(20) DEFAULT 'pending',
  payment_method VARCHAR(50),
  paystack_response JSONB,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX idx_payment_transactions_reference ON payment_transactions(paystack_reference);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);

COMMENT ON TABLE payment_transactions IS 'Stores Paystack payment transactions';
COMMENT ON COLUMN payment_transactions.paystack_reference IS 'Paystack transaction reference';
COMMENT ON COLUMN payment_transactions.status IS 'pending, success, failed, reversed';
