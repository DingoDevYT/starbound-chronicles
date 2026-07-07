// ═══════════════════════════════════════════════════════════════════════════
// STARBOUND CHRONICLES — parametric 3D structure renderer (classic script).
// Loaded by campaign.html AND dev/harness.html so combat, the map editor and
// the visual test harness all draw battlefields through the exact same code.
//
// Everything structural (floors, walls, windows, railings, stairs, slopes,
// terrain, posts) is EXACT-SIZED generated geometry — no GLB bounding-box
// fitting, so nothing can clip, z-fight or mis-scale by construction. Kenney
// GLB models are used only for props/decor, where a loose fit is fine.
//
// Piece roles ({m, x, y, z, r, v?, s?}):
//   floor    thin slab whose TOP sits at z*floorH (z levels are half a tile)
//   terrain  solid block from the ground up to z*floorH (raised earth — you
//            stand on top; the inside blocks shots and movement)
//   wall     full-storey panel on cell EDGE r (0=N,1=E,2=S,3=W)
//   window   wall with a glass opening (blocks movement, not sight)
//   railing  low parapet on edge r (blocks movement, not sight — grants cover)
//   stairs   real stepped staircase climbing a full storey toward r
//   slope    wedge ramp climbing one half-tile level toward r
//   post     thin support column from the ground to the deck at z (visual)
//   prop-*   themed GLB decor/cover (v picks a model, r faces it, s scales it)
// ═══════════════════════════════════════════════════════════════════════════

const SC_DIR4 = [ [0,-1], [1,0], [0,1], [-1,0] ]; // r: 0 N, 1 E, 2 S, 3 W
const SC_STOREY = 2;                              // one storey = 2 half-tile levels

// ── Theme model kits (props + per-theme GLB pools). Shared here so the harness
// can render the same prop sets campaign.html uses. ──────────────────────────
const SC_NATURE_BASE = 'assets/3d/kenney_nature-kit/Models/GLTF format/';
const COMBAT_3D_THEMES = {
  // ── Primary themes (match the on-foot battlefield presets) ──
  plain: {
    base: SC_NATURE_BASE,
    obstacles: [
      'tree_pineTallA.glb', 'tree_pineTallB.glb', 'tree_pineRoundA.glb', 'tree_default.glb', 'tree_oak.glb', 'tree_fat.glb',
      'tree_pineSmallA.glb', 'tree_pineSmallB.glb', 'tree_thin.glb', 'tree_small.glb', 'tree_tall.glb',
      'rock_largeA.glb', 'rock_smallA.glb', 'log.glb', 'log_stack.glb', 'stump_round.glb',
      'mushroom_redGroup.glb', 'flower_purpleA.glb', 'grass_leafsLarge.glb',
    ],
  },
  canyon: {
    base: SC_NATURE_BASE,
    obstacles: [
      'rock_largeA.glb', 'rock_largeB.glb', 'rock_tallA.glb', 'rock_tallB.glb', 'rock_tallC.glb',
      'rock_smallA.glb', 'rock_smallB.glb', 'stump_old.glb', 'log.glb', 'tree_thin.glb',
    ],
  },
  ruins: {
    base: 'assets/3d/kenney_mini-dungeon/Models/GLB format/',
    obstacles: ['column.glb', 'rocks.glb', 'stones.glb', 'wood-structure.glb', 'wood-support.glb', 'barrel.glb', 'wall-half.glb'],
    obstaclesExtra: { base: SC_NATURE_BASE, items: ['rock_smallA.glb', 'rock_smallB.glb', 'grass_leafsLarge.glb'] },
  },
  desert: {
    base: SC_NATURE_BASE,
    obstacles: ['rock_largeA.glb', 'rock_smallA.glb', 'rock_tallC.glb', 'rock_smallB.glb', 'stump_round.glb', 'log_stack.glb'],
  },
  facility: {
    base: 'assets/3d/kenney_factory-kit_3.0/Models/GLB format/',
    obstacles: ['box-large.glb', 'box-long.glb', 'box-small.glb', 'box-wide.glb', 'machine.glb', 'machine-bed.glb', 'machine-fortified.glb', 'pipe-glass-large-long.glb', 'pipe-glass-large-bend.glb'],
  },
  // ── Legacy keys (older saved custom maps still reference these) ──
  arena: {
    base: 'assets/3d/kenney_mini-arena/Models/GLB format/',
    floor: 'floor.glb',
    obstacles: ['block.glb', 'column.glb', 'column-damaged.glb', 'tree.glb', 'statue.glb', 'weapon-rack.glb'],
    fogColor: 0x05070d, skyTop: 0x142a4a,
  },
  forest: {
    base: 'assets/3d/kenney_retro-urban-kit/Models/GLB format/',
    floor: 'grass.glb',
    obstacles: ['tree-large.glb', 'tree-shrub.glb'],
    obstaclesExtra: {
      base: 'assets/3d/kenney_nature-kit/Models/GLTF format/',
      items: [
        'tree_pineTallA.glb', 'tree_pineTallB.glb', 'tree_pineRoundA.glb', 'tree_default.glb', 'tree_oak.glb', 'tree_fat.glb',
        'tree_pineSmallA.glb', 'tree_pineSmallB.glb', 'tree_thin.glb', 'tree_small.glb', 'tree_tall.glb',
        'rock_largeA.glb', 'rock_tallA.glb', 'rock_smallA.glb', 'rock_smallB.glb', 'rock_tallC.glb',
        'log.glb', 'log_stack.glb', 'stump_round.glb', 'stump_old.glb',
        'mushroom_redGroup.glb', 'mushroom_tanGroup.glb', 'flower_purpleA.glb', 'grass_leafsLarge.glb',
      ],
    },
    fogColor: 0x0a1a0d, skyTop: 0x1c3a24,
  },
  town: {
    base: 'assets/3d/kenney_retro-urban-kit/Models/GLB format/',
    floor: 'road-asphalt-center.glb',
    obstacles: [
      'detail-dumpster-closed.glb', 'detail-dumpster-open.glb', 'detail-barrier-type-a.glb', 'detail-barrier-strong-type-a.glb',
      'detail-bench.glb', 'detail-light-single.glb', 'pallet.glb', 'pallet-small.glb', 'tree-small.glb',
      'tree-park-large.glb', 'tree-shrub.glb', 'truck-grey.glb', 'truck-green-cargo.glb', 'wall-a-column.glb',
    ],
    fogColor: 0x0d0f16, skyTop: 0x24283a,
  },
  dungeon: {
    base: 'assets/3d/kenney_mini-dungeon/Models/GLB format/',
    floor: 'floor.glb',
    obstacles: ['column.glb', 'barrel.glb', 'chest.glb', 'rocks.glb', 'stones.glb', 'wood-structure.glb', 'wood-support.glb', 'wall-half.glb', 'banner.glb'],
    fogColor: 0x08060a, skyTop: 0x180e1a,
  },
  factory: {
    base: 'assets/3d/kenney_factory-kit_3.0/Models/GLB format/',
    floor: 'floor.glb',
    obstacles: ['box-large.glb', 'box-long.glb', 'box-small.glb', 'box-wide.glb', 'machine.glb', 'machine-bed.glb', 'machine-fortified.glb', 'pipe-glass-large-long.glb', 'pipe-glass-large-bend.glb'],
    fogColor: 0x0a0c10, skyTop: 0x1c2028,
  },
};

