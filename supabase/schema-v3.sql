-- ============================================================
--  STARBOUND CHRONICLES — Schema v3 Patch
--  Run this in Supabase > SQL Editor > New Query
--  Run AFTER schema.sql (and schema-v2.sql if you ran it)
-- ============================================================

-- ─── FIX: Infinite recursion in campaign_members RLS ─────────
-- Root cause: the SELECT policy on campaign_members queried
-- campaign_members inside itself, causing infinite recursion.
-- Fix: SECURITY DEFINER function bypasses RLS so it doesn't loop.

CREATE OR REPLACE FUNCTION public.get_my_campaign_ids()
RETURNS SETOF UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT campaign_id FROM public.campaign_members WHERE user_id = auth.uid()
$$;

-- Drop the recursive policy and replace it
DROP POLICY IF EXISTS "Members visible to fellow members" ON campaign_members;

CREATE POLICY "Members see fellow members" ON campaign_members FOR SELECT USING (
  user_id = auth.uid()
  OR campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_members.campaign_id AND owner_id = auth.uid())
);

-- Also replace other policies that reference campaign_members to use the function
DROP POLICY IF EXISTS "Characters viewable by owner or campaign mates" ON characters;
CREATE POLICY "Characters viewable by owner or campaign mates" ON characters FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM campaign_members cm
    WHERE cm.character_id = characters.id
      AND cm.campaign_id IN (SELECT get_my_campaign_ids())
  )
);

DROP POLICY IF EXISTS "Campaigns viewable by members" ON campaigns;
CREATE POLICY "Campaigns viewable by members" ON campaigns FOR SELECT USING (
  auth.uid() = owner_id
  OR id IN (SELECT get_my_campaign_ids())
);

DROP POLICY IF EXISTS "Log visible to campaign members" ON ship_log;
CREATE POLICY "Log visible to campaign members" ON ship_log FOR SELECT USING (
  ship_log.campaign_id IN (SELECT get_my_campaign_ids())
);

DROP POLICY IF EXISTS "Members create log entries" ON ship_log;
CREATE POLICY "Members create log entries" ON ship_log FOR INSERT WITH CHECK (
  auth.uid() = author_id
  AND ship_log.campaign_id IN (SELECT get_my_campaign_ids())
);

