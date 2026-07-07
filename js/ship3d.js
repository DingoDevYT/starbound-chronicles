// ═══════════════════════════════════════════════════════════════════════════
// STARBOUND CHRONICLES — 3D ship home base (classic script).
// A walkable, enclosed spaceship interior the crew move around in as their home.
// Loaded by campaign.html (Ship tab) AND dev-ship.html (visual harness).
//
// Reuses the low-level helpers from js/combat3d-structures.js (scColor,
// scCloneModel3D, scCachedGeo) — that file must load first.
//
// Layout scales with hull size (small → capital): more/bigger rooms. Interior is
// generated parametric geometry (panelled metal, emissive trim, ceiling) with
// Kenney space-station props dropped in for the "home" feel. Outside the hull is
// SPACE: a black void with a warp-streak starfield the GM can flip between three
// environment modes — travelling, docked at a station, or landed on a planet —
// with smooth transitions between them.
//
// Coordinate system matches combat: 1 grid cell = SHIP_CELL world units, +x east,
// +z south, y up. Tokens stand at (gx*cell, gz*floorH, gy*cell).
// ═══════════════════════════════════════════════════════════════════════════

const SHIP_CELL = 2;
const SHIP_WALL_H = 2.7;              // interior ceiling height (world units)
const SHIP_DIR4 = [ [0,-1], [1,0], [0,1], [-1,0] ]; // r: 0 N, 1 E, 2 S, 3 W

// ── Materials (cached; dark metallic hull with cyan emissive trim) ───────────
const shipMatCache = new Map();
function shipMat(key) {
  if (shipMatCache.has(key)) return shipMatCache.get(key);
  let m;
  switch (key) {
    case 'deckA':   m = new THREE.MeshStandardMaterial({ color: scColor(0x4a5468), roughness: 0.6, metalness: 0.35 }); break;
    case 'deckB':   m = new THREE.MeshStandardMaterial({ color: scColor(0x3e4759), roughness: 0.6, metalness: 0.35 }); break;
    case 'wall':    m = new THREE.MeshStandardMaterial({ color: scColor(0x424b5e), roughness: 0.5,  metalness: 0.45 }); break;
    case 'wallDark':m = new THREE.MeshStandardMaterial({ color: scColor(0x353d4d), roughness: 0.5,  metalness: 0.45 }); break;
    case 'ceiling': m = new THREE.MeshStandardMaterial({ color: scColor(0x1c222d), roughness: 0.7,  metalness: 0.3, side: THREE.DoubleSide }); break;
    case 'frame':   m = new THREE.MeshStandardMaterial({ color: scColor(0x454f63), roughness: 0.4,  metalness: 0.6  }); break;
    case 'trim':    m = new THREE.MeshStandardMaterial({ color: scColor(0x0a2438), emissive: scColor(0x2ea8ff), emissiveIntensity: 1.3, roughness: 0.4, metalness: 0.3 }); break;
    case 'trimWarm':m = new THREE.MeshStandardMaterial({ color: scColor(0x2a1608), emissive: scColor(0xffa83a), emissiveIntensity: 1.1, roughness: 0.4, metalness: 0.3 }); break;
    case 'lightPanel': m = new THREE.MeshStandardMaterial({ color: scColor(0x0d1a26), emissive: scColor(0x8fd0ff), emissiveIntensity: 0.9, roughness: 0.5, metalness: 0.1 }); break;
    case 'glass':   m = new THREE.MeshStandardMaterial({ color: scColor(0x0a1622), transparent: true, opacity: 0.14, roughness: 0.1, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false }); break;
    default:        m = new THREE.MeshStandardMaterial({ color: scColor(0x808080) });
  }
  shipMatCache.set(key, m);
  return m;
}
function shipPickMat() {
  if (!shipMatCache.has('__pick')) shipMatCache.set('__pick', new THREE.MeshBasicMaterial({ visible: false }));
  return shipMatCache.get('__pick');
}

