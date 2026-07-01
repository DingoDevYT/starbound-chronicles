-- ============================================================
--  STARBOUND CHRONICLES — Schema v5
--  Ship types, components, campaign ships
--  Run AFTER schema-v4.sql. Safe to re-run.
-- ============================================================

-- ─── Ship hull definitions ───────────────────────────────────
CREATE TABLE IF NOT EXISTS ship_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  size        TEXT NOT NULL CHECK (size IN ('small','medium','large','capital')),
  description TEXT DEFAULT '',
  -- Interior floor as array of row strings ('X' = floor, ' ' = empty)
  floor_rows  JSONB NOT NULL DEFAULT '[]',
  grid_w      INTEGER NOT NULL DEFAULT 10,
  grid_h      INTEGER NOT NULL DEFAULT 10,
  -- Component attachment points in grid coords (relative to hull origin)
  left_wing_slot    JSONB DEFAULT '{"x":-3,"y":3,"w":3,"h":3}',
  right_wing_slot   JSONB DEFAULT '{"x":10,"y":3,"w":3,"h":3}',
  thruster_slot     JSONB DEFAULT '{"x":3,"y":9,"w":4,"h":3}',
  -- Crew station positions inside the hull
  station_positions JSONB DEFAULT '[]',
  -- Base stats (before components)
  hp_base         INTEGER DEFAULT 50,
  armor_base      INTEGER DEFAULT 0,
  speed_base      INTEGER DEFAULT 6,
  fuel_capacity   INTEGER DEFAULT 100,
  crew_capacity   INTEGER DEFAULT 4,
  cargo_capacity  INTEGER DEFAULT 20,
  cost_credits    INTEGER DEFAULT 1000,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Ship components (wings, thrusters) ──────────────────────
CREATE TABLE IF NOT EXISTS ship_components (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('wing','thruster')),
  compatible_sizes TEXT[] DEFAULT '{}',
  -- Stat modifiers (additive with base stats)
  speed_mod    INTEGER DEFAULT 0,
  armor_mod    INTEGER DEFAULT 0,
  hp_mod       INTEGER DEFAULT 0,
  fuel_mod     INTEGER DEFAULT 0,    -- change to max fuel capacity
  maneuver_mod INTEGER DEFAULT 0,
  fuel_regen   NUMERIC(5,2) DEFAULT 0,
  description  TEXT DEFAULT '',
  cost_credits INTEGER DEFAULT 200,
  image_url    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Campaign ships (one per campaign) ───────────────────────
CREATE TABLE IF NOT EXISTS campaign_ships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE UNIQUE,
  ship_type_id UUID REFERENCES ship_types(id),
  ship_name    TEXT DEFAULT 'The Unnamed',
  left_wing_id  UUID REFERENCES ship_components(id),
  right_wing_id UUID REFERENCES ship_components(id),
  thruster_id   UUID REFERENCES ship_components(id),
  -- Derived current stats (recalculated when components change)
  hp_current   INTEGER DEFAULT 50,
  hp_max       INTEGER DEFAULT 50,
  armor        INTEGER DEFAULT 0,
  speed        INTEGER DEFAULT 6,
  fuel_current INTEGER DEFAULT 100,
  fuel_max     INTEGER DEFAULT 100,
  -- Cosmetic
  color        TEXT DEFAULT '#2a4a6a',
  notes        TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Replica identity for realtime ───────────────────────────
ALTER TABLE campaign_ships REPLICA IDENTITY FULL;

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE ship_types       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ship_components  ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_ships   ENABLE ROW LEVEL SECURITY;

-- ship_types and ship_components: readable by all authenticated users (global data)
DROP POLICY IF EXISTS "Anyone reads ship types"       ON ship_types;
DROP POLICY IF EXISTS "Anyone reads ship components"  ON ship_components;

CREATE POLICY "Anyone reads ship types" ON ship_types FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Anyone reads ship components" ON ship_components FOR SELECT USING (auth.role() = 'authenticated');

-- campaign_ships: members can read, GM can write
DROP POLICY IF EXISTS "Members read ship"  ON campaign_ships;
DROP POLICY IF EXISTS "GM manages ship"    ON campaign_ships;

