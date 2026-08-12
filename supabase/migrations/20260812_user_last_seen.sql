-- Tracks real activity (heartbeat pinged from the inventory shell while a user
-- has the app open) separately from Supabase auth's last_sign_in_at, which only
-- updates on a fresh login and stays stale for the rest of a long session.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