// ── Per-theme color palettes (sRGB hex, converted to linear at material time
// so the renderer's sRGB output pipeline shows them true). ───────────────────
const SC_PALETTES = {
  // ── Primary theme identities — matched to the battlefield presets' actual settings
  // (Rocky Canyon is orange rock, Desert Wastes is sand, etc.), not asset-kit names. ──
  plain: {
    ground: 0x5d8a4a, floorA: 0x6f9e58, floorB: 0x669454, deckA: 0x8a6a45, deckB: 0x7c5e3c,
    wall: 0x6b5137, glass: 0xcfe8ff, railing: 0x6d5439, stairs: 0x8a6a45, slope: 0x639252,
    terrain: 0x5c8b49, post: 0x54402b, grid: 0x1d2f18, rough: 0.92, metal: 0.0,
  },
  canyon: {
    ground: 0xb4713a, floorA: 0xcf9052, floorB: 0xc28147, deckA: 0xc99a66, deckB: 0xbd8d59,
    wall: 0xb97f4e, glass: 0xaed9f5, railing: 0x8a5a32, stairs: 0xb98a5a, slope: 0xd6924e,
    terrain: 0xd6924e, post: 0x7c4f2b, grid: 0x40260f, rough: 0.9, metal: 0.0,
  },
  ruins: {
    ground: 0x8b8577, floorA: 0xa39c8b, floorB: 0x968f7d, deckA: 0xa89f8d, deckB: 0x9d9482,
    wall: 0x9a917d, glass: 0xa9c8e0, railing: 0x6f685a, stairs: 0x968d7a, slope: 0x998f7d,
    terrain: 0x8f887a, post: 0x5f594c, grid: 0x2b2820, rough: 0.9, metal: 0.02,
  },
  desert: {
    ground: 0xc9a25e, floorA: 0xdbb877, floorB: 0xd0ab69, deckA: 0xcaa76a, deckB: 0xbf9c5f,
    wall: 0xc4a06a, glass: 0xaed9f5, railing: 0x8f7443, stairs: 0xbf9a5f, slope: 0xd9b06a,
    terrain: 0xd9b06a, post: 0x7c6338, grid: 0x3d2f16, rough: 0.92, metal: 0.0,
  },
  facility: {
    ground: 0x565e66, floorA: 0x707b84, floorB: 0x636e77, deckA: 0x8b959e, deckB: 0x7e8891,
    wall: 0x4c565e, glass: 0x93c8e8, railing: 0xd9a53a, stairs: 0x7b858e, slope: 0x6b757e,
    terrain: 0x646d75, post: 0x3f484f, grid: 0x14181c, rough: 0.55, metal: 0.3,
  },
  // ── Legacy keys (older saved custom maps + battles reference these) ──
  arena: {
    ground: 0x7d8a99, floorA: 0xaab5c2, floorB: 0x99a5b3, deckA: 0xb4bec9, deckB: 0xa6b1bd,
    wall: 0x67788c, glass: 0x8ec8ef, railing: 0x45525f, stairs: 0x8b97a5, slope: 0x93a0ae,
    terrain: 0x8794a3, post: 0x45525f, grid: 0x1a2530, rough: 0.82, metal: 0.06,
  },
  forest: {
    ground: 0x4f7c3c, floorA: 0x649250, floorB: 0x578547, deckA: 0x8a6a45, deckB: 0x7c5e3c,
    wall: 0x6b5137, glass: 0xcfe8ff, railing: 0x6d5439, stairs: 0x8a6a45, slope: 0x639252,
    terrain: 0x5c8b49, post: 0x54402b, grid: 0x1d2f18, rough: 0.92, metal: 0.0,
  },
  town: {
    ground: 0x6b7076, floorA: 0x8b9198, floorB: 0x7d848b, deckA: 0xafa28b, deckB: 0xa2957d,
    wall: 0xbcab8e, glass: 0x9cc8e8, railing: 0x77705f, stairs: 0x968c78, slope: 0x8b9198,
    terrain: 0x80858b, post: 0x66604f, grid: 0x1f2226, rough: 0.85, metal: 0.04,
  },
  dungeon: {
    ground: 0x413c4e, floorA: 0x685f7a, floorB: 0x5c546d, deckA: 0x776e8a, deckB: 0x6c637e,
    wall: 0x494257, glass: 0x8ba6cf, railing: 0x3d374b, stairs: 0x716886, slope: 0x655c76,
    terrain: 0x554d66, post: 0x383244, grid: 0x171320, rough: 0.9, metal: 0.03,
  },
  factory: {
    ground: 0x565e66, floorA: 0x707b84, floorB: 0x636e77, deckA: 0x8b959e, deckB: 0x7e8891,
    wall: 0x4c565e, glass: 0x93c8e8, railing: 0xd9a53a, stairs: 0x7b858e, slope: 0x6b757e,
    terrain: 0x646d75, post: 0x3f484f, grid: 0x14181c, rough: 0.55, metal: 0.3,
  },
};
function scPalette(themeKey) { return SC_PALETTES[themeKey] || SC_PALETTES.arena; }
function scIsProp(role) { return !!role && role.startsWith('prop'); }
function scHash(x, y) { return Math.abs(Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1; }
function scColor(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }

// Material cache — one MeshStandardMaterial per theme+role (+faded editor variant).
const scMatCache = new Map();
function scMaterial(themeKey, role, faded) {
  const key = themeKey + '|' + role + '|' + (faded ? 1 : 0);
  if (scMatCache.has(key)) return scMatCache.get(key);
  const P = scPalette(themeKey);
  let mat;
  if (role === 'glass') {
    mat = new THREE.MeshStandardMaterial({ color: scColor(P.glass), transparent: true, opacity: 0.35, roughness: 0.15, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
  } else {
    mat = new THREE.MeshStandardMaterial({ color: scColor(P[role] != null ? P[role] : 0xffffff), roughness: P.rough, metalness: P.metal });
  }
  if (faded) { mat = mat.clone(); mat.transparent = true; mat.opacity = 0.15; mat.depthWrite = false; }
  scMatCache.set(key, mat);
  return mat;
}
let scGhostMatCache = null;
function scGhostMat() {
  if (!scGhostMatCache) scGhostMatCache = new THREE.MeshBasicMaterial({ color: 0x4dc0ff, transparent: true, opacity: 0.45, depthWrite: false });
  return scGhostMatCache;
}
let scEraseMatCache = null;
function scEraseMat() {
  if (!scEraseMatCache) scEraseMatCache = new THREE.MeshBasicMaterial({ color: 0xff5f5f, transparent: true, opacity: 0.4, depthWrite: false });
  return scEraseMatCache;
}
let scPickMatCache = null;
function scPickMat() {
  if (!scPickMatCache) scPickMatCache = new THREE.MeshBasicMaterial({ visible: false });
  return scPickMatCache;
}

// Geometry cache (geometries depend only on cell/floorH and, for terrain/posts, z).
const scGeoCache = new Map();
function scCachedGeo(key, make) {
  if (!scGeoCache.has(key)) scGeoCache.set(key, make());
  return scGeoCache.get(key);
}

// Extruded profile rising toward NORTH (grid -y / world -z) — see mapping note:
// shape (sx,sy) extruded depth w, then rotateY(π/2) ⇒ world x = extrude-z − w/2,
// world y = sy, world z = −sx. So +sx in the profile faces world NORTH. ✓
function scProfileGeo(profilePts, depth) {
  const shape = new THREE.Shape();
  shape.moveTo(profilePts[0][0], profilePts[0][1]);
  for (let i = 1; i < profilePts.length; i++) shape.lineTo(profilePts[i][0], profilePts[i][1]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 });
  geo.rotateY(Math.PI / 2);
  geo.translate(-depth / 2, 0, 0);
  return geo;
}
function scStairsGeo(cell, rise) {
  return scCachedGeo(`stairs|${cell}|${rise}`, () => {
    const n = 6, d = cell, pts = [[-d / 2, 0]];
    for (let i = 0; i < n; i++) {
      const x0 = -d / 2 + i * d / n, x1 = -d / 2 + (i + 1) * d / n;
      pts.push([x0, (i + 1) * rise / n], [x1, (i + 1) * rise / n]);
    }
    pts.push([d / 2, 0]);
    return scProfileGeo(pts, cell * 0.96);
  });
}
function scSlopeGeo(cell, rise) {
  return scCachedGeo(`slope|${cell}|${rise}`, () =>
    scProfileGeo([[-cell / 2, 0], [cell / 2, 0], [cell / 2, rise]], cell));
}

// Build ONE piece as an Object3D whose local origin is the CELL CENTER at the
// piece's own level height (caller positions it at (x*cell, z*floorH, y*cell)).
// Rotation/edge offsets for r are baked in. `o.ghost` renders it as a hologram.
function scBuildPieceMesh(p, themeKey, cell, floorH, o) {
  o = o || {};
  const slab = cell * 0.06, wallT = cell * 0.07, storeyH = floorH * SC_STOREY;
  const mat = role => o.ghost ? scGhostMat() : scMaterial(themeKey, role, o.faded);
  const shadows = m => { if (!o.ghost && !o.faded) { m.castShadow = true; m.receiveShadow = true; } return m; };
  const r = (p.r || 0) % 4, [dx, dy] = SC_DIR4[r];

  if (p.m === 'floor') {
    const g = scCachedGeo(`floor|${cell}`, () => new THREE.BoxGeometry(cell, slab, cell));
    const m = shadows(new THREE.Mesh(g, mat('floorA')));
    m.position.y = -slab / 2;
    return m;
  }
  if (p.m === 'terrain') {
    const hgt = Math.max(p.z * floorH, slab) + slab; // reaches slab-depth below ground so seams never show
    const g = scCachedGeo(`terrain|${cell}|${hgt.toFixed(3)}`, () => new THREE.BoxGeometry(cell, hgt, cell));
    // Sides get a darkened variant of the terrain tone so raised ground reads as a
    // carved block instead of a floating flat patch (box material order: +x,-x,+y,-y,+z,-z).
    let matArr;
    if (o.ghost) matArr = scGhostMat();
    else {
      const side = scMaterial(themeKey, 'terrainSide', o.faded);
      if (!side.userData.tinted) { side.color.copy(scColor(scPalette(themeKey).terrain)).multiplyScalar(0.72); side.userData.tinted = true; }
      const top = mat('terrain');
      matArr = [side, side, top, side, side, side];
    }
    const m = shadows(new THREE.Mesh(g, matArr));
    m.position.y = -hgt / 2; // top face at the piece's level height
    return m;
  }
  if (p.m === 'wall' || p.m === 'window' || p.m === 'railing') {
    const L = cell + wallT; // slightly long so perpendicular walls meet cleanly at corners
    const inner = new THREE.Group();
    if (p.m === 'wall') {
      const m = shadows(new THREE.Mesh(scCachedGeo(`wallbox|${cell}|${storeyH}`, () => new THREE.BoxGeometry(L, storeyH, wallT)), mat('wall')));
      m.position.y = storeyH / 2;
      inner.add(m);
    } else if (p.m === 'window') {
      const H = storeyH;
      const parts = [ // [w, h, cy, isGlass]
        [L, 0.45 * H, 0.225 * H, false],          // sill
        [L, 0.15 * H, 0.925 * H, false],          // lintel
        [0.22 * L, 0.40 * H, 0.65 * H, false],    // left column (x offset below)
        [0.22 * L, 0.40 * H, 0.65 * H, false],    // right column
        [0.56 * L, 0.40 * H, 0.65 * H, true],     // glass pane
      ];
      parts.forEach((pt, i) => {
        const [w, h, cy, glass] = pt;
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, glass ? wallT * 0.3 : wallT), mat(glass ? 'glass' : 'wall'));
        if (!glass) shadows(m);
        m.position.set(i === 2 ? -0.39 * L : i === 3 ? 0.39 * L : 0, cy, 0);
        inner.add(m);
      });
    } else { // railing — low bar + posts
      const H = storeyH * 0.35;
      const bar = shadows(new THREE.Mesh(new THREE.BoxGeometry(L, storeyH * 0.05, wallT * 0.7), mat('railing')));
      bar.position.y = H;
      inner.add(bar);
      for (const px of [-0.4 * L, 0, 0.4 * L]) {
        const post = shadows(new THREE.Mesh(new THREE.BoxGeometry(wallT * 0.7, H, wallT * 0.7), mat('railing')));
        post.position.set(px, H / 2, 0);
        inner.add(post);
      }
    }
    inner.rotation.y = (r % 2 === 1) ? Math.PI / 2 : 0; // N/S edges run E-W; E/W edges run N-S
    inner.position.set(dx * cell / 2, 0, dy * cell / 2);
    const wrap = new THREE.Group();
    wrap.add(inner);
    return wrap;
  }
  if (p.m === 'stairs' || p.m === 'slope') {
    const rise = p.m === 'stairs' ? storeyH : floorH;
    const g = p.m === 'stairs' ? scStairsGeo(cell, rise) : scSlopeGeo(cell, rise);
    const m = shadows(new THREE.Mesh(g, mat(p.m)));
    m.rotation.y = r * -Math.PI / 2;
    return m;
  }
  if (p.m === 'post') {
    const hgt = Math.max(p.z * floorH - slab, slab);
    const g = scCachedGeo(`post|${cell}|${hgt.toFixed(3)}`, () => new THREE.BoxGeometry(wallT * 1.2, hgt, wallT * 1.2));
    const m = shadows(new THREE.Mesh(g, mat('post')));
    m.position.y = -slab - hgt / 2; // hangs from just under the deck down to the ground
    return m;
  }
  // Unknown role — render nothing (engine ignores it too).
  return new THREE.Group();
}

