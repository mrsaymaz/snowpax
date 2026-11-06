// The sled ride's cinematic scenes: on the way into Kasımpaşa the camera turns, for about seven
// seconds, to each place whose English task is played at the outpost, in task order, and shows it
// as a grand view: the landmark in its own little neighbourhood (snowed-in houses with lit windows,
// lanes and lamps, trees, stalls, the frozen Golden Horn), under its own sky and light, with a
// distant skyline, gulls and falling snow, filmed in three sweeping shots.
//
// The neighbourhoods are drawn by the game's own village renderer (village.js and snowtown.js), so
// they look like the arena and use the same landmark models as the carousel. Each scene sits beside
// the track in its own frame: the track runs along local +x at z = TRACK_Z (the sled rides from -x
// to +x), the place lies at local -z.
//
// A scene: { group, duration, shots, wide, light, tick(t, dt), dispose() }. A shot moves the camera
// from one pose to another, or round an orbit; the sled ride blends the first in and the last out.
import {
  Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, SphereGeometry, CircleGeometry, PlaneGeometry, BoxGeometry, ConeGeometry, CylinderGeometry,
  BufferGeometry, Float32BufferAttribute, Points, PointsMaterial, Sprite, SpriteMaterial, CanvasTexture, SRGBColorSpace, AdditiveBlending, BackSide,
  DoubleSide, Color, Vector3, InstancedMesh, Object3D, TorusGeometry,
} from 'three';
import { buildTileArena } from '../tilemap.mjs';
import { buildVillage } from './village.js';

export const TRACK_Z = 14, SCENE_SECONDS = 7.2;
const ease = t => t * t * (3 - 2 * t);
const lerp = (a, b, k) => a + (b - a) * k;
const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const tex = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; };
const rng = seed => { let s = seed * 7919 + 13; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

// ---------- the neighbourhood: a tile layout drawn by the village renderer ----------
// The landmark stands in a round plaza at C; a lane with lamps rings it; snowed-in houses close the
// back and the sides (or the frozen sea, at the Pier); the side towards the track stays open snow
// with a few trees, so the camera can look in.
const W = 46, H = 34, CX = 23, CZ = 15, PLACE = { x: 0, z: -9 }; // the landmark's middle in the scene's frame
function neighbourhood({ landmark, seed = 1, sea = 0, plazaR = 5, trees = 'TvxyT', props = [], flag = '#c8443c' }) {
  const g = Array.from({ length: H }, () => Array(W).fill('.')), R = rng(seed), lms = [];
  const set = (i, j, c) => { if (i >= 0 && j >= 0 && i < W && j < H) g[j][i] = c; };
  const tree = () => trees[Math.floor(R() * trees.length)];
  for (let j = 0; j < sea; j++) for (let i = 0; i < W; i++) set(i, j, 'W'); // the frozen Golden Horn
  if (!sea) for (let i = 0; i < W; i++) { set(i, 0, R() < 0.55 ? 'R' : tree()); set(i, 1, i % 7 === 3 ? tree() : 'H'); set(i, 2, i % 7 === 3 ? '.' : 'H'); set(i, 3, i % 7 === 3 ? '_' : '_'); }
  for (let j = Math.max(4, sea); j < H - 13; j++) for (const [o, d] of [[0, 1], [W - 1, -1]]) { set(o, j, R() < 0.5 ? 'R' : tree()); set(o + d, j, j % 6 === 2 ? tree() : 'H'); set(o + 2 * d, j, j % 6 === 2 ? '.' : 'H'); set(o + 3 * d, j, '_'); }
  for (let j = H - 13; j < H; j++) for (const i of [0, 1, 2, W - 1, W - 2, W - 3]) if (R() < 0.55) set(i, j, tree()); // trees down the open sides
  for (let k = 0; k < 18; k++) { const i = 4 + Math.floor(R() * (W - 8)), j = CZ + 9 + Math.floor(R() * (H - CZ - 10)); if (Math.abs(i + 0.5 - CX) > 15 && g[j][i] === '.') set(i, j, tree()); } // trees at the edges of the foreground (the middle is the camera's way in)
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const d = Math.max(Math.abs(i + 0.5 - CX), Math.abs(j + 0.5 - CZ)); // a square plaza with straight edges, a lane round it
    if (Math.abs(d - (plazaR + 2)) < 0.5 && g[j][i] !== 'W') set(i, j, '_');
    if (d <= plazaR) set(i, j, 'P');
  }
  for (const [di, dj] of [[-1, -1], [1, -1], [-1, 0], [1, 0]]) { const i = Math.floor(CX + di * (plazaR + 3.2)), j = Math.floor(CZ + dj * (plazaR + 3.2)); if (g[j]?.[i] !== 'W') set(i, j, 'l'); } // old lamps, behind and beside (never between the camera and the place)
  for (let dj = -2; dj < 2; dj++) for (let di = -2; di < 2; di++) set(CX + di, CZ + dj, 'O');
  lms.push({ type: landmark, i: CX - 2, j: CZ - 2, w: 4, h: 4, outpost: 'cine-' + landmark, centre: true });
  for (const p of props) { const { type, i, j, w = 1, h = 1, ...rest } = p; for (let y = j; y < j + h; y++) for (let x = i; x < i + w; x++) set(x, y, 'G'); lms.push({ type, i, j, w, h, outpost: 'cine-prop', ...rest }); }
  set(W - 1, H - 1, 'h'); set(0, H - 1, 'r'); // the arena format wants a home and a camp; hidden in the corners
  const def = { id: 'cine', name: '', kind: 'tiles', world: true, tile: 15, w: W, h: H, rows: g.map(r => r.join('')), outposts: [], schoolyard: null, landmarks: lms, scenery: [], hills: [], sledRuns: [], pickups: [], signposts: [] };
  const world = buildVillage(buildTileArena(def), { look: 'v2', quality: 'medium' });
  world.group.position.set(PLACE.x, 0, PLACE.z + (H / 2 - CZ)); // the landmark's middle at PLACE
  world.group.traverse(o => { if (o.isMesh && o.geometry?.type === 'PlaneGeometry' && o.geometry.parameters.width === 1.1) o.material.color.set(flag); }); // the landmark's flag in the place's colour
  return world;
}

