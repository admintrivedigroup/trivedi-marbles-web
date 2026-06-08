-- Add show_on_website flag to marble_lots so staff can choose which lots
-- appear on the public website collection page.

ALTER TABLE marble_lots
  ADD COLUMN IF NOT EXISTS show_on_website BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_marble_lots_show_on_website
  ON marble_lots (show_on_website)
  WHERE show_on_website = TRUE AND deleted_at IS NULL;