// ── Full structure → THREE.Group. Synchronous (geometry only). Floors are one
// InstancedMesh (checkerboard per cell via instance colors). Props are returned
// for the caller to place as GLBs. opts.fadeAboveZ ghosts pieces above a level
// (editor slicing); opts.picks=false skips the invisible click-pick tiles. ────
function buildStructureGroup(structure, themeKey, cell, floorH, opts) {
  opts = opts || {};
  const group = new THREE.Group(), picks = [], props = [];
  const fadeZ = (opts.fadeAboveZ == null) ? Infinity : opts.fadeAboveZ;
  const P = scPalette(themeKey);
  const slab = cell * 0.06;
  const floorsSolid = [], floorsFaded = [];

  for (const p of (structure.pieces || [])) {
    if (p.m === 'floor') {
      (p.z > fadeZ ? floorsFaded : floorsSolid).push(p);
    } else if (scIsProp(p.m)) {
      props.push(p);
    } else if (p.m === 'terrain' || p.m === 'wall' || p.m === 'window' || p.m === 'railing' || p.m === 'stairs' || p.m === 'slope' || p.m === 'post') {
      const mesh = scBuildPieceMesh(p, themeKey, cell, floorH, { faded: p.z > fadeZ });
      // ADD the level height — don't overwrite Y. scBuildPieceMesh bakes a local Y offset into
      // solid pieces (terrain sits at -hgt/2, floor at -slab/2, post below the deck) so their
      // TOP lands exactly at the piece height; overwriting Y here floated tall terrain blocks
      // half their height off the ground.
      mesh.position.x = p.x * cell;
      mesh.position.z = p.y * cell;
      mesh.position.y += p.z * floorH;
      group.add(mesh);
    }
    if (opts.picks !== false && (p.m === 'floor' || p.m === 'terrain' || p.m === 'stairs' || p.m === 'slope')) {
      const pick = new THREE.Mesh(scCachedGeo(`pick|${cell}`, () => new THREE.PlaneGeometry(cell, cell)), scPickMat());
      pick.rotation.x = -Math.PI / 2;
      pick.position.set(p.x * cell, p.z * floorH + 0.02, p.y * cell);
      pick.userData.cell = { x: p.x, y: p.y, z: p.z };
      group.add(pick);
      picks.push(pick);
    }
  }

  // ── Auto-supports: any elevated floor deck with nothing beneath it (no ground/terrain
  // in its column and no wall on its cell at lower storeys) gets corner legs, and its
  // exposed edges get a fascia skirt — so platforms read as BUILT structures instead of
  // slabs hovering on air. Roofs over walled rooms are already supported and get none. ──
  const supported = new Set(), floorAtKey = new Set();
  for (const p of (structure.pieces || [])) {
    if ((p.m === 'floor' || p.m === 'terrain' || p.m === 'stairs' || p.m === 'slope')) floorAtKey.add(p.x + ',' + p.y + ',' + p.z);
    if ((p.m === 'floor' && p.z === 0) || p.m === 'terrain' || p.m === 'stairs' || p.m === 'slope') supported.add(p.x + ',' + p.y);
    if (p.m === 'wall' || p.m === 'window') {
      const [dx, dy] = SC_DIR4[(p.r || 0) % 4];
      supported.add(p.x + ',' + p.y);
      supported.add((p.x + dx) + ',' + (p.y + dy)); // a wall props up the decks on both sides of its edge
    }
  }
  const legGeoCache = {};
  for (const p of (structure.pieces || [])) {
    if (p.m !== 'floor' || p.z <= 0 || supported.has(p.x + ',' + p.y)) continue;
    const faded = p.z > fadeZ;
    const legMat = scMaterial(themeKey, 'post', faded);
    const wallT = cell * 0.07, legH = p.z * floorH - slab;
    const legKey = legH.toFixed(3);
    if (!legGeoCache[legKey]) legGeoCache[legKey] = new THREE.BoxGeometry(wallT * 1.1, legH, wallT * 1.1);
    for (const [lx, lz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) {
      const leg = new THREE.Mesh(legGeoCache[legKey], legMat);
      leg.position.set(p.x * cell + lx * cell, p.z * floorH - slab - legH / 2, p.y * cell + lz * cell);
      if (!faded) { leg.castShadow = true; leg.receiveShadow = true; }
      group.add(leg);
    }
    // fascia skirt on edges with no neighbouring deck at the same level
    SC_DIR4.forEach(([dx, dy], r) => {
      if (floorAtKey.has((p.x + dx) + ',' + (p.y + dy) + ',' + p.z)) return;
      const band = new THREE.Mesh(
        scCachedGeo(`fascia|${cell}`, () => new THREE.BoxGeometry(cell, cell * 0.14, cell * 0.05)),
        scMaterial(themeKey, 'railing', faded)
      );
      band.rotation.y = (r % 2 === 1) ? Math.PI / 2 : 0;
      band.position.set(p.x * cell + dx * cell * 0.48, p.z * floorH - slab - cell * 0.06, p.y * cell + dy * cell * 0.48);
      if (!faded) { band.castShadow = true; band.receiveShadow = true; }
      group.add(band);
    });
  }

  const addFloorInstances = (list, faded) => {
    if (!list.length) return;
    const geo = scCachedGeo(`floor|${cell}`, () => new THREE.BoxGeometry(cell, slab, cell));
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: P.rough, metalness: P.metal });
    if (faded) { m.transparent = true; m.opacity = 0.15; m.depthWrite = false; }
    const inst = new THREE.InstancedMesh(geo, m, list.length);
    inst.receiveShadow = !faded; inst.castShadow = !faded;
    const m4 = new THREE.Matrix4();
    const cGA = scColor(P.floorA), cGB = scColor(P.floorB), cDA = scColor(P.deckA), cDB = scColor(P.deckB);
    list.forEach((p, i) => {
      m4.makeTranslation(p.x * cell, p.z * floorH - slab / 2, p.y * cell);
      inst.setMatrixAt(i, m4);
      const alt = (p.x + p.y) % 2 !== 0;
      inst.setColorAt(i, p.z > 0 ? (alt ? cDB : cDA) : (alt ? cGB : cGA));
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);
  };
  addFloorInstances(floorsSolid, false);
  addFloorInstances(floorsFaded, true);

  return { group, picks, props };
}

