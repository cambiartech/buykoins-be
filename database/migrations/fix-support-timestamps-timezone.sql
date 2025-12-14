-- Migration: Fix Support Messages Timestamps to Use TIME ZONE
-- This ensures all timestamps are stored in UTC

-- Change support_messages.created_at to TIMESTAMP WITH TIME ZONE
ALTER TABLE support_messages 
ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC';

-- Change support_messages.read_at to TIMESTAMP WITH TIME ZONE (if it exists)
ALTER TABLE support_messages 
ALTER COLUMN read_at TYPE TIMESTAMP WITH TIME ZONE USING read_at AT TIME ZONE 'UTC';

-- Change support_conversations.last_message_at to TIMESTAMP WITH TIME ZONE
ALTER TABLE support_conversations 
ALTER COLUMN last_message_at TYPE TIMESTAMP WITH TIME ZONE USING last_message_at AT TIME ZONE 'UTC';

-- Change support_conversations.created_at to TIMESTAMP WITH TIME ZONE
ALTER TABLE support_conversations 
ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC';

-- Change support_conversations.updated_at to TIMESTAMP WITH TIME ZONE
ALTER TABLE support_conversations 
ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'UTC';

-- Update default to use UTC
ALTER TABLE support_messages 
ALTER COLUMN created_at SET DEFAULT (NOW() AT TIME ZONE 'UTC');

ALTER TABLE support_conversations 
ALTER COLUMN created_at SET DEFAULT (NOW() AT TIME ZONE 'UTC');

ALTER TABLE support_conversations 
ALTER COLUMN updated_at SET DEFAULT (NOW() AT TIME ZONE 'UTC');

