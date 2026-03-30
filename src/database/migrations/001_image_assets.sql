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

-- ============================================================================
-- View: selected_photos_with_originals
-- Photographer can query this to get selected images with original file names.
-- ============================================================================

CREATE OR REPLACE VIEW selected_photos_with_originals AS
SELECT
  sp.id           AS selection_entry_id,
  sp.selection_id,
  sp.photo_id,
  sp.comment,
  p.original_file_name,
  p.compressed_file_name,
  p.storage_url,
  p.thumbnail_url,
  p.file_size_original,
  p.file_size_compressed,
  p.mime_type,
  p.width,
  p.height,
  p.created_at    AS uploaded_at,
  s.share_id,
  s.project_id,
  s.status        AS selection_status,
  s.submitted_at
FROM selected_photos sp
JOIN photos p ON p.id = sp.photo_id
JOIN selections s ON s.id = sp.selection_id;
