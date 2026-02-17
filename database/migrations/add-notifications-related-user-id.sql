-- Admin notifications (e.g. new_support_message) need to record which user triggered them
-- so admins know who sent the message. Adds related_user_id for "notification for admin, about user X".
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS related_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_related_user_id ON notifications(related_user_id);

COMMENT ON COLUMN notifications.related_user_id IS 'For admin notifications: the user who triggered this (e.g. who sent the support message).';
