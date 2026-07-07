// ═══════════════════════════════════════════════════════════════════════════
// STARBOUND CHRONICLES — 3D ship home base (classic script).
// A walkable spaceship interior seen from above (no roof — you look in and click
// around), wrapped in a CURVED hull silhouette with real exterior components:
// wings, thruster nacelles with burning exhaust, gun turrets on the rim, and a
// glowing reactor core in the engine room. Requires js/combat3d-structures.js.
//
// The environment does LITERAL landings: flip the GM mode and the ship flares,
// a landing site (planet surface + pad, or a dock hangar platform) rises to meet
// the hull, and the ship settles onto its legs — then lifts off again into
// perfectly straight, parallel warp streaks when you return to travel.
//
// buildShip3D(size, comps) → { group, picks, grid, layout, dynamic }
//   comps: { wingTier, thrusterTier, reactorTier, gunCount, gunTier } (1..3)
// createShipEnvironment(scene) → env with setMode('travel'|'dock'|'planet'),
//   update(dt), bindShip(built, shipGroup).
// ═══════════════════════════════════════════════════════════════════════════

const SHIP_CELL = 2;
const SHIP_HULL_H = 1.9;   // outer hull wall height (open top above)
const SHIP_PART_H = 1.5;   // interior partition height (lower, so rooms read from above)
const SHIP_DIR4 = [ [0,-1], [1,0], [0,1], [-1,0] ];
const SHIP_GRID_DIMS = { small: { w: 9, h: 10 }, medium: { w: 13, h: 13 }, large: { w: 17, h: 16 }, capital: { w: 23, h: 20 } };
const SHIP_TIER_COLORS = [0xffa83a, 0x3ad2ff, 0xc07aff]; // upgrade tiers 1/2/3: amber → cyan → violet

// ── Materials ────────────────────────────────────────────────────────────────
const shipMatCache = new Map();
function shipMat(key) {
  if (shipMatCache.has(key)) return shipMatCache.get(key);
  let m;
  switch (key) {
    case 'hullBody': m = new THREE.MeshStandardMaterial({ color: scColor(0x39445c), roughness: 0.45, metalness: 0.55 }); break;
    case 'hullWall': m = new THREE.MeshStandardMaterial({ color: scColor(0x46516b), roughness: 0.5, metalness: 0.45, side: THREE.DoubleSide }); break;
    case 'deckA':    m = new THREE.MeshStandardMaterial({ color: scColor(0x4d5871), roughness: 0.6, metalness: 0.3 }); break;
    case 'deckB':    m = new THREE.MeshStandardMaterial({ color: scColor(0x424c62), roughness: 0.6, metalness: 0.3 }); break;
    case 'part':     m = new THREE.MeshStandardMaterial({ color: scColor(0x59647e), roughness: 0.5, metalness: 0.4 }); break;
    case 'rim':      m = new THREE.MeshStandardMaterial({ color: scColor(0x6b7793), roughness: 0.35, metalness: 0.65 }); break;
    case 'trim':     m = new THREE.MeshStandardMaterial({ color: scColor(0x0a2438), emissive: scColor(0x2ea8ff), emissiveIntensity: 1.4, roughness: 0.4 }); break;
    case 'console':  m = new THREE.MeshStandardMaterial({ color: scColor(0x2b3345), roughness: 0.4, metalness: 0.5 }); break;
    case 'screen':   m = new THREE.MeshStandardMaterial({ color: scColor(0x06131f), emissive: scColor(0x53c8ff), emissiveIntensity: 1.2, roughness: 0.3 }); break;
    case 'seat':     m = new THREE.MeshStandardMaterial({ color: scColor(0x7a4a3a), roughness: 0.8, metalness: 0.05 }); break;
    case 'gun':      m = new THREE.MeshStandardMaterial({ color: scColor(0x333c4f), roughness: 0.4, metalness: 0.6 }); break;
    case 'glass':    m = new THREE.MeshStandardMaterial({ color: scColor(0x0a1622), transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false }); break;
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
    shipMatCache.set(key, new THREE.MeshStandardMaterial({ color: scColor(0x141820), emissive: scColor(c), emissiveIntensity: 1.5, roughness: 0.35 }));
  }
  return shipMatCache.get(key);
}
function shipPickMat() {
  if (!shipMatCache.has('__pick')) shipMatCache.set('__pick', new THREE.MeshBasicMaterial({ visible: false }));
  return shipMatCache.get('__pick');
}

