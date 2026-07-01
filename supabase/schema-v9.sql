-- ============================================================
--  STARBOUND CHRONICLES — Schema v9
--  Destination tracking for the space map's route/ETA display
--  Run AFTER schema-v7.sql. Safe to re-run.
-- ============================================================

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS destination_sector TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS destination_system TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS destination_planet TEXT;
