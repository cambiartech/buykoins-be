-- Add sudoCustomerOnboardingData JSON field to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS sudo_customer_onboarding_data JSONB DEFAULT NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_sudo_customer_onboarding 
ON users USING GIN (sudo_customer_onboarding_data);

-- Add comment
COMMENT ON COLUMN users.sudo_customer_onboarding_data IS 'Stores Sudo customer onboarding progress: dob, billingAddress, identity, onboardingStep, onboardingCompleted';

