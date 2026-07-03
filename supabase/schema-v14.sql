-- ============================================================
--  STARBOUND CHRONICLES — Schema v14
--  Ship component rework to match the current lore doc:
--  Hull Frames / Power Reactors / Wing Modules / Gun Hardpoints,
--  balanced around a 6 PP baseline economy.
--
--  This ADDS new columns and new canonical hull/component rows —
--  it does not delete any existing ship_types/ship_components rows,
--  since campaigns may already have ships referencing them by
--  foreign key (deleting would either fail or orphan live data).
--  The new "Sleek Interceptor / Standard Frigate / Heavy Cargo
--  Hauler" hulls and the exact reactor/wing/weapon sets from the
--  lore doc are the ones to actually use going forward.
--
--  Run once. Safe to re-run.
-- ============================================================

-- ── ship_types: hull stats needed for the new system ──────────
ALTER TABLE ship_types
  ADD COLUMN IF NOT EXISTS base_ad   INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS gun_slots INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS special   TEXT DEFAULT '';

-- ── ship_components: allow 'reactor' and 'weapon' types + their stats ──
ALTER TABLE ship_components DROP CONSTRAINT IF EXISTS ship_components_type_check;
ALTER TABLE ship_components ADD CONSTRAINT ship_components_type_check
  CHECK (type IN ('wing','thruster','reactor','weapon'));

ALTER TABLE ship_components
  ADD COLUMN IF NOT EXISTS shield_hp_mod INTEGER DEFAULT 0,   -- wings: Base Shield HP contributed
  ADD COLUMN IF NOT EXISTS ad_mod        INTEGER DEFAULT 0,   -- wings: AD modifier
  ADD COLUMN IF NOT EXISTS pp_cap_mod    INTEGER DEFAULT 0,   -- reactors: Max PP Cap
  ADD COLUMN IF NOT EXISTS pp_regen_mod  INTEGER DEFAULT 0,   -- reactors: PP Regen / Turn
  ADD COLUMN IF NOT EXISTS component_hp  INTEGER DEFAULT 0,   -- the component's own HP (can be knocked out)
  ADD COLUMN IF NOT EXISTS pp_cost       INTEGER DEFAULT 0,   -- weapons: PP cost to fire
  ADD COLUMN IF NOT EXISTS damage_dice   TEXT DEFAULT '',     -- weapons: e.g. '1d12'
  ADD COLUMN IF NOT EXISTS fight_mod     INTEGER DEFAULT 0,   -- weapons: accuracy modifier to FIGHT check
  ADD COLUMN IF NOT EXISTS special       TEXT DEFAULT '';     -- freeform special-trait text

-- ── campaign_ships: track shields, PP budget, total AD, reactor + guns ──
ALTER TABLE campaign_ships
  ADD COLUMN IF NOT EXISTS reactor_id     UUID REFERENCES ship_components(id),
  ADD COLUMN IF NOT EXISTS gun_ids        JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS shield_current INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shield_max     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pp_max         INTEGER DEFAULT 6,
  ADD COLUMN IF NOT EXISTS ad_total       INTEGER DEFAULT 10;

-- Old seed data used "smuggler" as a station role key before the class system
-- was renamed to Captain/Pilot/Gunsmith/Technician. Not currently read by any
-- rendering code, but fix it so it doesn't resurface if that feature is wired up.
UPDATE ship_types
SET station_positions = REPLACE(station_positions::text, '"role":"smuggler"', '"role":"captain"')::jsonb
WHERE station_positions::text LIKE '%smuggler%';

-- ── New canonical hulls (exact stats from the lore doc) ───────
INSERT INTO ship_types (name, size, description, grid_w, grid_h, floor_rows, left_wing_slot, right_wing_slot, thruster_slot, station_positions, base_ad, gun_slots, special, hp_base, armor_base, speed_base, fuel_capacity, crew_capacity, cargo_capacity, cost_credits)
VALUES

('Sleek Interceptor', 'small',
 'A nimble, single-hardpoint interceptor built for speed over survivability. Nimble Profile: Evasive Manoeuvre actions cost 1 less PP to execute.',
 10, 9,
 '["    XX    ","  XXXXXX  "," XXXXXXXX ","XXXXXXXXXX","XXXXXXXXXX","XXXXXXXXXX"," XXXXXXXX ","  XXXXXX  ","    XX    "]',
 '{"x":-3,"y":3,"w":3,"h":3}',
 '{"x":10,"y":3,"w":3,"h":3}',
 '{"x":3,"y":9,"w":4,"h":3}',
 '[{"role":"pilot","label":"Helm","x":5,"y":1},{"role":"gunsmith","label":"Gunnery","x":7,"y":4},{"role":"technician","label":"Engineering","x":5,"y":7},{"role":"captain","label":"Bridge","x":3,"y":4}]',
 14, 1, 'Nimble Profile: Evasive Manoeuvre actions cost 1 less PP to execute.',
 35, 0, 8, 80, 4, 15, 800),

