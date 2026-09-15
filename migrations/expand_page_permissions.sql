-- Fixes "new row for relation user_permissions violates check constraint
-- user_permissions_permission_check" when toggling any of the new
-- page-view permissions (Dashboard, Inventory, Tasks, Task Calendar,
-- KRA/KPI, Visualizer, Journal, Audit Log, Archive) added to
-- ALL_PERMISSIONS in src/app/inventory/_lib/permissions.ts.
--
-- Same root cause as fix_user_permissions_check.sql: the CHECK constraint
-- was never updated when those permissions were introduced. This migration
-- also keeps has_permission()'s role-default fallback in sync with
-- ROLE_DEFAULTS, and switches the audit_logs SELECT policy from a hard
-- is_admin() check to has_permission('view_audit_log') so the new
-- Audit Log toggle actually governs read access, not just the app's nav.

-- ─── 1. Recreate the CHECK constraint with the full permission list ───────────
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
    'view_dashboard',
    'view_inventory',
    'add_stock',
    'edit_stock',
    'delete_stock',
    'stock_movement',
    'view_tasks',
    'view_task_calendar',
    'view_kra',
    'quotations',
    'client_leads',
    'view_visualizer',
    'view_journal',
    'manage_users',
    'view_audit_log',
    'view_archive',
    'settings'
  ));

-- ─── 2. Keep has_permission()'s role-default fallback in sync ─────────────────
-- Role defaults below must stay identical to ROLE_DEFAULTS in
-- src/app/inventory/_lib/permissions.ts. If that table changes, update both.
CREATE OR REPLACE FUNCTION public.has_permission(permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  WITH override AS (
    SELECT enabled FROM public.user_permissions
    WHERE user_id = auth.uid() AND permission = permission_name
    LIMIT 1
  ),
  role_default AS (
    SELECT CASE public.get_caller_role()
      WHEN 'superadmin' THEN true
      WHEN 'admin' THEN permission_name NOT IN ('delete_stock', 'manage_users')
      WHEN 'staff' THEN permission_name IN (
        'stock_movement', 'quotations',
        'view_dashboard', 'view_inventory', 'view_tasks',
        'view_task_calendar', 'view_kra', 'view_visualizer'
      )
      ELSE false
    END AS value
  )
  SELECT COALESCE((SELECT enabled FROM override), (SELECT value FROM role_default));
$$;

REVOKE ALL ON FUNCTION public.has_permission(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission(TEXT) TO authenticated;

-- ─── 3. audit_logs read access now follows the view_audit_log permission ──────
DROP POLICY IF EXISTS "auth_select" ON public.audit_logs;
CREATE POLICY "auth_select" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.has_permission('view_audit_log'));
