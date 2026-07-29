-- Upgrades the journal/blog system into a full SEO publishing system.
-- Run this migration in the Supabase SQL editor.
--
-- Renames blog_posts -> journal_posts (same id/rows, resolves the old /blog vs
-- /journal naming split), adds slug + SEO + classification + workflow-status
-- fields, converts legacy paragraph content into the new JSON block schema,
-- and adds categories / related-products / related-articles / redirect-history
-- tables. Safe to re-run: every step is guarded so running this file twice is
-- a no-op the second time.
--
-- Does NOT delete any existing journal records, does NOT publish/unpublish
-- anything, and does NOT activate any redirects.

-- ─── 1. Rename table + existing columns ──────────────────────────────────────

ALTER TABLE IF EXISTS blog_posts RENAME TO journal_posts;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_posts' AND column_name = 'cover_image'
  ) THEN
    ALTER TABLE journal_posts RENAME COLUMN cover_image TO cover_image_url;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_posts' AND column_name = 'content'
      AND data_type = 'ARRAY'
  ) THEN
    ALTER TABLE journal_posts RENAME COLUMN content TO content_legacy_paragraphs;
  END IF;
END $$;

-- ─── 2. New columns (all nullable or safely defaulted) ───────────────────────

ALTER TABLE journal_posts
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS author_name TEXT NOT NULL DEFAULT 'Trivedi Marbles Editorial Team',
  -- References auth.users(id) directly (guaranteed PK) rather than
  -- user_profiles(user_id), since user_profiles' own DDL isn't checked into
  -- this repo and its uniqueness can't be verified from source alone.
  ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cover_image_alt TEXT,
  ADD COLUMN IF NOT EXISTS content JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS focus_keyword TEXT,
  ADD COLUMN IF NOT EXISTS secondary_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS meta_description TEXT,
  ADD COLUMN IF NOT EXISTS canonical_url TEXT,
  ADD COLUMN IF NOT EXISTS social_title TEXT,
  ADD COLUMN IF NOT EXISTS social_description TEXT,
  ADD COLUMN IF NOT EXISTS social_image_url TEXT,
  ADD COLUMN IF NOT EXISTS robots_index BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS robots_follow BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS target_audience JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS search_intent TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'journal_posts_status_check'
  ) THEN
    ALTER TABLE journal_posts
      ADD CONSTRAINT journal_posts_status_check
      CHECK (status IN ('draft', 'scheduled', 'published', 'archived'));
  END IF;
END $$;

-- ─── 3. Backfill: status/published_at from the old `published` boolean ──────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_posts' AND column_name = 'published'
  ) THEN
    UPDATE journal_posts
      SET status = CASE WHEN published THEN 'published' ELSE 'draft' END,
          published_at = CASE WHEN published THEN date::timestamptz ELSE NULL END;

    -- The pre-existing anon_select_published policy reads `published`
    -- directly, so it must be dropped before the column can be dropped.
    -- Step 8 recreates it (with the new published_at-based definition).
    DROP POLICY IF EXISTS "anon_select_published" ON journal_posts;

    ALTER TABLE journal_posts DROP COLUMN published;
  END IF;
END $$;

-- ─── 4. Backfill: slugs for existing rows (already-published, real slugs — ──
-- ───    not placeholders, since these rows are already live) ────────────────