// ---------- the cinematic layer: sky, sun, haze, a far skyline, gulls, falling snow ----------
function sky(g, L) {
  const geo = new SphereGeometry(320, 32, 16), pos = geo.attributes.position, col = [], top = new Color(L.top), hor = new Color(L.horizon), c = new Color();
  for (let v = 0; v < pos.count; v++) { const y = pos.getY(v) / 320, k = Math.pow(Math.max(0, y), 0.55); c.copy(hor).lerp(top, k); col.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  const dome = new Mesh(geo, new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false })); dome.position.set(PLACE.x, -10, PLACE.z); dome.renderOrder = -10; g.add(dome);
  const glowT = tex(128, 128, (x, S) => { const gr = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,244,214,0.85)'); gr.addColorStop(0.5, 'rgba(255,214,150,0.22)'); gr.addColorStop(1, 'rgba(255,200,140,0)'); x.fillStyle = gr; x.fillRect(0, 0, S, S); });
  const d = new Vector3(...L.dir).normalize(), sun = new Sprite(new SpriteMaterial({ map: glowT, color: L.sunDisc || L.sun, transparent: true, depthWrite: false, fog: false, blending: AdditiveBlending }));
  sun.position.set(PLACE.x + d.x * 290, Math.max(10, d.y * 290) - 6, PLACE.z + d.z * 290); sun.scale.setScalar((L.sunSize || 70) * 1.8); g.add(sun);
  // a soft band of haze along the horizon
  const hazeT = tex(4, 64, (x) => { const gr = x.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 4, 64); });
  const haze = new Mesh(new CylinderGeometry(270, 270, 50, 48, 1, true), new MeshBasicMaterial({ map: hazeT, color: L.horizon, transparent: true, side: BackSide, depthWrite: false, fog: false })); haze.position.set(PLACE.x, 10, PLACE.z); g.add(haze);
  // soft clouds low over the hills, lit by the hour
  const cloudT = tex(256, 128, (x) => { for (let k = 0; k < 9; k++) { const cx = 40 + k * 22 + (k % 3) * 6, cy = 78 - Math.sin(k / 8 * Math.PI) * 30, r = 22 + Math.sin(k * 1.7) * 8 + Math.sin(k / 8 * Math.PI) * 16, gr = x.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 256, 128); } });
  const R = rng(L.seed || 7), tint = new Color(L.horizon).lerp(new Color('#ffffff'), 0.55).lerp(new Color(L.sun), 0.25);
  for (let k = 0; k < 11; k++) { const a = -1.9 + k * 0.38 + (R() - 0.5) * 0.2, r = 250, cl = new Sprite(new SpriteMaterial({ map: cloudT, color: tint, transparent: true, opacity: 0.55 + R() * 0.3, depthWrite: false, fog: false })); cl.position.set(PLACE.x + Math.sin(a) * r, 34 + R() * 34, PLACE.z - Math.cos(a) * r); cl.scale.set(80 + R() * 70, 30 + R() * 20, 1); g.add(cl); }
}
// ---------- the town beyond: snowy hills with hillside neighbourhoods, groves and an old tower ----------
// The ground round the place is flat (the neighbourhood and the track sit on it); beyond it the
// land rises into rolling hills covered in pastel houses with snowy roofs, the way Istanbul's
// neighbourhoods climb their slopes, with groves of pines, tall cypresses and round trees, an old
// stone tower on the highest hill. At the Pier the frozen Golden Horn stretches north to a far
// shore. Far things take on the colour of the haze, so the hills step back into the distance.
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function terrainFn(seed, sea) {
  const R = rng(seed), p = [R() * 6.28, R() * 6.28, R() * 6.28, R() * 6.28];
  return (x, z) => {
    const dx = x - PLACE.x, dz = z - PLACE.z, r = Math.hypot(dx, dz), a = Math.atan2(dx, -dz);
    if (sea && dz < -17 && r < 128 && Math.abs(dx) < 120) return -0.35; // the frozen Golden Horn
    const rise = sea && dz < -17 ? smooth(126, 165, r) : smooth(36, 96, r);
    const hills = 9 + 6 * Math.sin(a * 3 + p[0]) + 4 * Math.sin(a * 7 + p[1]) + 5 * Math.sin(r / 21 + p[2]) + 3 * Math.sin(dx / 13 + dz / 17 + p[3]);
    const byTrack = 1 - smooth(6, 18, dz) * (1 - smooth(42, 64, dz)); // flat by the track, rising again far behind it
    return Math.max(0, rise * hills * (0.55 + 0.45 * smooth(60, 160, r)) * byTrack) - 0.06;
  };
}
function townscape(g, L, { seed = 3, sea = false }) {
  const hH = terrainFn(seed, sea), R = rng(seed + 101), hor = new Color(L.fog || L.horizon), far = k => Math.min(0.6, Math.max(0, (k - 45) / 260)); // how much haze at a distance
  // the land: a heightfield, snow white, a little bluer in the hollows and on the ice
  const N = 140, S = 460, geo = new PlaneGeometry(S, S, N, N); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, col = [], snowC = new Color(L.snow || '#f2f5fd'), hollow = new Color('#d9e0f2'), iceC = new Color('#9dc1e2'), c = new Color();
  for (let v = 0; v < pos.count; v++) {
    const x = pos.getX(v) + PLACE.x, z = pos.getZ(v) + PLACE.z, h = hH(x, z); pos.setY(v, h);
    if (h < -0.2) c.copy(iceC).lerp(new Color('#c9def2'), 0.4 + 0.3 * Math.sin(x * 0.11 + z * 0.07)); else c.copy(snowC).lerp(hollow, 0.35 * smooth(2, -6, h - hH(x + 6, z + 6) * 0.5) + 0.12 * Math.sin(x * 0.05) * Math.cos(z * 0.06));
    c.lerp(hor, far(Math.hypot(x - PLACE.x, z - PLACE.z)) * 0.6); col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const land = new Mesh(geo, new MeshLambertMaterial({ vertexColors: true })); land.position.set(PLACE.x, 0, PLACE.z); land.receiveShadow = true; g.add(land);
  // where things may stand: not on the neighbourhood, not by the track, not on the ice
  const vx = W / 2 + 3, vz0 = PLACE.z - CZ - 3, vz1 = PLACE.z + (H - CZ) + 2;
  const free = (x, z) => !(Math.abs(x - PLACE.x) < vx && z > vz0 && z < vz1) && z < TRACK_Z - 10 + (z < 0 ? 0 : 0) && hH(x, z) > -0.1 && !(z > TRACK_Z - 10 && z < TRACK_Z + 30);
  // houses: three sizes of pastel house with a pitched roof under snow, facing the place
  const body = new BoxGeometry(1, 1, 1); body.translate(0, 0.5, 0);
  const roof = new ConeGeometry(0.76, 0.42, 4, 1); roof.rotateY(Math.PI / 4); roof.translate(0, 1.21, 0);
  { const rp = roof.attributes.position, rc = []; for (let v = 0; v < rp.count; v++) { const top = rp.getY(v) > 1.25; const k = top ? new Color('#fbfcff') : new Color(R() < 0.5 ? '#b9614e' : '#7a6f9e'); rc.push(k.r, k.g, k.b); } roof.setAttribute('color', new Float32BufferAttribute(rc, 3)); }
  const win = new PlaneGeometry(0.16, 0.2); win.translate(0, 0, 0.505);
  const PAST = ['#ecd2b4', '#e2c0cc', '#c9d8ea', '#ece2c4', '#d3e4d2', '#f2d6bd', '#d8cfe8', '#f4e7d6'];
  const homes = [];
  for (let gi = -230; gi < 230; gi += 5.2) for (let gj = -230; gj < 230; gj += 5.2) {
    const x = PLACE.x + gi + (R() - 0.5) * 3.2, z = PLACE.z + gj + (R() - 0.5) * 3.2, r = Math.hypot(x - PLACE.x, z - PLACE.z);
    if (r < 42 || r > 205 || !free(x, z)) continue;
    const dens = 0.55 + 0.45 * Math.sin((x - PLACE.x) / 37 + seed) * Math.cos((z - PLACE.z) / 29 - seed); // neighbourhoods and gaps between them
    if (R() > dens * (r < 70 ? 0.55 : 0.9)) continue;
    homes.push({ x, z, y: hH(x, z), w: 3.4 + R() * 2.8, h: 3 + R() * (r > 120 ? 5 : 3.5), d: 3.6 + R() * 1.6, ry: Math.atan2(PLACE.x - x, PLACE.z - z) + (R() - 0.5) * 0.5, c: PAST[Math.floor(R() * PAST.length)], r });
  }
  const bodies = new InstancedMesh(body, new MeshLambertMaterial({ color: '#ffffff' }), homes.length), roofs = new InstancedMesh(roof, new MeshLambertMaterial({ vertexColors: true }), homes.length), o = new Object3D(), bc = new Color();
  const wins = [], lit = 0.18 + (L.dusk || 0) * 0.7;
  homes.forEach((q, k) => {
    o.position.set(q.x, q.y - 0.3, q.z); o.rotation.set(0, q.ry, 0); o.scale.set(q.w, q.h, q.d); o.updateMatrix(); bodies.setMatrixAt(k, o.matrix); bc.set(q.c).lerp(hor, far(q.r)); bodies.setColorAt(k, bc);
    o.scale.set(q.w, Math.max(q.h, 3) * 0.9, q.d); o.position.y = q.y - 0.3 + q.h - Math.max(q.h, 3) * 0.9 * 1.0; o.updateMatrix(); roofs.setMatrixAt(k, o.matrix);
    for (let fl = 0; fl < Math.floor(q.h / 2.2); fl++) for (const u of [-0.25, 0.25]) if (R() < 0.85) { o.position.set(q.x, q.y - 0.3 + 1.1 + fl * 2.1, q.z); o.rotation.set(0, q.ry, 0); o.scale.set(q.w, q.h / q.h * 1, q.d); o.updateMatrix(); const m = o.matrix.clone().multiply(new Object3D().matrix.makeTranslation(u, 0, 0)).multiply(new Object3D().matrix.makeScale(1 / q.w * 2.4, 1 / 1 * 3, 1)); wins.push({ m, lit: R() < lit, r: q.r }); }
  });
  bodies.instanceColor.needsUpdate = true; bodies.receiveShadow = true; g.add(bodies, roofs);
  if (wins.length) { const wm = new InstancedMesh(win, new MeshBasicMaterial({ color: '#ffffff' }), wins.length), warm = new Color('#ffd27a'), dark = new Color('#55617f'); wins.forEach((w, k) => { wm.setMatrixAt(k, w.m); wm.setColorAt(k, (w.lit ? warm.clone() : dark.clone()).lerp(hor, far(w.r) * (w.lit ? 0.3 : 0.8))); }); wm.instanceColor.needsUpdate = true; g.add(wm); }
  // trees: groves of snowy pines, tall dark cypresses, round trees with snow on their crowns
  const pine = new ConeGeometry(1, 2.2, 7); pine.translate(0, 1.6, 0); const cyp = new CylinderGeometry(0.05, 0.55, 4.4, 7); cyp.translate(0, 2.4, 0); const ball = new SphereGeometry(1, 8, 6); ball.scale(1, 0.8, 1); ball.translate(0, 2.1, 0);
  const kinds = [[pine, '#2f6b5a', 1.0], [cyp, '#26473c', 1.0], [ball, '#f1f2f8', 1.1]], lists = [[], [], []];
  for (let k = 0; k < 900; k++) {
    const grove = Math.floor(R() * 40), ga = (grove / 40) * 6.28 * 1.7 + seed, gr = 40 + (grove % 9) * 19, cx = PLACE.x + Math.sin(ga) * gr, cz = PLACE.z - Math.abs(Math.cos(ga)) * gr - 6;
    const x = cx + (R() - 0.5) * 16, z = cz + (R() - 0.5) * 12, r = Math.hypot(x - PLACE.x, z - PLACE.z); if (r < 38 || !free(x, z)) continue;
    lists[grove % 5 === 0 ? 1 : grove % 3 === 0 ? 2 : 0].push({ x, z, y: hH(x, z), s: 0.9 + R() * 0.9, r });
  }
  kinds.forEach(([gm, cc], k) => { const L2 = lists[k]; if (!L2.length) return; const im = new InstancedMesh(gm, new MeshLambertMaterial({ color: '#ffffff' }), L2.length); L2.forEach((q, n) => { o.position.set(q.x, q.y - 0.2, q.z); o.rotation.set(0, R() * 6, 0); o.scale.set(q.s, q.s * (k === 1 ? 1.4 : 1), q.s); o.updateMatrix(); im.setMatrixAt(n, o.matrix); im.setColorAt(n, new Color(cc).lerp(hor, far(q.r))); }); im.instanceColor.needsUpdate = true; g.add(im); });
  { const trunk = new CylinderGeometry(0.13, 0.18, 1.5, 6); trunk.translate(0, 0.75, 0); const L2 = lists[2], im = new InstancedMesh(trunk, new MeshLambertMaterial({ color: '#7a5a46' }), Math.max(1, L2.length)); L2.forEach((q, n) => { o.position.set(q.x, q.y - 0.2, q.z); o.rotation.set(0, 0, 0); o.scale.setScalar(q.s); o.updateMatrix(); im.setMatrixAt(n, o.matrix); }); im.count = L2.length; g.add(im); } // the round trees' trunks
  { const capG = new ConeGeometry(0.62, 0.9, 7); capG.translate(0, 2.55, 0); const L2 = lists[0], im = new InstancedMesh(capG, new MeshLambertMaterial({ color: '#f6f8ff' }), Math.max(1, L2.length)); L2.forEach((q, n) => { o.position.set(q.x, q.y - 0.2, q.z); o.rotation.set(0, 0, 0); o.scale.setScalar(q.s); o.updateMatrix(); im.setMatrixAt(n, o.matrix); }); im.count = L2.length; g.add(im); } // snow on the pines
  // the old stone tower on the highest hill
  let best = null; for (let k = 0; k < 60; k++) { const side = k % 2 ? 1 : -1, a = side * (0.55 + (k >> 1) * 0.02), r = 150 + (k % 5) * 6, /* off to one side and far, never right behind the place */ x = PLACE.x + Math.sin(a) * r, z = PLACE.z - Math.cos(a) * r, h = hH(x, z); if (h > 0 && (!best || h > best.h)) best = { x, z, h }; }
  if (best) {
    const stone = new MeshLambertMaterial({ color: new Color('#d9cfc3').lerp(hor, 0.35) }), slate = new MeshLambertMaterial({ color: new Color('#5d5f86').lerp(hor, 0.3) }), dark = new MeshBasicMaterial({ color: new Color('#3d4363').lerp(hor, 0.3) }), glowW = new MeshBasicMaterial({ color: '#ffd27a' });
    const T = new Group(); T.position.set(best.x, best.h - 0.5, best.z); T.scale.setScalar(0.85); T.rotation.y = Math.atan2(PLACE.x - best.x, PLACE.z - best.z); g.add(T);
    const part = (gm, m, y) => { const ms = new Mesh(gm, m); ms.position.y = y; T.add(ms); return ms; };
    part(new CylinderGeometry(5.4, 6, 4, 20), stone, 2); part(new CylinderGeometry(4.2, 4.6, 30, 20), stone, 19);
    part(new CylinderGeometry(4.9, 4.9, 0.8, 20), stone, 34.4); part(new TorusGeometry(4.9, 0.18, 6, 28), slate, 35).rotation.x = Math.PI / 2;
    part(new CylinderGeometry(4.3, 4.3, 4.6, 20), stone, 37.2);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, wm = new Mesh(new PlaneGeometry(0.9, 2.2), L.dusk ? glowW : dark); wm.position.set(Math.sin(a) * 4.32, 37.2, Math.cos(a) * 4.32); wm.rotation.y = a; T.add(wm); }
    for (const y of [12, 20, 28]) for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + y, wm = new Mesh(new PlaneGeometry(0.7, 1.4), dark); wm.position.set(Math.sin(a) * 4.42, y, Math.cos(a) * 4.42); wm.rotation.y = a; T.add(wm); }
    part(new ConeGeometry(4.7, 10, 20), slate, 44.5); part(new ConeGeometry(4.0, 3.2, 20), new MeshLambertMaterial({ color: '#f6f8ff' }), 41.9); part(new CylinderGeometry(0.08, 0.08, 3, 6), slate, 51);
  }
}
function gulls(g, n = 7, seed = 5) {
  const R = rng(seed), m = new MeshLambertMaterial({ color: '#f7f8fc', side: DoubleSide }), list = [];
  for (let k = 0; k < n; k++) {
    const b = new Group(), wing = s => { const geo = new BufferGeometry(); geo.setAttribute('position', new Float32BufferAttribute([0, 0, 0.12, 0, 0, -0.12, s * 0.75, 0.05, -0.05], 3)); geo.computeVertexNormals(); return new Mesh(geo, m); };
    const L = wing(1), Rw = wing(-1); b.add(L, Rw); const body = new Mesh(new SphereGeometry(0.1, 8, 6), m); body.scale.set(0.8, 0.7, 2); b.add(body); b.scale.setScalar(1.6); g.add(b);
    list.push({ b, L, Rw, r: 10 + R() * 14, y: 9 + R() * 8, a: R() * 6.28, s: (0.12 + R() * 0.1) * (R() < 0.5 ? -1 : 1), ph: R() * 6 });
  }
  return t => { for (const q of list) { const a = q.a + t * q.s; q.b.position.set(PLACE.x + Math.sin(a) * q.r, q.y + Math.sin(t * 0.7 + q.ph) * 0.6, PLACE.z + Math.cos(a) * q.r * 0.7); q.b.rotation.y = a + (q.s > 0 ? Math.PI / 2 : -Math.PI / 2); const f = Math.sin(t * 7 + q.ph) * 0.6; q.L.rotation.z = f; q.Rw.rotation.z = -f; } };
}
function snowfall(g, n = 900) {
  const p = new Float32Array(n * 3), R = rng(9); for (let k = 0; k < n; k++) { p[k * 3] = PLACE.x + (R() - 0.5) * 50; p[k * 3 + 1] = R() * 22; p[k * 3 + 2] = PLACE.z + 10 + (R() - 0.5) * 44; }
  const geo = new BufferGeometry(); geo.setAttribute('position', new Float32BufferAttribute(p, 3));
  const flakeT = tex(32, 32, (x, S) => { const gr = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, S, S); });
  const pts = new Points(geo, new PointsMaterial({ size: 0.14, map: flakeT, transparent: true, depthWrite: false })); pts.frustumCulled = false; g.add(pts);
  return dt => { const a = geo.attributes.position.array; for (let k = 0; k < n; k++) { a[k * 3 + 1] -= dt * (0.8 + (k % 5) * 0.12); a[k * 3] += dt * 0.35 * Math.sin(k + a[k * 3 + 1]); if (a[k * 3 + 1] < 0) a[k * 3 + 1] += 22; } geo.attributes.position.needsUpdate = true; };
}

