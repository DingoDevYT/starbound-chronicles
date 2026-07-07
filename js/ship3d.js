// ═══════════════════════════════════════════════════════════════════════════
// STARBOUND CHRONICLES — 3D ship home base (classic script).
// Sleek curved hull (long, not fat), open deck you look into and click around,
// forward-mounted cannons, a proper cockpit with a captain's chair, thruster
// nacelles on an engine housing with layered flame + particle exhaust, and
// LITERAL landings onto pads that rise to meet the hull — centred on the ship.
// Requires js/combat3d-structures.js (scColor, scCachedGeo, getSkyTexture3D).
//
// buildShip3D(size, comps) → { group, picks, grid, outline, zones, dynamic }
//   comps: { wingTier, thrusterTier, reactorTier, gunCount, gunTier } (1..3)
// createShipEnvironment(scene) → env: setMode('travel'|'dock'|'planet'),
//   update(dt), bindShip(built, shipGroup).
// ═══════════════════════════════════════════════════════════════════════════

// ── Real ship models (Majadroid low-poly kit, CC0). The exterior shown flying/
// landing is a real textured model chosen by hull size, tinted by a colour
// variant (1..4 = the pack's four palette textures). Pre-assembled ships look
// far better than trying to bolt the loose component parts together, so hull
// upgrades swap to a bigger/fancier ship. ────────────────────────────────────
const SHIP_MAJADROID = 'assets/3d/LowPoly-Spaceships-By-Majadroid/';
const SHIP_REAL_MODEL = { small: 1, medium: 2, large: 3, capital: 4 };
const SHIP_REAL_TARGET_LEN = 26; // world units the model is scaled to (nose→tail)
// The pack's textures are literal photos of a red car (with a tiny swatch grid) —
// they map onto the hull as an ugly streaky mess. Ignore them and paint the ships
// with clean solid metallic hull colours; the "colour variant" picks the tint.
const SHIP_REAL_COLORS = [0x6f7d95, 0xa8443a, 0x3f7d70, 0x6a5a9e]; // steel · crimson · teal · plum
let _shipObjLoader = null;
const _shipHullMat = {};
function shipHullMaterial(variant) {
  const v = Math.min(4, Math.max(1, variant || 1));
  if (!_shipHullMat[v]) {
    _shipHullMat[v] = new THREE.MeshStandardMaterial({
      color: scColor(SHIP_REAL_COLORS[v - 1]), roughness: 0.5, metalness: 0.55,
    });
  }
  return _shipHullMat[v];
}
// Loads the real ship for a hull size. Returns a Promise<Group> with the model
// centred at origin, nose pointing -Z, scaled to SHIP_REAL_TARGET_LEN, and
// userData.bellyY / .length set for the landing maths. Also spins up engine glow.
function loadRealShip(size, variant) {
  if (!_shipObjLoader) _shipObjLoader = new THREE.OBJLoader();
  const shipN = SHIP_REAL_MODEL[size] || 2;
  const path = SHIP_MAJADROID + 'obj-files/obj-ships/material-01/m1-ship' + shipN + '.obj';
  const hullMat = shipHullMaterial(variant);
  return new Promise((resolve, reject) => {
    _shipObjLoader.load(path, obj => {
      const kill = [];
      obj.traverse(o => {
        if (o.isMesh) { o.material = hullMat; o.castShadow = true; o.receiveShadow = true; }
        else if (o.isLine) kill.push(o); // stray line elements render as giant white wireframes
      });
      kill.forEach(o => o.parent && o.parent.remove(o));
      // orient + centre + scale
      let box = new THREE.Box3().setFromObject(obj);
      const size3 = new THREE.Vector3(); box.getSize(size3);
      const longAxisZ = size3.z >= size3.x;           // is the model longest along Z already?
      if (!longAxisZ) obj.rotation.y = Math.PI / 2;    // rotate so length runs along Z
      box = new THREE.Box3().setFromObject(obj);
      box.getSize(size3);
      const scale = SHIP_REAL_TARGET_LEN / (Math.max(size3.x, size3.z) || 1);
      obj.scale.setScalar(scale);
      box = new THREE.Box3().setFromObject(obj);
      const ctr = new THREE.Vector3(); box.getCenter(ctr);
      obj.position.sub(ctr);                            // centre at origin
      const wrap = new THREE.Group();
      wrap.add(obj);
      box = new THREE.Box3().setFromObject(wrap);
      wrap.userData.bellyY = box.min.y;
      wrap.userData.length = box.max.z - box.min.z;
      // engine glow: additive discs + point light at the tail
      wrap.userData.engineGlow = [];
      const gm = new THREE.MeshBasicMaterial({ map: shipGlowTexture(), color: 0x8fd6ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
      for (const gx of [-box.max.x * 0.35, box.max.x * 0.35, 0]) {
        const spr = new THREE.Sprite(gm.clone());
        spr.scale.setScalar(2.4);
        spr.position.set(gx, box.min.y * 0.2, box.max.z - 0.4);
        wrap.add(spr); wrap.userData.engineGlow.push(spr);
      }
      resolve(wrap);
    }, undefined, reject);
  });
}

const SHIP_CELL = 2;
const SHIP_HULL_H = 1.9;
const SHIP_PART_H = 1.45;
const SHIP_DIR4 = [ [0,-1], [1,0], [0,1], [-1,0] ];
// Long, sleek proportions — roughly 1 : 1.8 width to length.
const SHIP_GRID_DIMS = { small: { w: 7, h: 12 }, medium: { w: 9, h: 16 }, large: { w: 13, h: 20 }, capital: { w: 17, h: 26 } };
const SHIP_TIER_COLORS = [0xffa83a, 0x3ad2ff, 0xc07aff];
const SHIP_ACCENT = 0x37c4ff;

// ── Materials ────────────────────────────────────────────────────────────────
const shipMatCache = new Map();
function shipMat(key) {
  if (shipMatCache.has(key)) return shipMatCache.get(key);
  let m;
  // flatShading gives every facet a crisp flat face — the blocky low-poly look.
  switch (key) {
    case 'hullBody': m = new THREE.MeshStandardMaterial({ color: scColor(0x3d4a66), roughness: 0.42, metalness: 0.58, flatShading: true }); break;
    case 'hullWall': m = new THREE.MeshStandardMaterial({ color: scColor(0x4a5674), roughness: 0.48, metalness: 0.5, side: THREE.DoubleSide, flatShading: true }); break;
    case 'deckA':    m = new THREE.MeshStandardMaterial({ color: scColor(0x505b74), roughness: 0.6, metalness: 0.3, flatShading: true }); break;
    case 'deckB':    m = new THREE.MeshStandardMaterial({ color: scColor(0x4a5570), roughness: 0.6, metalness: 0.3, flatShading: true }); break;
    case 'deckWalk': m = new THREE.MeshStandardMaterial({ color: scColor(0x5b6884), roughness: 0.5, metalness: 0.35, emissive: scColor(0x16324a), emissiveIntensity: 0.35, flatShading: true }); break;
    case 'part':     m = new THREE.MeshStandardMaterial({ color: scColor(0x5d6880), roughness: 0.5, metalness: 0.4, flatShading: true }); break;
    case 'rim':      m = new THREE.MeshStandardMaterial({ color: scColor(0x76829e), roughness: 0.32, metalness: 0.68, flatShading: true }); break;
    case 'accent':   m = new THREE.MeshStandardMaterial({ color: scColor(0x0d3348), emissive: scColor(SHIP_ACCENT), emissiveIntensity: 0.9, roughness: 0.4 }); break;
    case 'trim':     m = new THREE.MeshStandardMaterial({ color: scColor(0x0a2438), emissive: scColor(0x2ea8ff), emissiveIntensity: 1.4, roughness: 0.4 }); break;
    case 'console':  m = new THREE.MeshStandardMaterial({ color: scColor(0x333c52), roughness: 0.38, metalness: 0.55, flatShading: true }); break;
    case 'screen':   m = new THREE.MeshStandardMaterial({ color: scColor(0x06131f), emissive: scColor(0x53c8ff), emissiveIntensity: 1.25, roughness: 0.3 }); break;
    case 'holo':     m = new THREE.MeshBasicMaterial({ color: 0x53c8ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); break;
    case 'seat':     m = new THREE.MeshStandardMaterial({ color: scColor(0x8a4f3c), roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide, flatShading: true }); break;
    case 'gun':      m = new THREE.MeshStandardMaterial({ color: scColor(0x353f56), roughness: 0.38, metalness: 0.62, flatShading: true }); break;
    case 'glass':    m = new THREE.MeshStandardMaterial({ color: scColor(0x8fd8ff), transparent: true, opacity: 0.16, roughness: 0.08, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false }); break;
    case 'padDark':  m = new THREE.MeshStandardMaterial({ color: scColor(0x2c3038), roughness: 0.8, metalness: 0.3 }); break;
    case 'padMark':  m = new THREE.MeshStandardMaterial({ color: scColor(0x3a2c08), emissive: scColor(0xf5b83a), emissiveIntensity: 1.0, roughness: 0.5 }); break;
    default:         m = new THREE.MeshStandardMaterial({ color: scColor(0x808080) });
  }
  shipMatCache.set(key, m);
  return m;
}
function shipTierMat(tier) {
  const key = 'tier' + tier;
  if (!shipMatCache.has(key)) {
    const c = SHIP_TIER_COLORS[Math.min(2, Math.max(0, tier - 1))];
    shipMatCache.set(key, new THREE.MeshStandardMaterial({ color: scColor(0x141820), emissive: scColor(c), emissiveIntensity: 1.6, roughness: 0.35 }));
  }
  return shipMatCache.get(key);
}
function shipPickMat() {
  if (!shipMatCache.has('__pick')) shipMatCache.set('__pick', new THREE.MeshBasicMaterial({ visible: false }));
  return shipMatCache.get('__pick');
}
let shipGlowTex = null;
function shipGlowTexture() {
  if (shipGlowTex) return shipGlowTex;
  const s = 64, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  shipGlowTex = new THREE.CanvasTexture(c);
  return shipGlowTex;
}

// ── Hull outline: ANGULAR — straight edges + 45° diagonal chamfers, grid-aligned.
// A blocky arrow/hex silhouette: pointed nose that widens at 45°, straight flanks,
// chamfered stern. No curves. ────────────────────────────────────────────────
function shipHullOutline(size) {
  const { w, h } = SHIP_GRID_DIMS[size] || SHIP_GRID_DIMS.medium;
  const c = SHIP_CELL;
  const cx = (w - 1) * c / 2;
  const zTop = -0.5 * c, zBot = (h - 0.5) * c;
  const maxHalf = (w - 1) * c / 2 + 0.55 * c;
  const w1 = Math.round(maxHalf * 0.4 / c) * c || c;   // nose half-width, snapped to the grid
  const stc = maxHalf * 0.55;                          // stern chamfer depth
  const zNose = zTop - 3.6 * c;
  const zStern = zBot + 0.35 * c;
  const zShoulder = zNose + maxHalf;                   // 45° widening ends here (full beam)
  const zSternC = zStern - stc;                        // stern chamfer starts here
  // right-half corners, nose (−z) → stern (+z)
  const R = [
    [cx,              zNose],
    [cx + w1,         zNose + w1],       // 45° off the nose tip
    [cx + maxHalf,    zShoulder],        // 45° out to full beam
    [cx + maxHalf,    zSternC],          // straight flank
    [cx + maxHalf - stc, zStern],        // 45° stern chamfer
  ];
  const corners = R.map(p => p.slice());
  for (let i = R.length - 1; i >= 0; i--) corners.push([2 * cx - R[i][0], R[i][1]]); // mirror to the left
  const s = new THREE.Shape();
  s.moveTo(corners[0][0], corners[0][1]);
  for (let i = 1; i < corners.length; i++) s.lineTo(corners[i][0], corners[i][1]);
  s.closePath();
  const pts = corners.map(([x, z]) => ({ x, y: z }));
  const zMax = (zShoulder + zSternC) / 2;
  return { shape: s, pts, w, h, cx, zNose, zShoulder, zMax, zSternC, zStern, maxHalf, shoulderHalf: w1, sternHalf: maxHalf - stc,
           zMid: (zNose + zStern) / 2, length: zStern - zNose };
}
function shipPointInHull(px, pz, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, zi = pts[i].y, xj = pts[j].x, zj = pts[j].y;
    if (((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / (zj - zi) + xi)) inside = !inside;
  }
  return inside;
}
// Exact hull half-width at a given z: intersect the outline edges with the z line.
function shipHalfWidthAt(o, z) {
  let maxx = o.cx; const pts = o.pts;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const zi = pts[i].y, zj = pts[j].y, xi = pts[i].x, xj = pts[j].x;
    if ((zi > z) !== (zj > z)) { const x = xi + (xj - xi) * (z - zi) / (zj - zi); if (x > maxx) maxx = x; }
  }
  return maxx - o.cx;
}
function shipRasterize(o) {
  const c = SHIP_CELL, floor = new Set();
  for (let x = 0; x < o.w; x++) for (let y = 0; y < o.h; y++) {
    const wx = x * c, wz = y * c, m = 0.44 * c;
    if (shipPointInHull(wx, wz, o.pts) && shipPointInHull(wx - m, wz - m, o.pts) && shipPointInHull(wx + m, wz - m, o.pts) &&
        shipPointInHull(wx - m, wz + m, o.pts) && shipPointInHull(wx + m, wz + m, o.pts)) floor.add(x + ',' + y);
  }
  return floor;
}

// Rooms by length bands; doorway punched in the middle of each shared border.
function shipZones(floor, o, size) {
  const rows = [...floor].map(k => +k.split(',')[1]);
  const yMin = Math.min(...rows), yMax = Math.max(...rows);
  const span = yMax - yMin + 1;
  const roomAt = new Map();
  for (const k of floor) {
    const [x, y] = k.split(',').map(Number);
    const f = (y - yMin) / span;
    let kind;
    if (f < 0.24) kind = 'bridge';
    else if (f < 0.56) kind = 'common';
    else {
      if (size === 'small') kind = 'engine';
      else if (size === 'medium') kind = x < (o.w - 1) / 2 ? 'quarters' : 'engine';
      else kind = x < (o.w - 1) * 0.36 ? 'quarters' : (x > (o.w - 1) * 0.64 ? 'engine' : 'hold');
    }
    roomAt.set(k, kind);
  }
  const partition = new Set(), doors = new Set();
  for (const k of floor) {
    const [x, y] = k.split(',').map(Number);
    [[1, 0, 1], [0, 1, 2]].forEach(([dx, dy, r]) => {
      const nk = (x + dx) + ',' + (y + dy);
      if (floor.has(nk) && roomAt.get(k) !== roomAt.get(nk)) partition.add(x + ',' + y + ',' + r);
    });
  }
  const seenPair = new Set(), partList = [...partition];
  for (const e of partList) {
    const [x, y, r] = e.split(',').map(Number);
    const [dx, dy] = SHIP_DIR4[r];
    const pair = [roomAt.get(x + ',' + y), roomAt.get((x + dx) + ',' + (y + dy))].sort().join('|');
    if (seenPair.has(pair)) continue;
    const shared = partList.filter(pe => {
      const [px, py, pr] = pe.split(',').map(Number); const [pdx, pdy] = SHIP_DIR4[pr];
      return [roomAt.get(px + ',' + py), roomAt.get((px + pdx) + ',' + (py + pdy))].sort().join('|') === pair;
    });
    const mid = shared[Math.floor(shared.length / 2)];
    doors.add(mid); partition.delete(mid);
    seenPair.add(pair);
  }
  const cellsOf = kind => [...floor].filter(k => roomAt.get(k) === kind).map(k => k.split(',').map(Number));
  const centroid = list => list.length ? [Math.round(list.reduce((s, p) => s + p[0], 0) / list.length), Math.round(list.reduce((s, p) => s + p[1], 0) / list.length)] : null;
  const bridge = cellsOf('bridge'), engine = cellsOf('engine'), common = cellsOf('common');
  const stations = [];
  if (bridge.length) {
    const fy = Math.min(...bridge.map(p => p[1]));
    const row = bridge.filter(p => p[1] === fy + 1);
    const hx = row.length ? row[Math.floor(row.length / 2)][0] : bridge[0][0];
    stations.push({ kind: 'helm', x: hx, y: fy + 1 });
  }
  const ec = centroid(engine.length ? engine : common);
  if (ec) stations.push({ kind: 'reactor', x: ec[0], y: ec[1] });
  if (common.length) {
    const midY = Math.round(common.reduce((s, p) => s + p[1], 0) / common.length);
    const rowC = common.filter(p => Math.abs(p[1] - midY) <= 1);
    stations.push({ kind: 'weapons', x: Math.max(...rowC.map(p => p[0])), y: midY, r: 1 });
    stations.push({ kind: 'weapons', x: Math.min(...rowC.map(p => p[0])), y: midY, r: 3 });
  }
  return { roomAt, partition, doors, stations, yMin, yMax, cellsOf };
}

// ── Builders ─────────────────────────────────────────────────────────────────
function shipBuildBody(o) {
  // Single-bevel extrude = one crisp 45° chamfer around the belly (blocky, not rounded).
  const geo = new THREE.ExtrudeGeometry(o.shape, { depth: 0.7, bevelEnabled: true, bevelThickness: 0.55, bevelSize: 0.55, bevelSegments: 1, curveSegments: 1 });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, -0.55, 0);
  const body = new THREE.Mesh(geo, shipMat('hullBody'));
  body.castShadow = true; body.receiveShadow = true;
  const g = new THREE.Group();
  g.add(body);
  // landing legs — tripod stance: one under the nose, two under the stern quarter
  const legPos = [
    [o.cx, o.zNose + 4.5],
    [o.cx - o.sternHalf * 0.72, o.zSternC - 1.2], [o.cx + o.sternHalf * 0.72, o.zSternC - 1.2],
    [o.cx - o.maxHalf * 0.7, o.zMax], [o.cx + o.maxHalf * 0.7, o.zMax],
  ];
  for (const [lx, lz] of legPos) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.85, 10), shipMat('rim'));
    leg.position.set(lx, -1.45, lz);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, 0.13, 12), shipMat('padDark'));
    foot.position.set(lx, -1.9, lz);
    g.add(leg, foot);
  }
  return g;
}
function shipBuildWalls(o) {
  const pts = o.pts, n = pts.length, H = SHIP_HULL_H;
  const pos = new Float32Array(n * 6 * 3);
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], o6 = i * 18;
    pos.set([a.x, 0, a.y,  b.x, 0, b.y,  a.x, H, a.y,  b.x, 0, b.y,  b.x, H, b.y,  a.x, H, a.y], o6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const wall = new THREE.Mesh(geo, shipMat('hullWall'));
  wall.castShadow = true; wall.receiveShadow = true;
  const g = new THREE.Group();
  g.add(wall);
  // Flat angular trim bands hugging the outline (quads per edge — no tubes): a metal
  // top lip, a painted accent stripe, and an emissive glow line at the base.
  const band = (y, th, mat) => {
    const p2 = new Float32Array(n * 6 * 3);
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n], o6 = i * 18;
      p2.set([a.x, y - th, a.y,  b.x, y - th, b.y,  a.x, y + th, a.y,  b.x, y - th, b.y,  b.x, y + th, b.y,  a.x, y + th, a.y], o6);
    }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.BufferAttribute(p2, 3));
    gg.computeVertexNormals();
    return new THREE.Mesh(gg, mat);
  };
  g.add(band(H, 0.09, shipMat('rim')));            // top lip
  g.add(band(H * 0.55, 0.07, shipMat('accent')));  // accent stripe
  g.add(band(0.16, 0.05, shipMat('trim')));        // base glow line
  // cockpit canopy: a faceted low-poly wedge (chamfered box) over the bow, sized to
  // the hull width there — angular, matching the blocky hull.
  const canZ = o.zNose + Math.max(2.4, o.maxHalf);
  const canR = Math.max(1.0, shipHalfWidthAt(o, canZ) * 0.72);
  const canGeo = new THREE.CylinderGeometry(canR * 0.5, canR, 0.9, 6, 1); // hexagonal prism = low-poly dome
  canGeo.rotateY(Math.PI / 6);
  const canopy = new THREE.Mesh(canGeo, shipMat('glass'));
  canopy.scale.set(1, 1, 1.7);
  canopy.position.set(o.cx, 0.2, canZ);
  const canopyRim = new THREE.Mesh(new THREE.CylinderGeometry(canR, canR * 1.08, 0.18, 6), shipMat('rim'));
  canopyRim.rotation.y = Math.PI / 6; canopyRim.scale.set(1, 1, 1.7);
  canopyRim.position.set(o.cx, 0.08, canZ);
  g.add(canopy, canopyRim);
  return g;
}
function shipBuildDeck(floor, o, group, picks) {
  const c = SHIP_CELL;
  const cells = [...floor].map(k => k.split(',').map(Number));
  const spineX = Math.round((o.w - 1) / 2);
  const geo = scCachedGeo(`shipdeck|${c}`, () => new THREE.BoxGeometry(c * 0.99, 0.08, c * 0.99));
  const counts = { a: 0, b: 0, w: 0 };
  const iA = new THREE.InstancedMesh(geo, shipMat('deckA'), cells.length);
  const iB = new THREE.InstancedMesh(geo, shipMat('deckB'), cells.length);
  const iW = new THREE.InstancedMesh(geo, shipMat('deckWalk'), cells.length);
  iA.receiveShadow = iB.receiveShadow = iW.receiveShadow = true;
  const m4 = new THREE.Matrix4();
  const pickGeo = scCachedGeo(`shippick|${c}`, () => new THREE.PlaneGeometry(c, c));
  for (const [x, y] of cells) {
    m4.makeTranslation(x * c, 0.04, y * c);
    if (x === spineX) iW.setMatrixAt(counts.w++, m4);          // central lit walkway spine
    else if ((x + y) % 2 === 0) iA.setMatrixAt(counts.a++, m4);
    else iB.setMatrixAt(counts.b++, m4);
    const pick = new THREE.Mesh(pickGeo, shipPickMat());
    pick.rotation.x = -Math.PI / 2; pick.position.set(x * c, 0.1, y * c);
    pick.userData.cell = { x, y, z: 0 };
    group.add(pick); picks.push(pick);
  }
  iA.count = counts.a; iB.count = counts.b; iW.count = counts.w;
  iA.instanceMatrix.needsUpdate = iB.instanceMatrix.needsUpdate = iW.instanceMatrix.needsUpdate = true;
  group.add(iA, iB, iW);
}
function shipBuildPartitions(zones, group) {
  const c = SHIP_CELL, t = 0.14, H = SHIP_PART_H;
  const panelGeo = scCachedGeo(`shippart|${c}`, () => new THREE.BoxGeometry(c + t, H, t));
  const capGeo = scCachedGeo(`shippartcap|${c}`, () => new THREE.CylinderGeometry(t / 2, t / 2, c + t, 8));
  for (const e of zones.partition) {
    const [x, y, r] = e.split(',').map(Number);
    const [dx, dy] = SHIP_DIR4[r];
    const wrap = new THREE.Group();
    const panel = new THREE.Mesh(panelGeo, shipMat('part'));
    panel.position.y = H / 2; panel.castShadow = true; panel.receiveShadow = true;
    const cap = new THREE.Mesh(capGeo, shipMat('rim'));
    cap.rotation.z = Math.PI / 2; cap.position.y = H;
    wrap.add(panel, cap);
    wrap.rotation.y = (r % 2 === 1) ? Math.PI / 2 : 0;
    wrap.position.set(x * c + dx * c / 2, 0, y * c + dy * c / 2);
    group.add(wrap);
  }
  for (const e of zones.doors) {
    const [x, y, r] = e.split(',').map(Number);
    const [dx, dy] = SHIP_DIR4[r];
    const arch = new THREE.Mesh(new THREE.TorusGeometry(c * 0.42, 0.06, 8, 20, Math.PI), shipMat('trim'));
    arch.position.set(x * c + dx * c / 2, H, y * c + dy * c / 2);
    arch.rotation.y = (r % 2 === 1) ? 0 : Math.PI / 2;
    group.add(arch);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, H, 8), shipMat('rim'));
      const px = (r % 2 === 1) ? 0 : side * c * 0.42, pz = (r % 2 === 1) ? side * c * 0.42 : 0;
      post.position.set(x * c + dx * c / 2 + px, H / 2, y * c + dy * c / 2 + pz);
      group.add(post);
    }
  }
}
// ── The cockpit: a wrap-around arc of console segments FACING the pilot, a
// captain's chair behind it, and a small holo-projector in the middle. ──────
function shipBuildHelm(st, group) {
  const g = new THREE.Group();
  g.position.set(st.x * SHIP_CELL, 0.08, st.y * SHIP_CELL);
  // console arc: segments on a circle ahead of the pilot (toward the nose, -z),
  // each yawed tangentially, screens tilted back toward the pilot's seat.
  const R = 1.25, segs = 5;
  for (let i = 0; i < segs; i++) {
    const th = (i / (segs - 1) - 0.5) * 1.55; // -0.77..0.77 radians around -z
    const px = Math.sin(th) * R, pz = -Math.cos(th) * R;
    const seg = new THREE.Group();
    const desk = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.1, 0.34), shipMat('console'));
    desk.position.y = 0.78; desk.rotation.x = -0.18;
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.7, 0.09), shipMat('console'));
    front.position.set(0, 0.4, -0.14);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.3), shipMat('screen'));
    scr.position.set(0, 1.05, -0.1); scr.rotation.x = -0.42;
    seg.add(desk, front, scr);
    seg.position.set(px, 0, pz);
    seg.rotation.y = -th;           // face the pilot in the middle
    g.add(seg);
  }
  // captain's chair (facing the console/nose): pedestal, seat, curved backrest, armrests
  const chair = new THREE.Group();
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.42, 10), shipMat('rim'));
  pedestal.position.y = 0.21;
  const baseDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.06, 14), shipMat('console'));
  baseDisc.position.y = 0.03;
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.3, 0.13, 16), shipMat('seat'));
  seat.position.y = 0.49;
  // curved backrest BEHIND the pilot (pilot faces the console at -z; θ=0 faces +z)
  const back = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.82, 16, 1, true, -Math.PI * 0.28, Math.PI * 0.56), shipMat('seat'));
  back.position.set(0, 0.95, 0.06);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.34), shipMat('console'));
    arm.position.set(s * 0.34, 0.66, 0);
    chair.add(arm);
  }
  chair.add(pedestal, baseDisc, seat, back);
  chair.position.z = 0.55;
  g.add(chair);
  // central holo-projector between the consoles
  const holoBase = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.1, 12), shipMat('console'));
  holoBase.position.set(0, 0.83, -R);
  const holoCone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.5, 16, 1, true), shipMat('holo'));
  holoCone.rotation.x = Math.PI; holoCone.position.set(0, 1.15, -R);
  const holoBall = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), shipMat('holo'));
  holoBall.position.set(0, 1.42, -R);
  g.add(holoBase, holoCone, holoBall);
  group.add(g);
  return { holoBall };
}
function shipBuildStations(zones, comps, group, dynamic) {
  const c = SHIP_CELL;
  for (const st of zones.stations) {
    if (st.kind === 'helm') {
      const refs = shipBuildHelm(st, group);
      dynamic.holo = refs.holoBall;
    } else if (st.kind === 'reactor') {
      const tier = comps.reactorTier || 1;
      const g = new THREE.Group();
      g.position.set(st.x * c, 0.08, st.y * c);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.18, 8), shipMat('console'));
      base.position.y = 0.09;
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.28 + tier * 0.06, 0.28 + tier * 0.06, 1.1 + tier * 0.25, 6), shipTierMat(tier));
      core.position.y = 0.75 + tier * 0.12;
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 1.2 + tier * 0.25, 8, 1, true), shipMat('glass'));
      shell.position.y = 0.8 + tier * 0.12;
      g.add(base, core, shell);
      for (const rot of [0.9, -0.9]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 4, 8), shipMat('rim'));
        ring.position.y = 0.85 + tier * 0.12; ring.rotation.x = rot;
        g.add(ring);
      }
      dynamic.reactorCore = core;
      dynamic.reactorRings = [];
      group.add(g);
    } else if (st.kind === 'weapons') {
      // gunnery station against the hull: console faces INTO the room, operator
      // stands between it and the middle of the ship.
      const g = new THREE.Group();
      g.position.set(st.x * c, 0.08, st.y * c);
      const facing = st.r === 1 ? -1 : 1; // screens look toward ship centreline
      const desk = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 1.1), shipMat('console'));
      desk.position.set(-facing * 0.35, 0.74, 0); desk.rotation.z = facing * 0.14;
      const front = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.66, 1.1), shipMat('console'));
      front.position.set(-facing * 0.6, 0.38, 0);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.3), shipMat('screen'));
      scr.position.set(-facing * 0.42, 1.02, 0);
      scr.rotation.y = facing * Math.PI / 2; scr.rotation.x = -0.35;
      g.add(desk, front, scr);
      group.add(g);
    }
  }
}
// ── Exterior: swept-back wings, FRONT-mounted cannons flush against the nose
// flanks, and an engine housing bar carrying the thruster nacelles. ─────────
function shipBuildExterior(o, comps, group, dynamic) {
  const c = SHIP_CELL;
  // — wings: swept delta blades angled back along the hull —
  const wTier = comps.wingTier || 1;
  const ws = (0.75 + wTier * 0.28) * (o.maxHalf / 8);
  const wingShape = new THREE.Shape();      // angular delta plate — all straight edges
  wingShape.moveTo(0, -1.0);
  wingShape.lineTo(4.2, 1.1);               // straight leading edge to the tip
  wingShape.lineTo(3.5, 2.2);               // straight tip chord
  wingShape.lineTo(0, 3.2);                 // straight trailing edge back to the root
  wingShape.lineTo(0, -1.0);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.08, bevelSegments: 1, curveSegments: 1 });
  wingGeo.rotateX(Math.PI / 2);
  for (const side of [1, -1]) {
    const wing = new THREE.Mesh(wingGeo, shipMat('hullBody'));
    wing.castShadow = true;
    wing.scale.set(ws * side, 1, ws);
    wing.position.set(o.cx + side * (shipHalfWidthAt(o, o.zMax) - 0.3), 0.5, o.zMax - 1.2);
    wing.rotation.y = side * -0.3;  // sweep back along the hull
    group.add(wing);
    // accent edge light on the wing tip
    const tipGlow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), shipMat('accent'));
    tipGlow.position.set(o.cx + side * (shipHalfWidthAt(o, o.zMax) - 0.3 + 3.6 * ws), 0.6, o.zMax - 1.2 + 2.2 * ws);
    group.add(tipGlow);
    if (wTier >= 2) {
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.22 * ws, 1.3 * ws, 4), shipMat('rim')); // 4-sided = angular fin
      fin.rotation.y = Math.PI / 4;
      fin.position.set(o.cx + side * (shipHalfWidthAt(o, o.zMax) + 2.2 * ws), 0.95, o.zMax + 0.6 * ws);
      fin.rotation.z = side * -0.14;
      group.add(fin);
    }
  }
  // — forward cannons: mounted flush on the nose flanks, barrels ahead —
  const gCount = Math.min(4, Math.max(0, comps.gunCount ?? 2)), gTier = comps.gunTier || 1;
  dynamic.gunTips = [];
  const gunRows = [[o.zNose + 5.2, 0.55], [o.zShoulder + 1.6, 0.6]]; // [z, y] rows: nose pair, then shoulder pair
  for (let i = 0; i < gCount; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const [gz, gy] = gunRows[Math.floor(i / 2) % gunRows.length];
    const hw = shipHalfWidthAt(o, gz);
    const gp = new THREE.Group();
    // angular box mount pod hugging the hull side
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 1.5), shipMat('gun'));
    gp.add(pod);
    const barrelLen = 1.5 + gTier * 0.3;
    for (let bIdx = 0; bIdx < gTier; bIdx++) {
      const off = (bIdx - (gTier - 1) / 2) * 0.15;
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, barrelLen), shipMat('gun'));
      barrel.position.set(off, 0.06, -(0.55 + barrelLen / 2));
      const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.14), shipMat('rim'));
      muzzle.position.set(off, 0.06, -(0.55 + barrelLen));
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), shipTierMat(gTier));
      tip.position.set(off, 0.06, -(0.62 + barrelLen));
      gp.add(barrel, muzzle, tip);
      dynamic.gunTips.push(tip);
    }
    gp.position.set(o.cx + side * (hw - 0.1), gy, gz);
    gp.rotation.y = side * -0.06; // toe-in just a touch
    group.add(gp);
  }
  // — engine housing: a rounded bar across the stern that the nacelles mount on —
  const tTier = comps.thrusterTier || 1;
  const sizeKey = Object.keys(SHIP_GRID_DIMS).find(k => SHIP_GRID_DIMS[k].w === o.w) || 'medium';
  const tCount = { small: 2, medium: 2, large: 3, capital: 4 }[sizeKey];
  const ts = 0.7 + tTier * 0.2;
  const barW = o.sternHalf * 1.9, barH = 1.3;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(barW, barH, 1.5), shipMat('hullBody')); // plain box engine housing
  bar.castShadow = true;
  bar.position.set(o.cx, 0.7, o.zSternC - 0.2);
  group.add(bar);
  // — thruster nacelles: octagonal prisms + pyramid nose (all faceted) —
  dynamic.exhaust = [];
  for (let i = 0; i < tCount; i++) {
    const fx = tCount === 1 ? 0 : (i / (tCount - 1) - 0.5) * 2;
    const tx = o.cx + fx * (barW / 2 - 0.9), tz = o.zSternC + 1.55;
    const nac = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.44 * ts, 0.52 * ts, 1.6 * ts, 8), shipMat('rim')); // octagonal
    body.rotation.x = Math.PI / 2; body.rotation.z = Math.PI / 8; body.castShadow = true;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.44 * ts, 0.7 * ts, 8), shipMat('rim'));
    nose.rotation.x = -Math.PI / 2; nose.rotation.y = Math.PI / 8; nose.position.z = -1.1 * ts;
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.48 * ts, 0.36 * ts, 0.45 * ts, 8, 1, true), shipMat('gun'));
    nozzle.rotation.x = Math.PI / 2; nozzle.rotation.z = Math.PI / 8; nozzle.position.z = 0.95 * ts;
    nac.add(body, nose, nozzle);
    const tint = SHIP_TIER_COLORS[Math.min(2, tTier - 1)];
    // layered flame: white-hot core + colored outer cone (both additive)
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xfff6e0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const flameCore = new THREE.Mesh(new THREE.ConeGeometry(0.16 * ts, 1.6 * ts, 12, 1, true), coreMat);
    flameCore.rotation.x = -Math.PI / 2; flameCore.position.z = 1.7 * ts;
    const outerMat = new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false });
    const flameOuter = new THREE.Mesh(new THREE.ConeGeometry(0.3 * ts, 2.6 * ts, 14, 1, true), outerMat);
    flameOuter.rotation.x = -Math.PI / 2; flameOuter.position.z = 2.2 * ts;
    // glow sprite at the nozzle mouth
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: shipGlowTexture(), color: tint, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(1.6 * ts);
    glow.position.z = 1.15 * ts;
    // particle stream
    const pCount = 36;
    const pPos = new Float32Array(pCount * 3);
    for (let p = 0; p < pCount; p++) { pPos[p * 3] = (Math.random() - 0.5) * 0.2; pPos[p * 3 + 1] = (Math.random() - 0.5) * 0.2; pPos[p * 3 + 2] = 1.2 * ts + Math.random() * 6; }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ color: tint, size: 0.34, map: shipGlowTexture(), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    const pts = new THREE.Points(pGeo, pMat);
    pts.frustumCulled = false;
    nac.add(flameCore, flameOuter, glow, pts);
    nac.position.set(tx, 0.75, tz);
    group.add(nac);
    dynamic.exhaust.push({ flameCore, flameOuter, coreMat, outerMat, glowMat: glow.material, pts, pGeo, ts, seed: i * 7.3 });
  }
}

