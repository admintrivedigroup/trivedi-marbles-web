-- Adds an avatar_url for the self-service profile section on the Settings
-- page. Writes still go through the admin/service-role client in
-- profile.ts (scoped to the caller's own user_id), matching the existing
-- write model for user_profiles documented in secure_inventory_rls.sql --
-- no new RLS policy is needed since RLS only gates direct client access.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;
