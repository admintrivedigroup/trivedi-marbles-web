-- Low-stock notification infrastructure: a global threshold setting, a
-- per-user opt-in, a cooldown table so a run of writes while a category
-- stays low doesn't re-notify everyone on every single write, and the
-- notifications themselves.
--
-- Writes go through the admin/service-role client (see
-- src/app/inventory/_lib/low-stock.ts and _actions/notifications.ts),
-- matching the existing write model for user_profiles — no authenticated
-- INSERT/UPDATE policies are added except where the client reads its own
-- notifications directly.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS low_stock_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Singleton row holding the app-wide low-stock threshold: an "Available"
-- slab count per (category, warehouse) at or below which an alert fires.
CREATE TABLE IF NOT EXISTS inventory_settings (
  id                  SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO inventory_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE inventory_settings ENABLE ROW LEVEL SECURITY;
-- No authenticated policies: read via getInventorySettings() and written
-- via updateLowStockThreshold(), both server-only through the admin client.

-- Tracks the last time each (category, warehouse) pair was notified as
-- low, so it only re-notifies after LOW_STOCK_COOLDOWN_HOURS has passed
-- (see low-stock.ts) instead of on every subsequent write.
CREATE TABLE IF NOT EXISTS low_stock_state (
  category_id      UUID NOT NULL REFERENCES marble_categories(id) ON DELETE CASCADE,
  warehouse_id     UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  last_notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (category_id, warehouse_id)
);

ALTER TABLE low_stock_state ENABLE ROW LEVEL SECURITY;
-- No authenticated policies: internal bookkeeping only, read/written via
-- the admin client from low-stock.ts.

CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT,
  category_id  UUID REFERENCES marble_categories(id) ON DELETE SET NULL,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Recipients read their own notifications directly for the bell dropdown.
-- Inserting and marking-as-read still go through the admin client (scoped
-- to the caller's own user_id in code), so no authenticated INSERT/UPDATE
-- policy is added — mirrors the user_profiles write model.
DROP POLICY IF EXISTS "auth_select_own" ON notifications;
CREATE POLICY "auth_select_own" ON notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
