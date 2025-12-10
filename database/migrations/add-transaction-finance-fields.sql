-- Migration: Add finance fields to transactions table
-- Date: 2025-12-09
-- Description: Adds NGN amounts, exchange rate, processing fee, and net amount fields
--              to support finance tracking and bookkeeping

-- Add amount_in_ngn column
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS amount_in_ngn DECIMAL(15, 2);

-- Add exchange_rate column
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(10, 4);

-- Add processing_fee column
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS processing_fee DECIMAL(15, 2);

-- Add net_amount column
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS net_amount DECIMAL(15, 2);

-- Add comments for documentation
COMMENT ON COLUMN transactions.amount_in_ngn IS 'NGN equivalent amount (for withdrawals/payouts)';
COMMENT ON COLUMN transactions.exchange_rate IS 'Exchange rate used (USD to NGN)';
COMMENT ON COLUMN transactions.processing_fee IS 'Processing fee in NGN';
COMMENT ON COLUMN transactions.net_amount IS 'Net amount in NGN (after fees)';

-- Verify columns were added
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'transactions' 
AND column_name IN ('amount_in_ngn', 'exchange_rate', 'processing_fee', 'net_amount')
ORDER BY column_name;

