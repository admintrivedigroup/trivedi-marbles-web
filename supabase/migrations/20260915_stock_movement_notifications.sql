-- Stock Movement Alerts: a per-user opt-in for notifications on slab status
-- changes (Available/Reserved/Sold) and warehouse transfers, alongside the
-- existing low-stock alerts (see 20260820_low_stock_notifications.sql).
--
-- notifications.type has no CHECK constraint (plain TEXT), so no schema
-- change is needed there — this just adds the opt-in column. Writes go
-- through the admin client (see src/app/inventory/_lib/stock-movement-notify.ts
-- and _actions/notifications.ts), same write model as low_stock_alerts_enabled.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS stock_movement_alerts_enabled BOOLEAN NOT NULL DEFAULT FALSE;
