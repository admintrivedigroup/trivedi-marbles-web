-- Closes the RLS authorization gap on the journal tables: write access (and,
-- for staff, draft/scheduled/archived read access) was previously governed
-- only by the application layer (requireJournalManager()/assertJournalManager()
-- in src/app/inventory/_lib/journal-auth.ts), matching this repo's blanket
-- "any authenticated user" RLS convention used everywhere else. This migration
-- makes the journal tables specifically role-aware at the database layer,
-- per an explicit security review — it does NOT touch any other table's RLS.
--
-- Run this in the Supabase SQL editor AFTER migrations/upgrade_journal_posts.sql.
-- Idempotent: safe to run more than once.
--
-- Does not activate /journal navigation, sitemap inclusion, canonical
-- cutover, or redirects — this is a database-security-only change.

-- ─── 1. Role lookup helper ────────────────────────────────────────────────────
--
-- Introspected directly against the live database (user_profiles has no
-- checked-in CREATE TABLE in this repo): user_profiles has its OWN `id` PK,
-- a separate `user_id` column that is the FK to auth.users(id), and a plain
-- `role` TEXT column. Confirmed real values in use: 'staff', 'superadmin'
-- (the app's Role type — src/app/inventory/_lib/permissions.ts — also
-- includes 'admin', same casing). So the correct join is:
--   user_profiles.user_id = auth.uid()
--
-- This is a SECURITY DEFINER function (not SECURITY INVOKER) so it works
-- regardless of user_profiles' own RLS configuration (unknown/unverified —
-- pg_policies isn't introspectable via the PostgREST API this project uses).
-- search_path is pinned to prevent search_path-hijacking, the table
-- reference is schema-qualified, it is STABLE (safe to use in RLS USING
-- clauses / query planning), and it returns ONLY a boolean — no row data.
-- Calling it from another table's RLS policy is not recursive: it queries
-- user_profiles only, and user_profiles' policies (whatever they are) do
-- not reference the journal tables.

