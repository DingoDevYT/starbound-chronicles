-- ============================================================
--  STARBOUND CHRONICLES — Schema v3 (complete patch)
--  Run this AFTER schema.sql only.
--  This file includes ALL v2 tables + all RLS fixes.
--  If you already ran schema-v2.sql, it's safe to run again (uses IF NOT EXISTS).
-- ============================================================

-- ─── V2: EXTEND CHARACTERS ───────────────────────────────────
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS level       INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS xp          INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hp_current  INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS hp_max      INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS armor       INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS speed       INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS skills      JSONB   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS background  TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS personality TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS bonds       TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS flaws       TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS image_url   TEXT;

-- ─── V2: CHARACTER INVENTORY ─────────────────────────────────
CREATE TABLE IF NOT EXISTS character_inventory (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  item_type    TEXT DEFAULT 'misc',
  quantity     INTEGER DEFAULT 1,
  weight       NUMERIC(6,2) DEFAULT 0,
  value        INTEGER DEFAULT 0,
  description  TEXT DEFAULT '',
  is_equipped  BOOLEAN DEFAULT FALSE,
  properties   JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── V2: SHIP TOKENS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ship_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  label        TEXT NOT NULL DEFAULT 'Token',
  icon         TEXT DEFAULT '🧑',
  color        TEXT DEFAULT '#3a78d4',
  grid_x       INTEGER NOT NULL DEFAULT 0,
  grid_y       INTEGER NOT NULL DEFAULT 0,
  token_size   INTEGER DEFAULT 1,
  hp_current   INTEGER,
  hp_max       INTEGER,
  conditions   TEXT[] DEFAULT '{}',
  notes        TEXT DEFAULT '',
  is_npc       BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── V2: CAMPAIGN QUESTS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_quests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT DEFAULT '',
  status       TEXT DEFAULT 'active',
  priority     TEXT DEFAULT 'main',
  created_by   UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── V2: CAMPAIGN NPCS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_npcs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  species      TEXT DEFAULT 'human',
  faction      TEXT DEFAULT '',
  disposition  TEXT DEFAULT 'neutral',
  description  TEXT DEFAULT '',
  stats        JSONB DEFAULT '{"fly":8,"fix":8,"fight":8,"face":8}',
  hp_current   INTEGER DEFAULT 10,
  hp_max       INTEGER DEFAULT 10,
  notes        TEXT DEFAULT '',
  is_alive     BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── V2: INITIATIVE TRACKER ──────────────────────────────────
CREATE TABLE IF NOT EXISTS initiative_tracker (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  combatant    TEXT NOT NULL,
  initiative   INTEGER NOT NULL DEFAULT 0,
  hp_current   INTEGER,
  hp_max       INTEGER,
  is_active    BOOLEAN DEFAULT TRUE,
  is_npc       BOOLEAN DEFAULT FALSE,
  conditions   TEXT[] DEFAULT '{}',
  sort_order   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── V2: DICE ROLLS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dice_rolls (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id),
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  expression   TEXT NOT NULL,
  result       INTEGER NOT NULL,
  breakdown    JSONB NOT NULL DEFAULT '[]',
  label        TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── V2: CAMPAIGN SETTINGS ───────────────────────────────────
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS settings  JSONB DEFAULT '{"fog_enabled":true,"grid_visible":true,"allow_player_tokens":true}',
  ADD COLUMN IF NOT EXISTS round_num INTEGER DEFAULT 0;

-- ─── V2: ENABLE RLS ON NEW TABLES ────────────────────────────
ALTER TABLE character_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE ship_tokens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_quests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_npcs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE initiative_tracker  ENABLE ROW LEVEL SECURITY;
ALTER TABLE dice_rolls          ENABLE ROW LEVEL SECURITY;

-- ============================================================
--  V3 FIX: Infinite recursion in campaign_members RLS
--  Root cause: the SELECT policy on campaign_members queried
--  campaign_members inside itself (infinite recursion).
--  Fix: SECURITY DEFINER function bypasses RLS so it can't loop.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_campaign_ids()
RETURNS SETOF UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT campaign_id FROM public.campaign_members WHERE user_id = auth.uid()
$$;

-- ─── Drop ALL old recursive policies ─────────────────────────
DROP POLICY IF EXISTS "Members visible to fellow members"              ON campaign_members;
DROP POLICY IF EXISTS "Members see fellow members"                     ON campaign_members;
DROP POLICY IF EXISTS "Characters viewable by owner or campaign mates" ON characters;
DROP POLICY IF EXISTS "Campaigns viewable by members"                  ON campaigns;
DROP POLICY IF EXISTS "Log visible to campaign members"                ON ship_log;
DROP POLICY IF EXISTS "Members create log entries"                     ON ship_log;
DROP POLICY IF EXISTS "Inventory visible to owner and campaign mates"  ON character_inventory;
DROP POLICY IF EXISTS "Tokens visible to campaign members"             ON ship_tokens;
DROP POLICY IF EXISTS "Members place tokens"                           ON ship_tokens;
DROP POLICY IF EXISTS "Members move tokens"                            ON ship_tokens;
DROP POLICY IF EXISTS "Members remove tokens"                          ON ship_tokens;
DROP POLICY IF EXISTS "Quests visible to members"                      ON campaign_quests;
DROP POLICY IF EXISTS "Members create quests"                          ON campaign_quests;
DROP POLICY IF EXISTS "Members update quests"                          ON campaign_quests;
DROP POLICY IF EXISTS "NPCs visible to members"                        ON campaign_npcs;
DROP POLICY IF EXISTS "GM manages NPCs"                                ON campaign_npcs;
DROP POLICY IF EXISTS "Initiative visible to members"                  ON initiative_tracker;
DROP POLICY IF EXISTS "Members add to initiative"                      ON initiative_tracker;
DROP POLICY IF EXISTS "Members update initiative"                      ON initiative_tracker;
DROP POLICY IF EXISTS "GM clears initiative"                           ON initiative_tracker;
DROP POLICY IF EXISTS "Rolls visible to campaign members"              ON dice_rolls;
DROP POLICY IF EXISTS "Users log own rolls"                            ON dice_rolls;

-- ─── campaign_members: non-recursive SELECT ───────────────────
CREATE POLICY "Members see fellow members" ON campaign_members FOR SELECT USING (
  user_id = auth.uid()
  OR campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_members.campaign_id AND owner_id = auth.uid())
);

-- ─── campaigns ───────────────────────────────────────────────
CREATE POLICY "Campaigns viewable by members" ON campaigns FOR SELECT USING (
  auth.uid() = owner_id
  OR id IN (SELECT get_my_campaign_ids())
);

-- ─── characters ──────────────────────────────────────────────
CREATE POLICY "Characters viewable by owner or campaign mates" ON characters FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM campaign_members cm
    WHERE cm.character_id = characters.id
      AND cm.campaign_id IN (SELECT get_my_campaign_ids())
  )
);

