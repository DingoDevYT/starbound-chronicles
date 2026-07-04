-- ============================================================
--  STARBOUND CHRONICLES — Schema v20
--  Ship balance pass + shorter component names.
--
--  All renames/rebalances are UPDATEs keyed on the OLD name, so
--  existing campaign_ships / ship references (by id) are untouched —
--  nothing already equipped gets unequipped by this migration.
--
--  Changes:
--  - Hull/reactor/wing names shortened for memorability.
--  - Reactor PP caps rebalanced to a 10-20 range (was 5-8), regen
--    averaging ~4-5/turn, so early ships aren't starved for PP.
--  - Weapon damage raised across the board — 4d8 (the old ceiling)
--    is now a MIDDLE tier, with a new top-tier Siege Railgun above
--    it, so ship fights resolve in a handful of solid hits instead
--    of a long grind against 40-160 combined shield+hull pools.
--
--  Run once. Safe to re-run (UPDATEs are idempotent; the new weapon
--  INSERT uses ON CONFLICT DO NOTHING).
-- ============================================================

-- ── Hulls: shorter names ───────────────────────────────────────
UPDATE ship_types SET name = 'Interceptor' WHERE name = 'Sleek Interceptor';
UPDATE ship_types SET name = 'Frigate'     WHERE name = 'Standard Frigate';
UPDATE ship_types SET name = 'Hauler'      WHERE name = 'Heavy Cargo Hauler';

-- ── Wings: shorter names (stats unchanged) ─────────────────────
UPDATE ship_components SET name = 'Stabilisers' WHERE name = 'Aero-Stabilisers';
UPDATE ship_components SET name = 'Aegis Wings'  WHERE name = 'Aegis Plated Wings';
UPDATE ship_components SET name = 'Solar Sails'  WHERE name = 'Solar-Sail Vectors';

-- ── Reactors: shorter names + PP rebalance (cap 10-20, regen ~4-5 avg) ──
UPDATE ship_components
  SET name = 'Ion Core', pp_cap_mod = 12, pp_regen_mod = 5
  WHERE name = 'Standard Ion Core';
UPDATE ship_components
  SET name = 'Hyper-Flux', pp_cap_mod = 10, pp_regen_mod = 6
  WHERE name = 'Hyper-Flux Reactor';
UPDATE ship_components
  SET name = 'Overclock Drive', pp_cap_mod = 20, pp_regen_mod = 3
  WHERE name = 'Overclocked Plasma Drive';

-- ── Weapons: shorter names + damage rebalance ──────────────────
-- 4d8 (the old ceiling) becomes the middle tier; a new top tier sits above it.
UPDATE ship_components
  SET name = 'Pulse Laser', damage_dice = '2d6', pp_cost = 1, fight_mod = 0
  WHERE name = 'Light Pulse Laser';
UPDATE ship_components
  SET name = 'Mag Cannon', damage_dice = '3d8', pp_cost = 2, fight_mod = 2
  WHERE name = 'Mag-Accelerator Cannon';
UPDATE ship_components
  SET name = 'Plasma Mortar', damage_dice = '4d8', pp_cost = 3, fight_mod = -1
  WHERE name = 'Heavy Plasma Mortar';

INSERT INTO ship_components (name, type, compatible_sizes, pp_cost, damage_dice, fight_mod, description, special, cost_credits)
VALUES
('Siege Railgun', 'weapon', '{small,medium,large}', 5, '6d10', -2, 'A single devastating railgun slug, fired at massive power draw.', 'Completely destroys 2 points of an enemy''s active Armor rating on impact.', 2200)
ON CONFLICT (name) DO NOTHING;
