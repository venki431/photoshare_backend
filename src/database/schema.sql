-- PhotoShare Database Schema — PostgreSQL
-- Run this against your PostgreSQL database to create tables.

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                    TEXT PRIMARY KEY,
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
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  code        TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email);

-- ─── Projects ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_projects_share  ON projects(share_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- ─── Photos ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS photos (
  id             TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename       TEXT NOT NULL,
  cloudinary_id  TEXT,
  url            TEXT NOT NULL,
  thumb_url      TEXT NOT NULL,
  width          INTEGER,
  height         INTEGER,
  size           INTEGER,
  taken_at       TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photos_project ON photos(project_id);

-- ─── Selections ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS selections (
  id           TEXT PRIMARY KEY,
  share_id     TEXT NOT NULL UNIQUE,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Selected photos (per selection) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS selected_photos (
  id           TEXT PRIMARY KEY,
  selection_id TEXT NOT NULL REFERENCES selections(id) ON DELETE CASCADE,
  photo_id     TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  comment      TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(selection_id, photo_id)
);

CREATE INDEX IF NOT EXISTS idx_selected_photos_sel ON selected_photos(selection_id);

-- ─── RPC functions for atomic counter updates ────────────────────────────────

CREATE OR REPLACE FUNCTION increment_image_count(project_id_input TEXT)
RETURNS void AS $$
  UPDATE projects SET image_count = image_count + 1 WHERE id = project_id_input;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION decrement_image_count(project_id_input TEXT)
RETURNS void AS $$
  UPDATE projects SET image_count = GREATEST(0, image_count - 1) WHERE id = project_id_input;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION decrement_image_count_by(project_id_input TEXT, amount INTEGER)
RETURNS void AS $$
  UPDATE projects SET image_count = GREATEST(0, image_count - amount) WHERE id = project_id_input;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION increment_selected_count(project_id_input TEXT)
RETURNS void AS $$
  UPDATE projects SET selected_count = selected_count + 1 WHERE id = project_id_input;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION decrement_selected_count(project_id_input TEXT)
RETURNS void AS $$
  UPDATE projects SET selected_count = GREATEST(0, selected_count - 1) WHERE id = project_id_input;
$$ LANGUAGE sql;