// Big soft-colored ground plane far past the battlefield, fading into the fog.
function scBuildSurround(themeKey, w, h, cell) {
  const P = scPalette(themeKey);
  const slab = cell * 0.06;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700),
    new THREE.MeshStandardMaterial({ color: scColor(P.ground), roughness: 0.95, metalness: 0 })
  );
  mesh.rotation.x = -Math.PI / 2;
  // Just a hair below the floor tops — flush with the battlefield, so the map doesn't
  // read as a raised tray hovering above the world.
  mesh.position.set((w - 1) * cell / 2, -0.03, (h - 1) * cell / 2);
  mesh.receiveShadow = true;
  return mesh;
}

// Daylight fog scaled to the battlefield so the PLAY AREA stays crisp and only
// the far surround melts into the sky haze.
function scFogRange(w, h, cell) {
  const span = Math.max(w, h) * cell;
  return { color: 0xbcd4ea, near: span * 1.6, far: span * 4.2 };
}
function scApplyFog(scene, w, h, cell) {
  const f = scFogRange(w, h, cell);
  if (!scene.fog) scene.fog = new THREE.Fog(f.color, f.near, f.far);
  else { scene.fog.color.setHex(f.color); scene.fog.near = f.near; scene.fog.far = f.far; }
}

// Battlefield grid lines at exact cell boundaries (y slightly above the floor top).
function scGridLines(x0, x1, y0, y1, cell, colorHex, opacity) {
  const verts = [];
  for (let gx = x0; gx <= x1; gx++) verts.push((gx - 0.5) * cell, 0, (y0 - 0.5) * cell, (gx - 0.5) * cell, 0, (y1 - 0.5) * cell);
  for (let gy = y0; gy <= y1; gy++) verts.push((x0 - 0.5) * cell, 0, (gy - 0.5) * cell, (x1 - 0.5) * cell, 0, (gy - 0.5) * cell);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  const mat = new THREE.LineBasicMaterial({ color: scColor(colorHex), transparent: true, opacity: opacity != null ? opacity : 0.3 });
  const lines = new THREE.LineSegments(geo, mat);
  lines.position.y = 0.015;
  return lines;
}

