// ============================================================
//  STARBOUND CHRONICLES — Item Catalog
//  Static reference data (same pattern as species/class data
//  elsewhere) — no DB table needed since nobody edits this in-app.
//  Picking an entry copies its stats + icon into a real
//  character_inventory / campaign_cargo row.
// ============================================================

// Species diet tags — must match SPECIES_REF diet strings used elsewhere.
const DIET = {
  OMNIVORE: 'omnivore', LITHIVORE: 'lithivore', HYPER: 'hyper-omnivore',
  DISSOLVENT: 'dissolvent', PHOTOSYNTHETIC: 'photosynthetic',
};

const GUN_ICON = i => `assets/sci-fi items/weapons/gun_icons_1/Icon29_${String(i).padStart(2,'0')}.png`;
const MISC_ICON = i => `assets/sci-fi items/various items/Icon14_${String(i).padStart(2,'0')}.png`;
const TOOL_ICON = i => `assets/sci-fi items/mining items/free_mining_icons_1/Icon31_${String(i).padStart(2,'0')}.png`;
const MINERAL_SHEET = 'assets/sci-fi items/mining items/spritesheets/StewV_Minerals_Sheet_01.png';
// 8 cols x 6 rows of 32x32 cells on a 256x192 sheet.
function mineralIcon(col, row) { return { sheet: MINERAL_SHEET, col, row, cellW: 32, cellH: 32, sheetW: 256, sheetH: 192 }; }

// ── WEAPONS ────────────────────────────────────────────────────
// Tiered by role so every class/species has viable starting-to-midgame options.
const WEAPON_TIERS = [
  { tag:'pistol',  dmg:'1d8',  acc:2,  range:20, weight:0.8, value:150 },
  { tag:'smg',     dmg:'1d10', acc:1,  range:25, weight:1.4, value:220 },
  { tag:'carbine', dmg:'2d6',  acc:1,  range:40, weight:2.2, value:320 },
  { tag:'rifle',   dmg:'2d8',  acc:0,  range:60, weight:3.0, value:420 },
  { tag:'shotgun', dmg:'3d6',  acc:-1, range:10, weight:3.4, value:380 },
  { tag:'sniper',  dmg:'3d8',  acc:2,  range:120,weight:4.2, value:650 },
  { tag:'heavy',   dmg:'4d6',  acc:-2, range:50, weight:6.0, value:800 },
  { tag:'melee',   dmg:'1d10', acc:1,  range:2,  weight:1.6, value:130 },
];
const WEAPON_NAMES = [
  ['Ion Snub','pistol'], ['Sidewinder Pistol','pistol'], ['Coil Pistol','pistol'], ['Scrapper Sidearm','pistol'],
  ['Rattler SMG','smg'], ['Buzzsaw SMG','smg'], ['Wasp-Pattern SMG','smg'],
  ['Mag-Slug Carbine','carbine'], ['Ridgeline Carbine','carbine'], ['Voidrunner Carbine','carbine'],
  ['Longbeam Rifle','rifle'], ['GAC Standard Rifle','rifle'], ['Patrol Rifle','rifle'], ['Marksman Rifle','rifle'],
  ['Breach Shotgun','shotgun'], ['Scatterblast','shotgun'], ['KEC Mining Shotgun','shotgun'],
  ['Farsight Sniper','sniper'], ['Ghostline Sniper','sniper'],
  ['Siege Cannon','heavy'], ['Plasma Ripper','heavy'], ['Autocannon Mk.I','heavy'],
  ['Vibroblade','melee'], ['Shock Knuckles','melee'], ['Mono-Edge Cutlass','melee'], ['Kragol War Pick','melee'],
  ['Deadbolt Pistol','pistol'], ['Nomad Pistol','pistol'],
  ['Fringe SMG','smg'], ['Salvager SMG','smg'],
  ['Border Carbine','carbine'],
  ['Skyline Rifle','rifle'], ['Void Pirate Rifle','rifle'],
  ['Close-Call Shotgun','shotgun'],
  ['Deepstrike Sniper','sniper'],
];
const WEAPONS = WEAPON_NAMES.map(([name, tag], i) => {
  const t = WEAPON_TIERS.find(w => w.tag === tag);
  return {
    key: 'wpn_' + name.toLowerCase().replace(/[^a-z0-9]+/g,'_'),
    name, category:'weapon', subcategory:tag,
    icon: GUN_ICON((i % 35) + 1),
    desc: `A ${tag === 'melee' ? 'close-combat' : tag} weapon common across the frontier.`,
    dmg: t.dmg, acc: t.acc, range: t.range, weight: t.weight, value: t.value,
  };
});