// ── Curved hull outline (top view). Built from quadratic curves: tapered round
// nose → shoulder → widest at mid → gentle taper → rounded stern. Returned both
// as a THREE.Shape (for extrusion) and a flat point list (for the wall ribbon +
// point-in-polygon rasterisation of walkable cells). ─────────────────────────
function shipHullOutline(size) {
  const { w, h } = SHIP_GRID_DIMS[size] || SHIP_GRID_DIMS.medium;
  const c = SHIP_CELL;
  const cx = (w - 1) * c / 2;
  const zTop = -0.5 * c, zBot = (h - 0.5) * c;
  const maxHalf = (w - 1) * c / 2 + 0.9 * c;
  const shoulderHalf = maxHalf * 0.58, sternHalf = maxHalf * 0.74;
  const zNose = zTop - 2.4 * c, zShoulder = zTop + 1.6 * c, zMax = zTop + (zBot - zTop) * 0.46;
  const zSternC = zBot - 0.4 * c, zStern = zBot + 0.5 * c;

  const s = new THREE.Shape();
  s.moveTo(cx, zNose);
  s.quadraticCurveTo(cx + shoulderHalf * 0.9, zNose + 0.6 * c, cx + shoulderHalf, zShoulder);
  s.quadraticCurveTo(cx + maxHalf * 1.04, (zShoulder + zMax) / 2, cx + maxHalf, zMax);
  s.quadraticCurveTo(cx + maxHalf * 0.98, (zMax + zSternC) / 2, cx + sternHalf, zSternC);
  s.quadraticCurveTo(cx + sternHalf * 0.96, zStern, cx + sternHalf * 0.62, zStern);
  s.lineTo(cx - sternHalf * 0.62, zStern);
  s.quadraticCurveTo(cx - sternHalf * 0.96, zStern, cx - sternHalf, zSternC);
  s.quadraticCurveTo(cx - maxHalf * 0.98, (zMax + zSternC) / 2, cx - maxHalf, zMax);
  s.quadraticCurveTo(cx - maxHalf * 1.04, (zShoulder + zMax) / 2, cx - shoulderHalf, zShoulder);
  s.quadraticCurveTo(cx - shoulderHalf * 0.9, zNose + 0.6 * c, cx, zNose);
  const pts = s.getPoints(72);
  return { shape: s, pts, w, h, cx, zNose, zShoulder, zMax, zSternC, zStern, maxHalf, shoulderHalf, sternHalf };
}
function shipPointInHull(px, pz, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, zi = pts[i].y, xj = pts[j].x, zj = pts[j].y;
    if (((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / (zj - zi) + xi)) inside = !inside;
  }
  return inside;
}

// Walkable cells: a cell is floor when its centre AND four inset corners all fall
// inside the hull outline (so walls never slice through a walkable tile).
function shipRasterize(o) {
  const c = SHIP_CELL, floor = new Set();
  for (let x = 0; x < o.w; x++) for (let y = 0; y < o.h; y++) {
    const wx = x * c, wz = y * c, m = 0.44 * c;
    if (shipPointInHull(wx, wz, o.pts) && shipPointInHull(wx - m, wz - m, o.pts) && shipPointInHull(wx + m, wz - m, o.pts) &&
        shipPointInHull(wx - m, wz + m, o.pts) && shipPointInHull(wx + m, wz + m, o.pts)) floor.add(x + ',' + y);
  }
  return floor;
}

