-- Run this migration in the Supabase SQL editor to add tables + storage bucket
-- for the new, isolated Room/Product Visualizer feature (src/app/visualizer).
-- Purely additive: no existing tables, columns, or policies are touched.

CREATE TABLE IF NOT EXISTS visualizer_jobs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        REFERENCES auth.users(id),
  room_photo_path  TEXT        NOT NULL,
  product_ref      JSONB,
  mode             TEXT        NOT NULL DEFAULT 'local' CHECK (mode IN ('local', 'replicate')),
  status           TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed')),
  error            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visualizer_results (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID        NOT NULL REFERENCES visualizer_jobs(id) ON DELETE CASCADE,
  result_path TEXT        NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_visualizer_jobs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_visualizer_jobs_updated_at
  BEFORE UPDATE ON visualizer_jobs
  FOR EACH ROW EXECUTE FUNCTION update_visualizer_jobs_updated_at();

-- Row-level security: users only see their own jobs/results.
-- All writes happen server-side via the service-role client (src/lib/supabase/admin.ts)
-- after the API route has verified the caller's session, so no INSERT/UPDATE policy
-- is needed for the anon/authenticated roles here.
ALTER TABLE visualizer_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE visualizer_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_jobs_select" ON visualizer_jobs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "own_results_select" ON visualizer_results
  FOR SELECT TO authenticated
  USING (job_id IN (SELECT id FROM visualizer_jobs WHERE user_id = auth.uid()));

-- ─── Storage bucket ───────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('visualizer-uploads', 'visualizer-uploads', FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "visualizer_uploads_own_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'visualizer-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "visualizer_uploads_own_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'visualizer-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "visualizer_uploads_own_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'visualizer-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
