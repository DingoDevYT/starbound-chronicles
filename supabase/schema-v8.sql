-- ============================================================
--  STARBOUND CHRONICLES — Schema v8
--  Fix: schema-v5.sql's INSERT statements had no ON CONFLICT guard,
--  so re-running that file (e.g. while troubleshooting) duplicated
--  every hull and component. This cleans up existing duplicates and
--  adds a UNIQUE constraint so it can't happen again.
--  Run once. Safe to re-run after the first time (no-ops on a clean DB).
-- ============================================================

-- ─── Dedupe ship_types, repointing any campaign_ships that reference a duplicate ───
CREATE TEMP TABLE _st_dupes AS
SELECT t1.id AS dupe_id,
       (SELECT t2.id FROM ship_types t2 WHERE t2.name = t1.name ORDER BY t2.created_at, t2.id LIMIT 1) AS keep_id
FROM ship_types t1;
DELETE FROM _st_dupes WHERE dupe_id = keep_id;

UPDATE campaign_ships cs SET ship_type_id = d.keep_id FROM _st_dupes d WHERE cs.ship_type_id = d.dupe_id;
DELETE FROM ship_types WHERE id IN (SELECT dupe_id FROM _st_dupes);
DROP TABLE _st_dupes;

-- ─── Dedupe ship_components, repointing all three FK columns on campaign_ships ───
CREATE TEMP TABLE _sc_dupes AS
SELECT c1.id AS dupe_id,
       (SELECT c2.id FROM ship_components c2 WHERE c2.name = c1.name ORDER BY c2.created_at, c2.id LIMIT 1) AS keep_id
FROM ship_components c1;
DELETE FROM _sc_dupes WHERE dupe_id = keep_id;

UPDATE campaign_ships cs SET left_wing_id  = d.keep_id FROM _sc_dupes d WHERE cs.left_wing_id  = d.dupe_id;
UPDATE campaign_ships cs SET right_wing_id = d.keep_id FROM _sc_dupes d WHERE cs.right_wing_id = d.dupe_id;
UPDATE campaign_ships cs SET thruster_id  = d.keep_id FROM _sc_dupes d WHERE cs.thruster_id  = d.dupe_id;
DELETE FROM ship_components WHERE id IN (SELECT dupe_id FROM _sc_dupes);
DROP TABLE _sc_dupes;

-- ─── Prevent this from happening again (no-op if schema-v5.sql already added these) ───
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ship_types_name_key') THEN
    ALTER TABLE ship_types ADD CONSTRAINT ship_types_name_key UNIQUE (name);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ship_components_name_key') THEN
    ALTER TABLE ship_components ADD CONSTRAINT ship_components_name_key UNIQUE (name);
  END IF;
END $$;
