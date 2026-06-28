-- ============================================================
--  STARBOUND CHRONICLES — Schema v2
--  Run this AFTER schema.sql (adds all new tables & columns)
--  SQL Editor > New Query > paste > Run
-- ============================================================

-- ─── EXTEND CHARACTERS ───────────────────────────────────────
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

-- ─── CHARACTER INVENTORY ─────────────────────────────────────
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

-- ─── SHIP TOKENS (map tokens) ────────────────────────────────
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

-- ─── CAMPAIGN QUESTS ─────────────────────────────────────────
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

-- ─── CAMPAIGN NPCS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_npcs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  species      TEXT DEFAULT 'human',
  faction      TEXT DEFAULT '',
  disposition  TEXT DEFAULT 'neutral',
  description  TEXT DEFAULT '',
  stats        JSONB DEFAULT '{"strength":10,"agility":10,"intellect":10,"tenacity":10,"social":10,"tech":10}',
  hp_current   INTEGER DEFAULT 10,
  hp_max       INTEGER DEFAULT 10,
  notes        TEXT DEFAULT '',
  is_alive     BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INITIATIVE TRACKER ──────────────────────────────────────
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

-- ─── DICE ROLLS ──────────────────────────────────────────────
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

-- ─── CAMPAIGN SETTINGS (extend campaigns) ────────────────────
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS settings  JSONB DEFAULT '{"fog_enabled":true,"grid_visible":true,"allow_player_tokens":true}',
  ADD COLUMN IF NOT EXISTS round_num INTEGER DEFAULT 0;

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================

-- character_inventory
ALTER TABLE character_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Inventory visible to owner and campaign mates" ON character_inventory FOR SELECT USING (
  EXISTS (SELECT 1 FROM characters WHERE id = character_inventory.character_id AND user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM campaign_members cm
    JOIN campaign_members me ON me.campaign_id = cm.campaign_id
    WHERE cm.character_id = character_inventory.character_id AND me.user_id = auth.uid()
  )
);
CREATE POLICY "Owners manage inventory"  ON character_inventory FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM characters WHERE id = character_inventory.character_id AND user_id = auth.uid())
);
CREATE POLICY "Owners update inventory"  ON character_inventory FOR UPDATE USING (
  EXISTS (SELECT 1 FROM characters WHERE id = character_inventory.character_id AND user_id = auth.uid())
);
CREATE POLICY "Owners delete inventory"  ON character_inventory FOR DELETE USING (
  EXISTS (SELECT 1 FROM characters WHERE id = character_inventory.character_id AND user_id = auth.uid())
);

-- ship_tokens
ALTER TABLE ship_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tokens visible to campaign members" ON ship_tokens FOR SELECT USING (
  EXISTS (SELECT 1 FROM campaign_members WHERE campaign_id = ship_tokens.campaign_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = ship_tokens.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Members place tokens" ON ship_tokens FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM campaign_members WHERE campaign_id = ship_tokens.campaign_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = ship_tokens.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Members move tokens" ON ship_tokens FOR UPDATE USING (
  EXISTS (SELECT 1 FROM campaign_members WHERE campaign_id = ship_tokens.campaign_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = ship_tokens.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Members remove tokens" ON ship_tokens FOR DELETE USING (
  EXISTS (SELECT 1 FROM campaign_members WHERE campaign_id = ship_tokens.campaign_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = ship_tokens.campaign_id AND owner_id = auth.uid())
);

-- campaign_quests
ALTER TABLE campaign_quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Quests visible to members"   ON campaign_quests FOR SELECT USING (
  EXISTS (SELECT 1 FROM campaign_members WHERE campaign_id = campaign_quests.campaign_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_quests.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Members create quests"       ON campaign_quests FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM campaign_members WHERE campaign_id = campaign_quests.campaign_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_quests.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Members update quests"       ON campaign_quests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM campaign_members WHERE campaign_id = campaign_quests.campaign_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_quests.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Owners delete quests"        ON campaign_quests FOR DELETE USING (
  EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_quests.campaign_id AND owner_id = auth.uid())
);

-- campaign_npcs
ALTER TABLE campaign_npcs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "NPCs visible to members"     ON campaign_npcs FOR SELECT USING (
  EXISTS (SELECT 1 FROM campaign_members WHERE campaign_id = campaign_npcs.campaign_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_npcs.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "GM manages NPCs"             ON campaign_npcs FOR ALL USING (
  EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_npcs.campaign_id AND owner_id = auth.uid())
);

-- initiative_tracker
ALTER TABLE initiative_tracker ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Initiative visible to members" ON initiative_tracker FOR SELECT USING (
  EXISTS (SELECT 1 FROM campaign_members WHERE campaign_id = initiative_tracker.campaign_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = initiative_tracker.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Members add to initiative"   ON initiative_tracker FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM campaign_members WHERE campaign_id = initiative_tracker.campaign_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = initiative_tracker.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Members update initiative"   ON initiative_tracker FOR UPDATE USING (
  EXISTS (SELECT 1 FROM campaign_members WHERE campaign_id = initiative_tracker.campaign_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = initiative_tracker.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "GM clears initiative"        ON initiative_tracker FOR DELETE USING (
  EXISTS (SELECT 1 FROM campaigns WHERE id = initiative_tracker.campaign_id AND owner_id = auth.uid())
);

-- dice_rolls
ALTER TABLE dice_rolls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rolls visible to campaign members" ON dice_rolls FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM campaign_members WHERE campaign_id = dice_rolls.campaign_id AND user_id = auth.uid())
);
CREATE POLICY "Users log own rolls"         ON dice_rolls FOR INSERT WITH CHECK (auth.uid() = user_id);
