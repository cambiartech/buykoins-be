-- Migration: Add Widget System Tables
-- Created: 2025-01-XX
-- Description: Tables for automated widget flows (onboarding, withdrawal, deposit)
-- Note: Uses existing onboarding_auth_codes table (no new auth code table needed)

-- Widget Sessions Table
CREATE TABLE IF NOT EXISTS widget_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trigger_type VARCHAR(20) NOT NULL CHECK (trigger_type IN ('onboarding', 'withdrawal', 'deposit')),
  context JSONB DEFAULT '{}', -- Stores context data (amount, request IDs, etc.)
  current_step VARCHAR(50) NOT NULL,
  completed_steps TEXT[] DEFAULT '{}',
  collected_data JSONB DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned', 'error')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- Sliding window: extends on activity
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() -- Track last user activity
);

CREATE INDEX idx_widget_sessions_user_id ON widget_sessions(user_id);
CREATE INDEX idx_widget_sessions_status ON widget_sessions(status);
CREATE INDEX idx_widget_sessions_expires_at ON widget_sessions(expires_at);
CREATE INDEX idx_widget_sessions_last_activity_at ON widget_sessions(last_activity_at);
CREATE INDEX idx_widget_sessions_trigger_type ON widget_sessions(trigger_type);

-- Add comment to table
COMMENT ON TABLE widget_sessions IS 'Tracks multi-step widget flows for onboarding, withdrawal, and deposit';

-- Note: We use existing onboarding_auth_codes table for auth codes (no new table needed)
-- Note: No paypal_connections table needed - we use shared PayPal account

