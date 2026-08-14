-- Jumlah grup tersimpan pada definisi permainan.
-- Katalog bawaan dikosongkan; permainan diisi sendiri lewat aplikasi.

ALTER TABLE games ADD COLUMN team_count INTEGER NOT NULL DEFAULT 1;
DELETE FROM games WHERE is_builtin = 1;
