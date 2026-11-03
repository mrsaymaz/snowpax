// Renders a hand-made tile arena: bright, chunky, readable from a steep camera.
// Low cover in the play area (walls, benches, cars, snowmen, hedges); tall buildings only
// around the edges. Everything is generated here — no downloaded models or images.
import {
  Group, Mesh, InstancedMesh, Object3D, BoxGeometry, SphereGeometry, CylinderGeometry, ConeGeometry, PlaneGeometry,
  IcosahedronGeometry, MeshLambertMaterial, MeshStandardMaterial, MeshBasicMaterial, CanvasTexture, SRGBColorSpace,
  RepeatWrapping, NearestFilter, Color, Shape, ExtrudeGeometry, Sprite, SpriteMaterial, DoubleSide, TorusGeometry, RingGeometry,
} from 'three';
import { addCutout } from './cutout.js';
import { CONFIG } from '../../config.js';

const C = {
  snowA: '#f3f8fd', snowB: '#e6f0f9', streetA: '#c9d7e6', streetB: '#bfcfe1', yardA: '#fdf1d6', yardB: '#f6e6c3', ice: '#bfe8ff',
  wall: '#ffffff', wallSide: '#dce9f7', wood: '#a46a43', hedge: '#2f9e5b', hedge2: '#3fb26b', trunk: '#8a5a3b',
  roofEave: '#e0634e', snow: '#ffffff', lamp: '#3b4a63', glow: '#ffd27a',
  houses: ['#ff9f8f', '#ffd27a', '#94d5c8', '#a3c4f5', '#c8aef2', '#ffb8cf', '#b2e3a6', '#ffc792'],
  cars: ['#ff5d5d', '#3f8efc', '#ffcf3f', '#32c27d', '#a46bff', '#ff8c42'],
};
const hash = (a, b) => { let h = Math.imul(a * 73856093 ^ b * 19349663, 2654435761); h ^= h >>> 13; return (h >>> 0) / 4294967296; };
const mats = new Map();
const mat = (hex, extra = {}) => { const k = hex + JSON.stringify(extra); if (!mats.has(k)) { const m = new MeshLambertMaterial({ color: hex, ...extra }); addCutout(m); mats.set(k, m); } return mats.get(k); };

function roundedBoxGeo(w, d, h, r = 0.12, segs = 2) {
  const sh = new Shape(), x = -w / 2 + r, y = -d / 2 + r, W = w - 2 * r, D = d - 2 * r;
  sh.moveTo(x, y); sh.lineTo(x + W, y); sh.lineTo(x + W, y + D); sh.lineTo(x, y + D); sh.lineTo(x, y);
  const g = new ExtrudeGeometry(sh, { depth: Math.max(0.01, h - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: segs, curveSegments: 4 });
  g.rotateX(-Math.PI / 2); g.translate(0, r, 0);
  return g;
}

// Ground: one canvas texture painted tile by tile.
function groundTexture(rows) {
  const h = rows.length, w = rows[0].length, px = 32;
  const c = document.createElement('canvas'); c.width = w * px; c.height = h * px; const g = c.getContext('2d');
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = rows[j][i], odd = (i + j) % 2;
    let col = odd ? C.snowA : C.snowB;
    if ('_oi'.includes(ch)) col = odd ? C.streetA : C.streetB;
    if ('Yh'.includes(ch)) col = odd ? C.yardA : C.yardB;
    if (ch === 'i') col = C.ice;
    g.fillStyle = col; g.fillRect(i * px, j * px, px, px);
    if (ch === 'i') { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(i * px + 6, j * px + 8, 14, 3); g.fillRect(i * px + 12, j * px + 18, 10, 2); }
  }
  // street lane markings (dashed white line through the middle of the street)
  const streetRows = rows.map((r, j) => (r.includes('____') ? j : -1)).filter(j => j >= 0);
  if (streetRows.length) {
    const mid = (streetRows[0] + streetRows[streetRows.length - 1] + 1) / 2;
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 1; i < w - 3; i += 2) g.fillRect(i * px + 6, mid * px - 2, px - 12, 4);
    g.fillStyle = 'rgba(255,255,255,0.9)'; // snowy kerbs
    g.fillRect(px, streetRows[0] * px, (w - 3) * px, 3); g.fillRect(px, (streetRows[streetRows.length - 1] + 1) * px - 3, (w - 3) * px, 3);
  }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// Window texture for edge buildings: rounded warm windows with snowy sills.
function windowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const x = i * 64 + 16, y = j * 64 + 12, lit = hash(i, j * 7) < 0.45;
    g.fillStyle = '#fff6ea'; g.beginPath(); g.roundRect(x - 4, y - 4, 40, 44, 12); g.fill();
    g.fillStyle = lit ? '#ffc65c' : '#7f9fce'; g.beginPath(); g.roundRect(x, y, 32, 36, 9); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x + 15, y, 2, 36);
    g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(x - 6, y + 34, 44, 8, 4); g.fill();
  }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping; return t;
}

function signSprite(text, bg = '#1b3a5c', w = 8) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = bg; g.beginPath(); g.roundRect(8, 8, 496, 112, 34); g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.stroke();
  g.fillStyle = '#ffffff'; g.font = '900 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 70);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
  const s = new Sprite(new SpriteMaterial({ map: t, depthTest: false })); s.scale.set(w, w / 4, 1); s.renderOrder = 6; return s;
}

export function buildArena(arena, { rivalTeam = 'gryffindor', quality = 'medium' } = {}) {
  const group = new Group(), rows = arena.rows, H = arena.h, W = arena.w, x0 = arena.x0, z0 = arena.z0;
  const at = (i, j) => [x0 + i + 0.5, z0 + j + 0.5];
  const o = new Object3D();
  const instanced = (geom, material, list, place, shadow = true) => {
    if (!list.length) return null;
    const m = new InstancedMesh(geom, material, list.length);
    list.forEach((it, k) => { place(o, it, k); o.updateMatrix(); m.setMatrixAt(k, o.matrix); });
    m.castShadow = shadow; m.receiveShadow = true; group.add(m); return m;
  };
  const reset = () => { o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); };

  // ground (arena) + snowy surroundings
  const outside = new Mesh(new PlaneGeometry(W + 80, H + 80), new MeshLambertMaterial({ color: '#eef5fb' }));
  outside.rotation.x = -Math.PI / 2; outside.position.y = -0.02; outside.receiveShadow = true; group.add(outside);
  const ground = new Mesh(new PlaneGeometry(W, H), new MeshLambertMaterial({ map: groundTexture(rows) }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; group.add(ground);

  const list = ch => { const out = []; for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (rows[j][i] === ch) out.push([i, j]); return out; };

  // snow walls: chunky rounded blocks
  instanced(roundedBoxGeo(0.98, 0.98, 1.1, 0.16), new MeshLambertMaterial({ color: '#f7fbff' }), list('#'), (o, [i, j]) => { reset(); const [x, z] = at(i, j); o.position.set(x, 0, z); });
  instanced(roundedBoxGeo(1.04, 1.04, 0.22, 0.1), new MeshLambertMaterial({ color: '#ffffff' }), list('#'), (o, [i, j]) => { reset(); const [x, z] = at(i, j); o.position.set(x, 1.0, z); }, false);

  // benches: wooden seat with snow on top
  const benches = list('b');
  instanced(roundedBoxGeo(0.95, 0.5, 0.18, 0.05), mat(C.wood), benches, (o, [i, j]) => { reset(); const [x, z] = at(i, j); o.position.set(x, 0.42, z); });
  instanced(new BoxGeometry(0.1, 0.42, 0.4), mat('#5d4030'), benches.flatMap(b => [[...b, -0.38], [...b, 0.38]]), (o, [i, j, dx]) => { reset(); const [x, z] = at(i, j); o.position.set(x + dx, 0.21, z); });
  instanced(roundedBoxGeo(0.9, 0.46, 0.1, 0.05), mat(C.snow), benches, (o, [i, j]) => { reset(); const [x, z] = at(i, j); o.position.set(x, 0.6, z); }, false);

  // parked cars: rounded body, cabin, snow on the roof, wheels
  const cars = list('c');
  cars.forEach(([i, j], k) => {
    const [x, z] = at(i, j), col = C.cars[Math.floor(hash(i, j) * C.cars.length)], car = new Group();
    const body = new Mesh(roundedBoxGeo(1.7, 0.9, 0.55, 0.18), mat(col)); body.position.y = 0.18; car.add(body);
    const cab = new Mesh(roundedBoxGeo(1.0, 0.8, 0.42, 0.14), mat('#dff1ff')); cab.position.set(-0.1, 0.68, 0); car.add(cab);
    const roofSnow = new Mesh(roundedBoxGeo(1.05, 0.85, 0.16, 0.08), mat(C.snow)); roofSnow.position.set(-0.1, 1.06, 0); car.add(roofSnow);
    for (const [wx, wz] of [[-0.55, 0.42], [0.55, 0.42], [-0.55, -0.42], [0.55, -0.42]]) { const wh = new Mesh(new CylinderGeometry(0.17, 0.17, 0.12, 12), mat('#2b2f3a')); wh.rotation.x = Math.PI / 2; wh.position.set(wx, 0.17, wz); car.add(wh); }
    car.position.set(x, 0, z); car.rotation.y = hash(j, i) < 0.5 ? 0 : Math.PI;
    car.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    group.add(car);
  });

  // snowmen (cover): two balls, carrot nose, team-neutral red scarf
  const snowmen = list('n');
  instanced(new SphereGeometry(0.42, 16, 12), mat('#ffffff'), snowmen, (o, [i, j]) => { reset(); const [x, z] = at(i, j); o.position.set(x, 0.38, z); });
  instanced(new SphereGeometry(0.29, 16, 12), mat('#ffffff'), snowmen, (o, [i, j]) => { reset(); const [x, z] = at(i, j); o.position.set(x, 0.98, z); });
  instanced(new ConeGeometry(0.05, 0.26, 8), mat('#f08a24'), snowmen, (o, [i, j]) => { reset(); const [x, z] = at(i, j); o.position.set(x, 1.0, z + 0.36); o.rotation.x = Math.PI / 2; }, false);
  instanced(new TorusGeometry(0.25, 0.06, 6, 16), mat('#e5383b'), snowmen, (o, [i, j]) => { reset(); const [x, z] = at(i, j); o.position.set(x, 0.75, z); o.rotation.x = Math.PI / 2; }, false);
  instanced(new CylinderGeometry(0.17, 0.2, 0.26, 12), mat('#2b2f3a'), snowmen, (o, [i, j]) => { reset(); const [x, z] = at(i, j); o.position.set(x, 1.32, z); }, false);

  // trees: round clay trees with snow caps
  const trees = list('t');
  instanced(new CylinderGeometry(0.14, 0.2, 1.0, 8), mat(C.trunk), trees, (o, [i, j]) => { reset(); const [x, z] = at(i, j); o.position.set(x, 0.5, z); });
  instanced(new IcosahedronGeometry(0.75, 2), mat('#2f8f57'), trees, (o, [i, j]) => { reset(); const [x, z] = at(i, j); o.position.set(x, 1.45, z); });
  instanced(new SphereGeometry(0.62, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2.5), mat(C.snow), trees, (o, [i, j]) => { reset(); const [x, z] = at(i, j); o.position.set(x, 1.72, z); }, false);

  // street lamps with a warm glow
  const lamps = list('L');
  instanced(new CylinderGeometry(0.06, 0.09, 2.2, 8), mat(C.lamp), lamps, (o, [i, j]) => { reset(); const [x, z] = at(i, j); o.position.set(x, 1.1, z); });
  instanced(new SphereGeometry(0.22, 12, 8), new MeshLambertMaterial({ color: '#fff0c8', emissive: new Color('#ffbf55'), emissiveIntensity: 1.1 }), lamps, (o, [i, j]) => { reset(); const [x, z] = at(i, j); o.position.set(x, 2.3, z); }, false);
  instanced(new SphereGeometry(0.25, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), mat(C.snow), lamps, (o, [i, j]) => { reset(); const [x, z] = at(i, j); o.position.set(x, 2.38, z); }, false);

  // picket fences with snow on the rails
  const fences = list('F');
  instanced(new BoxGeometry(0.12, 0.8, 0.12), mat('#f4ead8'), fences.flatMap(f => [[...f, -0.33], [...f, 0], [...f, 0.33]]), (o, [i, j, d]) => { reset(); const [x, z] = at(i, j); const vertical = rows[j][i - 1] !== 'F' && rows[j][i + 1] !== 'F'; o.position.set(x + (vertical ? 0 : d), 0.4, z + (vertical ? d : 0)); });
  instanced(new BoxGeometry(1, 0.1, 0.1), mat('#f4ead8'), fences, (o, [i, j]) => { reset(); const [x, z] = at(i, j); const vertical = rows[j][i - 1] !== 'F' && rows[j][i + 1] !== 'F'; o.position.set(x, 0.55, z); if (vertical) o.rotation.y = Math.PI / 2; });
  instanced(new BoxGeometry(1, 0.08, 0.16), mat(C.snow), fences, (o, [i, j]) => { reset(); const [x, z] = at(i, j); const vertical = rows[j][i - 1] !== 'F' && rows[j][i + 1] !== 'F'; o.position.set(x, 0.84, z); if (vertical) o.rotation.y = Math.PI / 2; }, false);

  // hedges: clusters of leafy balls with snow on top (walk in to hide)
  const bushes = list('B');
  const leaves = [], tops = [];
  bushes.forEach(([i, j]) => { const [x, z] = at(i, j); for (let k = 0; k < 3; k++) { const a = hash(i * 3 + k, j) * 6.28, r = 0.18 + hash(j, i * 5 + k) * 0.12; leaves.push([x + Math.cos(a) * r, z + Math.sin(a) * r, 0.42 + hash(i, j + k) * 0.12]); } tops.push([x, z]); });
  const leafMesh = instanced(new IcosahedronGeometry(1, 1), new MeshLambertMaterial({ color: '#ffffff' }), leaves, (o, [x, z, s], k) => { reset(); o.position.set(x, s * 0.95, z); o.scale.setScalar(s); });
  if (leafMesh) { leaves.forEach((_, k) => leafMesh.setColorAt(k, new Color(k % 2 ? C.hedge : C.hedge2))); leafMesh.instanceColor.needsUpdate = true; addCutout(leafMesh.material); }
  instanced(new SphereGeometry(0.42, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.6), mat(C.snow), tops, (o, [x, z]) => { reset(); o.position.set(x, 0.9, z); o.scale.set(1.1, 0.7, 1.1); }, false);

  // snowdrifts: refill mounds with a soft glow (shrink while refilling)
  const driftMesh = new InstancedMesh(new IcosahedronGeometry(0.55, 2), new MeshLambertMaterial({ color: '#ffffff', emissive: new Color('#bfe2ff'), emissiveIntensity: 0.35 }), arena.drifts.length);
  const setDrift = (k, t) => { const [x, z] = arena.drifts[k]; reset(); o.position.set(x, -0.1 + 0.15 * t, z); o.scale.set(1.2, 0.5 + 0.45 * t, 1.0); o.updateMatrix(); driftMesh.setMatrixAt(k, o.matrix); };
  arena.drifts.forEach((_, k) => setDrift(k, 1)); driftMesh.receiveShadow = true; group.add(driftMesh);

  // --- edge buildings ---
  const tex = windowTexture();
  const building = (x, z, w, d, storeys, colHex, { roof = 'pitched', door = true, facing = 'south' } = {}) => {
    const g = new Group(), h = storeys * 1.25;
    const wm = new MeshLambertMaterial({ color: colHex, map: tex }); addCutout(wm);
    const geo = roundedBoxGeo(w, d, h, 0.14, 2);
    // world-scale UVs for the window texture on the walls
    const uv = geo.attributes.uv, pos = geo.attributes.position, nrm = geo.attributes.normal;
    for (let k = 0; k < uv.count; k++) { const nx = Math.abs(nrm.getX(k)), ny = Math.abs(nrm.getY(k)); const u = nx > 0.5 ? pos.getZ(k) : pos.getX(k); uv.setXY(k, ny > 0.5 ? 0.99 : u / 4 + 0.5, ny > 0.5 ? 0.99 : pos.getY(k) / 5); }
    const body = new Mesh(geo, wm); g.add(body);
    if (roof === 'pitched') {
      const rise = Math.min(1.2, d * 0.4), sh = new Shape();
      sh.moveTo(-d / 2 - 0.2, 0); sh.lineTo(d / 2 + 0.2, 0); sh.lineTo(0, rise); sh.lineTo(-d / 2 - 0.2, 0);
      const rg = new ExtrudeGeometry(sh, { depth: w + 0.3, bevelEnabled: false }); rg.translate(0, 0, -(w + 0.3) / 2); rg.rotateY(Math.PI / 2);
      const r = new Mesh(rg, mat(C.snow)); r.position.y = h; g.add(r);
      const eave = new Mesh(roundedBoxGeo(w + 0.3, d + 0.4, 0.16, 0.06), mat(C.roofEave)); eave.position.y = h - 0.08; g.add(eave);
    } else {
      const slab = new Mesh(roundedBoxGeo(w + 0.25, d + 0.25, 0.32, 0.14), mat(C.snow)); slab.position.y = h; g.add(slab);
    }
    if (door) {
      const dz = facing === 'south' ? d / 2 + 0.02 : -(d / 2 + 0.02);
      const dr = new Mesh(roundedBoxGeo(0.7, 0.12, 1.1, 0.05), mat('#7a4b33')); dr.position.set(0, 0, dz); g.add(dr);
    }
    g.position.set(x, 0, z);
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    group.add(g); return g;
  };
  // group edge tiles into building runs
  const used = new Set(), key = (i, j) => i + ',' + j;
  const isH = (i, j) => i >= 0 && j >= 0 && i < W && j < H && rows[j][i] === 'H' && !used.has(key(i, j));
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!isH(i, j)) continue;
    const horizontal = isH(i + 1, j);
    let len = 1; const maxLen = 2 + Math.floor(hash(i, j) * 3);
    while (len < maxLen && (horizontal ? isH(i + len, j) : isH(i, j + len))) len++;
    for (let k = 0; k < len; k++) used.add(horizontal ? key(i + k, j) : key(i, j + k));
    const w = horizontal ? len : 1, d = horizontal ? 1 : len;
    const [cx, cz] = at(i + (w - 1) / 2, j + (d - 1) / 2);
    const nearCamera = j > H * 0.85, top = j < 2;
    const storeys = nearCamera ? 1 : top ? 3 + Math.floor(hash(j, i) * 2) : 2 + Math.floor(hash(j, i) * 2);
    // edge houses are drawn a bit deeper outward so the border reads as a street of houses
    const out = top ? -0.6 : nearCamera ? 0.6 : 0, sideOut = i === 0 ? -0.6 : i === W - 1 ? 0.6 : 0;
    building(cx + sideOut, cz + out, w - 0.06 + (horizontal ? 0 : 1.2), d - 0.06 + (horizontal ? 1.2 : 0), storeys, C.houses[Math.floor(hash(i * 3, j) * C.houses.length)], { roof: hash(i, j * 3) < 0.6 ? 'pitched' : 'flat', facing: top ? 'south' : 'north', door: !nearCamera });
  }

  // Our School: one building over all S tiles, with a sign and a flagpole
  const sTiles = list('S');
  if (sTiles.length) {
    const is = sTiles.map(t => t[0]), js = sTiles.map(t => t[1]);
    const i0 = Math.min(...is), i1 = Math.max(...is), j0 = Math.min(...js), j1 = Math.max(...js);
    const [cx, cz] = at((i0 + i1) / 2, (j0 + j1) / 2);
    building(cx, cz + 0.3, i1 - i0 + 1, j1 - j0 + 1.6, 2, '#ffd166', { roof: 'flat', facing: 'north' });
    const sign = signSprite('Our School'); sign.position.set(cx, 3.6, cz); group.add(sign);
    const pole = new Mesh(new CylinderGeometry(0.05, 0.05, 2.6, 8), mat('#d7dde6')); pole.position.set(cx + (i1 - i0) / 2 - 1, 3.4, cz - 0.4); group.add(pole);
  }

  // Rivals' snow fort: crenellated snow walls with the rival team's flag
  const kTiles = list('K');
  if (kTiles.length) {
    const rc = CONFIG.teams[rivalTeam]?.color || '#e5383b';
    instanced(roundedBoxGeo(1.0, 1.0, 1.6, 0.15), new MeshLambertMaterial({ color: '#f4f9ff' }), kTiles, (o, [i, j]) => { reset(); const [x, z] = at(i, j); o.position.set(x, 0, z); });
    instanced(roundedBoxGeo(0.42, 0.42, 0.4, 0.1), new MeshLambertMaterial({ color: '#ffffff' }), kTiles.filter(([i, j]) => (i + j) % 2 === 0), (o, [i, j]) => { reset(); const [x, z] = at(i, j); o.position.set(x, 1.55, z); }, false);
    const is = kTiles.map(t => t[0]), cx = at((Math.min(...is) + Math.max(...is)) / 2, 0)[0];
    const pole = new Mesh(new CylinderGeometry(0.05, 0.05, 2.4, 8), mat('#d7dde6')); pole.position.set(cx, 2.6, at(0, 0)[1]); group.add(pole);
    const flag = new Mesh(new PlaneGeometry(1.2, 0.7), new MeshLambertMaterial({ color: rc, side: DoubleSide })); flag.position.set(cx + 0.6, 3.4, at(0, 0)[1]); group.add(flag);
    group.userData.rivalFlag = flag;
  }

  // Mosque grounds (scenery, quiet zone): dome and minaret just outside the edge, behind the fence
  const mTiles = list('M');
  if (mTiles.length) {
    const js = mTiles.map(t => t[1]), is = mTiles.map(t => t[0]);
    const [cx, cz] = at(Math.max(...is) + 1.5, (Math.min(...js) + Math.max(...js)) / 2);
    const stone = new MeshLambertMaterial({ color: '#f4f1ea' }), dome = new MeshLambertMaterial({ color: '#a9c2e3' }); addCutout(stone); addCutout(dome);
    const base = new Mesh(roundedBoxGeo(4.2, 4.2, 2.2, 0.15), stone); base.position.set(cx, 0, cz); group.add(base);
    const dm = new Mesh(new SphereGeometry(1.7, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), dome); dm.position.set(cx, 2.2, cz); group.add(dm);
    const cap = new Mesh(new SphereGeometry(1.74, 24, 4, 0, Math.PI * 2, 0, Math.PI / 5), mat(C.snow)); cap.position.set(cx, 2.2, cz); group.add(cap);
    const mx = cx - 1.6, mz = cz - 2.4;
    const shaft = new Mesh(new CylinderGeometry(0.28, 0.32, 6, 12), stone); shaft.position.set(mx, 3, mz); group.add(shaft);
    const balcony = new Mesh(new CylinderGeometry(0.48, 0.48, 0.22, 12), mat(C.snow)); balcony.position.set(mx, 4.8, mz); group.add(balcony);
    const tip = new Mesh(new ConeGeometry(0.32, 1.3, 12), dome); tip.position.set(mx, 6.6, mz); group.add(tip);
    for (const m of [base, dm, shaft]) { m.castShadow = true; m.receiveShadow = true; }
    // a soft lilac ground tint marks the quiet zone
    const tint = new Mesh(new PlaneGeometry(4.5, mTiles.length / 2 + 3), new MeshBasicMaterial({ color: '#c9b8f0', transparent: true, opacity: 0.22, depthWrite: false }));
    tint.rotation.x = -Math.PI / 2; tint.position.set(at(Math.min(...is), 0)[0] - 0.3, 0.02, cz); group.add(tint);
  }

  // capture zone ring (progress is drawn by the game each frame)
  const zp = arena.places.find(p => p.kind === 'zone');
  let zone = null;
  if (zp) {
    const ringBase = new Mesh(new RingGeometry(zp.r - 0.14, zp.r, 64), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false }));
    ringBase.rotation.x = -Math.PI / 2; ringBase.position.set(zp.x, 0.04, zp.z); group.add(ringBase);
    const fill = new Mesh(new RingGeometry(0.01, zp.r - 0.14, 64, 1, 0, 0.001), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }));
    fill.rotation.x = -Math.PI / 2; fill.position.set(zp.x, 0.035, zp.z); group.add(fill);
    zone = { ringBase, fill, r: zp.r };
  }

  return {
    group, zone,
    updateDrift(k, t) { setDrift(k, t); driftMesh.instanceMatrix.needsUpdate = true; },
    setZone(progress, homeColor, rivalColor, contested, time) {
      if (!zone) return;
      const p = Math.abs(progress), col = progress >= 0 ? homeColor : rivalColor;
      zone.fill.geometry.dispose();
      zone.fill.geometry = new RingGeometry(0.01, zone.r - 0.14, 64, 1, Math.PI / 2, Math.max(0.001, p * Math.PI * 2));
      zone.fill.material.color.set(col); zone.fill.material.opacity = 0.32 + (contested ? 0.15 * Math.sin(time * 12) : 0);
      zone.ringBase.material.color.set(contested ? '#ffe066' : p > 0 ? col : '#ffffff');
    },
  };
}
