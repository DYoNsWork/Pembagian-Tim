-- Data peserta dan hasil pengundian di Cloudflare D1.

CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  jenis_kelamin TEXT NOT NULL,
  cabang TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS draws (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_count INTEGER NOT NULL,
  members_per_team INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS draw_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draw_id INTEGER NOT NULL,
  team_number INTEGER NOT NULL,
  team_name TEXT NOT NULL,
  nama TEXT NOT NULL,
  jenis_kelamin TEXT NOT NULL,
  cabang TEXT NOT NULL,
  FOREIGN KEY (draw_id) REFERENCES draws(id)
);

CREATE INDEX IF NOT EXISTS idx_draw_members_draw_id ON draw_members(draw_id);