// ── Orchestrator. opts.interior === true → the walkable DECK only (hull walls +
// deck + rooms + stations, no exterior wings/thrusters/guns) for the "board ship"
// view; otherwise the full parametric exterior (used as a fallback/legacy). ───
function buildShip3D(size, comps, opts) {
  comps = comps || {}; opts = opts || {};
  const o = shipHullOutline(size);
  const floor = shipRasterize(o);
  const zones = shipZones(floor, o, size);
  const group = new THREE.Group(), picks = [], dynamic = {};
  if (!opts.interior) group.add(shipBuildBody(o)); // solid belly is only for the exterior look
  group.add(shipBuildWalls(o));
  shipBuildDeck(floor, o, group, picks);
  shipBuildPartitions(zones, group);
  shipBuildStations(zones, comps, group, dynamic);
  if (!opts.interior) shipBuildExterior(o, comps, group, dynamic);
  const grid = { floor, roomAt: zones.roomAt, standable: (x, y) => floor.has(x + ',' + y) };
  return { group, picks, grid, outline: o, zones, dynamic, size };
}
function buildShipInterior(size, comps) { return buildShip3D(size, comps, { interior: true }); }

// Interior lighting: one soft light per room + ambient fill.
function addShipLighting(scene, built) {
  scene.add(new THREE.HemisphereLight(0xaecbf5, 0x141a26, 0.7));
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const lights = [];
  const kinds = ['bridge', 'common', 'quarters', 'hold', 'engine'];
  for (const kind of kinds) {
    const cells = built.zones.cellsOf(kind);
    if (!cells.length) continue;
    const cx = cells.reduce((s, p) => s + p[0], 0) / cells.length * SHIP_CELL;
    const cz = cells.reduce((s, p) => s + p[1], 0) / cells.length * SHIP_CELL;
    const span = Math.sqrt(cells.length) * SHIP_CELL;
    const p = new THREE.PointLight(kind === 'engine' ? 0xffd9b0 : 0xdcecff, 0.7, span * 3, 1.5);
    p.position.set(cx, 3.4, cz);
    scene.add(p); lights.push(p);
  }
  return lights;
}