CREATE OR REPLACE FUNCTION journal_slugify(input TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  result TEXT;
BEGIN
  result := lower(coalesce(input, ''));
  result := regexp_replace(result, '[^a-z0-9]+', '-', 'g');
  result := regexp_replace(result, '-+', '-', 'g');
  result := trim(both '-' from result);
  RETURN result;
END;
$$;

DO $$
DECLARE
  r RECORD;
  base_slug TEXT;
  candidate TEXT;
  suffix INT;
BEGIN
  FOR r IN SELECT id, title FROM journal_posts WHERE slug IS NULL ORDER BY created_at ASC LOOP
    base_slug := journal_slugify(r.title);
    IF base_slug = '' THEN
      base_slug := 'post';
    END IF;
    candidate := base_slug;
    suffix := 2;
    WHILE EXISTS (SELECT 1 FROM journal_posts WHERE slug = candidate) LOOP
      candidate := base_slug || '-' || suffix;
      suffix := suffix + 1;
    END LOOP;
    UPDATE journal_posts SET slug = candidate WHERE id = r.id;
  END LOOP;
END $$;

-- ─── 5. Backfill: convert legacy paragraph arrays into the new block schema ──

UPDATE journal_posts
SET content = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'type', 'paragraph',
      'data', jsonb_build_object('text', p)
    ) ORDER BY ord
  )
  FROM unnest(content_legacy_paragraphs) WITH ORDINALITY AS t(p, ord)
)
WHERE content = '[]'::jsonb
  AND content_legacy_paragraphs IS NOT NULL
  AND array_length(content_legacy_paragraphs, 1) > 0;

-- ─── 6. Indexes ───────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_posts_slug ON journal_posts (slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_posts_status ON journal_posts (status);
CREATE INDEX IF NOT EXISTS idx_journal_posts_published_at ON journal_posts (published_at);
CREATE INDEX IF NOT EXISTS idx_journal_posts_category ON journal_posts (category);
CREATE INDEX IF NOT EXISTS idx_journal_posts_is_featured ON journal_posts (is_featured) WHERE is_featured = TRUE;

-- ─── 7. updated_at trigger — rename to match the new table name ─────────────

CREATE OR REPLACE FUNCTION update_journal_posts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_blog_posts_updated_at') THEN
    DROP TRIGGER trg_blog_posts_updated_at ON journal_posts;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_journal_posts_updated_at ON journal_posts;
CREATE TRIGGER trg_journal_posts_updated_at
  BEFORE UPDATE ON journal_posts
  FOR EACH ROW EXECUTE FUNCTION update_journal_posts_updated_at();

DROP FUNCTION IF EXISTS update_blog_posts_updated_at();

-- ─── 8. RLS on journal_posts ──────────────────────────────────────────────────
-- Public users may only read published posts whose published_at has passed.
-- Write access stays "any authenticated user" at the RLS layer, matching this
-- project's established convention (no table in this repo encodes role-based
-- access in RLS — see client_leads, marble_lots, etc.). Admin/superadmin-only
-- enforcement for journal management is done in the server actions instead
-- (src/app/inventory/_lib/journal-auth.ts), the same way every other
-- role-gated admin feature (Archive, Audit Log) already works in this app.

ALTER TABLE journal_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_published" ON journal_posts;
CREATE POLICY "anon_select_published" ON journal_posts
  FOR SELECT TO anon
  USING (status = 'published' AND published_at IS NOT NULL AND published_at <= now());

DROP POLICY IF EXISTS "auth_select_all" ON journal_posts;
CREATE POLICY "auth_select_all" ON journal_posts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert" ON journal_posts;
CREATE POLICY "auth_insert" ON journal_posts FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update" ON journal_posts;
CREATE POLICY "auth_update" ON journal_posts FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_delete" ON journal_posts;
CREATE POLICY "auth_delete" ON journal_posts FOR DELETE TO authenticated USING (true);

-- ─── 9. journal_categories ────────────────────────────────────────────────────
-- Centralized, easy-to-modify-later category list (the 6 existing posts use
-- free-text categories from before this table existed and do not match this
-- taxonomy — they are intentionally left as-is; the admin UI flags the
-- mismatch for manual review rather than silently remapping them).