// Which cell edge is nearest to a point within a cell? fx/fz are the offsets
// from the cell center in world units, cell the cell size. → r 0..3.
function scNearestEdgeR(fx, fz, cell) {
  const half = cell / 2;
  const d = [half + fz, half - fx, half - fz, half + fx]; // N,E,S,W distances
  let best = 0;
  for (let i = 1; i < 4; i++) if (d[i] < d[best]) best = i;
  return best;
}

// ── GLB prop loading (props only — structures never touch this path). ───────
const scModelCache = new Map();
function scLoadModel3D(path) {
  if (!scModelCache.has(path)) {
    scModelCache.set(path, new Promise((resolve, reject) => {
      new THREE.GLTFLoader().load(path, g => resolve(g.scene), undefined, reject);
    }));
  }
  return scModelCache.get(path);
}
async function scCloneModel3D(path) {
  const src = await scLoadModel3D(path);
  const clone = src.clone(true);
  clone.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    // Some Kenney GLTF exports (notably the nature kit) ship with metalness=1, which
    // renders BLACK under plain lights (a fully-metallic surface only shows reflections,
    // and we have no environment map). Clamp it so the authored colors actually show.
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
      if (m && m.metalness !== undefined && m.metalness > 0.4 && !m.userData.scFixed) {
        // These exports also store sRGB color values where glTF expects linear, so on
        // top of the metalness clamp, reinterpret the color — otherwise it washes out.
        m.metalness = 0.1; m.color.convertSRGBToLinear(); m.userData.scFixed = true; m.needsUpdate = true;
      }
    });
  });
  return clone;
}
function scPropModelPath(themeKey, p) {
  const t = COMBAT_3D_THEMES[themeKey] || COMBAT_3D_THEMES.arena;
  const pool = (t.obstacles || []).map(f => t.base + f)
    .concat(t.obstaclesExtra ? t.obstaclesExtra.items.map(f => t.obstaclesExtra.base + f) : []);
  if (!pool.length) return null;
  const idx = (p.v != null) ? (p.v % pool.length) : Math.floor(scHash(p.x, p.y) * 997) % pool.length;
  return pool[idx];
}
async function scPlacePropGLB(parent, themeKey, p, cell, floorH) {
  const path = scPropModelPath(themeKey, p);
  if (!path) return null;
  const obj = await scCloneModel3D(path);
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3(); box.getSize(size);
  // Fit the footprint to the cell, but let tall/thin models (trees, columns) keep more
  // height so they don't shrink into lollipops on big battlefields.
  let s = Math.min(2.4 * (cell / 2), (cell * 0.92) / (Math.max(size.x, size.z) || 1));
  if (p.s) s *= p.s;
  obj.scale.setScalar(s);
  obj.position.set(p.x * cell, p.z * floorH - box.min.y * s, p.y * cell);
  obj.rotation.y = (p.r != null) ? p.r * -Math.PI / 2 : scHash(p.x, p.y + 0.5) * Math.PI * 2;
  parent.add(obj);
  return obj;
}