// ═══════════════════════════════════════════════════════════════════════════
// ENVIRONMENT — straight parallel streaks + literal landings CENTRED ON THE
// SHIP (sites are built around the hull's own midpoint, sized to the hull).
// ═══════════════════════════════════════════════════════════════════════════
const SHIP_SITE_HIDDEN_Y = -120;
function shipSmoothstep(t) { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); }
function shipSeg(t, a, b) { return shipSmoothstep((t - a) / (b - a)); }

function shipMakeStars(count, R) {
  const pos = new Float32Array(count * 6);
  for (let i = 0; i < count; i++) {
    let x, y;
    do { x = (Math.random() * 2 - 1) * R; y = (Math.random() * 2 - 1) * R * 0.7; } while (Math.hypot(x, y - 8) < 46);
    const z = (Math.random() * 2 - 1) * R;
    pos.set([x, y, z, x, y, z], i * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xd6e6ff, transparent: true, opacity: 0.85 });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.userData = { count, R };
  return lines;
}

function shipBuildPlanetSite(padR) {
  const g = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.CircleGeometry(360, 48), new THREE.MeshStandardMaterial({ color: scColor(0x5d8a4a), roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  g.add(ground);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(padR, padR + 2, 1.1, 44), shipMat('padDark'));
  pad.position.y = 0.55; pad.receiveShadow = true;
  g.add(pad);
  for (const f of [0.82, 0.55]) {
    const mark = new THREE.Mesh(new THREE.TorusGeometry(padR * f, 0.26, 6, 48), shipMat('padMark'));
    mark.rotation.x = -Math.PI / 2; mark.position.y = 1.12;
    g.add(mark);
  }
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), shipMat('padMark'));
    lamp.position.set(Math.cos(a) * (padR * 0.95), 1.4, Math.sin(a) * (padR * 0.95));
    g.add(lamp);
  }
  for (let i = 0; i < 7; i++) {
    const hs = 20 + Math.random() * 34;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(hs, 20, 14), new THREE.MeshStandardMaterial({ color: scColor(0x527d42), roughness: 1 }));
    const a = Math.random() * Math.PI * 2, d = padR + 90 + Math.random() * 160;
    hill.position.set(Math.cos(a) * d, -hs * 0.62, Math.sin(a) * d);
    hill.scale.y = 0.5;
    g.add(hill);
  }
  for (let i = 0; i < 9; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1 + Math.random() * 2.2, 0), new THREE.MeshStandardMaterial({ color: scColor(0x7e8a75), roughness: 0.95 }));
    const a = Math.random() * Math.PI * 2, d = padR + 8 + Math.random() * 50;
    rock.position.set(Math.cos(a) * d, 0.8, Math.sin(a) * d);
    rock.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    g.add(rock);
  }
  g.userData.landedY = -1.93 - 1.12;
  return g;
}
function shipBuildDockSite(padR) {
  const g = new THREE.Group();
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(padR + 4, padR + 6, 1.6, 12), new THREE.MeshStandardMaterial({ color: scColor(0x353d4c), roughness: 0.55, metalness: 0.6 }));
  plat.position.y = 0.8; plat.receiveShadow = true;
  g.add(plat);
  for (const f of [0.8, 0.52]) {
    const mark = new THREE.Mesh(new THREE.TorusGeometry(padR * f, 0.24, 6, 44), shipMat('padMark'));
    mark.rotation.x = -Math.PI / 2; mark.position.y = 1.62;
    g.add(mark);
  }
  for (const [rot, rad] of [[0.4, padR + 42], [Math.PI + 0.6, padR + 50]]) {
    const arc = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, 26, 44, 1, true, rot, 1.6), new THREE.MeshStandardMaterial({ color: scColor(0x232a38), roughness: 0.6, metalness: 0.5, side: THREE.DoubleSide }));
    arc.position.y = 13;
    g.add(arc);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(rad - 0.3, rad - 0.3, 2.2, 44, 1, true, rot + 0.12, 1.36), new THREE.MeshStandardMaterial({ color: scColor(0x0a1a28), emissive: scColor(0x67d3ff), emissiveIntensity: 0.9, side: THREE.DoubleSide }));
    band.position.y = 15;
    g.add(band);
  }
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 7, 10), shipMat('gun'));
    post.position.set(Math.cos(a) * (padR + 2), 4.4, Math.sin(a) * (padR + 2));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), shipMat('padMark'));
    cap.position.set(Math.cos(a) * (padR + 2), 8.2, Math.sin(a) * (padR + 2));
    g.add(post, cap);
  }
  for (let i = 0; i < 6; i++) {
    const crate = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.2, 8), new THREE.MeshStandardMaterial({ color: scColor(0x7a5a2c), roughness: 0.8 }));
    const a = 0.8 + i * 0.28;
    crate.position.set(Math.cos(a) * (padR + 12), 1.1, Math.sin(a) * (padR + 12));
    g.add(crate);
  }
  g.userData.landedY = -1.93 - 1.62;
  return g;
}

