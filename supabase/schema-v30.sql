-- ============================================================
--  STARBOUND CHRONICLES — Schema v30
--  Multi-story tactical combat: combatants now stand on a floor LEVEL, and
--  custom battlefields carry a full 3D structure (floors/walls/stairs/props)
--  instead of a flat obstacle list.
--
--  - initiative_tracker.grid_z: which story a combatant is on (0 = ground).
--    Movement between levels happens via stair tiles; line-of-sight and
--    attacks are blocked between floors except where there's an opening.
--  - custom_maps.structure: JSONB list of placed 3D pieces authored in the
--    new 3D map editor — { levels, pieces:[{m:role, x, y, z, r}] }. The older
--    custom_maps.obstacles column stays for backward-compat with any flat
--    maps saved before this migration; new maps use `structure`.
--
--  Run once. Safe to re-run.
-- ============================================================

ALTER TABLE initiative_tracker
  ADD COLUMN IF NOT EXISTS grid_z INTEGER DEFAULT 0;

ALTER TABLE custom_maps
  ADD COLUMN IF NOT EXISTS structure JSONB;
