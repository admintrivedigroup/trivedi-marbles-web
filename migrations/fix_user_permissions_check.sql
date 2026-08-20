-- Fixes "new row for relation user_permissions violates check constraint
-- user_permissions_permission_check" when toggling permissions in
-- /inventory/users (Settings tab).
--
-- Cause: the CHECK constraint on user_permissions.permission was defined
-- against an older, shorter permission list and never updated when
-- 'quotations', 'client_leads', 'settings', and 'manage_users' were added
-- to ALL_PERMISSIONS in src/app/inventory/_lib/permissions.ts. Any toggle
-- for one of those four permissions is rejected by Postgres before it
-- reaches the app's own ALL_PERMISSIONS.includes() validation.
--
-- Fix: drop whatever CHECK constraint currently exists on that column
-- (name looked up dynamically, in case it isn't the default
-- "user_permissions_permission_check") and recreate it to match
-- ALL_PERMISSIONS exactly.

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'user_permissions'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%permission%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.user_permissions DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.user_permissions
  ADD CONSTRAINT user_permissions_permission_check
  CHECK (permission IN (
    'add_stock',
    'edit_stock',
    'delete_stock',
    'stock_movement',
    'quotations',
    'client_leads',
    'settings',
    'manage_users'
  ));
