-- Slab photo auto-crop: new uploads store the tightly-cropped slab image in
-- the existing image_url/public_id columns (so every existing thumbnail,
-- grid, and the visualizer texture pipeline picks it up for free) and keep
-- the original uncropped photo in these new columns for the Compare toggle.
ALTER TABLE slab_images
  ADD COLUMN IF NOT EXISTS original_url TEXT,
  ADD COLUMN IF NOT EXISTS original_public_id TEXT,
  ADD COLUMN IF NOT EXISTS crop_box JSONB;