// Assign rooms by hull-length bands: bridge (front), common (middle), and a rear
// section split into quarters/hold/engine depending on hull size. Partitions get
// a doorway punched at the middle of every shared border.
function shipZones(floor, o, size) {
  const rows = [...floor].map(k => +k.split(',')[1]);
  const yMin = Math.min(...rows), yMax = Math.max(...rows);
  const span = yMax - yMin + 1;
  const roomAt = new Map();
  for (const k of floor) {
    const [x, y] = k.split(',').map(Number);
    const f = (y - yMin) / span;
    let kind;
    if (f < 0.26) kind = 'bridge';
    else if (f < 0.58) kind = 'common';
    else {
      const cxCell = (o.w - 1) / 2;
      if (size === 'small') kind = 'engine';
      else if (size === 'medium') kind = x < cxCell ? 'quarters' : 'engine';
      else kind = x < (o.w - 1) * 0.36 ? 'quarters' : (x > (o.w - 1) * 0.64 ? 'engine' : 'hold');
    }
    roomAt.set(k, kind);
  }
  // partition edges between different rooms (canonical: lower cell owns the edge)
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
  // station anchors
  const cellsOf = kind => [...floor].filter(k => roomAt.get(k) === kind).map(k => k.split(',').map(Number));
  const centroid = list => list.length ? [Math.round(list.reduce((s, p) => s + p[0], 0) / list.length), Math.round(list.reduce((s, p) => s + p[1], 0) / list.length)] : null;
  const bridge = cellsOf('bridge'), engine = cellsOf('engine'), common = cellsOf('common');
  const stations = [];
  if (bridge.length) { const fy = Math.min(...bridge.map(p => p[1])); const row = bridge.filter(p => p[1] === fy + 1); const hx = row.length ? row[Math.floor(row.length / 2)][0] : bridge[0][0]; stations.push({ kind: 'helm', x: hx, y: fy + 1 }); }
  const ec = centroid(engine.length ? engine : common); if (ec) stations.push({ kind: 'reactor', x: ec[0], y: ec[1] });
  if (common.length) {
    const midY = Math.round(common.reduce((s, p) => s + p[1], 0) / common.length);
    const rowC = common.filter(p => Math.abs(p[1] - midY) <= 1);
    stations.push({ kind: 'weapons', x: Math.max(...rowC.map(p => p[0])) - 0, y: midY, r: 1 });
    stations.push({ kind: 'weapons', x: Math.min(...rowC.map(p => p[0])) + 0, y: midY, r: 3 });
  }
  return { roomAt, partition, doors, stations, yMin, yMax };
}

