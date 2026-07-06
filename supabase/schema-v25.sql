-- ============================================================
--  STARBOUND CHRONICLES — Schema v25
--  Custom character art uploads.
--
--  Some players have their own commissioned/drawn art instead of
--  picking one of the built-in species/gender/variant portraits.
--  custom_portrait_url, when set, takes priority everywhere a
--  character's image renders (sheet portrait, crew roster thumbnail,
--  combat/ship tokens, GM view) — see characterPortraitPath() in
--  character.html/campaign.html/dashboard.html.
--
--  Storage: a public 'portraits' bucket, one folder per character
--  (object path `${character_id}/${filename}`), so RLS can scope
--  writes to the character's owner via storage.foldername(name).
--  Reads are public since portraits need to be visible to every
--  player in a shared campaign, not just the owner.
--
--  Run once. Safe to re-run.
-- ============================================================

ALTER TABLE characters ADD COLUMN IF NOT EXISTS custom_portrait_url TEXT DEFAULT NULL;

INSERT INTO storage.buckets (id, name, public)
VALUES ('portraits', 'portraits', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Portrait bucket public read" ON storage.objects;
DROP POLICY IF EXISTS "Owners upload their character portrait" ON storage.objects;
DROP POLICY IF EXISTS "Owners update their character portrait" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete their character portrait" ON storage.objects;

CREATE POLICY "Portrait bucket public read" ON storage.objects FOR SELECT USING (
  bucket_id = 'portraits'
);
CREATE POLICY "Owners upload their character portrait" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'portraits'
  AND EXISTS (SELECT 1 FROM characters WHERE id::text = (storage.foldername(name))[1] AND user_id = auth.uid())
);
CREATE POLICY "Owners update their character portrait" ON storage.objects FOR UPDATE USING (
  bucket_id = 'portraits'
  AND EXISTS (SELECT 1 FROM characters WHERE id::text = (storage.foldername(name))[1] AND user_id = auth.uid())
);
CREATE POLICY "Owners delete their character portrait" ON storage.objects FOR DELETE USING (
  bucket_id = 'portraits'
  AND EXISTS (SELECT 1 FROM characters WHERE id::text = (storage.foldername(name))[1] AND user_id = auth.uid())
);
