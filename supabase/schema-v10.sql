-- ============================================================
--  STARBOUND CHRONICLES — Schema v10
--  CRITICAL FIX: enable Realtime on every table the app subscribes to.
--
--  Root cause of "nothing updates live until I refresh": creating a
--  table with CREATE TABLE does NOT automatically make it broadcast
--  postgres_changes events. A table must be added to the
--  `supabase_realtime` publication first — that's a separate step none
--  of the previous schema files did. Every .on('postgres_changes', ...)
--  subscription in the app has been silently receiving nothing.
--
--  Run once. Safe to re-run (skips tables already in the publication).
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'campaigns', 'campaign_members', 'campaign_ships', 'ship_tokens',
    'ship_grid', 'ship_walls', 'initiative_tracker', 'campaign_quests',
    'campaign_npcs', 'ship_log', 'dice_rolls', 'characters'
  ] LOOP
    -- REPLICA IDENTITY FULL so UPDATE/DELETE payloads include the old row (needed to diff changes)
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', tbl);

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;
