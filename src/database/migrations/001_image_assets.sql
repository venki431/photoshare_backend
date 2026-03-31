-- ============================================================================
-- Migration: image_assets metadata table
-- Tracks both original and compressed file metadata for every uploaded photo.
-- ============================================================================

-- Add metadata columns to existing photos table
ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS original_file_name  TEXT,
  ADD COLUMN IF NOT EXISTS compressed_file_name TEXT,
  ADD COLUMN IF NOT EXISTS storage_url          TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url        TEXT,
  ADD COLUMN IF NOT EXISTS file_size_original   BIGINT,
  ADD COLUMN IF NOT EXISTS file_size_compressed BIGINT,
  ADD COLUMN IF NOT EXISTS mime_type            TEXT DEFAULT 'image/jpeg',
  ADD COLUMN IF NOT EXISTS upload_status        TEXT DEFAULT 'uploaded'
    CHECK (upload_status IN ('pending', 'uploaded', 'failed'));

-- Backfill existing rows
UPDATE photos
SET
  original_file_name  = COALESCE(original_file_name, filename),
  compressed_file_name = COALESCE(compressed_file_name, filename),
  storage_url         = COALESCE(storage_url, url),
  thumbnail_url       = COALESCE(thumbnail_url, thumb_url),
  file_size_original  = COALESCE(file_size_original, size),
  file_size_compressed = COALESCE(file_size_compressed, size),
  upload_status       = 'uploaded'
WHERE original_file_name IS NULL;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_photos_project_status
  ON photos (project_id, upload_status);