function createShipEnvironment(scene) {
  const env = { mode: 'travel', phase: 'space', tt: 0, queued: null, built: null, shipGroup: null };
  scene.background = new THREE.Color(0x03040a);

  const stars = shipMakeStars(900, 320);
  scene.add(stars); env.stars = stars;
  env.streak = 1;

  const sun = new THREE.DirectionalLight(0xfff2dc, 0.0);
  sun.position.set(60, 90, 40);
  scene.add(sun); env.sun = sun;

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(700, 32, 20),
    new THREE.MeshBasicMaterial({ map: getSkyTexture3D(), side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false })
  );
  sky.visible = false;
  scene.add(sky); env.sky = sky;

  const sites = {};
  function siteFor(mode) {
    if (!sites[mode]) {
      // Size + centre the pad on the SHIP so it always lands mid-pad. A real
      // (loaded) ship is centred at origin with a known length + belly height; a
      // parametric build uses its outline. The pad TOP is set to meet the belly.
      const isReal = !!env.realShip;
      const cx = isReal ? 0 : (env.built ? env.built.outline.cx : 0);
      const cz = isReal ? 0 : (env.built ? env.built.outline.zMid : 0);
      const len = isReal ? env.realShip.userData.length : (env.built ? env.built.outline.length : 40);
      const padR = Math.max(16, len * 0.66);
      sites[mode] = mode === 'planet' ? shipBuildPlanetSite(padR) : shipBuildDockSite(padR);
      sites[mode].position.set(cx, SHIP_SITE_HIDDEN_Y, cz);
      if (isReal) { // pad top (planet 1.1 / dock 1.6 above the site) must meet the ship belly
        const padTop = mode === 'planet' ? 1.1 : 1.6;
        sites[mode].userData.landedY = env.realShip.userData.bellyY - padTop;
      }
      scene.add(sites[mode]);
    }
    return sites[mode];
  }

  env.bindShip = function (built, shipGroup) {
    env.built = built; env.realShip = null; env.shipGroup = shipGroup;
    for (const k in sites) { scene.remove(sites[k]); delete sites[k]; }
    if (env.phase === 'sited') env.site = siteFor(env.mode);
    sky.position.set(built.outline.cx, 0, built.outline.zMid);
    stars.position.set(built.outline.cx, 0, built.outline.zMid);
  };
  // Bind a REAL loaded ship model (centred at origin) as the exterior.
  env.bindRealShip = function (shipGroup) {
    env.built = null; env.realShip = shipGroup; env.shipGroup = shipGroup;
    for (const k in sites) { scene.remove(sites[k]); delete sites[k]; }
    if (env.phase === 'sited') env.site = siteFor(env.mode);
    sky.position.set(0, 0, 0); stars.position.set(0, 0, 0);
  };

  env.setMode = function (mode) {
    if (mode === env.mode && (env.phase === 'sited' || env.phase === 'space')) return;
    if (env.phase === 'landing' || env.phase === 'takeoff') { env.queued = mode; return; }
    if (mode === 'travel') {
      if (env.phase === 'sited') { env.phase = 'takeoff'; env.tt = 0; }
      env.mode = 'travel';
    } else {
      if (env.phase === 'sited') { env.queued = mode; env.phase = 'takeoff'; env.tt = 0; }
      else { env.mode = mode; env.site = siteFor(mode); env.phase = 'landing'; env.tt = 0; }
    }
  };

  const LAND_T = 3.4, TAKEOFF_T = 3.0;
  env.update = function (dt) {
    env.tt += dt;
    const t = env.tt, now = performance.now() / 1000;
    let streakTarget = 0, siteY = SHIP_SITE_HIDDEN_Y, skyO = 0, sunI = 0, shipY = 0, starsO = 0.85;
    const landedY = env.site ? (env.site.userData.landedY || 0) : 0;

    if (env.phase === 'space') {
      streakTarget = 1;
    } else if (env.phase === 'landing') {
      streakTarget = 1 - shipSeg(t, 0, 1.0);
      siteY = SHIP_SITE_HIDDEN_Y + (landedY - SHIP_SITE_HIDDEN_Y) * shipSeg(t, 0.5, 2.5);
      skyO = env.mode === 'planet' ? shipSeg(t, 0.6, 2.2) : 0;
      sunI = (env.mode === 'planet' ? 0.95 : 0.4) * shipSeg(t, 0.6, 2.4);
      shipY = 1.1 * shipSeg(t, 0.4, 1.4) * (1 - shipSeg(t, 2.2, LAND_T));
      starsO = env.mode === 'planet' ? 0.85 * (1 - shipSeg(t, 0.8, 2.0)) : 0.85 - 0.5 * shipSeg(t, 0.8, 2.0);
      if (t >= LAND_T) { env.phase = 'sited'; env.tt = 0; }
    } else if (env.phase === 'sited') {
      siteY = landedY;
      skyO = env.mode === 'planet' ? 1 : 0;
      sunI = env.mode === 'planet' ? 0.95 : 0.4;
      starsO = env.mode === 'planet' ? 0 : 0.35;
    } else if (env.phase === 'takeoff') {
      shipY = 1.2 * shipSeg(t, 0, 0.9) * (1 - shipSeg(t, 2.2, TAKEOFF_T));
      siteY = landedY + (SHIP_SITE_HIDDEN_Y - landedY) * shipSeg(t, 0.6, 2.2);
      skyO = (env.mode === 'planet' ? 1 : 0) * (1 - shipSeg(t, 0.4, 1.6));
      sunI = (env.mode === 'planet' ? 0.95 : 0.4) * (1 - shipSeg(t, 0.4, 1.8));
      starsO = 0.35 + 0.5 * shipSeg(t, 1.4, TAKEOFF_T);
      streakTarget = shipSeg(t, 1.8, TAKEOFF_T);
      if (t >= TAKEOFF_T) {
        env.phase = 'space'; env.tt = 0; env.mode = 'travel';
        if (env.queued && env.queued !== 'travel') { const q = env.queued; env.queued = null; env.setMode(q); }
        else env.queued = null;
      }
    }

    env.streak += (streakTarget - env.streak) * (1 - Math.pow(0.002, dt));
    if (env.site) env.site.position.y = siteY;
    for (const k in sites) if (sites[k] !== env.site) sites[k].position.y = SHIP_SITE_HIDDEN_Y;
    env.sky.material.opacity = skyO; env.sky.visible = skyO > 0.01;
    env.sun.intensity = sunI;
    env.sun.color.setHex(env.mode === 'dock' ? 0xbdd8ff : 0xfff2dc);
    if (env.shipGroup) env.shipGroup.position.y = shipY;
    stars.material.opacity = starsO; stars.visible = starsO > 0.02;

    // straight, parallel streaks along +z
    const { count, R } = stars.userData;
    const pos = stars.geometry.attributes.position.array;
    const step = (4 + env.streak * 60) * dt * 10;
    const tail = 1.2 + env.streak * 60;
    for (let i = 0; i < count; i++) {
      let hz = pos[i * 6 + 5] + step;
      if (hz > R) hz -= 2 * R;
      pos[i * 6 + 5] = hz;
      pos[i * 6 + 2] = hz - tail;
    }
    stars.geometry.attributes.position.needsUpdate = true;

    // real ship: pulse the engine glow with the flight speed
    if (env.realShip && env.realShip.userData.engineGlow) {
      const burn = 0.25 + env.streak * 0.9;
      for (const spr of env.realShip.userData.engineGlow) {
        spr.material.opacity = 0.25 + burn * 0.6 * (1 + 0.12 * Math.sin(now * 24 + spr.position.x));
        spr.scale.setScalar(1.6 + burn * 1.4);
      }
    }
    // ship VFX: flickering layered flames, glow, particle stream, holo + reactor pulse
    if (env.built && env.built.dynamic) {
      const d = env.built.dynamic;
      const burn = 0.12 + env.streak * 0.88;
      if (d.exhaust) for (const e of d.exhaust) {
        const flick = 1 + 0.16 * Math.sin(now * 47 + e.seed) + 0.09 * Math.sin(now * 89 + e.seed * 2.1);
        e.flameCore.scale.set(1, (0.25 + burn * 1.1) * flick, 1);
        e.flameOuter.scale.set(1, (0.3 + burn * 1.2) * flick, 1);
        e.coreMat.opacity = 0.15 + burn * 0.75;
        e.outerMat.opacity = 0.08 + burn * 0.42;
        e.glowMat.opacity = 0.2 + burn * 0.7 * flick;
        // particles: stream backwards, respawn at the nozzle
        const arr = e.pGeo.attributes.position.array;
        const maxLen = 2 + burn * 8;
        for (let p = 0; p < arr.length; p += 3) {
          arr[p + 2] += dt * (5 + burn * 26);
          arr[p] += (Math.random() - 0.5) * dt * 1.6;
          arr[p + 1] += (Math.random() - 0.5) * dt * 1.6;
          if (arr[p + 2] > 1.2 * e.ts + maxLen) {
            arr[p] = (Math.random() - 0.5) * 0.18; arr[p + 1] = (Math.random() - 0.5) * 0.18; arr[p + 2] = 1.2 * e.ts;
          }
        }
        e.pGeo.attributes.position.needsUpdate = true;
        e.pts.material.opacity = 0.06 + burn * 0.5;
      }
      if (d.reactorCore) d.reactorCore.material.emissiveIntensity = 1.2 + Math.sin(now * 3.4) * 0.45;
      if (d.holo) { d.holo.position.y = 1.42 + Math.sin(now * 2.2) * 0.05; d.holo.rotation.y += dt * 1.4; }
      if (d.gunTips) for (let i = 0; i < d.gunTips.length; i++) d.gunTips[i].material.emissiveIntensity = 1.3 + Math.sin(now * 2.6 + i) * 0.5;
    }
  };
  return env;
}
