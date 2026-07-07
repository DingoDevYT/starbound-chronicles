-- ============================================================
--  STARBOUND CHRONICLES — Schema v29
--  Moves the Bestiary and Map Editor off browser localStorage (where only the
--  GM's own browser could see them) onto real, campaign-shared Supabase
--  tables — every campaign member can now see and use the same saved enemies
--  and battlefields, synced live like everything else in this app, same
--  "any campaign member can manage shared resources" trust model already
--  used for campaign_cargo/mining_sessions (see schema-v13.sql/schema-v22.sql).
--
--  Run once. Safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS bestiary_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  species       TEXT,
  gender        TEXT,
  variant       INTEGER,
  hp_max        INTEGER DEFAULT 10,
  base_ad       INTEGER DEFAULT 8,
  fight_mod     INTEGER DEFAULT 0,
  armor         INTEGER DEFAULT 0,
  speed         INTEGER DEFAULT 30,
  token_color   TEXT DEFAULT '#c84040',
  weapon_name   TEXT,
  weapon_type   TEXT,
  damage_dice   TEXT DEFAULT '1d6',
  accuracy_mod  INTEGER DEFAULT 0,
  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_maps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  w             INTEGER NOT NULL DEFAULT 26,
  h             INTEGER NOT NULL DEFAULT 18,
  theme3d       TEXT DEFAULT 'arena',
  obstacles     JSONB DEFAULT '[]'::jsonb,
  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bestiary_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_maps        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Bestiary visible to members" ON bestiary_templates;
DROP POLICY IF EXISTS "Members manage bestiary"     ON bestiary_templates;
DROP POLICY IF EXISTS "Members update bestiary"      ON bestiary_templates;
DROP POLICY IF EXISTS "Members delete bestiary"      ON bestiary_templates;

CREATE POLICY "Bestiary visible to members" ON bestiary_templates FOR SELECT USING (
  campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = bestiary_templates.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Members manage bestiary" ON bestiary_templates FOR INSERT WITH CHECK (
  campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = bestiary_templates.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Members update bestiary" ON bestiary_templates FOR UPDATE USING (
  campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = bestiary_templates.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Members delete bestiary" ON bestiary_templates FOR DELETE USING (
  campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = bestiary_templates.campaign_id AND owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Custom maps visible to members" ON custom_maps;
DROP POLICY IF EXISTS "Members manage custom maps"     ON custom_maps;
DROP POLICY IF EXISTS "Members update custom maps"      ON custom_maps;
DROP POLICY IF EXISTS "Members delete custom maps"      ON custom_maps;

CREATE POLICY "Custom maps visible to members" ON custom_maps FOR SELECT USING (
  campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = custom_maps.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Members manage custom maps" ON custom_maps FOR INSERT WITH CHECK (
  campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = custom_maps.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Members update custom maps" ON custom_maps FOR UPDATE USING (
  campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = custom_maps.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Members delete custom maps" ON custom_maps FOR DELETE USING (
  campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = custom_maps.campaign_id AND owner_id = auth.uid())
);

-- Realtime — same pattern as schema-v13.sql, so a new/edited enemy or map shows up live
-- for every connected client without needing a manual refresh.
DO $$
BEGIN
  ALTER TABLE public.bestiary_templates REPLICA IDENTITY FULL;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'bestiary_templates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bestiary_templates;
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE public.custom_maps REPLICA IDENTITY FULL;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'custom_maps'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_maps;
  END IF;
END $$;
