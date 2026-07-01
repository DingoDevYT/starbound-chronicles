-- ============================================================
--  STARBOUND CHRONICLES — Schema v4
--  Ship map editor: floor grid + wall edges + realtime
--  Run AFTER schema-v3.sql. Safe to re-run (IF NOT EXISTS).
-- ============================================================

-- ─── Floor tiles ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ship_grid (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  cell_x      INTEGER NOT NULL,
  cell_y      INTEGER NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, cell_x, cell_y)
);

-- ─── Wall edges ─────────────────────────────────────────────
-- dir: 'r' = right edge of (cell_x, cell_y)
--      'b' = bottom edge of (cell_x, cell_y)
CREATE TABLE IF NOT EXISTS ship_walls (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  cell_x      INTEGER NOT NULL,
  cell_y      INTEGER NOT NULL,
  dir         TEXT NOT NULL CHECK (dir IN ('r','b')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, cell_x, cell_y, dir)
);

-- ─── Full replica identity for realtime DELETE payloads ─────
ALTER TABLE ship_grid  REPLICA IDENTITY FULL;
ALTER TABLE ship_walls REPLICA IDENTITY FULL;
ALTER TABLE ship_tokens REPLICA IDENTITY FULL;

-- ─── Enable RLS ─────────────────────────────────────────────
ALTER TABLE ship_grid  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ship_walls ENABLE ROW LEVEL SECURITY;

-- ─── Drop old policies if they exist ────────────────────────
DROP POLICY IF EXISTS "Grid visible to members" ON ship_grid;
DROP POLICY IF EXISTS "GM edits grid"           ON ship_grid;
DROP POLICY IF EXISTS "Walls visible to members" ON ship_walls;
DROP POLICY IF EXISTS "GM edits walls"           ON ship_walls;

-- ─── ship_grid policies ─────────────────────────────────────
CREATE POLICY "Grid visible to members" ON ship_grid FOR SELECT USING (
  campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = ship_grid.campaign_id AND owner_id = auth.uid())
);

CREATE POLICY "GM edits grid" ON ship_grid FOR ALL USING (
  EXISTS (SELECT 1 FROM campaigns WHERE id = ship_grid.campaign_id AND owner_id = auth.uid())
);

-- ─── ship_walls policies ────────────────────────────────────
CREATE POLICY "Walls visible to members" ON ship_walls FOR SELECT USING (
  campaign_id IN (SELECT get_my_campaign_ids())
  OR EXISTS (SELECT 1 FROM campaigns WHERE id = ship_walls.campaign_id AND owner_id = auth.uid())
);

CREATE POLICY "GM edits walls" ON ship_walls FOR ALL USING (
  EXISTS (SELECT 1 FROM campaigns WHERE id = ship_walls.campaign_id AND owner_id = auth.uid())
);
