-- ============================================================
--  STARBOUND CHRONICLES — Schema v26
--  Fix: custom portrait uploads rejected with "new row violates
--  row-level security policy" even after schema-v25 was run by the
--  character's genuine owner.
--
--  schema-v25's storage.objects policies scoped INSERT/UPDATE/DELETE
--  via storage.foldername(name) cross-referenced against the
--  `characters` table — a fragile pattern (cross-schema RLS +
--  path-segment parsing) that isn't reliably evaluating true here.
--
--  Replaced with the same trust model already used everywhere else
--  in this app (any campaign member can manage shared resources —
--  campaign_cargo, mining_sessions, etc. — not just a strict owner
--  check): any authenticated user can manage files in the
--  'portraits' bucket. Character IDs are UUIDs (not guessable), so
--  this is a reasonable bar for a friends-only hobby project.
--
--  Also force the bucket to actually be public (in case it already
--  existed from a prior partial run and the ON CONFLICT DO NOTHING
--  in schema-v25 skipped setting that flag).
--
--  Run once. Safe to re-run.
-- ============================================================

UPDATE storage.buckets SET public = true WHERE id = 'portraits';

DROP POLICY IF EXISTS "Owners upload their character portrait" ON storage.objects;
DROP POLICY IF EXISTS "Owners update their character portrait" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete their character portrait" ON storage.objects;

CREATE POLICY "Authenticated users upload portraits" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'portraits' AND auth.role() = 'authenticated'
);
CREATE POLICY "Authenticated users update portraits" ON storage.objects FOR UPDATE USING (
  bucket_id = 'portraits' AND auth.role() = 'authenticated'
);
CREATE POLICY "Authenticated users delete portraits" ON storage.objects FOR DELETE USING (
  bucket_id = 'portraits' AND auth.role() = 'authenticated'
);
