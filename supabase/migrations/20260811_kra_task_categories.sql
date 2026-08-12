-- Links KRA columns to tasks so a "task category" column's Points/Reverse Points
-- can be auto-computed from task completion instead of typed in by hand.
--
-- calc_type = 'tasks'   -> column's score is derived from tasks tagged with it
-- is_bonus              -> column sits outside the 100% weightage cap (e.g. "Over & Beyond"),
--                          its score adds on top rather than competing for a share
-- is_compulsory         -> column cannot be deleted from the KRA manager UI

ALTER TABLE kra_columns
  ADD COLUMN IF NOT EXISTS calc_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (calc_type IN ('manual', 'tasks')),
  ADD COLUMN IF NOT EXISTS is_bonus BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_compulsory BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS kra_column_id UUID REFERENCES kra_columns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_kra_column_id ON tasks(kra_column_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_due ON tasks(assigned_to, due_date);