('Standard Frigate', 'medium',
 'The balanced baseline build. No positive or negative penalties — a solid all-rounder for crews that have not yet specialised.',
 16, 12,
 '["     XXXXXX     ","   XXXXXXXXXX   ","  XXXXXXXXXXXX  "," XXXXXXXXXXXXXX ","XXXXXXXXXXXXXXXX","XXXXXXXXXXXXXXXX","XXXXXXXXXXXXXXXX","XXXXXXXXXXXXXXXX"," XXXXXXXXXXXXXX ","  XXXXXXXXXXXX  ","   XXXXXXXXXX   ","     XXXXXX     "]',
 '{"x":-4,"y":4,"w":4,"h":4}',
 '{"x":16,"y":4,"w":4,"h":4}',
 '{"x":5,"y":12,"w":6,"h":4}',
 '[{"role":"pilot","label":"Helm","x":8,"y":1},{"role":"gunsmith","label":"Gunnery","x":8,"y":5},{"role":"technician","label":"Engineering","x":8,"y":10},{"role":"captain","label":"Bridge","x":4,"y":6}]',
 10, 2, 'Balanced Chassis: standard baseline build, no bonuses or penalties.',
 65, 0, 6, 150, 6, 40, 2500),

('Heavy Cargo Hauler', 'large',
 'A bulk carrier prioritising hull and hardpoints over agility. Bulk Carrier: base movement speed is reduced by 1 tile per turn.',
 22, 14,
 '["       XXXXXXXX       ","     XXXXXXXXXXXX     ","    XXXXXXXXXXXXXX    ","   XXXXXXXXXXXXXXXX   ","  XXXXXXXXXXXXXXXXXX  ","XXXXXXXXXXXXXXXXXXXXXX","XXXXXXXXXXXXXXXXXXXXXX","XXXXXXXXXXXXXXXXXXXXXX","XXXXXXXXXXXXXXXXXXXXXX","XXXXXXXXXXXXXXXXXXXXXX","  XXXXXXXXXXXXXXXXXX  ","   XXXXXXXXXXXXXXXX   ","    XXXXXXXXXXXXXX    ","       XXXXXXXX       "]',
 '{"x":-6,"y":5,"w":6,"h":5}',
 '{"x":22,"y":5,"w":6,"h":5}',
 '{"x":7,"y":14,"w":8,"h":5}',
 '[{"role":"pilot","label":"Helm","x":11,"y":1},{"role":"gunsmith","label":"Gunnery","x":11,"y":6},{"role":"technician","label":"Engineering","x":11,"y":12},{"role":"captain","label":"Bridge","x":5,"y":7}]',
 6, 3, 'Bulk Carrier: base movement speed is reduced by 1 tile per turn.',
 130, 0, 4, 250, 10, 80, 3500)

ON CONFLICT (name) DO NOTHING;

-- ── New canonical components (exact stats from the lore doc) ──
INSERT INTO ship_components (name, type, compatible_sizes, shield_hp_mod, ad_mod, component_hp, description, special, cost_credits)
VALUES
('Aero-Stabilisers',   'wing', '{small,medium,large}', 20, 2, 12, 'Lightweight composite wings designed to increase the ship''s baseline agility profile.', '', 400),
('Aegis Plated Wings',  'wing', '{small,medium,large}', 45, 0, 25, 'Bulky, heavily armored wing segments that sacrifice pure agility for massive shield capacity.', '', 700),
('Solar-Sail Vectors',  'wing', '{small,medium,large}', 15, 1, 10, 'Advanced Arboran-style light-capturing foil.', 'Adds a permanent +1 PP to your round-by-round Reactor Overclock action results.', 600)
ON CONFLICT (name) DO NOTHING;

INSERT INTO ship_components (name, type, compatible_sizes, pp_cap_mod, pp_regen_mod, component_hp, description, cost_credits)
VALUES
('Standard Ion Core',      'reactor', '{small,medium,large}', 6, 6, 15, 'Solid baseline performance. Dependable under normal operating parameters.', 500),
('Hyper-Flux Reactor',     'reactor', '{small,medium,large}', 5, 7, 10, 'Low capacity storage but cycles energy rapidly. Perfect for aggressive, high-turn builds.', 600),
('Overclocked Plasma Drive','reactor', '{small,medium,large}', 8, 5, 20, 'Massive power storage potential, but recharges slowly. Heavily reliant on Technician Overclock actions.', 900)
ON CONFLICT (name) DO NOTHING;

INSERT INTO ship_components (name, type, compatible_sizes, pp_cost, damage_dice, fight_mod, description, special, cost_credits)
VALUES
('Light Pulse Laser',    'weapon', '{small,medium,large}', 1, '1d12', 0,  'Low power draw, reliable thermal output. Available across all automated sector ports.', '', 300),
('Mag-Accelerator Cannon','weapon', '{small,medium,large}', 2, '2d10', 2,  'Fires high-velocity physical slugs, making it significantly easier to counter heavy long-range distance tracking.', '', 700),
('Heavy Plasma Mortar',  'weapon', '{small,medium,large}', 4, '4d8', -2, 'Slow, heavy projectile that is difficult to aim accurately.', 'Completely destroys 2 points of an enemy''s active Armor rating on impact.', 1400)
ON CONFLICT (name) DO NOTHING;
