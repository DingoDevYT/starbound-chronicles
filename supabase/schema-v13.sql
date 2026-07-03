-- ============================================================
--  STARBOUND CHRONICLES — Schema v13
--  Adds character credits and a shared ship cargo hold.
--
--  - characters.credits: a personal credit balance per character.
--  - campaign_cargo: a collective, campaign-scoped inventory (the
--    ship's cargo hold). Any crew member can stock it, take from
--    it, or drop items into it from their personal inventory —
--    this is the "party inventory" living on the ship itself,
--    distinct from character_inventory (a character's own gear).
--
--  Run once. Safe to re-run.
-- ============================================================

ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS campaign_cargo (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  item_type    TEXT DEFAULT 'misc',
  quantity     INTEGER DEFAULT 1,
  weight       NUMERIC(6,2) DEFAULT 0,
  value        INTEGER DEFAULT 0,
  description  TEXT DEFAULT '',
  added_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE campaign_cargo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cargo visible to members" ON campaign_cargo;
DROP POLICY IF EXISTS "Members manage cargo"     ON campaign_cargo;
DROP POLICY IF EXISTS "Members update cargo"     ON campaign_cargo;
DROP POLICY IF EXISTS "Members delete cargo"     ON campaign_cargo;

CREATE POLICY "Cargo visible to members" ON campaign_cargo FOR SELECT USING (
  campaign_cargo.campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_cargo.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Members manage cargo" ON campaign_cargo FOR INSERT WITH CHECK (
  campaign_cargo.campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_cargo.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Members update cargo" ON campaign_cargo FOR UPDATE USING (
  campaign_cargo.campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_cargo.campaign_id AND owner_id = auth.uid())
);
CREATE POLICY "Members delete cargo" ON campaign_cargo FOR DELETE USING (
  campaign_cargo.campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_cargo.campaign_id AND owner_id = auth.uid())
);

-- Realtime — same pattern as schema-v10.sql, so cargo changes show up live for the whole crew.
DO $$
BEGIN
  ALTER TABLE public.campaign_cargo REPLICA IDENTITY FULL;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'campaign_cargo'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_cargo;
  END IF;
END $$;