CREATE OR REPLACE FUNCTION public.is_journal_manager()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('admin', 'superadmin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_journal_manager() FROM PUBLIC;
-- Granted to anon as well as authenticated: the junction-table policies
-- below evaluate `is_journal_manager() OR ...` for both roles combined, so
-- anon must be permitted to call it (it simply evaluates to false for anon,
-- since auth.uid() is null with no session — but without EXECUTE granted,
-- Postgres would raise a permission error instead of evaluating to false).
GRANT EXECUTE ON FUNCTION public.is_journal_manager() TO authenticated, anon;

-- A second helper expressing "is this specific journal post publicly
-- readable right now" — used both directly on journal_posts and, via
-- EXISTS, to keep the junction tables from leaking which draft/scheduled/
-- archived posts exist.
CREATE OR REPLACE FUNCTION public.is_journal_post_publicly_readable(post_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.journal_posts jp
    WHERE jp.id = post_id
      AND jp.status = 'published'
      AND jp.published_at IS NOT NULL
      AND jp.published_at <= now()
  );
$$;

REVOKE ALL ON FUNCTION public.is_journal_post_publicly_readable(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_journal_post_publicly_readable(UUID) TO anon, authenticated;

-- ─── 2. journal_posts ─────────────────────────────────────────────────────────
-- anon:          read published + non-future posts only. No writes.
-- staff:         same read access as anon (NOT all statuses); no writes.
-- admin/superadmin: read everything; create/update; delete (app supports
--   real deletion via a separate, explicitly-confirmed action — see
--   deleteJournalPost in src/app/inventory/_actions/journal.ts).
-- robots_index/robots_follow are metadata-only fields and intentionally
-- play no part in these conditions (per requirement).

DROP POLICY IF EXISTS "anon_select_published" ON journal_posts;
CREATE POLICY "anon_select_published" ON journal_posts
  FOR SELECT TO anon
  USING (status = 'published' AND published_at IS NOT NULL AND published_at <= now());

DROP POLICY IF EXISTS "auth_select_all" ON journal_posts;
DROP POLICY IF EXISTS "auth_select_published_or_manager" ON journal_posts;
CREATE POLICY "auth_select_published_or_manager" ON journal_posts
  FOR SELECT TO authenticated
  USING (
    public.is_journal_manager()
    OR (status = 'published' AND published_at IS NOT NULL AND published_at <= now())
  );

DROP POLICY IF EXISTS "auth_insert" ON journal_posts;
CREATE POLICY "auth_insert" ON journal_posts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_journal_manager());

DROP POLICY IF EXISTS "auth_update" ON journal_posts;
CREATE POLICY "auth_update" ON journal_posts
  FOR UPDATE TO authenticated
  USING (public.is_journal_manager())
  WITH CHECK (public.is_journal_manager());

DROP POLICY IF EXISTS "auth_delete" ON journal_posts;
CREATE POLICY "auth_delete" ON journal_posts
  FOR DELETE TO authenticated
  USING (public.is_journal_manager());

-- ─── 3. journal_categories ────────────────────────────────────────────────────
-- Read stays open (category names/slugs are not sensitive and the app's
-- category dropdown needs them); only admin/superadmin can manage the list.

DROP POLICY IF EXISTS "anon_select" ON journal_categories;
CREATE POLICY "anon_select" ON journal_categories FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "auth_select" ON journal_categories;
CREATE POLICY "auth_select" ON journal_categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert" ON journal_categories;
CREATE POLICY "auth_insert" ON journal_categories
  FOR INSERT TO authenticated WITH CHECK (public.is_journal_manager());

DROP POLICY IF EXISTS "auth_update" ON journal_categories;
CREATE POLICY "auth_update" ON journal_categories
  FOR UPDATE TO authenticated
  USING (public.is_journal_manager())
  WITH CHECK (public.is_journal_manager());

DROP POLICY IF EXISTS "auth_delete" ON journal_categories;
CREATE POLICY "auth_delete" ON journal_categories
  FOR DELETE TO authenticated USING (public.is_journal_manager());

-- ─── 4. journal_post_related_products ────────────────────────────────────────
-- Read is limited to rows whose owning post is itself publicly readable (or
-- the caller is a journal manager) — otherwise the mere existence of a
-- relation row would leak that an unpublished post exists. marble_lot_id
-- references marble_lots, which is out of scope here (unrelated table).

DROP POLICY IF EXISTS "anon_select" ON journal_post_related_products;
DROP POLICY IF EXISTS "auth_select" ON journal_post_related_products;
DROP POLICY IF EXISTS "select_no_draft_leak" ON journal_post_related_products;
CREATE POLICY "select_no_draft_leak" ON journal_post_related_products
  FOR SELECT TO anon, authenticated
  USING (
    public.is_journal_manager()
    OR public.is_journal_post_publicly_readable(journal_post_id)
  );

DROP POLICY IF EXISTS "auth_insert" ON journal_post_related_products;
CREATE POLICY "auth_insert" ON journal_post_related_products
  FOR INSERT TO authenticated WITH CHECK (public.is_journal_manager());

DROP POLICY IF EXISTS "auth_update" ON journal_post_related_products;
CREATE POLICY "auth_update" ON journal_post_related_products
  FOR UPDATE TO authenticated
  USING (public.is_journal_manager())
  WITH CHECK (public.is_journal_manager());

DROP POLICY IF EXISTS "auth_delete" ON journal_post_related_products;
CREATE POLICY "auth_delete" ON journal_post_related_products
  FOR DELETE TO authenticated USING (public.is_journal_manager());

-- ─── 5. journal_post_related_articles ────────────────────────────────────────
-- Self-referencing junction: BOTH sides must be publicly readable (or the
-- caller must be a manager) before the relation row is visible, so a
-- relation can't be used to infer the existence of either an unpublished
-- source or an unpublished target post.

DROP POLICY IF EXISTS "anon_select" ON journal_post_related_articles;
DROP POLICY IF EXISTS "auth_select" ON journal_post_related_articles;
DROP POLICY IF EXISTS "select_no_draft_leak" ON journal_post_related_articles;
CREATE POLICY "select_no_draft_leak" ON journal_post_related_articles
  FOR SELECT TO anon, authenticated
  USING (
    public.is_journal_manager()
    OR (
      public.is_journal_post_publicly_readable(journal_post_id)
      AND public.is_journal_post_publicly_readable(related_journal_post_id)
    )
  );

DROP POLICY IF EXISTS "auth_insert" ON journal_post_related_articles;
CREATE POLICY "auth_insert" ON journal_post_related_articles
  FOR INSERT TO authenticated WITH CHECK (public.is_journal_manager());

DROP POLICY IF EXISTS "auth_update" ON journal_post_related_articles;
CREATE POLICY "auth_update" ON journal_post_related_articles
  FOR UPDATE TO authenticated
  USING (public.is_journal_manager())
  WITH CHECK (public.is_journal_manager());

DROP POLICY IF EXISTS "auth_delete" ON journal_post_related_articles;
CREATE POLICY "auth_delete" ON journal_post_related_articles
  FOR DELETE TO authenticated USING (public.is_journal_manager());

-- ─── 6. journal_post_redirects ───────────────────────────────────────────────
-- Read stays open: a redirect row is only ever created for a post that WAS
-- published at the time of the slug change (see updateJournalPost), and the
-- row itself contains only an old-slug string + a post id — no title,
-- content, or draft-status information — so it doesn't need the same
-- leak-prevention join as the two relation tables above. The public
-- /journal/[slug] route (src/lib/journal/redirects.ts) needs anon read
-- access to resolve stale links. Only admin/superadmin can create or
-- remove redirect-history entries.

DROP POLICY IF EXISTS "anon_select" ON journal_post_redirects;
CREATE POLICY "anon_select" ON journal_post_redirects FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "auth_select" ON journal_post_redirects;
CREATE POLICY "auth_select" ON journal_post_redirects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert" ON journal_post_redirects;
CREATE POLICY "auth_insert" ON journal_post_redirects
  FOR INSERT TO authenticated WITH CHECK (public.is_journal_manager());

DROP POLICY IF EXISTS "auth_delete" ON journal_post_redirects;
CREATE POLICY "auth_delete" ON journal_post_redirects
  FOR DELETE TO authenticated USING (public.is_journal_manager());

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION — run each block separately in the SQL editor. Every block is
-- wrapped in BEGIN/ROLLBACK so nothing is ever actually written, and uses
-- Supabase's standard RLS-simulation idiom (set request.jwt.claims + SET
-- LOCAL ROLE) rather than real client requests. Substitute real user ids
-- for <STAFF_USER_ID> / <ADMIN_OR_SUPERADMIN_USER_ID> — from this project's
-- current user_profiles data, a real staff id is 246c88c8-ed7c-4642-b94d-
-- 923cb7308197 and a real superadmin id is 2d815a67-73f6-4826-8ddf-
-- 85d69d76ebbe. (There is currently no distinct 'admin'-role user in this
-- database to substitute for an admin-specific run — the policies treat
-- 'admin' and 'superadmin' identically, so the superadmin run also proves
-- the admin case; create a temporary admin-role profile to test the literal
-- 'admin' string separately if desired.)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Anonymous cannot write.
begin;
  set local role anon;
  -- Expect: 0 rows affected / permission denied.
  update journal_posts set title = 'hacked' where true;
