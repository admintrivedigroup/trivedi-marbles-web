-- Adds a deep-link target to notifications so clicking one in the bell
-- menu navigates straight to the relevant page (a low-stock category's lot
-- list, the lot a status change happened in, the transfers page, or a
-- reserved slab) instead of just being read-only text.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS link TEXT;
