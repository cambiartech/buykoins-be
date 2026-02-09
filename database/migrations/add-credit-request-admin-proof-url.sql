-- Add admin_proof_url to credit_requests (matches CreditRequest entity).
ALTER TABLE credit_requests
ADD COLUMN IF NOT EXISTS admin_proof_url TEXT;