// ── Interior layouts, hand-authored per hull size. Each is a set of rooms whose
// union forms the pressurised hull; the outer boundary becomes hull walls (with
// window runs on the forward/bridge face), interior partitions get doorways, and
// a few cells are tagged as component-station anchors. ───────────────────────
// A layout: { w, h, rooms:[{x0,y0,x1,y1,kind}], stations:[{kind,x,y,r}] }
// kinds: bridge, engine, quarters, hold, corridor, common
const SHIP_LAYOUTS = {
  small: {
    w: 9, h: 8,
    rooms: [
      { x0: 2, y0: 0, x1: 7, y1: 3, kind: 'bridge' },
      { x0: 1, y0: 3, x1: 8, y1: 6, kind: 'common' },
      { x0: 3, y0: 6, x1: 6, y1: 8, kind: 'engine' },
    ],
    stations: [
      { kind: 'helm',    x: 4, y: 1, r: 0 },
      { kind: 'reactor', x: 4, y: 6, r: 0 },
      { kind: 'weapons', x: 6, y: 4, r: 1 },
    ],
  },
  medium: {
    w: 13, h: 11,
    rooms: [
      { x0: 3, y0: 0, x1: 10, y1: 3, kind: 'bridge' },
      { x0: 1, y0: 3, x1: 12, y1: 7, kind: 'common' },
      { x0: 1, y0: 7, x1: 5, y1: 11, kind: 'quarters' },
      { x0: 5, y0: 7, x1: 12, y1: 11, kind: 'engine' },
    ],
    stations: [
      { kind: 'helm',    x: 6, y: 1, r: 0 },
      { kind: 'reactor', x: 9, y: 9, r: 0 },
      { kind: 'weapons', x: 11, y: 4, r: 1 },
      { kind: 'weapons', x: 2, y: 4, r: 3 },
    ],
  },
  large: {
    w: 17, h: 14,
    rooms: [
      { x0: 5, y0: 0, x1: 12, y1: 3, kind: 'bridge' },
      { x0: 1, y0: 3, x1: 16, y1: 8, kind: 'common' },
      { x0: 1, y0: 8, x1: 6, y1: 14, kind: 'quarters' },
      { x0: 6, y0: 8, x1: 11, y1: 14, kind: 'hold' },
      { x0: 11, y0: 8, x1: 16, y1: 14, kind: 'engine' },
    ],
    stations: [
      { kind: 'helm',    x: 8, y: 1, r: 0 },
      { kind: 'reactor', x: 13, y: 11, r: 0 },
      { kind: 'weapons', x: 15, y: 5, r: 1 },
      { kind: 'weapons', x: 2, y: 5, r: 3 },
    ],
  },
  capital: {
    w: 23, h: 18,
    rooms: [
      { x0: 8, y0: 0, x1: 15, y1: 3, kind: 'bridge' },
      { x0: 2, y0: 3, x1: 21, y1: 9, kind: 'common' },
      { x0: 2, y0: 9, x1: 8, y1: 18, kind: 'quarters' },
      { x0: 8, y0: 9, x1: 15, y1: 18, kind: 'hold' },
      { x0: 15, y0: 9, x1: 21, y1: 18, kind: 'engine' },
    ],
    stations: [
      { kind: 'helm',    x: 11, y: 1, r: 0 },
      { kind: 'reactor', x: 18, y: 13, r: 0 },
      { kind: 'weapons', x: 20, y: 6, r: 1 },
      { kind: 'weapons', x: 3, y: 6, r: 3 },
      { kind: 'planet',  x: 11, y: 6, r: 0 },
    ],
  },
};
function shipLayoutFor(size) { return SHIP_LAYOUTS[size] || SHIP_LAYOUTS.medium; }

