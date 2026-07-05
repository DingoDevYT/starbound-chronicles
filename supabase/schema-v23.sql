-- ============================================================
--  STARBOUND CHRONICLES — Schema v23
--  Digital combat: auto-resolve attacks + NPC armor.
--
--  The turn-order sync bug (GM's browser never told anyone else
--  whose turn it was) needed NO schema change — activeTurn now
--  lives inside the existing campaigns.combat_state JSONB column,
--  which every client already subscribes to. But two things here
--  do need a migration:
--
--  1. Players now resolve their own attacks, including against
--     OTHER players' characters. The only UPDATE policy on
--     `characters` so far is "auth.uid() = user_id" (schema.sql),
--     so Player A could never legally write Player B's hp_current
--     even for combat damage. Add a permissive policy for "shares
--     a campaign with me", reusing get_my_campaign_ids() — the
--     same trust model already used everywhere else in this app
--     for shared resources (campaign_cargo, mining_sessions, etc.
--     all let any campaign member fully manage them, not just an
--     owner). Note this is row-level, not column-level — a
--     campaign mate can update more than just hp_current on
--     someone else's character, same blanket-trust shape as those
--     other tables.
--  2. NPC combatants (no character_id, so no character sheet to
--     pull Armor from) need their own Armor value for the
--     auto-resolve attack math to subtract on a hit. GM-settable
--     in the add/edit-combatant modal.
--
--  Run once. Safe to re-run.
-- ============================================================

ALTER TABLE initiative_tracker ADD COLUMN IF NOT EXISTS armor INTEGER DEFAULT 0;

DROP POLICY IF EXISTS "Campaign mates update each other's HP for combat" ON characters;
CREATE POLICY "Campaign mates update each other's HP for combat" ON characters FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM campaign_members cm
    WHERE cm.character_id = characters.id
      AND cm.campaign_id IN (SELECT get_my_campaign_ids())
  )
);
