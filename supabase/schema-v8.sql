-- ============================================================
--  STARBOUND CHRONICLES — Schema v8
--  Fix: schema-v5.sql's INSERT statements had no ON CONFLICT guard,
--  so re-running that file (e.g. while troubleshooting) duplicated
--  every hull and component. This cleans up existing duplicates and
--  adds a UNIQUE constraint so it can't happen again.
--  Run once. Safe to re-run after the first time (no-ops on a clean DB).
--
--  NOTE: rewritten to avoid TEMP TABLE — Supabase's SQL editor runs
--  over a pooled connection, so a temp table created in one statement
--  can disappear before the next statement runs ("relation does not
--  exist"). Each step below is a single self-contained statement.
-- ============================================================

-- ─── Dedupe ship_types, repointing any campaign_ships that reference a duplicate ───
WITH ranked AS (
  SELECT id, name, ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at, id) AS rn
  FROM ship_types
),
keep_map AS (
  SELECT d.id AS dupe_id, k.id AS keep_id
  FROM ranked d JOIN ranked k ON k.name = d.name AND k.rn = 1
  WHERE d.rn > 1
)
UPDATE campaign_ships cs SET ship_type_id = km.keep_id
FROM keep_map km WHERE cs.ship_type_id = km.dupe_id;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at, id) AS rn
  FROM ship_types
)
DELETE FROM ship_types WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ─── Dedupe ship_components, repointing all three FK columns on campaign_ships ───
WITH ranked AS (
  SELECT id, name, ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at, id) AS rn
  FROM ship_components
),
keep_map AS (
  SELECT d.id AS dupe_id, k.id AS keep_id
  FROM ranked d JOIN ranked k ON k.name = d.name AND k.rn = 1
  WHERE d.rn > 1
)
UPDATE campaign_ships cs SET
  left_wing_id  = COALESCE((SELECT keep_id FROM keep_map WHERE dupe_id = cs.left_wing_id),  cs.left_wing_id),
  right_wing_id = COALESCE((SELECT keep_id FROM keep_map WHERE dupe_id = cs.right_wing_id), cs.right_wing_id),
  thruster_id   = COALESCE((SELECT keep_id FROM keep_map WHERE dupe_id = cs.thruster_id),   cs.thruster_id)
WHERE cs.left_wing_id  IN (SELECT dupe_id FROM keep_map)
   OR cs.right_wing_id IN (SELECT dupe_id FROM keep_map)
   OR cs.thruster_id   IN (SELECT dupe_id FROM keep_map);

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at, id) AS rn
  FROM ship_components
)
DELETE FROM ship_components WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ─── Prevent this from happening again (no-op if schema-v5.sql already added these) ───
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ship_types_name_key') THEN
    ALTER TABLE ship_types ADD CONSTRAINT ship_types_name_key UNIQUE (name);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ship_components_name_key') THEN
    ALTER TABLE ship_components ADD CONSTRAINT ship_components_name_key UNIQUE (name);
  END IF;
END $$;
