-- Run this migration in the Supabase SQL editor to add the architect leads table.
-- Tracks leads sourced through architects (as opposed to client_leads, which
-- tracks clients who visited the factory directly).

CREATE TABLE IF NOT EXISTS architect_leads (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  architect_name         TEXT        NOT NULL,
  architect_number       TEXT,
  contractor_name        TEXT,
  contractor_number      TEXT,
  project_type           TEXT,
  -- Room / area material requirements
  facade                 TEXT,
  bedroom                TEXT,
  interior_wall_cladding TEXT,
  main_flooring          TEXT,
  kitchen_flooring       TEXT,
  kitchen_platform       TEXT,
  store_room             TEXT,
  table_tops             TEXT,
  staircase              TEXT,
  pillars                TEXT,
  bathroom               TEXT,
  car_parking_outside    TEXT,
  window_sill            TEXT,
  home_temple            TEXT,
  -- Other
  preference             TEXT,
  source_of_lead         TEXT,
  payment                TEXT,
  notes                  TEXT,
  quarry_mark            TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_architect_leads_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_architect_leads_updated_at
  BEFORE UPDATE ON architect_leads
  FOR EACH ROW EXECUTE FUNCTION update_architect_leads_updated_at();

-- Row-level security: all authenticated users can read/write
ALTER TABLE architect_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select" ON architect_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON architect_leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON architect_leads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete" ON architect_leads FOR DELETE TO authenticated USING (true);
