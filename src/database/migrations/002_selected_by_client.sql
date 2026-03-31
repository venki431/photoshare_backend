-- ============================================================================
-- Migration: Replace selected_photos table with selected_by_client flag
-- ============================================================================

-- Add selected_by_client flag to photos table
ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS selected_by_client BOOLEAN NOT NULL DEFAULT false;

-- Index for quick lookups of selected photos per project
CREATE INDEX IF NOT EXISTS idx_photos_selected
  ON photos (project_id, selected_by_client)
  WHERE selected_by_client = true;

-- Migrate existing data: mark photos that were in selected_photos as selected
UPDATE photos
SET selected_by_client = true
WHERE id IN (SELECT photo_id FROM selected_photos);

-- Drop the view that depends on selected_photos
DROP VIEW IF EXISTS selected_photos_with_originals;

-- Drop the selected_photos table
DROP TABLE IF EXISTS selected_photos;
