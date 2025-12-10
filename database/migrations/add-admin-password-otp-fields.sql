-- Migration: Add password change OTP fields to admins table
-- Date: 2025-12-09
-- Description: Adds OTP fields for secure password change verification

-- Add password_change_otp column
ALTER TABLE admins 
ADD COLUMN IF NOT EXISTS password_change_otp VARCHAR(6);

-- Add password_change_otp_expires_at column
ALTER TABLE admins 
ADD COLUMN IF NOT EXISTS password_change_otp_expires_at TIMESTAMP WITH TIME ZONE;

-- Add comments for documentation
COMMENT ON COLUMN admins.password_change_otp IS 'OTP code for password change verification';
COMMENT ON COLUMN admins.password_change_otp_expires_at IS 'OTP expiration timestamp';

-- Verify columns were added
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'admins' 
AND column_name IN ('password_change_otp', 'password_change_otp_expires_at')
ORDER BY column_name;

