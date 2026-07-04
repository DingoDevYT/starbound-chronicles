-- ============================================================
--  STARBOUND CHRONICLES — Schema v19
--  Personal armor as flat damage reduction (separate from AD, which
--  is purely the to-hit check). Total Armor = species base (0-2,
--  fixed in app code) + the one equipped armor item's DR (capped at
--  5 by the catalog data, not the DB).
--
--  Run once. Safe to re-run.
-- ============================================================

ALTER TABLE character_inventory
  ADD COLUMN IF NOT EXISTS armor_dr INTEGER DEFAULT 0;

-- campaign_cargo never got the weapon-stat columns character_inventory has (schema-v16),
-- so a weapon sent to the shared hold silently lost its damage/accuracy/range. Fixing that
-- gap here while adding armor_dr, so items round-trip losslessly either direction.
ALTER TABLE campaign_cargo
  ADD COLUMN IF NOT EXISTS armor_dr     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS damage_dice  TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS accuracy_mod INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS range_m      INTEGER DEFAULT 0;
