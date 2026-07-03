-- ============================================================
--  STARBOUND CHRONICLES — Schema v15
--  Adds an in-game day counter to campaigns so the GM can mark
--  that a day (or several) has passed, visible live to all players.
--
--  Run once. Safe to re-run.
-- ============================================================

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS day_num INTEGER DEFAULT 1;