// ---------- a scene: the neighbourhood, the layer over it, the light and the shots ----------
function vista({ hood, light, shots, wide, extra = null }) {
  return ({ camera = null } = {}) => {
    const g = new Group(), world = neighbourhood(hood); g.add(world.group);
    world.group.traverse(o => { if (o.isMesh && !o.material?.transparent) o.castShadow = o.receiveShadow = true; });
    sky(g, { ...light, seed: hood.seed }); townscape(g, light, { seed: hood.seed, sea: !!hood.sea });
    const flyGulls = gulls(g), snowing = snowfall(g), more = extra?.(g) || null;
    world.setDusk?.(light.dusk || 0);
    const focus = new Vector3();
    return {
      group: g, duration: SCENE_SECONDS, shots, wide, light,
      tick(t, dt) { focus.set(PLACE.x, 0, PLACE.z).applyMatrix4(g.matrixWorld); world.tick?.(dt, focus, false, camera); flyGulls(t); snowing(dt); more?.(t, dt); },
      dispose() { g.traverse(o => { if (o.isMesh || o.isSprite || o.isPoints) o.geometry?.dispose?.(); }); }, // geometry only: the village's materials are shared with the game's
    };
  };
}
const C = PLACE, at = (x, y, z) => [C.x + x, y, C.z + z]; // a point relative to the landmark
const orbit = (t0, t1, { r, a, y, look }) => ({ t0, t1, orbit: { c: [C.x, 0, C.z], r, a, y }, look });
const move = (t0, t1, from, to) => ({ t0, t1, from, to });