// ── MINERALS ───────────────────────────────────────────────────
// 6 colour families x 4 tiers, sliced straight off the mineral spritesheet.
const MINERAL_FAMILIES = [
  { name:'Ferrite',   row:0, color:'grey',   base:4 },
  { name:'Amethine',  row:1, color:'purple', base:9 },
  { name:'Coldveil',  row:2, color:'blue',   base:8 },
  { name:'Verdurite', row:3, color:'green',  base:7 },
  { name:'Bloodstone',row:4, color:'red',    base:11 },
  { name:'Sunshard',  row:5, color:'yellow', base:13 },
];
const MINERAL_TIERS = ['Ore', 'Cluster', 'Vein Cut', 'Refined'];
const MINERALS = [];
MINERAL_FAMILIES.forEach(fam => {
  MINERAL_TIERS.forEach((tier, ti) => {
    MINERALS.push({
      key: `min_${fam.color}_${ti}`,
      name: `${fam.name} ${tier}`,
      category: 'mineral', subcategory: fam.color,
      icon: mineralIcon(ti, fam.row),
      desc: `A ${tier.toLowerCase()} sample of ${fam.name.toLowerCase()}, a ${fam.color}-hued mineral prized by KEC prospectors.`,
      weight: 0.4 + ti * 0.3, value: fam.base * (ti + 1),
    });
  });
});

// ── RATIONS ────────────────────────────────────────────────────
const RATIONS = [
  { key:'ration_meat',   name:'Preserved Meat Ration',  category:'ration', dietTags:[DIET.OMNIVORE, DIET.HYPER], icon: MISC_ICON(28), desc:'Vacuum-sealed protein block. Tastes like a memory of meat.', weight:0.3, value:8 },
  { key:'ration_plant',  name:'Vac-Packed Plant Ration',category:'ration', dietTags:[DIET.OMNIVORE, DIET.HYPER], icon: MISC_ICON(29), desc:'Dense nutrient greens, freeze-dried for transit.', weight:0.2, value:6 },
  { key:'ration_baked',  name:'Ration Bread Loaf',      category:'ration', dietTags:[DIET.OMNIVORE, DIET.HYPER], icon: MISC_ICON(30), desc:'Dense, long-life baked ration bar. Better than the paste, barely.', weight:0.3, value:7 },
  { key:'ration_paste',  name:'Synthetic Nutrient Paste',category:'ration', dietTags:[DIET.OMNIVORE, DIET.HYPER], icon: MISC_ICON(31), desc:'Standard GAC-issue nutrient paste. Nobody likes it, everybody eats it.', weight:0.2, value:4 },
  { key:'ration_rock',   name:'Mineral Feed Block',     category:'ration', dietTags:[DIET.LITHIVORE], icon: TOOL_ICON(30), desc:'Compressed ore chips, ground fine enough for a Kragol to grind down.', weight:0.6, value:9 },
  { key:'ration_sludge', name:'Reclaimed Waste Slurry', category:'ration', dietTags:[DIET.DISSOLVENT], icon: MISC_ICON(32), desc:'Bio-processed chemical waste — a Myxos delicacy, allegedly.', weight:0.3, value:5 },
];