// ── Painted daytime sky panorama (blue gradient + sun + clouds + mountain
// ridgelines), canvas-generated — no image asset. Cached, shared everywhere. ──
let skyTexture3D = null;
function getSkyTexture3D() {
  if (skyTexture3D) return skyTexture3D;
  const W = 2048, H = 1024, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const horizonY = H * 0.55;
  const sky = g.createLinearGradient(0, 0, 0, horizonY);
  sky.addColorStop(0, '#2f6fc0'); sky.addColorStop(0.6, '#6ea6dd'); sky.addColorStop(1, '#cfe6f5');
  g.fillStyle = sky; g.fillRect(0, 0, W, horizonY);
  const gr = g.createLinearGradient(0, horizonY, 0, H);
  gr.addColorStop(0, '#cdd9c4'); gr.addColorStop(1, '#8fa07e');
  g.fillStyle = gr; g.fillRect(0, horizonY, W, H - horizonY);
  const sunX = W * 0.72, sunY = horizonY * 0.4;
  const sun = g.createRadialGradient(sunX, sunY, 0, sunX, sunY, 260);
  sun.addColorStop(0, 'rgba(255,250,235,0.95)'); sun.addColorStop(0.4, 'rgba(255,244,210,0.4)'); sun.addColorStop(1, 'rgba(255,244,210,0)');
  g.fillStyle = sun; g.fillRect(0, 0, W, horizonY);
  g.globalAlpha = 0.5;
  for (let i = 0; i < 26; i++) {
    const cxp = scHash(i, 3.7) * W, cyp = scHash(i, 9.1) * horizonY * 0.8, rr = 30 + scHash(i, 5.3) * 90;
    const cl = g.createRadialGradient(cxp, cyp, 0, cxp, cyp, rr);
    cl.addColorStop(0, 'rgba(255,255,255,0.9)'); cl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = cl; g.beginPath(); g.ellipse(cxp, cyp, rr * 1.6, rr, 0, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  // Ridge layers: far = soft rolling hills (curves), near = jagged peaks with
  // varied widths/heights so the skyline doesn't read as a repeating sawtooth.
  const layers = [
    { col: '#93aec9', amp: 130, base: horizonY - 40, minW: 90, varW: 120, seed: 11, smooth: true },
    { col: '#7590ad', amp: 170, base: horizonY - 12, minW: 55, varW: 95, seed: 23, smooth: false },
    { col: '#5a7391', amp: 215, base: horizonY + 20, minW: 45, varW: 80, seed: 37, smooth: false },
  ];
  for (const L of layers) {
    g.fillStyle = L.col; g.beginPath(); g.moveTo(-20, H); g.lineTo(-20, L.base);
    let x = -20, i = 0;
    while (x < W + 20) {
      const w = L.minW + scHash(i, L.seed) * L.varW;
      const peakY = L.base - (0.35 + scHash(i, L.seed + 0.5) * 0.65) * L.amp;
      const endY = L.base - (0.15 + scHash(i, L.seed + 0.9) * 0.35) * L.amp; // valleys stay raised — a connected range, not lone spikes
      if (L.smooth) {
        g.quadraticCurveTo(x + w * 0.5, peakY, x + w, endY);
      } else {
        g.lineTo(x + w * (0.35 + scHash(i, L.seed + 0.2) * 0.3), peakY);
        g.lineTo(x + w, endY);
      }
      x += w; i++;
    }
    g.lineTo(W + 20, H); g.closePath(); g.fill();
  }
  skyTexture3D = new THREE.CanvasTexture(c);
  skyTexture3D.encoding = THREE.sRGBEncoding;
  return skyTexture3D;
}

// ═══════════════════════════════════════════════════════════════════════════
// HAND-CRAFTED MAP LAYOUTS — one designed battlefield per theme, built from
// composable helpers also used by the editor's Room tool and stamps.
// ═══════════════════════════════════════════════════════════════════════════
function scAddFloorRect(pieces, x0, y0, x1, y1, z, role) {
  for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) pieces.push({ m: role || 'floor', x, y, z });
}
// Perimeter EDGE walls around [x0,x1)×[y0,y1) at level z. opts: doors [{x,y,r}]
// left open; role overrides 'wall' (e.g. 'railing' for parapets); windowEvery
// N makes every Nth panel a window (0 = solid walls only).
function scAddWallsAround(pieces, x0, y0, x1, y1, z, opts) {
  opts = opts || {};
  const doors = opts.doors || [];
  const winEvery = (opts.windowEvery != null) ? opts.windowEvery : 3;
  let i = 0;
  const put = (x, y, r) => {
    i++;
    if (doors.some(d => d.x === x && d.y === y && d.r === r)) return;
    const m = opts.role ? opts.role : (winEvery && i % winEvery === 1 ? 'window' : 'wall');
    pieces.push({ m, x, y, z, r });
  };
  for (let x = x0; x < x1; x++) put(x, y0, 0);
  for (let x = x0; x < x1; x++) put(x, y1 - 1, 2);
  for (let y = y0; y < y1; y++) put(x0, y, 3);
  for (let y = y0; y < y1; y++) put(x1 - 1, y, 1);
}
// A ground-floor room; opts.roof adds a flat roof deck one storey up with a
// parapet railing, opts.stairs an interior staircase up to it (an open shaft
// is left in the deck over the stair cell). Needs bw,bh ≥ 3.
function scAddBuilding(pieces, x0, y0, bw, bh, opts) {
  opts = opts || {};
  const x1 = x0 + bw, y1 = y0 + bh;
  scAddFloorRect(pieces, x0, y0, x1, y1, 0);
  const door = opts.door || { x: x0 + (bw >> 1), y: y1 - 1, r: 2 };
  scAddWallsAround(pieces, x0, y0, x1, y1, 0, { doors: [door], windowEvery: opts.windowEvery });
  if (opts.roof === false) return;
  const withStairs = opts.stairs !== false;
  const sx = x0 + 1, sy = y0 + 1, sr = 1; // interior stair, ascending east
  for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) {
    if (withStairs && x === sx && y === sy) continue; // open stairwell shaft
    pieces.push({ m: 'floor', x, y, z: SC_STOREY });
  }
  if (withStairs) pieces.push({ m: 'stairs', x: sx, y: sy, z: 0, r: sr });
  scAddWallsAround(pieces, x0, y0, x1, y1, SC_STOREY, { role: 'railing' });
}
// Railings around the outer perimeter of a set of deck cells (Set of "x,y")
// at level z, skipping any edges in skipEdges (Set of "x,y,r" — stair landings).
function scRailPerimeter(pieces, cells, z, skipEdges) {
  for (const key of cells) {
    const [x, y] = key.split(',').map(Number);
    SC_DIR4.forEach(([dx, dy], r) => {
      if (cells.has((x + dx) + ',' + (y + dy))) return;
      if (skipEdges && skipEdges.has(x + ',' + y + ',' + r)) return;
      pieces.push({ m: 'railing', x, y, z, r });
    });
  }
}

// ── Hand-crafted 48x48 battlefield layouts, one per preset identity. All coordinates
// are derived from w/h so custom sizes still work; designs assume roughly 40x40+.
// Every layout keeps a clear spawn plaza at the centre and is validated by the Node
// map tests (stair/slope landings standable, no unreachable pockets).

