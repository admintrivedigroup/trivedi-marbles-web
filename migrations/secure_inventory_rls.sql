-- Closes the RLS authorization gap on every inventory table that isn't
-- journal (see migrations/secure_journal_rls.sql for that one, and its own
-- comment for the "blanket any-authenticated-user RLS" convention this repo
-- used everywhere before that migration). That convention meant any
-- authenticated Supabase session — regardless of assigned role or the
-- per-user permission toggles in Settings — could read and write every
-- table directly via the PostgREST API, bypassing the Next.js app entirely.
-- Two concrete risks this closes:
--   1. A `staff` account (which the Settings UI shows as having no
--      add_stock/edit_stock/delete_stock/etc.) could still add, edit, or
--      delete inventory, run stock movements, or touch client leads by
--      calling the Supabase REST API directly with its own session token —
--      the UI only hid the buttons, it didn't gate the data.
--   2. Writes to user_profiles/user_permissions were reachable the same
--      way, so a `staff` account could set its own role to 'superadmin' or
--      flip on manage_users, with nothing at the database layer to stop it.
--
-- This migration is the DB-layer counterpart to the requirePermission()
-- checks added to src/app/inventory/_actions/*.ts in the same pass — those
-- close the gap for traffic that goes through the app; this closes it for
-- anyone who skips the app and talks to PostgREST directly.
--
-- Run this in the Supabase SQL editor. Idempotent: safe to run more than
-- once. Does not touch journal_* tables (already covered) or any table not
-- listed below.

-- ─── 1. Permission-resolution helpers ──────────────────────────────────────────
--
-- Mirrors src/app/inventory/_lib/permissions.ts exactly: resolvePermissions()
-- starts from the role's default grid, then applies any per-user override
-- row in user_permissions. These are SECURITY DEFINER (so they work
-- regardless of user_profiles/user_permissions' own RLS below), STABLE, and
-- search_path-pinned. They return only booleans/text — no row data.

CREATE OR REPLACE FUNCTION public.get_caller_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_profiles WHERE user_id = auth.uid()),
    'staff'
  );
$$;

REVOKE ALL ON FUNCTION public.get_caller_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_caller_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT public.get_caller_role() IN ('admin', 'superadmin');
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

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
      WHEN 'staff' THEN permission_name IN ('stock_movement', 'quotations')
      ELSE false
    END AS value
  )
  SELECT COALESCE((SELECT enabled FROM override), (SELECT value FROM role_default));
$$;

REVOKE ALL ON FUNCTION public.has_permission(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission(TEXT) TO authenticated;

-- Convenience OR of the four stock-related permissions — slabs/marble_lots
-- UPDATE is reached by several different app actions (price/status edits,
-- warehouse moves, soft-delete/restore) that each require a different one
-- of these. This is the coarse DB-layer boundary; requirePermission() in
-- the app enforces exactly which one a given action needs.
CREATE OR REPLACE FUNCTION public.can_write_stock()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT public.has_permission('add_stock')
      OR public.has_permission('edit_stock')
      OR public.has_permission('delete_stock')
      OR public.has_permission('stock_movement');
$$;

REVOKE ALL ON FUNCTION public.can_write_stock() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_write_stock() TO authenticated;

-- ─── 2. slabs ───────────────────────────────────────────────────────────────
-- Public-facing pages (/collection, /inventory/slab/:id/view) read this
-- table via the service-role admin client, which bypasses RLS entirely —
-- so no `anon` policy is needed here for the public site to keep working.

ALTER TABLE public.slabs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select" ON public.slabs;
CREATE POLICY "auth_select" ON public.slabs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert" ON public.slabs;
CREATE POLICY "auth_insert" ON public.slabs
  FOR INSERT TO authenticated WITH CHECK (public.has_permission('add_stock'));

DROP POLICY IF EXISTS "auth_update" ON public.slabs;
CREATE POLICY "auth_update" ON public.slabs
  FOR UPDATE TO authenticated
  USING (public.can_write_stock())
  WITH CHECK (public.can_write_stock());

DROP POLICY IF EXISTS "auth_delete" ON public.slabs;
CREATE POLICY "auth_delete" ON public.slabs
  FOR DELETE TO authenticated USING (public.has_permission('delete_stock'));

-- ─── 3. marble_lots ───────────────────────────────────────────────────────────

ALTER TABLE public.marble_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select" ON public.marble_lots;
CREATE POLICY "auth_select" ON public.marble_lots
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert" ON public.marble_lots;
CREATE POLICY "auth_insert" ON public.marble_lots
  FOR INSERT TO authenticated WITH CHECK (public.has_permission('add_stock'));

DROP POLICY IF EXISTS "auth_update" ON public.marble_lots;
CREATE POLICY "auth_update" ON public.marble_lots
  FOR UPDATE TO authenticated
  USING (public.can_write_stock())
  WITH CHECK (public.can_write_stock());

DROP POLICY IF EXISTS "auth_delete" ON public.marble_lots;
CREATE POLICY "auth_delete" ON public.marble_lots
  FOR DELETE TO authenticated USING (public.has_permission('delete_stock'));

-- ─── 4. slab_images ───────────────────────────────────────────────────────────

ALTER TABLE public.slab_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select" ON public.slab_images;
CREATE POLICY "auth_select" ON public.slab_images
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert" ON public.slab_images;
CREATE POLICY "auth_insert" ON public.slab_images
  FOR INSERT TO authenticated WITH CHECK (public.has_permission('edit_stock'));

DROP POLICY IF EXISTS "auth_update" ON public.slab_images;
CREATE POLICY "auth_update" ON public.slab_images
  FOR UPDATE TO authenticated
  USING (public.has_permission('edit_stock'))
  WITH CHECK (public.has_permission('edit_stock'));

DROP POLICY IF EXISTS "auth_delete" ON public.slab_images;
CREATE POLICY "auth_delete" ON public.slab_images
  FOR DELETE TO authenticated USING (public.has_permission('edit_stock'));

-- ─── 5. slab_movements ────────────────────────────────────────────────────────
-- App inserts go through the admin client (bypasses RLS), but this policy
-- covers any future/direct authenticated write path.

ALTER TABLE public.slab_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select" ON public.slab_movements;
CREATE POLICY "auth_select" ON public.slab_movements
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert" ON public.slab_movements;
CREATE POLICY "auth_insert" ON public.slab_movements
  FOR INSERT TO authenticated WITH CHECK (public.has_permission('stock_movement'));

-- permanentDeleteSlab/permanentDeleteLot delete movement history rows via
-- the regular (non-admin) client as part of the cleanup cascade.
DROP POLICY IF EXISTS "auth_delete" ON public.slab_movements;
CREATE POLICY "auth_delete" ON public.slab_movements
  FOR DELETE TO authenticated USING (public.has_permission('delete_stock'));

-- ─── 6. Lookup tables: slab_statuses, marble_categories, thickness_options, warehouses
-- Read stays open (dropdowns need them everywhere); only `settings` can
-- manage the lists, matching addLookupOption/deleteLookupOption.

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['slab_statuses', 'marble_categories', 'thickness_options', 'warehouses']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS "auth_select" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "auth_select" ON public.%I FOR SELECT TO authenticated USING (true)', t
    );

    EXECUTE format('DROP POLICY IF EXISTS "auth_insert" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "auth_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_permission(''settings''))', t
    );

    EXECUTE format('DROP POLICY IF EXISTS "auth_update" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "auth_update" ON public.%I FOR UPDATE TO authenticated USING (public.has_permission(''settings'')) WITH CHECK (public.has_permission(''settings''))', t
    );
  END LOOP;
END $$;

-- ─── 7. transfer_requests / transfer_request_items ─────────────────────────────

ALTER TABLE public.transfer_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select" ON public.transfer_requests;
CREATE POLICY "auth_select" ON public.transfer_requests
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert" ON public.transfer_requests;
CREATE POLICY "auth_insert" ON public.transfer_requests
  FOR INSERT TO authenticated WITH CHECK (public.has_permission('stock_movement'));

DROP POLICY IF EXISTS "auth_update" ON public.transfer_requests;
CREATE POLICY "auth_update" ON public.transfer_requests
  FOR UPDATE TO authenticated
  USING (public.has_permission('stock_movement'))
  WITH CHECK (public.has_permission('stock_movement'));

ALTER TABLE public.transfer_request_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select" ON public.transfer_request_items;
CREATE POLICY "auth_select" ON public.transfer_request_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert" ON public.transfer_request_items;
CREATE POLICY "auth_insert" ON public.transfer_request_items
  FOR INSERT TO authenticated WITH CHECK (public.has_permission('stock_movement'));

DROP POLICY IF EXISTS "auth_update" ON public.transfer_request_items;
CREATE POLICY "auth_update" ON public.transfer_request_items
  FOR UPDATE TO authenticated
  USING (public.has_permission('stock_movement'))
  WITH CHECK (public.has_permission('stock_movement'));

-- permanentDeleteSlab/permanentDeleteLot delete transfer-item rows via the
-- regular (non-admin) client as part of the cleanup cascade.
DROP POLICY IF EXISTS "auth_delete" ON public.transfer_request_items;
CREATE POLICY "auth_delete" ON public.transfer_request_items
  FOR DELETE TO authenticated USING (public.has_permission('delete_stock'));

-- ─── 8. user_profiles / user_permissions / user_warehouse_access ───────────────
-- The critical fix: these three drive role and permission resolution
-- itself, so authenticated writes are denied outright (no INSERT/UPDATE/
-- DELETE policy at all — RLS defaults to deny). All writes already go
-- through the admin/service-role client in user-management.ts, gated by
-- requireManageUsers(); service_role bypasses RLS, so that keeps working.
-- Reads are scoped to the caller's own row — getCurrentUserProfile() only
-- ever needs "my role / my permissions / my warehouses", and the admin
-- Users list page reads via the admin client, not this policy.

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_own" ON public.user_profiles;
CREATE POLICY "auth_select_own" ON public.user_profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_own" ON public.user_permissions;
CREATE POLICY "auth_select_own" ON public.user_permissions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.user_warehouse_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_own" ON public.user_warehouse_access;
CREATE POLICY "auth_select_own" ON public.user_warehouse_access
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ─── 9. tasks / task_checklist_items ────────────────────────────────────────────
-- Read stays open — staff seeing each other's tasks is an intentional,
-- already-shipped product decision (see the 2026-08-12 Tasks/KRA
-- cross-visibility fix), not part of this review. Write mirrors the app's
-- own assertTaskOwnerOrAdmin(): admin, or the assignee, may write.

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select" ON public.tasks;
CREATE POLICY "auth_select" ON public.tasks
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert" ON public.tasks;
CREATE POLICY "auth_insert" ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update" ON public.tasks;
CREATE POLICY "auth_update" ON public.tasks
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR assigned_to::text = auth.uid()::text)
  WITH CHECK (public.is_admin() OR assigned_to::text = auth.uid()::text);

DROP POLICY IF EXISTS "auth_delete" ON public.tasks;
CREATE POLICY "auth_delete" ON public.tasks
  FOR DELETE TO authenticated
  USING (public.is_admin() OR assigned_to::text = auth.uid()::text);

ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select" ON public.task_checklist_items;
CREATE POLICY "auth_select" ON public.task_checklist_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_write" ON public.task_checklist_items;
CREATE POLICY "auth_write" ON public.task_checklist_items
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_checklist_items.task_id
        AND tasks.assigned_to::text = auth.uid()::text
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_checklist_items.task_id
        AND tasks.assigned_to::text = auth.uid()::text
    )
  );

-- ─── 10. kra_entries / kra_columns ──────────────────────────────────────────────
-- Already gated to admin/superadmin for every write via requireAdmin() in
-- kra.ts; read stays open (same intentional cross-visibility as tasks).

ALTER TABLE public.kra_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select" ON public.kra_entries;
CREATE POLICY "auth_select" ON public.kra_entries
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_write" ON public.kra_entries;
CREATE POLICY "auth_write" ON public.kra_entries
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE public.kra_columns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select" ON public.kra_columns;
CREATE POLICY "auth_select" ON public.kra_columns
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_write" ON public.kra_columns;
CREATE POLICY "auth_write" ON public.kra_columns
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── 11. client_leads ───────────────────────────────────────────────────────────
-- Previously had no app-layer auth check at all (fixed alongside this
-- migration) and no RLS restriction — any authenticated session could read
-- or write customer contact data regardless of the client_leads permission
-- toggle. `staff` defaults to client_leads: false.

ALTER TABLE public.client_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select" ON public.client_leads;
CREATE POLICY "auth_select" ON public.client_leads
  FOR SELECT TO authenticated USING (public.has_permission('client_leads'));

DROP POLICY IF EXISTS "auth_write" ON public.client_leads;
CREATE POLICY "auth_write" ON public.client_leads
  FOR ALL TO authenticated
  USING (public.has_permission('client_leads'))
  WITH CHECK (public.has_permission('client_leads'));

-- ─── 12. audit_logs ─────────────────────────────────────────────────────────────
-- Writes always go through the admin client (logAudit() in _lib/audit.ts),
-- so no authenticated write policy is created — RLS defaults to deny.
-- Read is restricted to admin/superadmin, matching the /inventory/audit
-- page's own role gate.

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select" ON public.audit_logs;
CREATE POLICY "auth_select" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_admin());