-- ─── ship_log ────────────────────────────────────────────────
CREATE POLICY "Log visible to campaign members" ON ship_log FOR SELECT USING (
  ship_log.campaign_id IN (SELECT get_my_campaign_ids())
);
CREATE POLICY "Members create log entries" ON ship_log FOR INSERT WITH CHECK (
  auth.uid() = author_id
  AND ship_log.campaign_id IN (SELECT get_my_campaign_ids())
);

-- ─── character_inventory ─────────────────────────────────────
CREATE POLICY "Inventory visible to owner and campaign mates" ON character_inventory FOR SELECT USING (
  EXISTS (SELECT 1 FROM characters WHERE id = character_inventory.character_id AND user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM campaign_members cm
    WHERE cm.character_id = character_inventory.character_id
      AND cm.campaign_id IN (SELECT get_my_campaign_ids())
  )
);
CREATE POLICY "Owners manage inventory" ON character_inventory FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM characters WHERE id = character_inventory.character_id AND user_id = auth.uid())
);
CREATE POLICY "Owners update inventory" ON character_inventory FOR UPDATE USING (
  EXISTS (SELECT 1 FROM characters WHERE id = character_inventory.character_id AND user_id = auth.uid())
);
CREATE POLICY "Owners delete inventory" ON character_inventory FOR DELETE USING (
  EXISTS (SELECT 1 FROM characters WHERE id = character_inventory.character_id AND user_id = auth.uid())
);

-- ─── ship_tokens ─────────────────────────────────────────────
CREATE POLICY "Tokens visible to campaign members" ON ship_tokens FOR SELECT USING (
  ship_tokens.campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = ship_tokens.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Members place tokens" ON ship_tokens FOR INSERT WITH CHECK (
  ship_tokens.campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = ship_tokens.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Members move tokens" ON ship_tokens FOR UPDATE USING (
  ship_tokens.campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = ship_tokens.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Members remove tokens" ON ship_tokens FOR DELETE USING (
  ship_tokens.campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = ship_tokens.campaign_id AND owner_id = auth.uid())
);

-- ─── campaign_quests ─────────────────────────────────────────
CREATE POLICY "Quests visible to members" ON campaign_quests FOR SELECT USING (
  campaign_quests.campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_quests.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Members create quests" ON campaign_quests FOR INSERT WITH CHECK (
  campaign_quests.campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_quests.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Members update quests" ON campaign_quests FOR UPDATE USING (
  campaign_quests.campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_quests.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Owners delete quests" ON campaign_quests FOR DELETE USING (
  EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_quests.campaign_id AND owner_id = auth.uid())
);

-- ─── campaign_npcs ───────────────────────────────────────────
CREATE POLICY "NPCs visible to members" ON campaign_npcs FOR SELECT USING (
  campaign_npcs.campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_npcs.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "GM manages NPCs" ON campaign_npcs FOR ALL USING (
  EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_npcs.campaign_id AND owner_id = auth.uid())
);

-- ─── initiative_tracker ──────────────────────────────────────
CREATE POLICY "Initiative visible to members" ON initiative_tracker FOR SELECT USING (
  initiative_tracker.campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = initiative_tracker.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Members add to initiative" ON initiative_tracker FOR INSERT WITH CHECK (
  initiative_tracker.campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = initiative_tracker.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Members update initiative" ON initiative_tracker FOR UPDATE USING (
  initiative_tracker.campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = initiative_tracker.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "GM clears initiative" ON initiative_tracker FOR DELETE USING (
  EXISTS (SELECT 1 FROM campaigns WHERE id = initiative_tracker.campaign_id AND owner_id = auth.uid())
);

-- ─── dice_rolls ──────────────────────────────────────────────
CREATE POLICY "Rolls visible to campaign members" ON dice_rolls FOR SELECT USING (
  auth.uid() = user_id
  OR dice_rolls.campaign_id IN (SELECT get_my_campaign_ids())
);
CREATE POLICY "Users log own rolls" ON dice_rolls FOR INSERT WITH CHECK (auth.uid() = user_id);