// Deterministic scatter helper — places props from the theme pool, avoiding a set of
// "keep clear" rects and the centre plaza.
function scScatterProps(pieces, w, h, count, seed, clearRects, clearR) {
  const cx = w / 2, cy = h / 2;
  let placed = 0, i = 0;
  while (placed < count && i < count * 8) {
    i++;
    const x = 1 + Math.floor(scHash(i, seed) * (w - 2));
    const y = 1 + Math.floor(scHash(i, seed + 0.7) * (h - 2));
    if (Math.hypot(x - cx, y - cy) < (clearR || 5)) continue;
    if (clearRects.some(rc => x >= rc[0] - 1 && x < rc[2] + 1 && y >= rc[1] - 1 && y < rc[3] + 1)) continue;
    pieces.push({ m: 'prop', x, y, z: 0 });
    placed++;
  }
}
// A stepped mesa: stacked terrain tiers (each inset by 1) with slope switchback access.
// tiers = number of half-tile steps. Returns the footprint rect for keep-clear lists.
function scAddMesa(pieces, x0, y0, tw, th, tiers) {
  for (let t = 1; t <= tiers; t++) {
    const inset = t - 1;
    const ax0 = x0 + inset, ay0 = y0 + inset, ax1 = x0 + tw - inset, ay1 = y0 + th - inset;
    if (ax1 - ax0 < 1 || ay1 - ay0 < 1) break;
    scAddFloorRect(pieces, ax0, ay0, ax1, ay1, t, 'terrain');
    // slope up to this tier from the south, staggered eastward per tier (a switchback)
    const sx = Math.min(ax0 + 1 + inset, ax1 - 1);
    pieces.push({ m: 'slope', x: sx, y: ay1, z: t - 1, r: 0 });
  }
  return [x0, y0, x0 + tw, y0 + th];
}