// Boulevard Park (a clear blue afternoon): the treehouse fort in its giant plane tree, at the end
// of an avenue of old plane trees, chestnut and salep stalls steaming, houses round the park.
const boulevard = vista({
  hood: { landmark: 'treehouse', seed: 11, flag: '#3f9b5a', trees: 'TTvT', props: [
    ...[0, 1, 2].flatMap(k => [{ type: 'plane-tree', i: CX - 6, j: CZ + 7 + k * 4, w: 2, h: 2 }, { type: 'plane-tree', i: CX + 4, j: CZ + 7 + k * 4, w: 2, h: 2 }]),
    { type: 'stall', kind: 'chestnut', i: CX - 9, j: CZ + 2, w: 2, h: 1 }, { type: 'stall', kind: 'salep', i: CX + 7, j: CZ + 2, w: 2, h: 1 }] },
  light: { sun: '#fff3dc', intensity: 2.0, sky: '#e6eeff', ground: '#9b93c8', dir: [-0.45, 0.62, -0.62], top: '#5d93e0', horizon: '#dbe7fb', far: '#a6b4d8', fog: '#dbe7fb' },
  shots: [
    move(0, 2.6, [at(-2, 1.8, 22), at(0, 3.6, 0)], [at(-1.2, 3.2, 14), at(0, 4.3, 0)]), // down the avenue of plane trees to the tree
    orbit(2.6, 5.0, { r: [12, 10.5], a: [0.6, -0.3], y: [3, 7.5], look: [at(0, 4, 0), at(0, 5.6, 0)] }), // up and round to the fort
    move(5.0, 7.2, [at(-1, 11, 15), at(0, 3.2, 0)], [at(-1, 17.5, 25), at(0, 2.4, -1)]), // up the middle of the avenue, over the park and the town
  ],
  wide: [at(-11, 11, 20), at(0, 3, -1)],
});
// Archery Ground (bright late afternoon, long shadows): the archers' lodge with its lead domes and
// golden bow, the old record stones in a row, straw targets, pennants, houses round the ground.
const archery = vista({
  hood: { landmark: 'archers-lodge', seed: 21, flag: '#c8443c', trees: 'xvxT', props: [
    ...[0, 1, 2, 3, 4].map(k => ({ type: 'marker-stone', n: k, i: CX - 13 + k * 2, j: CZ + 8 })),
    ...[0, 1, 2].map(k => ({ type: 'target', i: CX + 7 + k * 2, j: CZ + 1 })),
    { type: 'stall', kind: 'salep', i: CX - 10, j: CZ + 1, w: 2, h: 1 }] },
  light: { sun: '#ffe2b8', intensity: 2.15, sky: '#efe9f6', ground: '#a497c4', dir: [-0.78, 0.36, -0.5], top: '#6f97d8', horizon: '#f6e3cf', far: '#b2abcc', fog: '#efe2d8', sunSize: 80 },
  shots: [
    move(0, 2.6, [at(-12, 1.6, 17), at(-2, 2.2, 0)], [at(-8, 6, 14), at(0, 2.3, 0)]), // up past the record stones
    orbit(2.6, 5.0, { r: [13, 11.5], a: [-0.3, 0.5], y: [3, 4.2], look: [at(0, 2.3, -0.5), at(0, 2.5, -0.5)] }), // round the porch, the low sun behind
    move(5.0, 7.2, [at(5, 7, 13), at(0, 2, -1)], [at(12, 15, 22), at(0, 1.4, -3)]), // the ground and the town beyond
  ],
  wide: [at(4, 10, 21), at(0, 2, -1)],
});
// Kızılay Square (a lavender afternoon, the lamps coming on): the tiled fountain kiosk in the middle
// of the square, simit, tea and roasted-corn stalls, plane trees, the houses all round.
const kizilay = vista({
  hood: { landmark: 'fountain', seed: 31, flag: '#35b0b0', trees: 'vTvT', plazaR: 5.5, props: [
    { type: 'stall', kind: 'simit', i: CX - 5, j: CZ + 4, w: 2, h: 1 }, { type: 'stall', kind: 'cay', i: CX + 3, j: CZ + 4, w: 2, h: 1 }, { type: 'stall', kind: 'corn', i: CX + 7, j: CZ - 3, w: 2, h: 1 },
    { type: 'plane-tree', i: CX - 11, j: CZ + 6, w: 2, h: 2 }, { type: 'plane-tree', i: CX + 9, j: CZ + 6, w: 2, h: 2 }, { type: 'plane-tree', i: CX - 11, j: CZ - 4, w: 2, h: 2 }] },
  light: { sun: '#f3e4ff', intensity: 1.7, sky: '#e6dcf5', ground: '#8f86bf', dir: [-0.4, 0.4, -0.82], top: '#7c7fd0', horizon: '#ead7ee', far: '#a69cc8', fog: '#e4d6ec', dusk: 0.45 },
  shots: [
    move(0, 2.6, [at(0.5, 1.6, 19), at(0, 2.3, 0)], [at(0.3, 2.4, 12), at(0, 2.5, 0)]), // across the square to the kiosk
    orbit(2.6, 5.0, { r: [11, 9.5], a: [1.0, -0.6], y: [2.6, 3.6], look: [at(0, 2.5, 0), at(0, 2.7, 0)] }), // round the kiosk
    move(5.0, 7.2, [at(-4, 5, 10), at(0, 2, 0)], [at(-9, 15, 18), at(0, 1.4, -1)]), // up over the square
  ],
  wide: [at(-7, 12, 18), at(0, 2, 0)],
});
// Sururi Park (golden hour): the snow castle being built, slides and swings, the giant snowman with
// its ladder, a corn stall, pines all round.
const sururi = vista({
  hood: { landmark: 'snow-castle', seed: 41, flag: '#e8a10a', trees: 'yxyT', props: [
    { type: 'slide', i: CX + 8, j: CZ + 5, w: 2, h: 2 }, { type: 'swings', i: CX - 10, j: CZ + 5, w: 2, h: 2 }, { type: 'giant-snowman', i: CX + 8, j: CZ - 3, w: 2, h: 2 },
    { type: 'stall', kind: 'corn', i: CX - 9, j: CZ - 2, w: 2, h: 1 }] },
  light: { sun: '#ffd28a', intensity: 2.2, sky: '#fbe7cf', ground: '#a88fb4', dir: [-0.82, 0.24, -0.5], top: '#7f8fd1', horizon: '#ffd9a8', far: '#c0a5b8', fog: '#f6d9bf', sunSize: 90, dusk: 0.25 },
  shots: [
    move(0, 2.6, [at(11, 1.8, 17), at(1, 3, 0)], [at(7, 5, 14), at(0, 3.2, 0)]), // in past the slide
    orbit(2.6, 5.0, { r: [13, 11.5], a: [-0.8, 0.25], y: [3.5, 5], look: [at(0, 3.1, 0), at(0, 3.5, 0)] }), // round the towers
    move(5.0, 7.2, [at(0, 9, 12), at(0, 2.6, -1)], [at(0, 17, 22), at(0, 1.6, -3)]), // high over the park
  ],
  wide: [at(0, 12, 20), at(0, 2.5, -1)],
});
// The Pier (sunset, the lamps lit): the admiral and his lion on the quay, the frozen Golden Horn
// behind with a ferry stuck in the ice, the wooden pier and the ferry building, the far shore.
const pier = vista({
  hood: { landmark: 'admiral', seed: 51, flag: '#e8584a', sea: 11, trees: 'xTx', plazaR: 5, props: [
    { type: 'pier', i: CX - 8, j: 5, w: 2, h: 3, along: 'z' }, { type: 'iskele', i: CX + 6, j: 8, w: 4, h: 2, along: 'x', dir: 1 }, { type: 'ferry', i: CX - 2, j: 2, w: 5, h: 2, along: 'x' },
    { type: 'stall', kind: 'fish', i: CX - 10, j: CZ + 2, w: 2, h: 1 }] },
  light: { sun: '#ffb38a', intensity: 1.9, sky: '#f6d6dc', ground: '#8f7fb8', dir: [-0.6, 0.18, -0.78], top: '#6c6fc4', horizon: '#ffc1a4', far: '#9b88b4', fog: '#f2c6bc', sunDisc: '#ffb070', sunSize: 95, dusk: 0.8 },
  shots: [
    move(0, 2.6, [at(-7, 1.8, 15), at(0, 3.4, -1)], [at(-4, 3, 10), at(0, 3.8, -1)]), // the statue against the sunset
    orbit(2.6, 5.0, { r: [10, 9], a: [0.7, -0.5], y: [2.5, 3.6], look: [at(0, 3.4, 0), at(0, 3.6, 0)] }), // round the admiral and his lion
    move(5.0, 7.2, [at(2, 5, 8), at(0, 1.2, -10)], [at(6, 12, 16), at(0, 0.8, -26)]), // out over the frozen Golden Horn
  ],
  wide: [at(4, 10, 16), at(0, 1.5, -8)],
});


