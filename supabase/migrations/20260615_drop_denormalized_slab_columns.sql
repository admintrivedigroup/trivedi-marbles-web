-- Remove denormalized columns from slabs that are now read via the marble_lots join.
-- marble_name, category_id, and thickness_id are authoritative on marble_lots;
-- keeping them on slabs was wasted storage and required a cascade on every lot edit.
--
-- Prices (cost_price, selling_price, dealer_price) are intentionally kept on slabs
-- because individual slabs can have different prices via batch price updates.
--
-- Run this in the Supabase SQL editor or via `supabase db push`.

ALTER TABLE slabs
  DROP COLUMN IF EXISTS marble_name,
  DROP COLUMN IF EXISTS category_id,
  DROP COLUMN IF EXISTS thickness_id;