// — Open Plain: rolling green hills, tree copses, one wooden overwatch platform. —
function scMapPlain(pieces, w, h) {
  const clear = [];
  clear.push(scAddMesa(pieces, Math.round(w * 0.14), Math.round(h * 0.22), 6, 5, 1));
  clear.push(scAddMesa(pieces, Math.round(w * 0.62), Math.round(h * 0.58), 7, 5, 2));
  clear.push(scAddMesa(pieces, Math.round(w * 0.32), Math.round(h * 0.72), 5, 4, 1));
  clear.push(scAddMesa(pieces, Math.round(w * 0.72), Math.round(h * 0.16), 5, 4, 1));
  // wooden overwatch platform (auto-legs make it a real trestle)
  const px0 = Math.round(w * 0.42), py0 = Math.round(h * 0.12);
  scAddFloorRect(pieces, px0, py0, px0 + 3, py0 + 2, SC_STOREY);
  pieces.push({ m: 'stairs', x: px0 + 1, y: py0 + 2, z: 0, r: 0 });
  scAddWallsAround(pieces, px0, py0, px0 + 3, py0 + 2, SC_STOREY, { role: 'railing', doors: [{ x: px0 + 1, y: py0 + 1, r: 2 }] });
  clear.push([px0, py0, px0 + 3, py0 + 3]);
  scScatterProps(pieces, w, h, Math.round(w * h * 0.028), 3.1, clear);
}
// — Rocky Canyon: big orange stepped mesas, a boulder-strewn canyon floor, and
//   waist-high rock ridges that make cover lanes (see over, duck behind). —
function scMapCanyon(pieces, w, h) {
  const clear = [];
  clear.push(scAddMesa(pieces, Math.round(w * 0.08), Math.round(h * 0.16), 11, 9, 3));
  clear.push(scAddMesa(pieces, Math.round(w * 0.62), Math.round(h * 0.52), 10, 8, 2));
  clear.push(scAddMesa(pieces, Math.round(w * 0.14), Math.round(h * 0.68), 7, 5, 1));
  clear.push(scAddMesa(pieces, Math.round(w * 0.7), Math.round(h * 0.12), 6, 5, 1));
  // low rock ridges (1-wide waist-high terrain runs) — cover lanes across the open floor
  const ry1 = Math.round(h * 0.42), rx1 = Math.round(w * 0.34);
  for (let x = rx1; x < rx1 + 6; x++) pieces.push({ m: 'terrain', x, y: ry1, z: 1 });
  const ry2 = Math.round(h * 0.6), rx2 = Math.round(w * 0.46);
  for (let x = rx2; x < rx2 + 5; x++) pieces.push({ m: 'terrain', x, y: ry2, z: 1 });
  const rx3 = Math.round(w * 0.55), ry3 = Math.round(h * 0.24);
  for (let y = ry3; y < ry3 + 5; y++) pieces.push({ m: 'terrain', x: rx3, y, z: 1 });
  clear.push([rx1, ry1, rx1 + 6, ry1 + 1], [rx2, ry2, rx2 + 5, ry2 + 1], [rx3, ry3, rx3 + 1, ry3 + 5]);
  scScatterProps(pieces, w, h, Math.round(w * h * 0.024), 7.7, clear);
}
// — Ruins: broken building shells (gap-toothed walls), a collapsed plaza dais,
//   toppled columns, one still-climbable 2-storey shell. —
function scMapRuins(pieces, w, h) {
  const clear = [];
  // broken shell helper: perimeter walls with deterministic gaps, some windows
  const brokenShell = (x0, y0, bw, bh, seed) => {
    scAddFloorRect(pieces, x0, y0, x0 + bw, y0 + bh, 0);
    let i = 0;
    const put = (x, y, r) => { i++; if (scHash(i, seed) < 0.3) return; pieces.push({ m: scHash(i, seed + 0.4) < 0.22 ? 'window' : 'wall', x, y, z: 0, r }); };
    for (let x = x0; x < x0 + bw; x++) { put(x, y0, 0); put(x, y0 + bh - 1, 2); }
    for (let y = y0; y < y0 + bh; y++) { put(x0, y, 3); put(x0 + bw - 1, y, 1); }
    clear.push([x0, y0, x0 + bw, y0 + bh]);
  };
  brokenShell(Math.round(w * 0.12), Math.round(h * 0.14), 8, 6, 11.3);
  brokenShell(Math.round(w * 0.66), Math.round(h * 0.2), 7, 6, 17.9);
  brokenShell(Math.round(w * 0.16), Math.round(h * 0.62), 7, 6, 23.1);
  brokenShell(Math.round(w * 0.55), Math.round(h * 0.7), 9, 5, 29.7);
  // one intact 2-storey watch ruin with roof access
  const ix0 = Math.round(w * 0.42), iy0 = Math.round(h * 0.36);
  scAddBuilding(pieces, ix0, iy0, 5, 4, { door: { x: ix0 + 2, y: iy0 + 3, r: 2 } });
  clear.push([ix0, iy0, ix0 + 5, iy0 + 4]);
  // collapsed plaza dais south of centre
  const dx0 = Math.round(w * 0.46), dy0 = Math.round(h * 0.6);
  scAddFloorRect(pieces, dx0, dy0, dx0 + 3, dy0 + 3, 1, 'terrain');
  pieces.push({ m: 'slope', x: dx0 + 1, y: dy0 + 3, z: 0, r: 0 }, { m: 'slope', x: dx0 + 1, y: dy0 - 1, z: 0, r: 2 });
  clear.push([dx0, dy0, dx0 + 3, dy0 + 3]);
  scScatterProps(pieces, w, h, Math.round(w * h * 0.022), 31.7, clear);
}
// — Desert Wastes: broad low dunes with slope faces, a ruined outpost, rock spills. —
function scMapDesert(pieces, w, h) {
  const clear = [];
  const dune = (x0, y0, dw, dh, twoTier) => {
    scAddFloorRect(pieces, x0, y0, x0 + dw, y0 + dh, 1, 'terrain');
    pieces.push({ m: 'slope', x: x0 + 1, y: y0 + dh, z: 0, r: 0 });
    pieces.push({ m: 'slope', x: x0 + dw - 2, y: y0 - 1, z: 0, r: 2 });
    pieces.push({ m: 'slope', x: x0 - 1, y: y0 + (dh >> 1), z: 0, r: 1 });
    if (twoTier && dw >= 5 && dh >= 4) {
      scAddFloorRect(pieces, x0 + 2, y0 + 1, x0 + dw - 2, y0 + dh - 1, 2, 'terrain');
      pieces.push({ m: 'slope', x: x0 + 2, y: y0 + dh - 1, z: 1, r: 0 });
    }
    clear.push([x0, y0, x0 + dw, y0 + dh]);
  };
  dune(Math.round(w * 0.12), Math.round(h * 0.2), 7, 4, false);
  dune(Math.round(w * 0.6), Math.round(h * 0.6), 8, 5, true);
  dune(Math.round(w * 0.2), Math.round(h * 0.66), 6, 4, false);
  dune(Math.round(w * 0.68), Math.round(h * 0.14), 6, 4, false);
  // ruined outpost with roof access — the only hard structure for miles
  const bx0 = Math.round(w * 0.44), by0 = Math.round(h * 0.18);
  scAddBuilding(pieces, bx0, by0, 6, 5, { door: { x: bx0 + 3, y: by0 + 4, r: 2 }, windowEvery: 2 });
  clear.push([bx0, by0, bx0 + 6, by0 + 5]);
  // a freestanding windbreak wall
  const wx = Math.round(w * 0.3), wy = Math.round(h * 0.46);
  for (let x = wx; x < wx + 4; x++) pieces.push({ m: 'wall', x, y: wy, z: 0, r: 0 });
  scScatterProps(pieces, w, h, Math.round(w * h * 0.014), 41.3, clear);
}
// — Industrial Facility: a catwalk network over machine rows, windowed control
//   room, hazard railings everywhere. —
function scMapFacility(pieces, w, h) {
  const cells = new Set(), skip = new Set();
  const yN = Math.round(h * 0.2), yS = Math.round(h * 0.76), xW = Math.round(w * 0.14), xE = Math.round(w * 0.84), xM = Math.round(w * 0.5);
  for (let x = xW; x <= xE; x++) { cells.add(x + ',' + yN); cells.add(x + ',' + yS); }
  for (let y = yN; y <= yS; y++) { cells.add(xW + ',' + y); cells.add(xE + ',' + y); cells.add(xM + ',' + y); }
  for (const key of cells) {
    const [x, y] = key.split(',').map(Number);
    pieces.push({ m: 'floor', x, y, z: SC_STOREY });
  }
  // stair access at four corners + both middle-run ends
  const stairs = [
    { x: xW - 1, y: yN, r: 1 }, { x: xE + 1, y: yS, r: 3 },
    { x: xE + 1, y: yN, r: 3 }, { x: xW - 1, y: yS, r: 1 },
    { x: xM, y: yN - 1, r: 2 }, { x: xM, y: yS + 1, r: 0 },
  ];
  for (const s of stairs) {
    pieces.push({ m: 'stairs', x: s.x, y: s.y, z: 0, r: s.r });
    const [dx, dy] = SC_DIR4[s.r];
    skip.add((s.x + dx) + ',' + (s.y + dy) + ',' + ((s.r + 2) % 4));
  }
  scRailPerimeter(pieces, cells, SC_STOREY, skip);
  // windowed control room mid-west + solid storage mid-east
  const cx0 = Math.round(w * 0.26), cy0 = Math.round(h * 0.42);
  scAddWallsAround(pieces, cx0, cy0, cx0 + 7, cy0 + 5, 0, { windowEvery: 2, doors: [{ x: cx0, y: cy0 + 2, r: 3 }] });
  const sx0 = Math.round(w * 0.62), sy0 = Math.round(h * 0.4);
  scAddWallsAround(pieces, sx0, sy0, sx0 + 5, sy0 + 4, 0, { windowEvery: 0, doors: [{ x: sx0 + 4, y: sy0 + 1, r: 1 }] });
  const clear = [[cx0, cy0, cx0 + 7, cy0 + 5], [sx0, sy0, sx0 + 5, sy0 + 4], [xW - 2, yN - 2, xE + 2, yN + 1], [xW - 2, yS, xE + 2, yS + 2]];
  // machine rows between the runs
  const rowY1 = Math.round(h * 0.32), rowY2 = Math.round(h * 0.62);
  for (let x = Math.round(w * 0.2); x < Math.round(w * 0.8); x += 4) {
    pieces.push({ m: 'prop', x, y: rowY1, z: 0, v: 4 + (x % 3) });
    pieces.push({ m: 'prop', x: x + 2, y: rowY2, z: 0, v: (x % 4) });
  }
  scScatterProps(pieces, w, h, Math.round(w * h * 0.01), 53.9, clear);
}

const SC_HANDCRAFTED = {
  plain: scMapPlain, canyon: scMapCanyon, ruins: scMapRuins, desert: scMapDesert, facility: scMapFacility,
  // legacy theme keys from older battles/maps route to the closest new layout
  forest: scMapPlain, arena: scMapCanyon, town: scMapRuins, dungeon: scMapRuins, factory: scMapFacility,
};
function buildHandcraftedMap(themeKey, w, h) {
  w = w || 48; h = h || 48;
  const pieces = [];
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) pieces.push({ m: 'floor', x, y, z: 0 });
  (SC_HANDCRAFTED[themeKey] || scMapPlain)(pieces, w, h);
  // Clamp to bounds + dedupe (layouts may re-add ground floor under buildings).
  const seen = new Set(), out = [];
  for (const p of pieces) {
    if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) continue;
    const k = p.m + '|' + p.x + '|' + p.y + '|' + p.z + '|' + (p.r || 0);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return { levels: out.reduce((m, p) => Math.max(m, p.z + 1), 1), pieces: out };
}
