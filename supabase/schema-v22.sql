-- ============================================================
--  STARBOUND CHRONICLES — Schema v22
--  Asteroid mining minigame.
--
--  - mining_sessions: one row per expedition the GM sends a
--    character on. The GM picks which asteroid presets are offered;
--    the player then picks one + a mining tool from their own
--    inventory and plays the grid-dig minigame client-side. Loot
--    found is appended live to loot_found (JSONB) so the GM sees
--    it happening in real time, then written into the character's
--    personal inventory when the session completes.
--  - character_inventory / campaign_cargo gain mining tool stats
--    (modifier / AoE size / max charges / best-against hardness),
--    same pattern as weapon damage_dice or armor_dr.
--
--  Run once. Safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS mining_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  character_id      UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'pending',  -- pending | active | completed | aborted
  offered_asteroids JSONB DEFAULT '[]',                -- array of asteroid preset keys the GM offered
  selected_asteroid TEXT,
  selected_tool_item_id UUID REFERENCES character_inventory(id) ON DELETE SET NULL,
  loot_found        JSONB DEFAULT '[]',                -- array of {name, value, icon_path} as they're uncovered
  created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

ALTER TABLE mining_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mining sessions visible to campaign members" ON mining_sessions;
DROP POLICY IF EXISTS "Members manage mining sessions" ON mining_sessions;
DROP POLICY IF EXISTS "Members update mining sessions" ON mining_sessions;
DROP POLICY IF EXISTS "Members delete mining sessions" ON mining_sessions;

CREATE POLICY "Mining sessions visible to campaign members" ON mining_sessions FOR SELECT USING (
  campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = mining_sessions.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Members manage mining sessions" ON mining_sessions FOR INSERT WITH CHECK (
  campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = mining_sessions.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Members update mining sessions" ON mining_sessions FOR UPDATE USING (
  campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = mining_sessions.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Members delete mining sessions" ON mining_sessions FOR DELETE USING (
  campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = mining_sessions.campaign_id AND owner_id = auth.uid())
);

-- Realtime, same pattern as schema-v10.
DO $$
BEGIN
  ALTER TABLE public.mining_sessions REPLICA IDENTITY FULL;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mining_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mining_sessions;
  END IF;
END $$;

-- Mining tool stats, same pattern as weapon/armor stat columns.
ALTER TABLE character_inventory
  ADD COLUMN IF NOT EXISTS mining_modifier     INTEGER,
  ADD COLUMN IF NOT EXISTS mining_size         INTEGER,
  ADD COLUMN IF NOT EXISTS mining_max_charges  INTEGER,
  ADD COLUMN IF NOT EXISTS mining_best_against TEXT;

ALTER TABLE campaign_cargo
  ADD COLUMN IF NOT EXISTS mining_modifier     INTEGER,
  ADD COLUMN IF NOT EXISTS mining_size         INTEGER,
  ADD COLUMN IF NOT EXISTS mining_max_charges  INTEGER,
  ADD COLUMN IF NOT EXISTS mining_best_against TEXT;

-- Give every existing character a free Hand Pickaxe if they don't already have one —
-- new characters get this automatically at creation (dashboard.html), but existing
-- ones predate the mining system entirely.
INSERT INTO character_inventory (character_id, name, item_type, quantity, weight, value, description, mining_modifier, mining_size, mining_max_charges, mining_best_against)
SELECT c.id, 'Hand Pickaxe', 'tool', 1, 1.5, 20, 'Basic manual excavation tool. Slow and unglamorous, but it never runs out of charge you can''t recover.', 0, 1, 30, 'soft'
FROM characters c
WHERE NOT EXISTS (
  SELECT 1 FROM character_inventory ci WHERE ci.character_id = c.id AND ci.name = 'Hand Pickaxe'
);
