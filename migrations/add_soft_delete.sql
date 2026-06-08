-- Run this migration in Supabase SQL editor before deploying soft-delete code.
-- Adds deleted_at timestamps for non-destructive archiving of slabs and lots.

ALTER TABLE slabs
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE marble_lots
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Optional: speed up the common case of filtering active records.
CREATE INDEX IF NOT EXISTS idx_slabs_deleted_at ON slabs (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_marble_lots_deleted_at ON marble_lots (deleted_at) WHERE deleted_at IS NULL;
