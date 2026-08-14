-- Katalog jenis permainan yang bisa diubah lewat aplikasi.

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  members INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  label_prefix TEXT NOT NULL,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
