-- Kolom jenis permainan pada hasil undian.
-- Worker juga menambahkan kolom ini otomatis jika belum ada.

ALTER TABLE draws ADD COLUMN game_id TEXT;
ALTER TABLE draws ADD COLUMN game_name TEXT;