// ── Builders ─────────────────────────────────────────────────────────────────
function shipBuildBody(o) {
  // Curved hull body: extrude the outline DOWN with a bevel so the underside has a
  // rounded edge; the extrusion's top cap doubles as the smooth curved deck at y=0.
  const geo = new THREE.ExtrudeGeometry(o.shape, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.45, bevelSize: 0.5, bevelSegments: 3, curveSegments: 48 });
  geo.rotateX(Math.PI / 2); // shape (x, z-as-y) → world XZ, extruding downward
  geo.translate(0, -0.45, 0); // bevel extends above the extrusion — drop it so the deck cap sits at y=0
  const body = new THREE.Mesh(geo, shipMat('hullBody'));
  body.castShadow = true; body.receiveShadow = true;
  const g = new THREE.Group();
  g.add(body);
  // landing legs: four stubby cylinders + foot pads under the belly
  const legPos = [
    [o.cx - o.maxHalf * 0.55, o.zMax], [o.cx + o.maxHalf * 0.55, o.zMax],
    [o.cx - o.sternHalf * 0.5, o.zSternC - 1], [o.cx + o.sternHalf * 0.5, o.zSternC - 1],
  ];
  for (const [lx, lz] of legPos) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.9, 10), shipMat('rim'));
    leg.position.set(lx, -1.35, lz);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 0.14, 12), shipMat('padDark'));
    foot.position.set(lx, -1.82, lz);
    g.add(leg, foot);
  }
  return g;
}
function shipBuildWalls(o) {
  // Hull wall: a curved ribbon following the outline + a rounded metal rim tube on
  // top and an emissive glow line at the base — smooth curves, no boxes.
  const pts = o.pts, n = pts.length, H = SHIP_HULL_H;
  const pos = new Float32Array(n * 6 * 3);
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], o6 = i * 18;
    // two triangles: (a0,b0,aH) (b0,bH,aH)
    pos.set([a.x, 0, a.y,  b.x, 0, b.y,  a.x, H, a.y,  b.x, 0, b.y,  b.x, H, b.y,  a.x, H, a.y], o6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const wall = new THREE.Mesh(geo, shipMat('hullWall'));
  wall.castShadow = true; wall.receiveShadow = true;
  const curveTop = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p.x, H, p.y)), true);
  const rim = new THREE.Mesh(new THREE.TubeGeometry(curveTop, 96, 0.11, 8, true), shipMat('rim'));
  const curveBase = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p.x, 0.14, p.y)), true);
  const glow = new THREE.Mesh(new THREE.TubeGeometry(curveBase, 96, 0.05, 6, true), shipMat('trim'));
  const g = new THREE.Group(); g.add(wall, rim, glow);
  return g;
}
function shipBuildDeck(floor, group, picks) {
  const c = SHIP_CELL;
  const cells = [...floor].map(k => k.split(',').map(Number));
  const geo = scCachedGeo(`shipdeck|${c}`, () => new THREE.BoxGeometry(c * 0.96, 0.08, c * 0.96));
  const iA = new THREE.InstancedMesh(geo, shipMat('deckA'), cells.length);
  const iB = new THREE.InstancedMesh(geo, shipMat('deckB'), cells.length);
  iA.receiveShadow = iB.receiveShadow = true;
  let a = 0, b = 0; const m4 = new THREE.Matrix4();
  const pickGeo = scCachedGeo(`shippick|${c}`, () => new THREE.PlaneGeometry(c, c));
  for (const [x, y] of cells) {
    m4.makeTranslation(x * c, 0.04, y * c);
    if ((x + y) % 2 === 0) iA.setMatrixAt(a++, m4); else iB.setMatrixAt(b++, m4);
    const pick = new THREE.Mesh(pickGeo, shipPickMat());
    pick.rotation.x = -Math.PI / 2; pick.position.set(x * c, 0.1, y * c);
    pick.userData.cell = { x, y, z: 0 };
    group.add(pick); picks.push(pick);
  }
  iA.count = a; iB.count = b;
  iA.instanceMatrix.needsUpdate = iB.instanceMatrix.needsUpdate = true;
  group.add(iA, iB);
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
    const cap = new THREE.Mesh(capGeo, shipMat('rim')); // rounded top edge
    cap.rotation.z = Math.PI / 2; cap.position.y = H;
    wrap.add(panel, cap);
    wrap.rotation.y = (r % 2 === 1) ? Math.PI / 2 : 0;
    wrap.position.set(x * c + dx * c / 2, 0, y * c + dy * c / 2);
    group.add(wrap);
  }
  // doorway arches over the gaps — a half-torus curve marking each door
  for (const e of zones.doors) {
    const [x, y, r] = e.split(',').map(Number);
    const [dx, dy] = SHIP_DIR4[r];
    const arch = new THREE.Mesh(new THREE.TorusGeometry(c * 0.42, 0.06, 8, 20, Math.PI), shipMat('trim'));
    arch.position.set(x * c + dx * c / 2, H, y * c + dy * c / 2);
    arch.rotation.y = (r % 2 === 1) ? 0 : Math.PI / 2;
    group.add(arch);
    // door posts
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, H, 8), shipMat('rim'));
      const px = (r % 2 === 1) ? 0 : side * c * 0.42, pz = (r % 2 === 1) ? side * c * 0.42 : 0;
      post.position.set(x * c + dx * c / 2 + px, H / 2, y * c + dy * c / 2 + pz);
      group.add(post);
    }
  }
}
// Interior component stations — curved consoles, no boxes.
function shipBuildStations(zones, comps, group, dynamic) {
  const c = SHIP_CELL;
  for (const st of zones.stations) {
    const g = new THREE.Group();
    g.position.set(st.x * c, 0.1, st.y * c);
    if (st.kind === 'helm') {
      const desk = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.3, 10, 28, Math.PI * 0.85), shipMat('console'));
      desk.rotation.x = -Math.PI / 2; desk.rotation.z = Math.PI + (Math.PI - Math.PI * 0.85) / 2; // arc opens toward the pilot (south)
      desk.position.y = 0.72; desk.scale.y = 1; g.add(desk);
      for (let i = -1; i <= 1; i++) {
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.4), shipMat('screen'));
        const ang = i * 0.55;
        scr.position.set(Math.sin(ang) * 1.15, 1.12, -Math.cos(ang) * 1.15);
        scr.rotation.y = ang + Math.PI; scr.rotation.x = -0.28;
        g.add(scr);
      }
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.5, 12), shipMat('seat'));
      seat.position.set(0, 0.25, 0.7); g.add(seat);
    } else if (st.kind === 'reactor') {
      const tier = comps.reactorTier || 1;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.18, 24), shipMat('console'));
      base.position.y = 0.09; g.add(base);
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.3 + tier * 0.06, 0.3 + tier * 0.06, 1.2 + tier * 0.25, 20), shipTierMat(tier));
      core.position.y = 0.8 + tier * 0.12; g.add(core);
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 1.3 + tier * 0.25, 20, 1, true), shipMat('glass'));
      shell.position.y = 0.85 + tier * 0.12; g.add(shell);
      for (const rot of [0.9, -0.9]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.055, 8, 26), shipMat('rim'));
        ring.position.y = 0.9 + tier * 0.12; ring.rotation.x = rot;
        g.add(ring);
      }
      dynamic.reactorCore = core;
    } else if (st.kind === 'weapons') {
      const desk = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.22, 8, 20, Math.PI * 0.7), shipMat('console'));
      desk.rotation.x = -Math.PI / 2;
      desk.rotation.z = (st.r === 1 ? -Math.PI / 2 : Math.PI / 2) + (Math.PI - Math.PI * 0.7) / 2;
      desk.position.y = 0.68; g.add(desk);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.34), shipMat('screen'));
      scr.position.set(st.r === 1 ? 0.72 : -0.72, 1.0, 0);
      scr.rotation.y = st.r === 1 ? -Math.PI / 2 : Math.PI / 2; scr.rotation.x = -0.3;
      g.add(scr);
    }
    group.add(g);
  }
}
// Exterior components: swept curved wings, thruster nacelles with exhaust glow,
// dome gun turrets on the rim. Tier changes size, extras and glow color.
function shipBuildExterior(o, comps, group, dynamic) {
  const c = SHIP_CELL;
  // — wings —
  const wTier = comps.wingTier || 1;
  const ws = (0.8 + wTier * 0.3) * (o.maxHalf / 9);
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, -0.9); wingShape.quadraticCurveTo(2.4 * 1.2, -1.2, 4.4, 0.9);
  wingShape.quadraticCurveTo(4.9, 1.6, 4.1, 2.0); wingShape.quadraticCurveTo(1.6, 2.9, 0, 2.4);
  wingShape.lineTo(0, -0.9);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.08, bevelSegments: 2, curveSegments: 24 });
  wingGeo.rotateX(Math.PI / 2);
  for (const side of [1, -1]) {
    const wing = new THREE.Mesh(wingGeo, shipMat('hullBody'));
    wing.castShadow = true;
    wing.scale.set(ws * side, 1, ws);
    wing.position.set(o.cx + side * (o.maxHalf - 0.25), 0.42, o.zMax - 0.4 * c);
    group.add(wing);
    if (wTier >= 2) { // canard fin on upgraded wings
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.24 * ws, 1.5 * ws, 4), shipMat('rim'));
      fin.position.set(o.cx + side * (o.maxHalf + 2.6 * ws), 0.9, o.zMax + 1.1 * ws);
      fin.rotation.z = side * -0.16;
      group.add(fin);
    }
  }
  // — thrusters —
  const tTier = comps.thrusterTier || 1;
  const tCount = { small: 2, medium: 2, large: 3, capital: 4 }[Object.keys(SHIP_GRID_DIMS).find(k => SHIP_GRID_DIMS[k].w === o.w)] || 2;
  const ts = 0.75 + tTier * 0.22;
  dynamic.exhaust = [];
  for (let i = 0; i < tCount; i++) {
    const fx = tCount === 1 ? 0 : (i / (tCount - 1) - 0.5) * 2;
    const tx = o.cx + fx * o.sternHalf * 0.62, tz = o.zStern + 0.55 * ts;
    const nac = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * ts, 0.52 * ts, 1.7 * ts, 18), shipMat('rim'));
    body.rotation.x = Math.PI / 2; body.castShadow = true;
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.42 * ts, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), shipMat('rim'));
    nose.rotation.x = -Math.PI / 2; nose.position.z = -0.85 * ts;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.46 * ts, 0.09 * ts, 8, 20), shipMat('gun'));
    ring.position.z = 0.85 * ts;
    const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(0.36 * ts, 18), shipTierMat(tTier));
    glowDisc.position.z = 0.9 * ts;
    const plumeMat = new THREE.MeshBasicMaterial({ color: SHIP_TIER_COLORS[Math.min(2, tTier - 1)], transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.3 * ts, 2.4 * ts, 16, 1, true), plumeMat);
    plume.rotation.x = -Math.PI / 2; plume.position.z = 2.1 * ts;
    nac.add(body, nose, ring, glowDisc, plume);
    nac.position.set(tx, 0.55, tz);
    group.add(nac);
    dynamic.exhaust.push({ plume, plumeMat, glow: glowDisc });
  }
  // — gun turrets on the hull rim —
  const gCount = Math.min(4, Math.max(0, comps.gunCount ?? 2)), gTier = comps.gunTier || 1;
  dynamic.turrets = [];
  const spots = [
    [o.cx + o.shoulderHalf * 0.98, o.zShoulder + 0.5], [o.cx - o.shoulderHalf * 0.98, o.zShoulder + 0.5],
    [o.cx + o.maxHalf * 0.97, o.zMax + 2.2], [o.cx - o.maxHalf * 0.97, o.zMax + 2.2],
  ];
  for (let i = 0; i < gCount; i++) {
    const [gx, gz] = spots[i % spots.length];
    const tg = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.2, 14), shipMat('gun'));
    base.position.y = 0.1;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), shipMat('gun'));
    dome.position.y = 0.2;
    tg.add(base, dome);
    for (let bIdx = 0; bIdx < gTier; bIdx++) {
      const off = (bIdx - (gTier - 1) / 2) * 0.14;
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.0, 8), shipMat('gun'));
      barrel.rotation.x = Math.PI / 2; barrel.position.set(off, 0.32, -0.55);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), shipTierMat(gTier));
      tip.position.set(off, 0.32, -1.05);
      tg.add(barrel, tip);
    }
    tg.position.set(gx, SHIP_HULL_H + 0.06, gz);
    group.add(tg);
    dynamic.turrets.push(tg);
  }
}