// ---------- Arena 2: up the Golden Horn, from a bright morning at its mouth to dusk at Miniatürk ----------
// Karaköy Bridge and Pier (a clear blue morning, mist on the water): the bridge with its row of
// fishermen's rods, the pier hall, ferries in the ice, the far shore.
const karakoy = vista({
  hood: { landmark: 'karakoy', seed: 61, flag: '#2d6fb5', sea: 11, trees: 'xTx', plazaR: 5, props: [
    { type: 'ferry', i: CX - 12, j: 3, w: 5, h: 2, along: 'x' }, { type: 'ferry', i: CX + 7, j: 6, w: 5, h: 2, along: 'x' }, { type: 'pier', i: CX + 7, j: 9, w: 2, h: 3, along: 'z' },
    { type: 'stall', kind: 'fish', i: CX - 10, j: CZ + 2, w: 2, h: 1 }, { type: 'stall', kind: 'simit', i: CX + 7, j: CZ + 2, w: 2, h: 1 }] },
  light: { sun: '#fff1d6', intensity: 2.0, sky: '#e2ecff', ground: '#9a94c6', dir: [0.5, 0.5, -0.7], top: '#5a8ede', horizon: '#dbe8fb', far: '#a3b3d8', fog: '#d8e5f8' },
  shots: [
    move(0, 2.6, [at(-8, 1.6, 14), at(0, 2.2, -1)], [at(-4.5, 2.6, 9.5), at(0, 2.4, -1)]), // along the quay to the bridge and its rods
    orbit(2.6, 5.0, { r: [10, 9], a: [-0.8, 0.5], y: [2.4, 3.4], look: [at(0, 2.0, -0.5), at(0, 2.2, -0.5)] }), // round the pier hall and the ferry
    move(5.0, 7.2, [at(2, 5, 8), at(0, 1.2, -10)], [at(5, 12, 16), at(0, 0.8, -26)]), // up and out over the frozen water
  ],
  wide: [at(3, 9, 15), at(0, 1.5, -6)],
});
// Bankalar Caddesi (bright noon): the street of grand old banks, the great stone bank building at
// its heart with its columns and bronze door, lamps, a simit and a tea stall, plane trees.
const bankalar = vista({
  hood: { landmark: 'bankalar', seed: 71, flag: '#7a1f1f', trees: 'TvTT', plazaR: 5, props: [
    { type: 'plane-tree', i: CX - 9, j: CZ + 5, w: 2, h: 2 }, { type: 'plane-tree', i: CX + 7, j: CZ + 5, w: 2, h: 2 },
    { type: 'stall', kind: 'simit', i: CX - 6, j: CZ + 4, w: 2, h: 1 }, { type: 'stall', kind: 'cay', i: CX + 4, j: CZ + 4, w: 2, h: 1 }] },
  light: { sun: '#fffaf0', intensity: 2.25, sky: '#eef0fb', ground: '#a49dc8', dir: [-0.3, 0.75, -0.55], top: '#6f9ae0', horizon: '#e7eefb', far: '#b0b8d8', fog: '#e6ecf8' },
  shots: [
    move(0, 2.6, [at(0.5, 1.4, 16), at(0, 2.4, 0)], [at(0.3, 2.2, 10), at(0, 2.9, 0)]), // up the street to the great door
    orbit(2.6, 5.0, { r: [10, 9], a: [0.8, -0.6], y: [2.2, 3.6], look: [at(0, 2.6, 0), at(0, 3.0, 0)] }), // along the columns
    move(5.0, 7.2, [at(-3, 6, 9), at(0, 2.5, 0)], [at(-7, 14, 18), at(0, 1.8, -1)]), // over the rooftops of the street
  ],
  wide: [at(-6, 11, 18), at(0, 2.5, 0)],
});
// Tersane İstanbul (golden afternoon): the old shipyard on the water: the brick workshop and its
// chimney, the dry dock with a ship, the crane, the new promenade under its glass canopy.
const tersane = vista({
  hood: { landmark: 'tersane', seed: 81, flag: '#e8a10a', sea: 10, trees: 'xvx', plazaR: 5, props: [
    { type: 'ferry', i: CX - 11, j: 4, w: 5, h: 2, along: 'x' }, { type: 'stall', kind: 'cay', i: CX - 10, j: CZ + 2, w: 2, h: 1 }, { type: 'stall', kind: 'chestnut', i: CX + 7, j: CZ + 2, w: 2, h: 1 }] },
  light: { sun: '#ffdca8', intensity: 2.2, sky: '#f6e8d8', ground: '#a693bc', dir: [-0.75, 0.32, -0.55], top: '#7790d6', horizon: '#f8dcbc', far: '#b6a7c4', fog: '#f0dcc8', sunSize: 85, dusk: 0.2 },
  shots: [
    move(0, 2.6, [at(-9, 1.6, 13), at(0, 1.8, 0)], [at(-5.5, 2.4, 9), at(0, 2.0, 0)]), // along the promenade under the canopy
    orbit(2.6, 5.0, { r: [11, 9.5], a: [-0.5, 0.6], y: [2.6, 4.2], look: [at(0, 2.0, -0.8), at(0, 2.6, -0.8)] }), // round the workshop and the dry dock
    move(5.0, 7.2, [at(3, 7, 9), at(0, 2.4, -1)], [at(7, 15, 18), at(0, 1.4, -6)]), // up past the crane over the water
  ],
  wide: [at(4, 10, 16), at(0, 2, -2)],
});
// Aynalıkavak Pavilion (pink sunset): the pavilion on its stone base, wide eaves, mirror-bright
// windows catching the sunset, cypresses and the pool, the Golden Horn behind.
const aynalikavak = vista({
  hood: { landmark: 'aynalikavak', seed: 91, flag: '#c8443c', sea: 9, trees: 'xyxT', plazaR: 5, props: [
    { type: 'pier', i: CX - 7, j: 4, w: 2, h: 3, along: 'z' }, { type: 'stall', kind: 'salep', i: CX + 7, j: CZ + 2, w: 2, h: 1 }] },
  light: { sun: '#ffb79a', intensity: 1.9, sky: '#f6d8e0', ground: '#9285bd', dir: [-0.7, 0.2, -0.68], top: '#7273c8', horizon: '#ffc6ae', far: '#a28fb8', fog: '#f2cbc2', sunDisc: '#ffb878', sunSize: 95, dusk: 0.65 },
  shots: [
    move(0, 2.6, [at(0.6, 1.3, 14), at(0, 1.4, 0)], [at(0.3, 1.8, 8.5), at(0, 1.8, 0)]), // low across the pool to the steps
    orbit(2.6, 5.0, { r: [9, 8], a: [0.9, -0.5], y: [2.0, 3.0], look: [at(0, 1.6, -0.5), at(0, 1.9, -0.5)] }), // round the eaves, the windows catching the sunset
    move(5.0, 7.2, [at(-2, 5, 7), at(0, 1.4, -6)], [at(-5, 12, 15), at(0, 0.8, -22)]), // over the roof to the water
  ],
  wide: [at(-5, 9, 15), at(0, 1.5, -4)],
});
// Miniatürk (dusk, the lamps lit): the park of little models on snowy lawns, the big sign, giant
// snowmen among the models, the town's lights coming on beyond.
const miniaturk = vista({
  hood: { landmark: 'miniaturk', seed: 101, flag: '#7a1f1f', trees: 'xTxv', plazaR: 5, props: [
    { type: 'giant-snowman', i: CX - 9, j: CZ - 3, w: 2, h: 2 }, { type: 'giant-snowman', i: CX + 7, j: CZ - 3, w: 2, h: 2 },
    { type: 'stall', kind: 'corn', i: CX - 9, j: CZ + 3, w: 2, h: 1 }, { type: 'stall', kind: 'chestnut', i: CX + 7, j: CZ + 3, w: 2, h: 1 }] },
  light: { sun: '#e8c8ff', intensity: 1.5, sky: '#d8d0f0', ground: '#7f78b2', dir: [-0.5, 0.25, -0.83], top: '#4c5aa8', horizon: '#d9b8d8', far: '#8f86b4', fog: '#d4c2dc', sunDisc: '#ffb0a0', sunSize: 80, dusk: 0.95 },
  shots: [
    move(0, 2.6, [at(0.2, 1.2, 13), at(0, 1.0, 0)], [at(0.1, 1.5, 7.5), at(0, 1.1, 0)]), // up the path between the models
    orbit(2.6, 5.0, { r: [7.5, 6.5], a: [-0.9, 0.6], y: [1.6, 2.6], look: [at(0, 0.9, 0), at(0, 1.1, 0)] }), // low round the little towers
    move(5.0, 7.2, [at(3, 5, 7), at(0, 1.0, 0)], [at(7, 13, 16), at(0, 0.8, -2)]), // up over the park and the giant snowmen
  ],
  wide: [at(4, 9, 14), at(0, 1, 0)],
});

