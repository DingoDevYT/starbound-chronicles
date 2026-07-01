-- ============================================================
--  STARBOUND CHRONICLES — Schema v6
--  Per-component sprite variants + ship color scheme
--  Run AFTER schema-v5.sql. Safe to re-run.
-- ============================================================

-- Optional override art for a specific component. When set, this names a file
-- in assets/ship/ (without extension) to use instead of the hull-size default
-- sprite (e.g. Wing_Small, Thruster_Medium). Leave NULL to use the default.
ALTER TABLE ship_components ADD COLUMN IF NOT EXISTS sprite_key TEXT;

-- campaign_ships.color already exists (added in schema-v5) and is now used
-- as a multiply-tint applied to the body/wing/thruster sprites client-side.
-- No migration needed for it, just documenting the new meaning here.
