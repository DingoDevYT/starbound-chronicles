-- ============================================================
--  STARBOUND CHRONICLES — Schema v16
--  Grid combat: turn a campaign into a battle map.
--
--  - initiative_tracker rows double as combat TOKENS: they gain a
--    grid position, a token colour, a size-based Aim Difficulty, a
--    speed (for movement + initiative), a FIGHT modifier (to-hit),
--    and an optional link to a character (for the portrait + live HP).
--  - campaigns.combat_state holds the active battle: type (space or
--    outside), which preset map, grid size, and obstacle cells.
--
--  Both tables are already in the realtime publication (schema-v10)
--  with REPLICA IDENTITY FULL, so combat updates broadcast live.
--
--  Run once. Safe to re-run.
-- ============================================================

ALTER TABLE initiative_tracker
  ADD COLUMN IF NOT EXISTS grid_x       INTEGER,
  ADD COLUMN IF NOT EXISTS grid_y       INTEGER,
  ADD COLUMN IF NOT EXISTS token_color  TEXT DEFAULT '#c84040',
  ADD COLUMN IF NOT EXISTS base_ad      INTEGER DEFAULT 8,
  ADD COLUMN IF NOT EXISTS speed        INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS fight_mod    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS character_id UUID REFERENCES characters(id) ON DELETE SET NULL;

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS combat_state JSONB DEFAULT '{"active":false}';

-- Personal weapons: an inventory weapon can carry combat stats. Your ONE equipped
-- weapon (is_equipped, already present) is your only attack in on-foot combat.
ALTER TABLE character_inventory
  ADD COLUMN IF NOT EXISTS damage_dice  TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS accuracy_mod INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS range_m      INTEGER DEFAULT 0;