// ── Orchestrator ─────────────────────────────────────────────────────────────
function buildShip3D(size, comps) {
  comps = comps || {};
  const o = shipHullOutline(size);
  const floor = shipRasterize(o);
  const zones = shipZones(floor, o, size);
  const group = new THREE.Group(), picks = [], dynamic = {};
  group.add(shipBuildBody(o));
  group.add(shipBuildWalls(o));
  shipBuildDeck(floor, group, picks);
  shipBuildPartitions(zones, group);
  shipBuildStations(zones, comps, group, dynamic);
  shipBuildExterior(o, comps, group, dynamic);
  const grid = { floor, roomAt: zones.roomAt, standable: (x, y) => floor.has(x + ',' + y) };
  return { group, picks, grid, outline: o, zones, dynamic, size };
}

// Interior lighting: bright enough to play in from above, cool sci-fi cast.
function addShipLighting(scene, built) {
  scene.add(new THREE.HemisphereLight(0xaecbf5, 0x141a26, 0.75));
  scene.add(new THREE.AmbientLight(0xffffff, 0.42));
  const o = built.outline;
  const key = new THREE.PointLight(0xdcecff, 0.8, o.maxHalf * 7, 1.4);
  key.position.set(o.cx, 9, (o.zNose + o.zStern) / 2);
  scene.add(key);
  return [key];
}

