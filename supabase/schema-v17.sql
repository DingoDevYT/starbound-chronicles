-- ============================================================
--  STARBOUND CHRONICLES — Schema v17
--  - campaign_ships: track PP actually spent this round + a daily
--    fuel consumption rate (so days-remaining is a live number, not
--    something the GM has to calculate by hand).
--  - initiative_tracker: a per-row "revealed" flag so the GM can
--    choose to show a combatant's stats to players (players always
--    see their own row; everything else is hidden unless revealed).
--
--  Run once. Safe to re-run.
-- ============================================================

ALTER TABLE campaign_ships
  ADD COLUMN IF NOT EXISTS pp_current      INTEGER DEFAULT 6,
  ADD COLUMN IF NOT EXISTS fuel_daily_rate INTEGER DEFAULT 10;

ALTER TABLE initiative_tracker
  ADD COLUMN IF NOT EXISTS revealed BOOLEAN DEFAULT FALSE;
