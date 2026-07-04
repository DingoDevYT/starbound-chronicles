-- ============================================================
--  STARBOUND CHRONICLES — Schema v18
--  Item catalog support + rations.
--
--  The catalog itself (~100 weapons/minerals/rations/gear) lives in
--  js/catalog.js as static reference data, same pattern as species
--  and class data elsewhere in the app — it doesn't need to be a live
--  DB table since nobody edits it in-app. Picking a catalog item just
--  copies its stats + icon into a normal character_inventory /
--  campaign_cargo row, which is why those tables need a couple of
--  new columns:
--
--  - icon_path: which image to render for this item.
--  - diet_tag: for rations, which species diet it satisfies
--    (omnivore / lithivore / hyper-omnivore / dissolvent). Used to
--    grey out rations a character's species can't actually eat.
--
--  Run once. Safe to re-run.
-- ============================================================

ALTER TABLE character_inventory
  ADD COLUMN IF NOT EXISTS icon_path TEXT,
  ADD COLUMN IF NOT EXISTS diet_tag  TEXT;

ALTER TABLE campaign_cargo
  ADD COLUMN IF NOT EXISTS icon_path TEXT,
  ADD COLUMN IF NOT EXISTS diet_tag  TEXT;
