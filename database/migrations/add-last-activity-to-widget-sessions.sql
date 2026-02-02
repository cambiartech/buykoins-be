-- Migration: Add last_activity_at column to widget_sessions
-- Created: 2025-01-XX
-- Description: Adds activity tracking for sliding window expiration

-- Add last_activity_at column
ALTER TABLE widget_sessions 
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing sessions to set last_activity_at to created_at
UPDATE widget_sessions 
SET last_activity_at = created_at 
WHERE last_activity_at IS NULL;

-- Create index for activity tracking
CREATE INDEX IF NOT EXISTS idx_widget_sessions_last_activity_at ON widget_sessions(last_activity_at);

-- Add comment
COMMENT ON COLUMN widget_sessions.last_activity_at IS 'Tracks last user activity for sliding window expiration';

