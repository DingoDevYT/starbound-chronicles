-- ============================================================
--  STARBOUND CHRONICLES — Schema v7
--  Party position on the space map
--  Run AFTER schema-v6.sql. Safe to re-run.
-- ============================================================

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS current_sector  TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS current_system  TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS current_planet  TEXT;

-- Realtime UPDATE payloads for campaigns already work (no REPLICA IDENTITY
-- change needed — campaigns doesn't need old-row data for an UPDATE diff).