CREATE POLICY "Members read ship" ON campaign_ships FOR SELECT USING (
  campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_ships.campaign_id AND owner_id = auth.uid())
);

CREATE POLICY "GM manages ship" ON campaign_ships FOR ALL USING (
  EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_ships.campaign_id AND owner_id = auth.uid())
);

-- ============================================================
--  Pre-populated ship types
-- ============================================================

INSERT INTO ship_types (name, size, description, grid_w, grid_h, floor_rows, left_wing_slot, right_wing_slot, thruster_slot, station_positions, hp_base, armor_base, speed_base, fuel_capacity, crew_capacity, cargo_capacity, cost_credits)
VALUES

('Scout', 'small',
 'A nimble single-deck vessel favoured by couriers and freelancers. Fast, cheap, and just big enough for a tight crew.',
 10, 9,
 '["    XX    ","  XXXXXX  "," XXXXXXXX ","XXXXXXXXXX","XXXXXXXXXX","XXXXXXXXXX"," XXXXXXXX ","  XXXXXX  ","    XX    "]',
 '{"x":-3,"y":3,"w":3,"h":3}',
 '{"x":10,"y":3,"w":3,"h":3}',
 '{"x":3,"y":9,"w":4,"h":3}',
 '[{"role":"pilot","label":"Helm","x":5,"y":1},{"role":"gunsmith","label":"Gunnery","x":7,"y":4},{"role":"technician","label":"Engineering","x":5,"y":7},{"role":"smuggler","label":"Comms","x":3,"y":4}]',
 40, 0, 8, 80, 4, 15, 800),

('Frigate', 'medium',
 'The workhorse of the galaxy. Balanced in every stat, the Frigate is the default choice for crews that have not yet specialised.',
 16, 12,
 '["     XXXXXX     ","   XXXXXXXXXX   ","  XXXXXXXXXXXX  "," XXXXXXXXXXXXXX ","XXXXXXXXXXXXXXXX","XXXXXXXXXXXXXXXX","XXXXXXXXXXXXXXXX","XXXXXXXXXXXXXXXX"," XXXXXXXXXXXXXX ","  XXXXXXXXXXXX  ","   XXXXXXXXXX   ","     XXXXXX     "]',
 '{"x":-4,"y":4,"w":4,"h":4}',
 '{"x":16,"y":4,"w":4,"h":4}',
 '{"x":5,"y":12,"w":6,"h":4}',
 '[{"role":"pilot","label":"Helm","x":8,"y":1},{"role":"gunsmith","label":"Gunnery","x":8,"y":5},{"role":"technician","label":"Engineering","x":8,"y":10},{"role":"smuggler","label":"Comms","x":4,"y":6}]',
 70, 2, 6, 150, 6, 40, 2500),

('Cruiser', 'large',
 'A heavy-duty combat vessel with reinforced hull plating and room for serious firepower. Slower but nearly impossible to take down.',
 22, 14,
 '["       XXXXXXXX       ","     XXXXXXXXXXXX     ","    XXXXXXXXXXXXXX    ","   XXXXXXXXXXXXXXXX   ","  XXXXXXXXXXXXXXXXXX  ","XXXXXXXXXXXXXXXXXXXXXX","XXXXXXXXXXXXXXXXXXXXXX","XXXXXXXXXXXXXXXXXXXXXX","XXXXXXXXXXXXXXXXXXXXXX","XXXXXXXXXXXXXXXXXXXXXX","  XXXXXXXXXXXXXXXXXX  ","   XXXXXXXXXXXXXXXX   ","    XXXXXXXXXXXXXX    ","       XXXXXXXX       "]',
 '{"x":-6,"y":5,"w":6,"h":5}',
 '{"x":22,"y":5,"w":6,"h":5}',
 '{"x":7,"y":14,"w":8,"h":5}',
 '[{"role":"pilot","label":"Helm","x":11,"y":1},{"role":"gunsmith","label":"Gunnery","x":11,"y":6},{"role":"technician","label":"Engineering","x":11,"y":12},{"role":"smuggler","label":"Comms","x":5,"y":7}]',
 120, 5, 4, 250, 10, 80, 6000),

