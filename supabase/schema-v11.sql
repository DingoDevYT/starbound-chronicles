-- ============================================================
--  STARBOUND CHRONICLES — Schema v11
--  CRITICAL FIX: campaign_members had no UPDATE policy at all.
--
--  Root cause of "I assigned my character but no token ever appears":
--  campaign_members only ever had SELECT/INSERT/DELETE policies. RLS
--  default-denies anything without an explicit policy, so every
--  `db.from('campaign_members').update({ character_id: ... })` call
--  from the "My Character" picker has been silently matching zero
--  rows this whole time — no error, no rows changed, character_id
--  never actually got set. ensureCrewTokens() then correctly found no
--  members with a character attached and created nothing.
--
--  Run once. Safe to re-run.
-- ============================================================

DROP POLICY IF EXISTS "Users update own membership" ON campaign_members;
DROP POLICY IF EXISTS "GM updates any membership"    ON campaign_members;

CREATE POLICY "Users update own membership" ON campaign_members FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "GM updates any membership" ON campaign_members FOR UPDATE USING (
  EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_members.campaign_id AND owner_id = auth.uid())
);
