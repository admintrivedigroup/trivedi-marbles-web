-- Drops the visualizer_jobs / visualizer_results tables and the
-- visualizer-uploads storage bucket. These backed the customer-facing
-- /visualizer route and its Python microservice, both removed in favor
-- of the Mask2Former-based showroom visualizer at /inventory/visualize,
-- which needs none of this (Replicate calls happen directly, no job queue).

DROP TRIGGER IF EXISTS trg_visualizer_jobs_updated_at ON visualizer_jobs;
DROP FUNCTION IF EXISTS update_visualizer_jobs_updated_at();

DROP POLICY IF EXISTS "own_results_select" ON visualizer_results;
DROP POLICY IF EXISTS "own_jobs_select"    ON visualizer_jobs;

DROP TABLE IF EXISTS visualizer_results;
DROP TABLE IF EXISTS visualizer_jobs;

-- ─── Storage bucket ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "visualizer_uploads_own_delete" ON storage.objects;
DROP POLICY IF EXISTS "visualizer_uploads_own_insert" ON storage.objects;
DROP POLICY IF EXISTS "visualizer_uploads_own_select" ON storage.objects;

DELETE FROM storage.objects WHERE bucket_id = 'visualizer-uploads';
DELETE FROM storage.buckets WHERE id = 'visualizer-uploads';
