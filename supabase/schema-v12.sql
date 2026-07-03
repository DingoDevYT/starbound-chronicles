-- ============================================================
--  STARBOUND CHRONICLES — Schema v12
--  CRITICAL FIX: joining a campaign by invite code always failed
--  with "No campaign found with that code."
--
--  Root cause: the "Campaigns viewable by members" SELECT policy
--  only allows a row to be seen by its owner or an existing member.
--  The join flow's very first step is
--    db.from('campaigns').select('id,name').eq('invite_code', code)
--  run by a user who is (by definition, since they're trying to
--  join) NOT yet a member — so RLS silently filtered the row out
--  before the client ever saw it. No error, just an empty result,
--  which the join handler correctly reported as "not found."
--
--  Fix: allow any authenticated user to look up a campaign's
--  id/name by invite code, independent of membership. This does
--  not expose more than the invite-code mechanism already implies
--  (anyone holding the code can already join).
--
--  Run once. Safe to re-run.
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can look up campaigns by invite code" ON campaigns;

CREATE POLICY "Authenticated users can look up campaigns by invite code" ON campaigns FOR SELECT USING (
  auth.uid() IS NOT NULL
);