// Derive the buildable grid from a layout: floor cells, hull-perimeter wall edges
// (some become windows), interior partition edges (with a doorway gap each), and
// which cells are standable (for token movement later).
function shipDeriveGrid(layout) {
  const floor = new Set();               // "x,y"
  const roomAt = new Map();              // "x,y" -> kind
  for (const r of layout.rooms) for (let x = r.x0; x < r.x1; x++) for (let y = r.y0; y < r.y1; y++) {
    floor.add(x + ',' + y); roomAt.set(x + ',' + y, r.kind);
  }
  const has = (x, y) => floor.has(x + ',' + y);
  // An edge between cell (x,y) and neighbour (nx,ny). Hull edge = only one side is floor.
  const hullWall = new Set(), partition = new Set(), windowEdge = new Set(), doorEdge = new Set();
  const key = (x, y, r) => x + ',' + y + ',' + r;
  for (const cell of floor) {
    const [x, y] = cell.split(',').map(Number);
    SHIP_DIR4.forEach(([dx, dy], r) => {
      const nx = x + dx, ny = y + dy;
      if (!has(nx, ny)) hullWall.add(key(x, y, r));                 // outward-facing → hull wall
      else if (roomAt.get(cell) !== roomAt.get(nx + ',' + ny)) {    // between two different rooms → partition
        // canonical: only add once (lower cell owns it)
        if (x < nx || y < ny) partition.add(key(x, y, r));
      }
    });
  }
  // Windows: put a run along each room's forward (north) hull face for the bridge/common.
  for (const cell of floor) {
    const [x, y] = cell.split(',').map(Number);
    const kind = roomAt.get(cell);
    if ((kind === 'bridge' || kind === 'common') && hullWall.has(key(x, y, 0)) && (x % 2 === 0)) {
      windowEdge.add(key(x, y, 0)); hullWall.delete(key(x, y, 0));
    }
    // side windows too, sparser
    if (kind === 'common' && hullWall.has(key(x, y, 1)) && (y % 3 === 0)) { windowEdge.add(key(x, y, 1)); hullWall.delete(key(x, y, 1)); }
    if (kind === 'common' && hullWall.has(key(x, y, 3)) && (y % 3 === 1)) { windowEdge.add(key(x, y, 3)); hullWall.delete(key(x, y, 3)); }
  }
  // Doorways: for each pair of adjacent rooms, punch one partition edge open near their shared border midpoint.
  const partList = [...partition];
  const seenPair = new Set();
  for (const e of partList) {
    const [x, y, r] = e.split(',').map(Number);
    const [dx, dy] = SHIP_DIR4[r];
    const pair = [roomAt.get(x + ',' + y), roomAt.get((x + dx) + ',' + (y + dy))].sort().join('|');
    if (seenPair.has(pair)) continue;
    // find the middle edge of this pair's shared border
    const shared = partList.filter(pe => {
      const [px, py, pr] = pe.split(',').map(Number); const [pdx, pdy] = SHIP_DIR4[pr];
      return [roomAt.get(px + ',' + py), roomAt.get((px + pdx) + ',' + (py + pdy))].sort().join('|') === pair;
    });
    const mid = shared[Math.floor(shared.length / 2)];
    doorEdge.add(mid); partition.delete(mid);
    seenPair.add(pair);
  }
  return { w: layout.w, h: layout.h, floor, roomAt, hullWall, partition, windowEdge, doorEdge,
           standable: (x, y) => floor.has(x + ',' + y) };
}

