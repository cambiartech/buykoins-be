-- Track how the user signed up / logs in: 'email' or 'tiktok'.
-- Existing users default to 'email'; new TikTok-only users get 'tiktok'.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_type VARCHAR(20) DEFAULT 'email';

COMMENT ON COLUMN users.auth_type IS 'How user signed up / primary auth: email or tiktok.';