// ═══════════════════════════════════════════════════════════════════════════
// ENVIRONMENT — straight parallel warp streaks + LITERAL landings.
// A landing SITE (planet surface with a pad, or a dock hangar platform) rises
// from below to meet the hull while the ship flares and settles onto its legs.
// Timeline phases: 'space' → 'landing' → 'sited' → 'takeoff' → 'space'.
// ═══════════════════════════════════════════════════════════════════════════
const SHIP_SITE_HIDDEN_Y = -110;
function smoothstep(t) { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); }
function seg(t, a, b) { return smoothstep((t - a) / (b - a)); }

function shipMakeStars(count, R) {
  // Every star travels EXACTLY along +z (bow → stern), so every streak is a
  // perfectly straight line and all of them are parallel. A cylindrical hole is
  // kept clear around the ship so streaks never cross the deck.
  const pos = new Float32Array(count * 6);
  for (let i = 0; i < count; i++) {
    let x, y;
    do { x = (Math.random() * 2 - 1) * R; y = (Math.random() * 2 - 1) * R * 0.7; } while (Math.hypot(x, y - 10) < 42);
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

function shipBuildPlanetSite() {
  const g = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.CircleGeometry(320, 48), new THREE.MeshStandardMaterial({ color: scColor(0x5d8a4a), roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  g.add(ground);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(30, 32, 1.1, 40), shipMat('padDark'));
  pad.position.y = 0.55; pad.receiveShadow = true;
  g.add(pad);
  for (const r of [24, 16]) {
    const mark = new THREE.Mesh(new THREE.TorusGeometry(r, 0.28, 6, 48), shipMat('padMark'));
    mark.rotation.x = -Math.PI / 2; mark.position.y = 1.12;
    g.add(mark);
  }
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), shipMat('padMark'));
    lamp.position.set(Math.cos(a) * 28.5, 1.4, Math.sin(a) * 28.5);
    g.add(lamp);
  }
  // rolling hills + rocks around the pad
  for (let i = 0; i < 7; i++) {
    const hs = 18 + Math.random() * 30;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(hs, 20, 14), new THREE.MeshStandardMaterial({ color: scColor(0x527d42), roughness: 1 }));
    const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 140;
    hill.position.set(Math.cos(a) * d, -hs * 0.62, Math.sin(a) * d);
    hill.scale.y = 0.5;
    g.add(hill);
  }
  for (let i = 0; i < 9; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1 + Math.random() * 2.2, 0), new THREE.MeshStandardMaterial({ color: scColor(0x7e8a75), roughness: 0.95 }));
    const a = Math.random() * Math.PI * 2, d = 42 + Math.random() * 60;
    rock.position.set(Math.cos(a) * d, 0.8, Math.sin(a) * d);
    rock.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    g.add(rock);
  }
  // where this site's Y must end up so its PAD TOP meets the ship's landing feet
  g.userData.landedY = -1.85 - 1.12;
  return g;
}
function shipBuildDockSite() {
  const g = new THREE.Group();
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(36, 38, 1.6, 10), new THREE.MeshStandardMaterial({ color: scColor(0x353d4c), roughness: 0.55, metalness: 0.6 }));
  plat.position.y = 0.8; plat.receiveShadow = true;
  g.add(plat);
  for (const r of [26, 17]) {
    const mark = new THREE.Mesh(new THREE.TorusGeometry(r, 0.26, 6, 40), shipMat('padMark'));
    mark.rotation.x = -Math.PI / 2; mark.position.y = 1.62;
    g.add(mark);
  }
  // curved hangar backdrop: two big wall arcs with emissive window bands
  for (const [rot, rad] of [[0.4, 70], [Math.PI + 0.6, 78]]) {
    const arc = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, 26, 40, 1, true, rot, 1.6), new THREE.MeshStandardMaterial({ color: scColor(0x232a38), roughness: 0.6, metalness: 0.5, side: THREE.DoubleSide }));
    arc.position.y = 13;
    g.add(arc);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(rad - 0.3, rad - 0.3, 2.2, 40, 1, true, rot + 0.12, 1.36), new THREE.MeshStandardMaterial({ color: scColor(0x0a1a28), emissive: scColor(0x67d3ff), emissiveIntensity: 0.9, side: THREE.DoubleSide }));
    band.position.y = 15;
    g.add(band);
  }
  // pylon lights around the pad
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 7, 10), shipMat('gun'));
    post.position.set(Math.cos(a) * 34, 4.4, Math.sin(a) * 34);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), shipMat('padMark'));
    cap.position.set(Math.cos(a) * 34, 8.2, Math.sin(a) * 34);
    g.add(post, cap);
  }
  // parked cargo crates
  for (let i = 0; i < 6; i++) {
    const crate = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.2, 8), new THREE.MeshStandardMaterial({ color: scColor(0x7a5a2c), roughness: 0.8 }));
    const a = 0.8 + i * 0.28;
    crate.position.set(Math.cos(a) * 44, 1.1, Math.sin(a) * 44);
    g.add(crate);
  }
  g.userData.landedY = -1.85 - 1.62; // pad top meets the ship's landing feet
  return g;
}