// ── Build the interior as a THREE.Group. Returns { group, picks } — picks are
// invisible floor tiles carrying userData.cell for click-to-move later. ──────
function buildShipInterior(size) {
  const layout = shipLayoutFor(size);
  const g = shipDeriveGrid(layout);
  const group = new THREE.Group(), picks = [];
  const cell = SHIP_CELL, wallT = cell * 0.08, wallH = SHIP_WALL_H, slab = cell * 0.06;

  // Deck: instanced panels (checkerboard of two metals) + a pick tile per cell.
  const floorCells = [...g.floor].map(k => k.split(',').map(Number));
  const deckGeo = scCachedGeo(`shipdeck|${cell}`, () => new THREE.BoxGeometry(cell * 0.98, slab, cell * 0.98));
  const instA = new THREE.InstancedMesh(deckGeo, shipMat('deckA'), floorCells.length);
  const instB = new THREE.InstancedMesh(deckGeo, shipMat('deckB'), floorCells.length);
  instA.receiveShadow = instB.receiveShadow = true;
  let ia = 0, ib = 0; const m4 = new THREE.Matrix4();
  const pickGeo = scCachedGeo(`shippick|${cell}`, () => new THREE.PlaneGeometry(cell, cell));
  for (const [x, y] of floorCells) {
    m4.makeTranslation(x * cell, -slab / 2, y * cell);
    if ((x + y) % 2 === 0) instA.setMatrixAt(ia++, m4); else instB.setMatrixAt(ib++, m4);
    const pick = new THREE.Mesh(pickGeo, shipPickMat());
    pick.rotation.x = -Math.PI / 2; pick.position.set(x * cell, 0.02, y * cell);
    pick.userData.cell = { x, y, z: 0 };
    group.add(pick); picks.push(pick);
  }
  instA.count = ia; instB.count = ib;
  instA.instanceMatrix.needsUpdate = instB.instanceMatrix.needsUpdate = true;
  group.add(instA, instB);

  // Ceiling: dark panels over the whole footprint + a few glowing light strips.
  const ceilY = wallH;
  for (const [x, y] of floorCells) {
    const tile = new THREE.Mesh(scCachedGeo(`shipceil|${cell}`, () => new THREE.BoxGeometry(cell * 0.98, slab, cell * 0.98)), shipMat('ceiling'));
    tile.position.set(x * cell, ceilY, y * cell);
    group.add(tile);
    if ((x + y * 2) % 5 === 0) { // scattered ceiling light panels
      const lp = new THREE.Mesh(scCachedGeo(`shiplp|${cell}`, () => new THREE.BoxGeometry(cell * 0.5, slab * 0.8, cell * 0.5)), shipMat('lightPanel'));
      lp.position.set(x * cell, ceilY - slab, y * cell);
      group.add(lp);
    }
  }

  // Walls: full-height panels on hull + partition edges, windows on window edges.
  const wallGeoH = scCachedGeo(`shipwall|${cell}|${wallH}`, () => new THREE.BoxGeometry(cell + wallT, wallH, wallT));
  const trimGeo  = scCachedGeo(`shiptrim|${cell}`, () => new THREE.BoxGeometry(cell + wallT, wallH * 0.05, wallT * 1.2));
  const addWall = (x, y, r, kind) => {
    const [dx, dy] = SHIP_DIR4[r];
    const wrap = new THREE.Group();
    const panel = new THREE.Mesh(wallGeoH, shipMat(kind === 'part' ? 'wallDark' : 'wall'));
    panel.position.y = wallH / 2; panel.castShadow = true; panel.receiveShadow = true;
    wrap.add(panel);
    const trim = new THREE.Mesh(trimGeo, shipMat('trim'));  // emissive baseboard glow
    trim.position.y = wallH * 0.14; wrap.add(trim);
    wrap.rotation.y = (r % 2 === 1) ? Math.PI / 2 : 0;
    wrap.position.set(x * cell + dx * cell / 2, 0, y * cell + dy * cell / 2);
    group.add(wrap);
  };
  const addWindow = (x, y, r) => {
    const [dx, dy] = SHIP_DIR4[r];
    const wrap = new THREE.Group();
    // frame ring (top/bottom/sides) + a faint glass pane; the opening looks out to space
    const fT = new THREE.Mesh(new THREE.BoxGeometry(cell + wallT, wallH * 0.22, wallT), shipMat('frame')); fT.position.y = wallH * 0.89;
    const fB = new THREE.Mesh(new THREE.BoxGeometry(cell + wallT, wallH * 0.3, wallT), shipMat('frame'));  fB.position.y = wallH * 0.15;
    const fL = new THREE.Mesh(new THREE.BoxGeometry(wallT * 1.4, wallH, wallT), shipMat('frame')); fL.position.set(-(cell / 2 - wallT * 0.5), wallH / 2, 0);
    const fR = fL.clone(); fR.position.x = (cell / 2 - wallT * 0.5);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(cell * 0.8, wallH * 0.5), shipMat('glass')); glass.position.y = wallH * 0.5;
    [fT, fB, fL, fR].forEach(o => { o.castShadow = true; });
    wrap.add(fT, fB, fL, fR, glass);
    wrap.rotation.y = (r % 2 === 1) ? Math.PI / 2 : 0;
    wrap.position.set(x * cell + dx * cell / 2, 0, y * cell + dy * cell / 2);
    wrap.userData.window = { x, y, r };
    group.add(wrap);
  };
  for (const e of g.hullWall)   { const [x, y, r] = e.split(',').map(Number); addWall(x, y, r, 'hull'); }
  for (const e of g.partition)  { const [x, y, r] = e.split(',').map(Number); addWall(x, y, r, 'part'); }
  for (const e of g.windowEdge) { const [x, y, r] = e.split(',').map(Number); addWindow(x, y, r); }

  return { group, picks, grid: g, layout };
}

