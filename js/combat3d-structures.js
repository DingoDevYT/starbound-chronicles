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
const COMBAT_3D_THEMES = {
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
      mesh.position.set(p.x * cell, p.z * floorH, p.y * cell);
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
  mesh.position.set((w - 1) * cell / 2, -slab - 0.02, (h - 1) * cell / 2);
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
  clone.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
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
  let s = Math.min(1.6 * (cell / 2), (cell * 0.85) / (Math.max(size.x, size.z) || 1));
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

// — Training Arena: central raised dais, mirrored watchtowers, pillar cover. —
function scMapArena(pieces, w, h) {
  const cx = w >> 1, cy = h >> 1;
  const dx0 = cx - 3, dy0 = cy - 2;
  scAddFloorRect(pieces, dx0, dy0, dx0 + 6, dy0 + 4, 1, 'terrain'); // half-tile dais
  pieces.push({ m: 'slope', x: dx0 - 1, y: cy - 1, z: 0, r: 1 }, { m: 'slope', x: dx0 - 1, y: cy, z: 0, r: 1 });
  pieces.push({ m: 'slope', x: dx0 + 6, y: cy - 1, z: 0, r: 3 }, { m: 'slope', x: dx0 + 6, y: cy, z: 0, r: 3 });
  for (let x = dx0; x < dx0 + 6; x++) {
    pieces.push({ m: 'railing', x, y: dy0, z: 1, r: 0 }, { m: 'railing', x, y: dy0 + 3, z: 1, r: 2 });
  }
  scAddBuilding(pieces, 3, 2, 3, 3, { door: { x: 4, y: 4, r: 2 } });
  scAddBuilding(pieces, w - 6, h - 5, 3, 3, { door: { x: w - 5, y: h - 5, r: 0 } });
  // pillars + weapon racks, mirrored
  pieces.push({ m: 'prop', x: cx - 6, y: 3, z: 0, v: 1 }, { m: 'prop', x: cx + 5, y: 3, z: 0, v: 1 });
  pieces.push({ m: 'prop', x: cx - 6, y: h - 4, z: 0, v: 1 }, { m: 'prop', x: cx + 5, y: h - 4, z: 0, v: 1 });
  pieces.push({ m: 'prop', x: 2, y: cy, z: 0, v: 5 }, { m: 'prop', x: w - 3, y: cy, z: 0, v: 5 });
  pieces.push({ m: 'prop', x: cx, y: 2, z: 0, v: 0 }, { m: 'prop', x: cx, y: h - 3, z: 0, v: 0 });
}
// — Forest: tiered hills, a wooden watch platform, dense treelines. —
function scMapForest(pieces, w, h) {
  const cx = w >> 1, cy = h >> 1;
  const hx = 5, hy = cy - 2;
  scAddFloorRect(pieces, hx, hy, hx + 3, hy + 3, 1, 'terrain'); // west hill (half-tile)
  pieces.push({ m: 'slope', x: hx + 1, y: hy + 3, z: 0, r: 0 }, { m: 'slope', x: hx + 1, y: hy - 1, z: 0, r: 2 });
  pieces.push({ m: 'slope', x: hx - 1, y: hy + 1, z: 0, r: 1 }, { m: 'slope', x: hx + 3, y: hy + 1, z: 0, r: 3 });
  const ex0 = w - 10, ey0 = cy - 3;
  scAddFloorRect(pieces, ex0, ey0, ex0 + 4, ey0 + 4, 1, 'terrain'); // east hill, two tiers
  scAddFloorRect(pieces, ex0 + 1, ey0 + 1, ex0 + 3, ey0 + 3, 2, 'terrain');
  pieces.push({ m: 'slope', x: ex0 + 1, y: ey0 + 4, z: 0, r: 0 }, { m: 'slope', x: ex0 + 2, y: ey0 - 1, z: 0, r: 2 });
  pieces.push({ m: 'slope', x: ex0 + 1, y: ey0 + 3, z: 1, r: 0 }); // upper tier ramp
  // wooden watch platform (one storey up) with stairs + railed edges
  const px0 = w - 6, py0 = 2;
  scAddFloorRect(pieces, px0, py0, px0 + 2, py0 + 2, SC_STOREY);
  for (let x = px0; x < px0 + 2; x++) for (let y = py0; y < py0 + 2; y++) pieces.push({ m: 'post', x, y, z: SC_STOREY });
  pieces.push({ m: 'stairs', x: px0, y: py0 + 2, z: 0, r: 0 });
  scAddWallsAround(pieces, px0, py0, px0 + 2, py0 + 2, SC_STOREY, { role: 'railing', doors: [{ x: px0, y: py0 + 1, r: 2 }] });
  // treelines along the borders + scattered interior trees (deterministic)
  for (let x = 0; x < w; x++) {
    if (scHash(x, 1.1) > 0.4) pieces.push({ m: 'prop', x, y: 0, z: 0 });
    if (scHash(x, 2.2) > 0.4) pieces.push({ m: 'prop', x, y: h - 1, z: 0 });
  }
  for (let y = 1; y < h - 1; y++) {
    if (scHash(3.3, y) > 0.5) pieces.push({ m: 'prop', x: 0, y, z: 0 });
    if (scHash(4.4, y) > 0.5) pieces.push({ m: 'prop', x: w - 1, y, z: 0 });
  }
  for (let i = 0; i < 26; i++) {
    const x = 2 + Math.floor(scHash(i, 7.7) * (w - 4)), y = 2 + Math.floor(scHash(i, 8.8) * (h - 4));
    if (Math.hypot(x - cx, y - cy) < 4) continue;                                 // keep a clearing
    if (x >= hx - 1 && x < hx + 4 && y >= hy - 1 && y < hy + 4) continue;         // west hill
    if (x >= ex0 - 1 && x < ex0 + 5 && y >= ey0 - 1 && y < ey0 + 5) continue;     // east hill
    if (x >= px0 - 1 && x < px0 + 2 && y >= py0 && y < py0 + 3) continue;         // platform
    pieces.push({ m: 'prop', x, y, z: 0 });
  }
}
// — Town: a main street, enterable buildings, two accessible rooftops. —
function scMapTown(pieces, w, h) {
  scAddBuilding(pieces, 4, 2, 7, 5, { door: { x: 7, y: 6, r: 2 } });                     // A: 2-storey, roof access
  scAddBuilding(pieces, 15, 2, 6, 4, { door: { x: 17, y: 5, r: 2 }, stairs: false });    // B: locked roof (skyline)
  scAddBuilding(pieces, 6, 12, 7, 4, { door: { x: 9, y: 12, r: 0 }, stairs: false });    // C
  scAddBuilding(pieces, 15, 12, 5, 4, { door: { x: 16, y: 12, r: 0 } });                 // D: 2-storey, roof access
  // street furniture — v indexes the town prop pool (bench 4, light 5, dumpsters 0/1, trucks 11/12, trees 8/9)
  pieces.push({ m: 'prop', x: 12, y: 3, z: 0, v: 0 }, { m: 'prop', x: 13, y: 3, z: 0, v: 1 });   // alley dumpsters
  pieces.push({ m: 'prop', x: 4, y: 8, z: 0, v: 5 }, { m: 'prop', x: 13, y: 10, z: 0, v: 5 }, { m: 'prop', x: 21, y: 8, z: 0, v: 5 });
  pieces.push({ m: 'prop', x: 13, y: 8, z: 0, v: 4 }, { m: 'prop', x: 3, y: 10, z: 0, v: 4 });
  pieces.push({ m: 'prop', x: 22, y: 9, z: 0, v: 11, s: 2, r: 1 });                              // parked truck
  pieces.push({ m: 'prop', x: 2, y: 15, z: 0, v: 9 }, { m: 'prop', x: 23, y: 15, z: 0, v: 9 }, { m: 'prop', x: 2, y: 3, z: 0, v: 8 });
  pieces.push({ m: 'prop', x: 12, y: 14, z: 0, v: 6 }, { m: 'prop', x: 21, y: 11, z: 0, v: 7 }); // pallets
}
// — Dungeon: a walled great hall + side chambers joined by corridors. —
function scMapDungeon(pieces, w, h) {
  scAddWallsAround(pieces, 0, 0, w, h, 0, { windowEvery: 0 });                    // outer shell
  scAddWallsAround(pieces, 8, 5, 18, 13, 0, {                                     // great hall
    windowEvery: 0,
    doors: [{ x: 8, y: 8, r: 3 }, { x: 17, y: 9, r: 1 }, { x: 12, y: 5, r: 0 }, { x: 13, y: 12, r: 2 }],
  });
  scAddFloorRect(pieces, 15, 8, 17, 10, 1, 'terrain');                            // raised dais
  pieces.push({ m: 'slope', x: 14, y: 8, z: 0, r: 1 }, { m: 'slope', x: 14, y: 9, z: 0, r: 1 });
  scAddWallsAround(pieces, 2, 2, 7, 7, 0, { windowEvery: 0, doors: [{ x: 6, y: 4, r: 1 }] });      // west chamber
  scAddWallsAround(pieces, 19, 2, 24, 7, 0, { windowEvery: 0, doors: [{ x: 19, y: 4, r: 3 }] });   // east chamber
  scAddWallsAround(pieces, 3, 11, 9, 16, 0, { windowEvery: 0, doors: [{ x: 6, y: 11, r: 0 }] });   // SW chamber
  scAddWallsAround(pieces, 17, 11, 23, 16, 0, { windowEvery: 0, doors: [{ x: 20, y: 11, r: 0 }] });// SE chamber
  // pillars in the hall + loot props in chambers (column 0, barrel 1, chest 2, banner 8)
  pieces.push({ m: 'prop', x: 10, y: 7, z: 0, v: 0 }, { m: 'prop', x: 10, y: 10, z: 0, v: 0 });
  pieces.push({ m: 'prop', x: 13, y: 7, z: 0, v: 0 }, { m: 'prop', x: 13, y: 10, z: 0, v: 0 });
  pieces.push({ m: 'prop', x: 3, y: 3, z: 0, v: 2 }, { m: 'prop', x: 22, y: 3, z: 0, v: 2 });
  pieces.push({ m: 'prop', x: 4, y: 14, z: 0, v: 1 }, { m: 'prop', x: 21, y: 14, z: 0, v: 1 }, { m: 'prop', x: 5, y: 5, z: 0, v: 1 });
  pieces.push({ m: 'prop', x: 12, y: 6, z: 0, v: 8 }, { m: 'prop', x: 14, y: 12, z: 0, v: 8 });
}
// — Factory: an elevated catwalk loop with railings, a windowed control room,
//   machines and crate cover on the floor below. —
function scMapFactory(pieces, w, h) {
  const cells = new Set();
  for (let x = 4; x <= 21; x++) { cells.add(x + ',3'); cells.add(x + ',14'); }
  for (let y = 4; y <= 13; y++) { cells.add('4,' + y); cells.add('21,' + y); }
  for (const key of cells) {
    const [x, y] = key.split(',').map(Number);
    pieces.push({ m: 'floor', x, y, z: SC_STOREY });
    if ((x + y) % 3 === 0) pieces.push({ m: 'post', x, y, z: SC_STOREY });
  }
  pieces.push({ m: 'stairs', x: 3, y: 3, z: 0, r: 1 });   // landing (4,3)
  pieces.push({ m: 'stairs', x: 22, y: 14, z: 0, r: 3 }); // landing (21,14)
  pieces.push({ m: 'stairs', x: 12, y: 15, z: 0, r: 0 }); // landing (12,14)
  scRailPerimeter(pieces, cells, SC_STOREY, new Set(['4,3,3', '21,14,1', '12,14,2']));
  scAddWallsAround(pieces, 10, 8, 16, 12, 0, { windowEvery: 2, doors: [{ x: 10, y: 9, r: 3 }] }); // control room
  // machines + crates (machine 4/5/6, boxes 0-3, pipes 7/8)
  pieces.push({ m: 'prop', x: 7, y: 6, z: 0, v: 4 }, { m: 'prop', x: 18, y: 6, z: 0, v: 6 }, { m: 'prop', x: 19, y: 11, z: 0, v: 5 });
  pieces.push({ m: 'prop', x: 6, y: 9, z: 0, v: 7 }, { m: 'prop', x: 23, y: 8, z: 0, v: 8 });
  pieces.push({ m: 'prop', x: 9, y: 5, z: 0, v: 0 }, { m: 'prop', x: 16, y: 6, z: 0, v: 3 });
  pieces.push({ m: 'prop', x: 5, y: 12, z: 0, v: 2 }, { m: 'prop', x: 20, y: 5, z: 0, v: 1 });
  pieces.push({ m: 'prop', x: 8, y: 13, z: 0, v: 1 }, { m: 'prop', x: 17, y: 13, z: 0, v: 0 });
}

const SC_HANDCRAFTED = { arena: scMapArena, forest: scMapForest, town: scMapTown, dungeon: scMapDungeon, factory: scMapFactory };
function buildHandcraftedMap(themeKey, w, h) {
  w = w || 26; h = h || 18;
  const pieces = [];
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) pieces.push({ m: 'floor', x, y, z: 0 });
  (SC_HANDCRAFTED[themeKey] || scMapArena)(pieces, w, h);
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