rollback;

-- 2. Staff cannot write.
begin;
  select set_config('request.jwt.claims', json_build_object('sub', '<STAFF_USER_ID>', 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- Expect: 0 rows affected.
  update journal_posts set title = 'hacked-by-staff' where true;
rollback;

-- 3. Staff cannot read drafts.
begin;
  select set_config('request.jwt.claims', json_build_object('sub', '<STAFF_USER_ID>', 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- Expect: 0 rows (assuming at least one draft/scheduled/archived post exists).
  select count(*) from journal_posts where status <> 'published';
rollback;

-- 4/5. Admin (or superadmin) can create and edit.
begin;
  select set_config('request.jwt.claims', json_build_object('sub', '<ADMIN_OR_SUPERADMIN_USER_ID>', 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- Expect: insert succeeds, returns the new row.
  with new_post as (
    insert into journal_posts (title, category, excerpt, cover_image_url, status)
    values ('RLS test post', 'Industry News', 'test', '', 'draft')
    returning id
  )
  update journal_posts set title = 'RLS test post (edited)'
  where id in (select id from new_post)
  returning id, title;
rollback;

-- 6. Public can read valid published articles.
begin;
  set local role anon;
  -- Expect: rows returned for genuinely published, non-future posts.
  select id, slug, status, published_at
  from journal_posts
  where status = 'published' and published_at <= now();
rollback;

-- 7. Public cannot read future scheduled articles.
begin;
  select set_config('request.jwt.claims', json_build_object('sub', '<ADMIN_OR_SUPERADMIN_USER_ID>', 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into journal_posts (title, category, excerpt, cover_image_url, status, scheduled_at)
  values ('Future scheduled test', 'Industry News', 'test', '', 'scheduled', now() + interval '1 day');

  reset role;
  select set_config('request.jwt.claims', '', true);
  set local role anon;
  -- Expect: 0 rows for this title.
  select count(*) from journal_posts where title = 'Future scheduled test';
rollback;

-- 8. Public cannot read archived articles.
begin;
  select set_config('request.jwt.claims', json_build_object('sub', '<ADMIN_OR_SUPERADMIN_USER_ID>', 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into journal_posts (title, category, excerpt, cover_image_url, status, published_at)
  values ('Archived test', 'Industry News', 'test', '', 'archived', now() - interval '1 day');

  reset role;
  select set_config('request.jwt.claims', '', true);
  set local role anon;
  -- Expect: 0 rows for this title.
  select count(*) from journal_posts where title = 'Archived test';
rollback;

-- 9. Related tables cannot leak draft-post data.
begin;
  select set_config('request.jwt.claims', json_build_object('sub', '<ADMIN_OR_SUPERADMIN_USER_ID>', 'role', 'authenticated')::text, true);
  set local role authenticated;

  with draft as (
    insert into journal_posts (title, category, excerpt, cover_image_url, status)
    values ('Draft leak test', 'Industry News', 'test', '', 'draft')
    returning id
  ), published as (
    select id from journal_posts where status = 'published' and published_at <= now() limit 1
  )
  insert into journal_post_related_articles (journal_post_id, related_journal_post_id)
  select published.id, draft.id from published, draft;

  reset role;
  select set_config('request.jwt.claims', '', true);
  set local role anon;
  -- Expect: 0 rows — the relation exists, but its draft side isn't readable.
  select jpra.*
  from journal_post_related_articles jpra
  join journal_posts d on d.id = jpra.related_journal_post_id
  where d.title = 'Draft leak test';
rollback;