// ═══════════════════════════════════════════════════════════════════════════
// SPACE ENVIRONMENT — black void + warp-streak starfield with three GM modes.
//   travel : fast forward streaks (hyperspace)
//   dock   : slow drift, station lights ahead
//   planet : slow drift, a big planet filling one side
// The Ship3DEnvironment object owns the stars, planet and dock props and tweens
// smoothly between modes when setMode() is called.
// ═══════════════════════════════════════════════════════════════════════════
function makeStarfield(count, radius) {
  const positions = new Float32Array(count * 2 * 3); // pairs of verts (tail,head) for streaks
  const vel = new Float32Array(count * 3);
  const R = radius;
  for (let i = 0; i < count; i++) {
    const x = (Math.random() * 2 - 1) * R, y = (Math.random() * 2 - 1) * R, z = (Math.random() * 2 - 1) * R;
    for (const o of [0, 3]) { positions[i * 6 + o] = x; positions[i * 6 + o + 1] = y; positions[i * 6 + o + 2] = z; }
    // drift direction (toward -z, the "forward" travel axis), varied slightly
    vel[i * 3] = (Math.random() - 0.5) * 0.2; vel[i * 3 + 1] = (Math.random() - 0.5) * 0.2; vel[i * 3 + 2] = -1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xcfe2ff, transparent: true, opacity: 0.9, fog: false });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.userData = { vel, count, R, positions };
  return lines;
}

function createShipEnvironment(scene) {
  const env = { mode: 'travel', speed: 0, targetSpeed: 1, streak: 0, targetStreak: 1 };
  scene.background = new THREE.Color(0x03040a);

  const stars = makeStarfield(1400, 340);
  scene.add(stars);
  env.stars = stars;

  // Planet — a big sphere with a canvas gradient + soft atmosphere rim, hidden until planet mode.
  const planetTex = shipPlanetTexture();
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(180, 48, 32),
    new THREE.MeshStandardMaterial({ map: planetTex, roughness: 1, metalness: 0, emissive: 0x223044, emissiveIntensity: 0.25, fog: false })
  );
  planet.position.set(120, -230, -260);
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(196, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x5fa8ff, transparent: true, opacity: 0.16, side: THREE.BackSide, fog: false })
  );
  planet.add(atmo);
  planet.visible = false; planet.scale.setScalar(0.01);
  scene.add(planet); env.planet = planet;

  // Dock — a distant station: a few big dark structures dotted with window lights, hidden until dock mode.
  const dock = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const w = 40 + Math.random() * 60, h = 30 + Math.random() * 90, d = 40 + Math.random() * 60;
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: scColor(0x1a2230), roughness: 0.7, metalness: 0.5, emissive: scColor(0x0a1420), emissiveIntensity: 0.4, fog: false }));
    box.position.set(-160 + Math.random() * 60, -60 + Math.random() * 120, -300 - Math.random() * 120);
    dock.add(box);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(120, 10, 12, 48),
    new THREE.MeshStandardMaterial({ color: scColor(0x232c3c), roughness: 0.6, metalness: 0.6, emissive: scColor(0x102030), emissiveIntensity: 0.5, fog: false }));
  ring.position.set(-140, 0, -340); ring.rotation.set(Math.PI / 2.3, 0.3, 0);
  dock.add(ring);
  dock.visible = false; dock.scale.setScalar(0.01);
  scene.add(dock); env.dock = dock;

  env.setMode = function (mode) {
    env.mode = mode;
    if (mode === 'travel') { env.targetSpeed = 4.0; env.targetStreak = 1; }
    else if (mode === 'dock') { env.targetSpeed = 0.25; env.targetStreak = 0.05; }
    else if (mode === 'planet') { env.targetSpeed = 0.2; env.targetStreak = 0.04; }
    env._planetOn = (mode === 'planet');
    env._dockOn = (mode === 'dock');
    if (env._planetOn) planet.visible = true;
    if (env._dockOn) dock.visible = true;
  };
  env.update = function (dt) {
    // ease speed + streak toward targets (the transition animation)
    const k = 1 - Math.pow(0.001, dt);
    env.speed += (env.targetSpeed - env.speed) * k;
    env.streak += (env.targetStreak - env.streak) * k;
    // advance stars along their drift, stretch tails by current streak, wrap in the box
    const { vel, count, R, positions } = stars.userData;
    const step = env.speed * dt * 60;
    const tail = 6 + env.streak * 90;
    for (let i = 0; i < count; i++) {
      let hx = positions[i * 6 + 3] + vel[i * 3] * step;
      let hy = positions[i * 6 + 4] + vel[i * 3 + 1] * step;
      let hz = positions[i * 6 + 5] + vel[i * 3 + 2] * step;
      if (hz < -R) { hz += 2 * R; hx = (Math.random() * 2 - 1) * R; hy = (Math.random() * 2 - 1) * R; }
      positions[i * 6 + 3] = hx; positions[i * 6 + 4] = hy; positions[i * 6 + 5] = hz;       // head
      positions[i * 6] = hx - vel[i * 3] * tail; positions[i * 6 + 1] = hy - vel[i * 3 + 1] * tail; positions[i * 6 + 2] = hz - vel[i * 3 + 2] * tail; // tail
    }
    stars.geometry.attributes.position.needsUpdate = true;
    // planet / dock grow-in and out
    const grow = (obj, on) => {
      const t = obj.scale.x + ((on ? 1 : 0.01) - obj.scale.x) * k;
      obj.scale.setScalar(t);
      if (!on && t < 0.02) obj.visible = false;
    };
    grow(planet, env._planetOn);
    grow(dock, env._dockOn);
    if (planet.visible) planet.rotation.y += dt * 0.01;
  };
  env.setMode('travel');
  return env;
}

