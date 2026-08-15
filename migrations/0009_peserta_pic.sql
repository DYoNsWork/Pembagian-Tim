-- Nomor peserta, exclude dari undian, dan 2 PIC per permainan.

ALTER TABLE participants ADD COLUMN nomor TEXT NOT NULL DEFAULT '';
ALTER TABLE participants ADD COLUMN excluded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE games ADD COLUMN pic1_id INTEGER;
ALTER TABLE games ADD COLUMN pic2_id INTEGER;
