-- Satu hasil acak per jenis permainan.

CREATE UNIQUE INDEX IF NOT EXISTS idx_draws_game_id ON draws(game_id);
