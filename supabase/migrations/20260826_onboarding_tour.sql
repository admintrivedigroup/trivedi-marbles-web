-- Tracks whether a user has completed the first-run onboarding guide.
-- Existing accounts are backfilled to "already seen" so the guide only
-- triggers automatically for user_profiles rows created after this migration
-- (new invites, which never set this column).

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

UPDATE user_profiles
  SET onboarding_completed_at = now()
  WHERE onboarding_completed_at IS NULL;