function createShipEnvironment(scene) {
  const env = { mode: 'travel', phase: 'space', tt: 0, queued: null, built: null, shipGroup: null };
  scene.background = new THREE.Color(0x03040a);

  const stars = shipMakeStars(900, 320);
  scene.add(stars); env.stars = stars;
  env.streak = 1; env._starSpeed = 1;

  const sun = new THREE.DirectionalLight(0xfff2dc, 0.0);
  sun.position.set(60, 90, 40); sun.castShadow = false;
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
      sites[mode] = mode === 'planet' ? shipBuildPlanetSite() : shipBuildDockSite();
      sites[mode].position.y = SHIP_SITE_HIDDEN_Y;
      scene.add(sites[mode]);
    }
    return sites[mode];
  }

  env.bindShip = function (built, shipGroup) { env.built = built; env.shipGroup = shipGroup; };

  env.setMode = function (mode) {
    if (mode === env.mode && (env.phase === 'sited' || env.phase === 'space')) return;
    if (env.phase === 'landing' || env.phase === 'takeoff') { env.queued = mode; return; }
    if (mode === 'travel') {
      if (env.phase === 'sited') { env.phase = 'takeoff'; env.tt = 0; }
      env.mode = 'travel';
    } else {
      if (env.phase === 'sited') { env.queued = mode; env.phase = 'takeoff'; env.tt = 0; } // relocate: lift off, then land at the new site
      else { env.mode = mode; env.site = siteFor(mode); env.phase = 'landing'; env.tt = 0; }
    }
  };

  const LAND_T = 3.4, TAKEOFF_T = 3.0;
  env.update = function (dt) {
    env.tt += dt;
    const t = env.tt;
    let streakTarget = 0, siteY = SHIP_SITE_HIDDEN_Y, skyO = 0, sunI = 0, shipY = 0, starsO = 0.85;

    const landedY = env.site ? (env.site.userData.landedY || 0) : 0;
    if (env.phase === 'space') {
      streakTarget = 1; siteY = SHIP_SITE_HIDDEN_Y;
    } else if (env.phase === 'landing') {
      streakTarget = 1 - seg(t, 0, 1.0);
      siteY = SHIP_SITE_HIDDEN_Y + (landedY - SHIP_SITE_HIDDEN_Y) * seg(t, 0.5, 2.5);
      skyO = env.mode === 'planet' ? seg(t, 0.6, 2.2) : 0;
      sunI = (env.mode === 'planet' ? 0.95 : 0.4) * seg(t, 0.6, 2.4);
      shipY = 1.1 * seg(t, 0.4, 1.4) * (1 - seg(t, 2.2, LAND_T)); // flare up, then settle down onto the legs
      starsO = env.mode === 'planet' ? 0.85 * (1 - seg(t, 0.8, 2.0)) : 0.85 - 0.5 * seg(t, 0.8, 2.0);
      if (t >= LAND_T) { env.phase = 'sited'; env.tt = 0; }
    } else if (env.phase === 'sited') {
      siteY = landedY; skyO = env.mode === 'planet' ? 1 : 0;
      sunI = env.mode === 'planet' ? 0.95 : 0.4;
      starsO = env.mode === 'planet' ? 0 : 0.35;
      streakTarget = 0; shipY = 0;
    } else if (env.phase === 'takeoff') {
      shipY = 1.2 * seg(t, 0, 0.9) * (1 - seg(t, 2.2, TAKEOFF_T));
      siteY = landedY + (SHIP_SITE_HIDDEN_Y - landedY) * seg(t, 0.6, 2.2);
      skyO = (env.mode === 'planet' ? 1 : 0) * (1 - seg(t, 0.4, 1.6));
      sunI = (env.mode === 'planet' ? 0.95 : 0.4) * (1 - seg(t, 0.4, 1.8));
      starsO = 0.35 + 0.5 * seg(t, 1.4, TAKEOFF_T);
      streakTarget = seg(t, 1.8, TAKEOFF_T);
      if (t >= TAKEOFF_T) {
        env.phase = 'space'; env.tt = 0; env.mode = 'travel';
        if (env.queued && env.queued !== 'travel') { const q = env.queued; env.queued = null; env.setMode(q); }
        else env.queued = null;
      }
    }

    // apply — smooth the streak factor a touch so there are no pops
    env.streak += (streakTarget - env.streak) * (1 - Math.pow(0.002, dt));
    if (env.site) env.site.position.y = siteY;
    for (const mkey in sites) if (sites[mkey] !== env.site) sites[mkey].position.y = SHIP_SITE_HIDDEN_Y;
    env.sky.material.opacity = skyO; env.sky.visible = skyO > 0.01;
    env.sun.intensity = sunI;
    env.sun.color.setHex(env.mode === 'dock' ? 0xbdd8ff : 0xfff2dc);
    if (env.shipGroup) env.shipGroup.position.y = shipY;
    stars.material.opacity = starsO; stars.visible = starsO > 0.02;

    // stars: straight parallel streaks along +z; tail length ∝ streak factor
    const { count, R } = stars.userData;
    const pos = stars.geometry.attributes.position.array;
    const step = (4 + env.streak * 60) * dt * 10;
    const tail = 1.2 + env.streak * 60;
    for (let i = 0; i < count; i++) {
      let hz = pos[i * 6 + 5] + step;
      if (hz > R) hz -= 2 * R;
      pos[i * 6 + 5] = hz;               // head z
      pos[i * 6 + 2] = hz - tail;        // tail z (same x/y → perfectly straight)
    }
    stars.geometry.attributes.position.needsUpdate = true;

    // ship pulses: exhaust burns bright in flight, idles when parked; reactor breathes
    if (env.built && env.built.dynamic) {
      const d = env.built.dynamic;
      const burn = 0.15 + env.streak * 0.85;
      if (d.exhaust) for (const e of d.exhaust) {
        e.plumeMat.opacity = 0.12 + burn * 0.55;
        e.plume.scale.set(1, 0.4 + burn * 1.1, 1);
        e.glow.material.emissiveIntensity = 0.6 + burn * 1.6;
      }
      if (d.reactorCore) d.reactorCore.material.emissiveIntensity = 1.2 + Math.sin(performance.now() * 0.0035) * 0.45;
      if (d.turrets) d.turrets.forEach((tg, i) => { tg.rotation.y = Math.sin(performance.now() * 0.0004 + i * 1.7) * 0.6; });
    }
  };
  return env;
}