// ── ARMOR ──────────────────────────────────────────────────────
// Flat damage reduction (DR), capped at 5 — armor never affects the to-hit (AD) check, only
// how much of a landed hit's damage actually gets through.
const ARMOR_ITEMS = [
  { key:'armor_padded',   name:'Padded Undersuit',  category:'armor', dr:1, icon: MISC_ICON(33), desc:'Basic quilted lining under a flight suit. Barely there, but better than nothing.', weight:1.0, value:60 },
  { key:'armor_synthweave',name:'Synthweave Vest',   category:'armor', dr:2, icon: MISC_ICON(34), desc:'Layered synthetic fibre vest, standard frontier issue.', weight:1.8, value:140 },
  { key:'armor_riot',     name:'Riot Plating',       category:'armor', dr:3, icon: MISC_ICON(35), desc:'Rigid plate sections over a padded harness. Bulky but dependable.', weight:3.2, value:260 },
  { key:'armor_composite',name:'Composite Vest',     category:'armor', dr:3, icon: MISC_ICON(36), desc:'Ceramic-composite panels, lighter than riot plating for the same protection.', weight:2.4, value:320 },
  { key:'armor_kec_hauler',name:'KEC Hauler Rig',    category:'armor', dr:4, icon: MISC_ICON(37), desc:'Reinforced mining exosuit padding, built to take a beating from rockfall.', weight:4.0, value:420 },
  { key:'armor_gac_combat',name:'GAC Combat Plate',  category:'armor', dr:5, icon: MISC_ICON(38), desc:'Full military-grade plating. Top-of-the-line, priced like it.', weight:5.5, value:650 },
];

// ── GEAR ───────────────────────────────────────────────────────
const GEAR_NAMES = [
  'Multi-Tool Rig','Neural Tap Interface','Encrypted Comms Unit','Portable Med-Scanner','Grav-Boots',
  'Field Repair Kit','Handheld Scanner','Emergency O2 Cell','Thermal Cloak','Signal Jammer',
  'Portable Fabricator','Nav Beacon','Cutting Torch','Adhesive Patch Kit','Rebreather Mask',
  'Stim Injector','Anti-Rad Capsule','Data Slate','Universal Adapter','Magnetic Grapple',
  'Vacuum-Sealed Toolkit','Salvage Drone','Portable Shield Emitter','Sensor Drone','Flare Gun',
  'Climbing Rig','Water Reclaimer','Solar Charge Panel','Emergency Beacon','Toolbelt Rig',
];
const GEAR = GEAR_NAMES.map((name, i) => ({
  key: 'gear_' + name.toLowerCase().replace(/[^a-z0-9]+/g,'_'),
  name, category:'gear',
  icon: MISC_ICON((i % 40) + 1),
  desc: `Standard-issue frontier gear — a ${name.toLowerCase()} for whatever the job needs.`,
  weight: 0.5 + (i % 5) * 0.4, value: 40 + i * 15,
}));

// ── MINING TOOLS (gear subcategory) ─────────────────────────────
const MINING_TOOL_NAMES = [
  'Prospector\'s Pickaxe','Laser Drill','Ore Sample Case','Seismic Charge','Vein Scanner',
  'Reinforced Crate','Mining Beacon','Rock Saw','Pressure Sealant','Cargo Sled',
];
const MINING_TOOLS = MINING_TOOL_NAMES.map((name, i) => ({
  key: 'tool_' + name.toLowerCase().replace(/[^a-z0-9]+/g,'_'),
  name, category:'gear', subcategory:'mining',
  icon: TOOL_ICON((i % 29) + 1),
  desc: `Mining-rated equipment — a ${name.toLowerCase()} for cracking open the rock.`,
  weight: 1.5 + (i % 4) * 0.6, value: 60 + i * 20,
}));

const ITEM_CATALOG = [...WEAPONS, ...ARMOR_ITEMS, ...MINERALS, ...RATIONS, ...GEAR, ...MINING_TOOLS];

function catalogByCategory(cat) { return ITEM_CATALOG.filter(i => i.category === cat); }
function catalogFind(key) { return ITEM_CATALOG.find(i => i.key === key); }

// Renders either a plain <img> icon or a CSS-sliced spritesheet cell.
function catalogIconHtml(icon, size) {
  size = size || 28;
  if (typeof icon === 'string') return `<img src="${icon}" style="width:${size}px;height:${size}px;object-fit:contain;image-rendering:pixelated;" alt="">`;
  const scale = size / icon.cellW;
  const bgW = icon.sheetW * scale, bgH = icon.sheetH * scale;
  const bgX = -icon.col * icon.cellW * scale, bgY = -icon.row * icon.cellH * scale;
  return `<div style="width:${size}px;height:${size}px;background-image:url('${icon.sheet}');background-size:${bgW}px ${bgH}px;background-position:${bgX}px ${bgY}px;image-rendering:pixelated;"></div>`;
}