-- ─── Also fix v2 table policies (safe to run even if tables don't exist yet) ──
DO $$ BEGIN

  -- character_inventory
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'character_inventory') THEN
    DROP POLICY IF EXISTS "Inventory visible to owner and campaign mates" ON character_inventory;
    EXECUTE $p$
      CREATE POLICY "Inventory visible to owner and campaign mates" ON character_inventory FOR SELECT USING (
        EXISTS (SELECT 1 FROM characters WHERE id = character_inventory.character_id AND user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM campaign_members cm
          WHERE cm.character_id = character_inventory.character_id
            AND cm.campaign_id IN (SELECT get_my_campaign_ids())
        )
      )
    $p$;
  END IF;

  -- ship_tokens
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ship_tokens') THEN
    DROP POLICY IF EXISTS "Tokens visible to campaign members" ON ship_tokens;
    EXECUTE $p$
      CREATE POLICY "Tokens visible to campaign members" ON ship_tokens FOR SELECT USING (
        ship_tokens.campaign_id IN (SELECT get_my_campaign_ids())
        OR EXISTS (SELECT 1 FROM campaigns WHERE id = ship_tokens.campaign_id AND owner_id = auth.uid())
      )
    $p$;
    DROP POLICY IF EXISTS "Members place tokens" ON ship_tokens;
    EXECUTE $p$
      CREATE POLICY "Members place tokens" ON ship_tokens FOR INSERT WITH CHECK (
        ship_tokens.campaign_id IN (SELECT get_my_campaign_ids())
        OR EXISTS (SELECT 1 FROM campaigns WHERE id = ship_tokens.campaign_id AND owner_id = auth.uid())
      )
    $p$;
    DROP POLICY IF EXISTS "Members move tokens" ON ship_tokens;
    EXECUTE $p$
      CREATE POLICY "Members move tokens" ON ship_tokens FOR UPDATE USING (
        ship_tokens.campaign_id IN (SELECT get_my_campaign_ids())
        OR EXISTS (SELECT 1 FROM campaigns WHERE id = ship_tokens.campaign_id AND owner_id = auth.uid())
      )
    $p$;
    DROP POLICY IF EXISTS "Members remove tokens" ON ship_tokens;
    EXECUTE $p$
      CREATE POLICY "Members remove tokens" ON ship_tokens FOR DELETE USING (
        ship_tokens.campaign_id IN (SELECT get_my_campaign_ids())
        OR EXISTS (SELECT 1 FROM campaigns WHERE id = ship_tokens.campaign_id AND owner_id = auth.uid())
      )
    $p$;
  END IF;

  -- campaign_quests
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_quests') THEN
    DROP POLICY IF EXISTS "Quests visible to members" ON campaign_quests;
    EXECUTE $p$
      CREATE POLICY "Quests visible to members" ON campaign_quests FOR SELECT USING (
        campaign_quests.campaign_id IN (SELECT get_my_campaign_ids())
        OR EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_quests.campaign_id AND owner_id = auth.uid())
      )
    $p$;
    DROP POLICY IF EXISTS "Members create quests" ON campaign_quests;
    EXECUTE $p$
      CREATE POLICY "Members create quests" ON campaign_quests FOR INSERT WITH CHECK (
        campaign_quests.campaign_id IN (SELECT get_my_campaign_ids())
        OR EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_quests.campaign_id AND owner_id = auth.uid())
      )
    $p$;
    DROP POLICY IF EXISTS "Members update quests" ON campaign_quests;
    EXECUTE $p$
      CREATE POLICY "Members update quests" ON campaign_quests FOR UPDATE USING (
        campaign_quests.campaign_id IN (SELECT get_my_campaign_ids())
        OR EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_quests.campaign_id AND owner_id = auth.uid())
      )
    $p$;
  END IF;

  -- campaign_npcs
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_npcs') THEN
    DROP POLICY IF EXISTS "NPCs visible to members" ON campaign_npcs;
    EXECUTE $p$
      CREATE POLICY "NPCs visible to members" ON campaign_npcs FOR SELECT USING (
        campaign_npcs.campaign_id IN (SELECT get_my_campaign_ids())
        OR EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_npcs.campaign_id AND owner_id = auth.uid())
      )
    $p$;
  END IF;

  -- initiative_tracker
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'initiative_tracker') THEN
    DROP POLICY IF EXISTS "Initiative visible to members" ON initiative_tracker;
    EXECUTE $p$
      CREATE POLICY "Initiative visible to members" ON initiative_tracker FOR SELECT USING (
        initiative_tracker.campaign_id IN (SELECT get_my_campaign_ids())
        OR EXISTS (SELECT 1 FROM campaigns WHERE id = initiative_tracker.campaign_id AND owner_id = auth.uid())
      )
    $p$;
    DROP POLICY IF EXISTS "Members add to initiative" ON initiative_tracker;
    EXECUTE $p$
      CREATE POLICY "Members add to initiative" ON initiative_tracker FOR INSERT WITH CHECK (
        initiative_tracker.campaign_id IN (SELECT get_my_campaign_ids())
        OR EXISTS (SELECT 1 FROM campaigns WHERE id = initiative_tracker.campaign_id AND owner_id = auth.uid())
      )
    $p$;
    DROP POLICY IF EXISTS "Members update initiative" ON initiative_tracker;
    EXECUTE $p$
      CREATE POLICY "Members update initiative" ON initiative_tracker FOR UPDATE USING (
        initiative_tracker.campaign_id IN (SELECT get_my_campaign_ids())
        OR EXISTS (SELECT 1 FROM campaigns WHERE id = initiative_tracker.campaign_id AND owner_id = auth.uid())
      )
    $p$;
  END IF;

  -- dice_rolls
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dice_rolls') THEN
    DROP POLICY IF EXISTS "Rolls visible to campaign members" ON dice_rolls;
    EXECUTE $p$
      CREATE POLICY "Rolls visible to campaign members" ON dice_rolls FOR SELECT USING (
        auth.uid() = user_id
        OR dice_rolls.campaign_id IN (SELECT get_my_campaign_ids())
      )
    $p$;
  END IF;

END $$;
