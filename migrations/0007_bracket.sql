-- Grup per sesi pada definisi permainan, plus bagan sistem gugur pada hasil undian.

ALTER TABLE games ADD COLUMN groups_per_session INTEGER NOT NULL DEFAULT 2;
ALTER TABLE draws ADD COLUMN groups_per_session INTEGER;
ALTER TABLE draws ADD COLUMN bracket TEXT;