CREATE TABLE IF NOT EXISTS journal_categories (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL UNIQUE,
  slug       TEXT        NOT NULL UNIQUE,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE journal_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select" ON journal_categories;
CREATE POLICY "anon_select" ON journal_categories FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "auth_select" ON journal_categories;
CREATE POLICY "auth_select" ON journal_categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert" ON journal_categories;
CREATE POLICY "auth_insert" ON journal_categories FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update" ON journal_categories;
CREATE POLICY "auth_update" ON journal_categories FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_delete" ON journal_categories;
CREATE POLICY "auth_delete" ON journal_categories FOR DELETE TO authenticated USING (true);

INSERT INTO journal_categories (name, slug, sort_order) VALUES
  ('Ambaji Marble', 'ambaji-marble', 0),
  ('Marble Selection Guides', 'marble-selection-guides', 1),
  ('Applications & Design', 'applications-design', 2),
  ('Finishes & Processing', 'finishes-processing', 3),
  ('Care & Maintenance', 'care-maintenance', 4),
  ('Architecture & Heritage', 'architecture-heritage', 5),
  ('Company & Quarry Stories', 'company-quarry-stories', 6),
  ('Industry News', 'industry-news', 7)
ON CONFLICT (name) DO NOTHING;

-- ─── 10. journal_post_related_products (junction to marble_lots) ────────────

CREATE TABLE IF NOT EXISTS journal_post_related_products (
  journal_post_id UUID NOT NULL REFERENCES journal_posts(id) ON DELETE CASCADE,
  marble_lot_id   UUID NOT NULL REFERENCES marble_lots(id) ON DELETE CASCADE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (journal_post_id, marble_lot_id)
);

ALTER TABLE journal_post_related_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select" ON journal_post_related_products;
CREATE POLICY "anon_select" ON journal_post_related_products FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "auth_select" ON journal_post_related_products;
CREATE POLICY "auth_select" ON journal_post_related_products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert" ON journal_post_related_products;
CREATE POLICY "auth_insert" ON journal_post_related_products FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update" ON journal_post_related_products;
CREATE POLICY "auth_update" ON journal_post_related_products FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_delete" ON journal_post_related_products;
CREATE POLICY "auth_delete" ON journal_post_related_products FOR DELETE TO authenticated USING (true);

-- ─── 11. journal_post_related_articles (self-referencing junction) ──────────

CREATE TABLE IF NOT EXISTS journal_post_related_articles (
  journal_post_id         UUID NOT NULL REFERENCES journal_posts(id) ON DELETE CASCADE,
  related_journal_post_id UUID NOT NULL REFERENCES journal_posts(id) ON DELETE CASCADE,
  sort_order              INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (journal_post_id, related_journal_post_id),
  CONSTRAINT journal_post_related_articles_no_self_ref
    CHECK (journal_post_id <> related_journal_post_id)
);

ALTER TABLE journal_post_related_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select" ON journal_post_related_articles;
CREATE POLICY "anon_select" ON journal_post_related_articles FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "auth_select" ON journal_post_related_articles;
CREATE POLICY "auth_select" ON journal_post_related_articles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert" ON journal_post_related_articles;
CREATE POLICY "auth_insert" ON journal_post_related_articles FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update" ON journal_post_related_articles;
CREATE POLICY "auth_update" ON journal_post_related_articles FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_delete" ON journal_post_related_articles;
CREATE POLICY "auth_delete" ON journal_post_related_articles FOR DELETE TO authenticated USING (true);

-- ─── 12. journal_post_redirects (old-slug -> post history) ───────────────────
-- Infrastructure only. Left EMPTY in this phase — no redirects are activated
-- for the 6 existing posts. Populated going forward whenever an admin changes
-- the slug of an already-published post (see updateJournalPost).

CREATE TABLE IF NOT EXISTS journal_post_redirects (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_post_id UUID        NOT NULL REFERENCES journal_posts(id) ON DELETE CASCADE,
  old_slug        TEXT        NOT NULL UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE journal_post_redirects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select" ON journal_post_redirects;
CREATE POLICY "anon_select" ON journal_post_redirects FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "auth_select" ON journal_post_redirects;
CREATE POLICY "auth_select" ON journal_post_redirects FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert" ON journal_post_redirects;
CREATE POLICY "auth_insert" ON journal_post_redirects FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete" ON journal_post_redirects;
CREATE POLICY "auth_delete" ON journal_post_redirects FOR DELETE TO authenticated USING (true);
