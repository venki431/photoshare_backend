-- Migration: Add folder-level sharing support
-- Run: psql -d photoshare -f src/database/migrations/001_folder_sharing.sql

ALTER TABLE folders ADD COLUMN IF NOT EXISTS share_id TEXT UNIQUE;
ALTER TABLE folders ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_folders_share ON folders(share_id) WHERE share_id IS NOT NULL;