('Dreadnought', 'capital',
 'A capital-class warship. Takes a full crew to operate and burns fuel like a star burns hydrogen. Nothing in the galaxy hits harder.',
 30, 20,
 '["              XX              ","           XXXXXXXX           ","         XXXXXXXXXXXX         ","       XXXXXXXXXXXXXXXX       ","      XXXXXXXXXXXXXXXXXX      ","     XXXXXXXXXXXXXXXXXXXX     ","    XXXXXXXXXXXXXXXXXXXXXX    ","   XXXXXXXXXXXXXXXXXXXXXXXX   ","  XXXXXXXXXXXXXXXXXXXXXXXXXX  "," XXXXXXXXXXXXXXXXXXXXXXXXXXXX ","XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX","XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX","XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX","XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"," XXXXXXXXXXXXXXXXXXXXXXXXXXXX ","  XXXXXXXXXXXXXXXXXXXXXXXXXX  ","   XXXXXXXXXXXXXXXXXXXXXXXX   ","    XXXXXXXXXXXXXXXXXXXXXX    ","      XXXXXXXXXXXXXXXXXX      ","        XXXXXXXXXXXXXX        "]',
 '{"x":-8,"y":7,"w":8,"h":7}',
 '{"x":30,"y":7,"w":8,"h":7}',
 '{"x":9,"y":20,"w":12,"h":6}',
 '[{"role":"pilot","label":"Helm","x":15,"y":2},{"role":"gunsmith","label":"Gunnery","x":15,"y":8},{"role":"technician","label":"Engineering","x":15,"y":17},{"role":"smuggler","label":"Comms","x":7,"y":10}]',
 200, 10, 2, 500, 20, 150, 15000);

-- ============================================================
--  Pre-populated ship components
-- ============================================================

INSERT INTO ship_components (name, type, compatible_sizes, speed_mod, armor_mod, hp_mod, fuel_mod, maneuver_mod, fuel_regen, description, cost_credits)
VALUES
-- Wings
('Standard Wings',       'wing', '{small,medium}',          2,  0,   0,   0,  0, 0,   'Basic swept-metal wings. Reliable, nothing special.',                                           200),
('Swept Wings',          'wing', '{medium,large}',           3,  0,   0,   0,  1, 0,   'Aerodynamically optimised for higher cruising speed and tighter turns.',                       400),
('Heavy Plating Wings',  'wing', '{large,capital}',         -1,  3,  20,   0,  0, 0,   'Armoured wing extensions that absorb incoming fire at the cost of agility.',                   600),
('Racing Fins',          'wing', '{small}',                  5,  0, -10,   0,  3, 0,   'Lightweight racing fins stripped of all armour for maximum speed. Extremely fragile.',         350),
('Military Wings',       'wing', '{medium,large,capital}',   2,  2,   0,   0,  0, 0,   'Standard-issue military wings. A solid balance of speed and protection.',                      500),
('Void Sails',           'wing', '{capital}',                2,  0,   0,   0,  0, 2.0, 'Experimental ion-collection sails. Passively generate fuel while drifting in deep space.',     800),

-- Thrusters
('Basic Thruster',       'thruster', '{small,medium,large,capital}',  0,  0,  0,   0, 0, 0,   'A standard combustion thruster. Gets the job done and not much else.',                  150),
('Afterburner',          'thruster', '{small,medium}',                 4,  0,  0, -20, 0, 0,   'Injects raw propellant for blistering speed. Burns through your fuel reserves fast.',    400),
('Ion Drive',            'thruster', '{medium,large}',                 2,  0,  0,   0, 0, 1.0, 'Efficient ion propulsion engine. Slowly regenerates fuel during transit.',               500),
('Plasma Core',          'thruster', '{large,capital}',                5,  0,  0, 100, 0, 0,   'High-output plasma engine with a built-in expanded fuel reserve.',                       900),
('Fuel Cell Array',      'thruster', '{small,medium,large,capital}', -1,  0,  0, 200, 0, 0.5,  'Trades thrust for a massive fuel reserve and a trickle of passive regeneration.',        600);
