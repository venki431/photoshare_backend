-- PhotoShare Database Schema — PostgreSQL
-- Run this against your PostgreSQL database to create tables.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 TEXT UNIQUE NOT NULL,
  name                  TEXT NOT NULL DEFAULT 'Photographer',
  role                  TEXT NOT NULL DEFAULT 'photographer',
  date_of_birth         DATE,
  phone_number          TEXT,
  address               TEXT,
  avatar_url            TEXT,
  is_verified           BOOLEAN NOT NULL DEFAULT false,
  onboarding_completed  BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_phone_number_key UNIQUE (phone_number)
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─── OTP codes (short-lived, single-use) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  code        TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email);

-- ─── Folders ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_id    TEXT UNIQUE,
  shared_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_share ON folders(share_id) WHERE share_id IS NOT NULL;

CREATE TRIGGER trg_folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─── Projects ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id        UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  event_type       TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  image_count      INTEGER NOT NULL DEFAULT 0,
  selected_count   INTEGER NOT NULL DEFAULT 0,
  share_id         TEXT UNIQUE NOT NULL,
  password         TEXT NOT NULL DEFAULT '',
  cover_url        TEXT,
  client_name      TEXT NOT NULL DEFAULT '',
  client_email     TEXT NOT NULL DEFAULT '',
  client_mobile    TEXT NOT NULL DEFAULT '',
  notes            TEXT NOT NULL DEFAULT '',
  allow_comments   BOOLEAN NOT NULL DEFAULT true,
  selection_limit  INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user   ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_folder ON projects(folder_id);
CREATE INDEX IF NOT EXISTS idx_projects_share  ON projects(share_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- ─── Photos ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS photos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename       TEXT NOT NULL,
  cloudinary_id  TEXT,
  url            TEXT NOT NULL,
  thumb_url      TEXT NOT NULL,
  width          INTEGER,
  height         INTEGER,
  size           INTEGER,
  taken_at            TIMESTAMPTZ,
  selected_by_client  BOOLEAN NOT NULL DEFAULT false,
  original_file_name    TEXT,
  compressed_file_name  TEXT,
  storage_url           TEXT,
  thumbnail_url         TEXT,
  file_size_original    INTEGER,
  file_size_compressed  INTEGER,
  mime_type             TEXT,
  upload_status         TEXT DEFAULT 'completed',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photos_project ON photos(project_id);
CREATE INDEX IF NOT EXISTS idx_photos_selected ON photos(project_id, selected_by_client)
  WHERE selected_by_client = true;

-- ─── Selections ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS selections (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id     TEXT NOT NULL UNIQUE,
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── RPC functions for atomic counter updates ────────────────────────────────

CREATE OR REPLACE FUNCTION increment_image_count(project_id_input UUID)
RETURNS void AS $$
  UPDATE projects SET image_count = image_count + 1 WHERE id = project_id_input;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION decrement_image_count(project_id_input UUID)
RETURNS void AS $$
  UPDATE projects SET image_count = GREATEST(0, image_count - 1) WHERE id = project_id_input;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION decrement_image_count_by(project_id_input UUID, amount INTEGER)
RETURNS void AS $$
  UPDATE projects SET image_count = GREATEST(0, image_count - amount) WHERE id = project_id_input;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION increment_selected_count(project_id_input UUID)
RETURNS void AS $$
  UPDATE projects SET selected_count = selected_count + 1 WHERE id = project_id_input;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION decrement_selected_count(project_id_input UUID)
RETURNS void AS $$
  UPDATE projects SET selected_count = GREATEST(0, selected_count - 1) WHERE id = project_id_input;
$$ LANGUAGE sql;