// A cloudy planet surface on a canvas (no image asset). Blue-green world by default.
let shipPlanetTex = null;
function shipPlanetTexture() {
  if (shipPlanetTex) return shipPlanetTex;
  const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#1b3a6b'); grd.addColorStop(0.5, '#2b6a7a'); grd.addColorStop(1, '#153048');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  // continents
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(${40 + Math.random() * 40},${90 + Math.random() * 60},${60 + Math.random() * 40},0.5)`;
    g.beginPath(); g.ellipse(Math.random() * W, Math.random() * H, 20 + Math.random() * 90, 12 + Math.random() * 40, Math.random() * 6, 0, Math.PI * 2); g.fill();
  }
  // clouds
  for (let i = 0; i < 60; i++) {
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath(); g.ellipse(Math.random() * W, Math.random() * H, 30 + Math.random() * 80, 10 + Math.random() * 20, 0, 0, Math.PI * 2); g.fill();
  }
  shipPlanetTex = new THREE.CanvasTexture(c);
  shipPlanetTex.colorSpace = THREE.sRGBEncoding; shipPlanetTex.encoding = THREE.sRGBEncoding;
  return shipPlanetTex;
}

// Interior lighting rig: soft ambient + cool hemisphere + one warm-white point light
// per room (under the ceiling) so every room is walkable-bright and the metal has
// form, while the emissive trim still reads. Added to whatever group/scene.
function addShipLighting(scene, layout) {
  scene.add(new THREE.HemisphereLight(0xaecbf5, 0x141a26, 0.7));
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const lights = [];
  for (const r of layout.rooms) {
    const rx = (r.x0 + r.x1 - 1) / 2 * SHIP_CELL, rz = (r.y0 + r.y1 - 1) / 2 * SHIP_CELL;
    const span = Math.max(r.x1 - r.x0, r.y1 - r.y0) * SHIP_CELL;
    const p = new THREE.PointLight(0xdcecff, 0.85, span * 2.4, 1.6);
    p.position.set(rx, SHIP_WALL_H * 0.86, rz);
    scene.add(p); lights.push(p);
  }
  return lights;
}
