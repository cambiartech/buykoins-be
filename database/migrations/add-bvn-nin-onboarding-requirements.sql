-- Add BVN and NIN requirement toggles to platform_settings table
-- Migration: add-bvn-nin-onboarding-requirements
-- Date: 2026-02-07

-- Add require_bvn_for_onboarding column
ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS require_bvn_for_onboarding BOOLEAN DEFAULT FALSE;

-- Add require_nin_for_onboarding column
ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS require_nin_for_onboarding BOOLEAN DEFAULT FALSE;

-- Add comment to columns
COMMENT ON COLUMN platform_settings.require_bvn_for_onboarding IS 'When enabled, users must provide BVN in their Sudo onboarding data before they can submit an onboarding request';
COMMENT ON COLUMN platform_settings.require_nin_for_onboarding IS 'When enabled, users must provide NIN in their Sudo onboarding data before they can submit an onboarding request';