// The scenes, by place; each one's welcome is read aloud with its name card.
export const CINEMA = {
  boulevard: { title: 'Boulevard Park', welcome: 'Welcome to Boulevard Park!', build: boulevard },
  archery: { title: 'Archery Ground', welcome: 'Welcome to Archery Ground!', build: archery },
  kizilay: { title: 'Kızılay Square', welcome: 'Welcome to Kızılay Square!', build: kizilay },
  sururi: { title: 'Sururi Park', welcome: 'Welcome to Sururi Park!', build: sururi },
  pier: { title: 'The Pier', welcome: 'Welcome to the Pier!', build: pier },
  karakoy: { title: 'Karaköy Bridge and Pier', welcome: 'Welcome to Karaköy!', build: karakoy },
  bankalar: { title: 'Bankalar Caddesi', welcome: 'Welcome to Bankalar Caddesi!', build: bankalar },
  tersane: { title: 'Tersane İstanbul', welcome: 'Welcome to Tersane İstanbul!', build: tersane },
  aynalikavak: { title: 'Aynalıkavak Pavilion', welcome: 'Welcome to Aynalıkavak Pavilion!', build: aynalikavak },
  miniaturk: { title: 'Miniatürk', welcome: 'Welcome to Miniatürk!', build: miniaturk },
};

// the camera of a shot at time t: [position, look-at] in the scene's frame
export function shotAt(scene, t) {
  const s = scene.shots.find(q => t >= q.t0 && t < q.t1) || scene.shots[scene.shots.length - 1];
  const k = ease(Math.max(0, Math.min(1, (t - s.t0) / (s.t1 - s.t0))));
  if (s.orbit) {
    const o = s.orbit, a = lerp(o.a[0], o.a[1], k), r = lerp(o.r[0], o.r[1], k);
    const look = Array.isArray(s.look[0]) ? lerp3(s.look[0], s.look[1], k) : s.look;
    return [[o.c[0] + Math.sin(a) * r, lerp(o.y[0], o.y[1], k), o.c[2] + Math.cos(a) * r], look];
  }
  return [lerp3(s.from[0], s.to[0], k), lerp3(s.from[1], s.to[1], k)];
}
