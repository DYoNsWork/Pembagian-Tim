-- Komposisi grup diset di definisi permainan.

ALTER TABLE games ADD COLUMN gender_mode TEXT NOT NULL DEFAULT 'campur';
