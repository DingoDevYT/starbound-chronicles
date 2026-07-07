-- ============================================================
--  STARBOUND CHRONICLES — Schema v28
--  Lets a GM-defined "Bestiary" enemy template carry its own weapon and
--  species/portrait data directly on the initiative_tracker row, instead of
--  requiring a linked `characters` row (which only ever existed for player
--  characters) or a `character_inventory` weapon (which only NPCs linked to
--  a character could ever have — a bare NPC combatant had no way to be
--  anything but unarmed in combat before this).
--
--  Nothing here changes existing behavior for character-linked combatants;
--  campaign.html only reads these new columns when character_id is null.
--
--  Run once. Safe to re-run.
-- ============================================================

ALTER TABLE initiative_tracker
  ADD COLUMN IF NOT EXISTS weapon_name    TEXT,
  ADD COLUMN IF NOT EXISTS weapon_type    TEXT,
  ADD COLUMN IF NOT EXISTS damage_dice    TEXT,
  ADD COLUMN IF NOT EXISTS accuracy_mod   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weapon_icon_path TEXT,
  ADD COLUMN IF NOT EXISTS npc_species    TEXT,
  ADD COLUMN IF NOT EXISTS npc_gender     TEXT,
  ADD COLUMN IF NOT EXISTS npc_variant    INTEGER;
