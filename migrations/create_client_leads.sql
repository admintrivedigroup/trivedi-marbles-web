-- Run this migration in the Supabase SQL editor to add the client leads table.
-- Tracks potential customer leads with all relevant project details.

CREATE TABLE IF NOT EXISTS client_leads (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name           TEXT        NOT NULL,
  contact_no            TEXT,
  requirement_sqft      TEXT,
  material_category     TEXT,
  converted             BOOLEAN     NOT NULL DEFAULT FALSE,
  first_visit_date      DATE,
  architect_name        TEXT,
  architect_contact     TEXT,
  contractor_name       TEXT,
  contractor_contact    TEXT,
  project_type          TEXT,
  -- Room / area material requirements
  facade                TEXT,
  bedroom               TEXT,
  interior_wall_cladding TEXT,
  main_flooring         TEXT,
  kitchen_flooring      TEXT,
  store_room            TEXT,
  bathroom              TEXT,
  car_parking_outside   TEXT,
  window_sill           TEXT,
  home_temple           TEXT,
  -- Other
  preference            TEXT,
  paid_from             TEXT,
  source_of_lead        TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_client_leads_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_client_leads_updated_at
  BEFORE UPDATE ON client_leads
  FOR EACH ROW EXECUTE FUNCTION update_client_leads_updated_at();

-- Row-level security: all authenticated users can read/write
ALTER TABLE client_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select" ON client_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON client_leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON client_leads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete" ON client_leads FOR DELETE TO authenticated USING (true);
