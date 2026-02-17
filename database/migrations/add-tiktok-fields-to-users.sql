-- TikTok Login Kit: link TikTok identity to user (for onboarding gate and profile display).
-- user.info.basic gives open_id, display_name, avatar_url.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tiktok_open_id VARCHAR(64) UNIQUE,
  ADD COLUMN IF NOT EXISTS tiktok_display_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS tiktok_avatar_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tiktok_open_id ON users(tiktok_open_id) WHERE tiktok_open_id IS NOT NULL;

COMMENT ON COLUMN users.tiktok_open_id IS 'TikTok open_id from Login Kit (user.info.basic). One TikTok account per Buykoins user.';
COMMENT ON COLUMN users.tiktok_display_name IS 'TikTok display name from user.info.basic.';
COMMENT ON COLUMN users.tiktok_avatar_url IS 'TikTok avatar URL from user.info.basic.';
