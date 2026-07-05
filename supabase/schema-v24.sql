-- ============================================================
--  STARBOUND CHRONICLES — Schema v24
--  Weapon type for combat sound/visual flavor.
--
--  The catalog already tags every weapon with a subcategory (pistol,
--  smg, carbine, rifle, shotgun, sniper, heavy, melee — see
--  WEAPON_TIERS in js/catalog.js), but that tag was never copied
--  onto the character_inventory/campaign_cargo row when an item was
--  picked from the catalog — only damage_dice/accuracy_mod/range_m
--  were. The auto-resolve attack FX needs it to pick a matching
--  gunfire sound and projectile look per weapon.
--
--  Run once. Safe to re-run.
-- ============================================================

ALTER TABLE character_inventory ADD COLUMN IF NOT EXISTS weapon_type TEXT DEFAULT NULL;
ALTER TABLE campaign_cargo      ADD COLUMN IF NOT EXISTS weapon_type TEXT DEFAULT NULL;
