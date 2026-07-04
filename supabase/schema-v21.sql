-- ============================================================
--  STARBOUND CHRONICLES — Schema v21
--  Shields were only ever sourced from wings' shield_hp_mod. Any
--  ship missing a wing (or created during the earlier auto-equip
--  regression, before it was fixed) sits at a permanent 0/0 shield
--  bar. Per design, shields should primarily be the Technician's
--  reactor doing the work, with wings only a smaller top-up (already
--  the case) — so reactors now carry the bulk of shield capacity.
--
--  If your campaign's ship still shows 0 Shield after running this,
--  its reactor slot is empty — open the Ship Loadout panel and equip
--  one; recomputeShipStats() picks this up immediately.
--
--  Run once. Safe to re-run.
-- ============================================================

UPDATE ship_components SET shield_hp_mod = 20 WHERE name = 'Ion Core';
UPDATE ship_components SET shield_hp_mod = 15 WHERE name = 'Hyper-Flux';
UPDATE ship_components SET shield_hp_mod = 35 WHERE name = 'Overclock Drive';
