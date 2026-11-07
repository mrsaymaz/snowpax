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
  DoubleSide, Color, Vector3, InstancedMesh, Object3D, TorusGeometry, LineSegments, LineBasicMaterial, Line,
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
function neighbourhood({ landmark, seed = 1, sea = 0, plazaR = 5, trees = 'TvxyT', props = [], tiles = [], flag = '#c8443c' }) {
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
  for (const [c, i, j] of tiles) if (!'OG'.includes(g[j]?.[i] ?? 'O')) set(i, j, c); // the place's own street furniture: lamps, benches, bushes, trees, crates, fire barrels
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
  return hH;
}
// ---------- the real skyline, a little larger than life ----------
// Each place looks out at what is really there from it, placed by its true bearing and made a bit
// bigger and clearer, so a child knows the view: Galata Tower on its hill, the old city's ridge of
// domes and minarets across the water (scenery only), the bridges over the Golden Horn, the red
// brick school on the hill at Fener, the towers of Şişli far off, the cypress hill above Eyüp.
// An item: { kind, a (bearing from the view's middle, + to the right), r (distance), s (size) }.
function skyline(g, L, hH, items = []) {
  const hor = new Color(L.fog || L.horizon), lit = (L.dusk || 0) > 0.3, R = rng(17);
  const haze = (c, r, k = 0.28) => new Color(c).lerp(hor, Math.min(0.55, Math.max(0, (r - 50) / 300) * k * 3));
  const M = (c, r, k) => new MeshLambertMaterial({ color: haze(c, r, k) }), B = (c, r, k) => new MeshBasicMaterial({ color: haze(c, r, k) });
  const glow = new MeshBasicMaterial({ color: '#ffd27a' });
  const where = (a, r) => { const x = PLACE.x + Math.sin(a) * r, z = PLACE.z - Math.cos(a) * r; return [x, Math.max(0, hH(x, z)), z]; };
  const put = (gm, m, x, y, z, root) => { const o = new Mesh(gm, m); o.position.set(x, y, z); root.add(o); return o; };
  const root = (x, y, z, s, face = true) => { const T = new Group(); T.position.set(x, y, z); T.scale.setScalar(s); if (face) T.rotation.y = Math.atan2(PLACE.x - x, PLACE.z - z); g.add(T); return T; };
  const minaret = (T, x, z, h, stone, lead) => { put(new CylinderGeometry(0.55, 0.65, h, 10), stone, x, h / 2, z, T); for (const f of [0.62, 0.82]) put(new CylinderGeometry(0.95, 0.75, 0.5, 10), stone, x, h * f, z, T); put(new ConeGeometry(0.62, 5, 10), lead, x, h + 2.5, z, T); };
  const build = {
    // Galata Tower: the round stone tower, its gallery and the tall pointed cap
    galata({ a, r, s = 1 }) {
      const [x, y, z] = where(a, r), T = root(x, y - 0.5, z, s * 0.85), stone = M('#d9cfc3', r, 0.6), slate = M('#5d5f86', r, 0.5), dark = B('#3d4363', r, 0.5);
      const part = (gm, m, py) => put(gm, m, 0, py, 0, T);
      part(new CylinderGeometry(5.4, 6, 4, 20), stone, 2); part(new CylinderGeometry(4.2, 4.6, 30, 20), stone, 19);
      part(new CylinderGeometry(4.9, 4.9, 0.8, 20), stone, 34.4); part(new TorusGeometry(4.9, 0.18, 6, 28), slate, 35).rotation.x = Math.PI / 2;
      part(new CylinderGeometry(4.3, 4.3, 4.6, 20), stone, 37.2);
      for (let k = 0; k < 12; k++) { const q = k / 12 * Math.PI * 2, wm = new Mesh(new PlaneGeometry(0.9, 2.2), lit ? glow : dark); wm.position.set(Math.sin(q) * 4.32, 37.2, Math.cos(q) * 4.32); wm.rotation.y = q; T.add(wm); }
      for (const py of [12, 20, 28]) for (let k = 0; k < 6; k++) { const q = k / 6 * Math.PI * 2 + py, wm = new Mesh(new PlaneGeometry(0.7, 1.4), dark); wm.position.set(Math.sin(q) * 4.42, py, Math.cos(q) * 4.42); wm.rotation.y = q; T.add(wm); }
      part(new ConeGeometry(4.7, 10, 20), slate, 44.5); part(new ConeGeometry(4.0, 3.2, 20), new MeshLambertMaterial({ color: '#f6f8ff' }), 41.9); part(new CylinderGeometry(0.08, 0.08, 3, 6), slate, 51);
      if (lit) { const halo = new Sprite(new SpriteMaterial({ map: glowTex(), color: '#ffcf8a', transparent: true, opacity: 0.5, depthWrite: false, blending: AdditiveBlending, fog: false })); halo.position.set(0, 37, 0); halo.scale.setScalar(26); T.add(halo); }
    },
    // the old city's ridge across the water: a great domed silhouette on the hilltop with its four
    // minarets, smaller domes along the slope, houses packed below (scenery, seen from afar)
    ridge({ a, r, s = 1, n = 3, span = 0.5 }) {
      const stone = M('#ece4d6', r, 0.55), lead = M('#8790ab', r, 0.5);
      for (let k = 0; k < n; k++) {
        const big = k === Math.floor(n / 2), q = a + (n === 1 ? 0 : (k / (n - 1) - 0.5) * span), rr = r + (big ? 8 : (k % 2) * 10), [x, y, z] = where(q, rr), T = root(x, y - 0.8, z, s * (big ? 1.25 : 0.8));
        put(new BoxGeometry(18, 8, 18), stone, 0, 4, 0, T);
        for (const [dx, dz] of [[-6, 0], [6, 0], [0, -6], [0, 6]]) { const hd = put(new SphereGeometry(4.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), lead, dx, 8, dz, T); hd.scale.y = 0.8; }
        put(new CylinderGeometry(6.6, 7.2, 3, 20), stone, 0, 9.5, 0, T); const d = put(new SphereGeometry(6.8, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), lead, 0, 11, 0, T); d.scale.y = 0.9; put(new CylinderGeometry(0.15, 0.15, 2.5, 6), lead, 0, 18.5, 0, T);
        const mh = big ? 30 : 24; for (const [mx, mz] of big ? [[-11, -11], [11, -11], [-11, 11], [11, 11]] : [[-11, 10], [11, 10]]) minaret(T, mx, mz, mh, stone, lead);
      }
      // the packed old houses on the slopes below, warm with lamps at dusk
      const box = new BoxGeometry(1, 1, 1), im = new InstancedMesh(box, new MeshLambertMaterial({ color: '#ffffff' }), 90), o = new Object3D(), cols = ['#efdcc4', '#e6cbb8', '#d9d2e6', '#f1e3c8', '#e3c4b4'];
      for (let k = 0; k < 90; k++) { const q = a + (R() - 0.5) * (span + 0.35), rr = r - 14 + R() * 26, [x, y, z] = where(q, rr), h = 4 + R() * 6; o.position.set(x, y + h / 2 - 0.5, z); o.rotation.set(0, R() * 0.6, 0); o.scale.set(5 + R() * 4, h, 5); o.updateMatrix(); im.setMatrixAt(k, o.matrix); im.setColorAt(k, haze(cols[k % 5], rr, 0.5)); }
      im.instanceColor.needsUpdate = true; g.add(im);
    },
    // a bridge across the water at distance r, from bearing a0 to a1: 'galata' (low, on piers, lamps
    // and a row of fishing rods), 'metro' (two tall white pylons, fans of cables), 'highway' (high on pillars)
    bridge({ type = 'galata', r, a0 = -0.9, a1 = 0.9, y0 = 0 }) {
      const z = PLACE.z - r, x0 = PLACE.x + Math.tan(a0) * r, x1 = PLACE.x + Math.tan(a1) * r, len = x1 - x0, cx = (x0 + x1) / 2;
      const deckY = type === 'highway' ? 20 : type === 'metro' ? 11 : 4.5, grey = M(type === 'metro' ? '#eef0f6' : '#a9a5bd', r, 0.5), dark = M('#4b4f6e', r, 0.5);
      put(new BoxGeometry(len, 1.6, 7), grey, cx, deckY + y0, z, g); put(new BoxGeometry(len, 0.3, 6.6), M('#f6f8ff', r, 0.3), cx, deckY + y0 + 0.95, z, g); // the deck under snow
      const step = type === 'galata' ? 16 : type === 'highway' ? 28 : 34;
      for (let x = x0 + step / 2; x < x1; x += step) put(new BoxGeometry(type === 'highway' ? 2.2 : 2.2, deckY + 1, type === 'highway' ? 3 : 4.5), grey, x, (deckY + y0) / 2 - 0.5, z, g);
      if (type === 'galata') {
        for (let x = x0 + 4; x < x1; x += 8) { put(new CylinderGeometry(0.15, 0.2, 5, 6), dark, x, deckY + y0 + 3.4, z + 3.2, g); put(new BoxGeometry(0.7, 0.8, 0.7), lit ? glow : M('#fff1c8', r, 0.3), x, deckY + y0 + 6.2, z + 3.2, g); }
        const rod = new CylinderGeometry(0.04, 0.06, 5, 4); rod.rotateX(0.9); const rods = new InstancedMesh(rod, dark, 60), o = new Object3D(); let k = 0; for (let x = x0 + 2; x < x1 && k < 60; x += len / 60, k++) { o.position.set(x, deckY + y0 + 3, z + 4.5); o.updateMatrix(); rods.setMatrixAt(k, o.matrix); } rods.count = k; g.add(rods); // the fishermen's rods over the rail
      }
      if (type === 'metro') for (const f of [0.38, 0.62]) {
        const px = x0 + len * f, top = deckY + y0 + 44; put(new BoxGeometry(2.2, top, 2.2), grey, px, top / 2, z, g);
        const pts = []; for (let k = 1; k <= 5; k++) for (const sd of [-1, 1]) pts.push(px, top - k * 2.4, z, px + sd * k * 11, deckY + y0 + 1, z);
        const geo = new BufferGeometry(); geo.setAttribute('position', new Float32BufferAttribute(pts, 3)); g.add(new LineSegments(geo, new LineBasicMaterial({ color: haze('#e6e9f2', r, 0.8), transparent: true, opacity: 0.7 })));
      }
    },
    // the Maiden's Tower: a little white tower on a rock in the water, lit at night
    maiden({ a, r, s = 1 }) {
      const x = PLACE.x + Math.sin(a) * r, z = PLACE.z - Math.cos(a) * r, T = root(x, -0.3, z, s), w = M('#f4f1ec', r, 0.4), lead = M('#6f748f', r, 0.4), rock = M('#8a8496', r, 0.4);
      const rk = put(new SphereGeometry(5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), rock, 0, 0, 0, T); rk.scale.set(1.4, 0.45, 1);
      put(new BoxGeometry(8, 3, 5), w, -1.5, 3.2, 0, T); put(new CylinderGeometry(1.6, 1.8, 8, 14), w, 2.5, 5.5, 0, T); put(new CylinderGeometry(2.0, 2.0, 0.6, 14), w, 2.5, 9.8, 0, T); put(new ConeGeometry(1.8, 4, 14), lead, 2.5, 12.1, 0, T); put(new CylinderGeometry(0.08, 0.08, 1.8, 5), lead, 2.5, 14.8, 0, T);
      for (let k = 0; k < 4; k++) put(new PlaneGeometry(0.7, 1.2), lit ? glow : B('#4a4a5e', r, 0.4), 2.5 + Math.sin(k * 1.57) * 1.62, 7, Math.cos(k * 1.57) * 1.62, T).rotation.y = k * 1.57;
      if (lit) { const halo = new Sprite(new SpriteMaterial({ map: glowTex(), color: '#ffe0a8', transparent: true, opacity: 0.45, depthWrite: false, blending: AdditiveBlending, fog: false })); halo.position.set(2.5, 7, 0); halo.scale.setScalar(18); T.add(halo); }
    },
    // a great suspension bridge far off across the strait: two tall towers, the main cable's curve, lit at night
    suspension({ r, a0 = -0.95, a1 = -0.4 }) {
      const z = PLACE.z - r, x0 = PLACE.x + Math.tan(a0) * r, x1 = PLACE.x + Math.tan(a1) * r, len = x1 - x0, deckY = 14, grey = M('#d9dce6', r, 0.5);
      put(new BoxGeometry(len, 1.4, 5), grey, (x0 + x1) / 2, deckY, z, g);
      const tA = x0 + len * 0.2, tB = x0 + len * 0.8, top = deckY + 42; for (const tx of [tA, tB]) { put(new BoxGeometry(2.4, top, 2.4), grey, tx, top / 2, z, g); put(new BoxGeometry(2.6, 1.2, 4.8), grey, tx, top - 4, z, g); }
      const pts = [], cab = u => { const xx = x0 + len * u; const y = u < 0.2 ? deckY + (top - deckY) * (u / 0.2) : u > 0.8 ? deckY + (top - deckY) * ((1 - u) / 0.2) : deckY + 3 + (top - deckY - 3) * Math.pow((u - 0.5) / 0.3, 2); return [xx, y]; };
      for (let k = 0; k < 40; k++) { const [ax, ay] = cab(k / 40), [bx, by] = cab((k + 1) / 40); pts.push(ax, ay, z, bx, by, z); if (k % 2 === 0 && k / 40 > 0.2 && k / 40 < 0.8) pts.push(ax, ay, z, ax, deckY, z); }
      const geo = new BufferGeometry(); geo.setAttribute('position', new Float32BufferAttribute(pts, 3)); g.add(new LineSegments(geo, new LineBasicMaterial({ color: lit ? '#c8a0ff' : haze('#e6e9f2', r, 0.6) })));
      if (lit) for (let k = 0; k <= 30; k++) { const [bx2] = cab(k / 30); const b2 = new Mesh(new SphereGeometry(0.5, 6, 4), new MeshBasicMaterial({ color: ['#b48cff', '#7ad0ff', '#ffd27a'][k % 3] })); b2.position.set(bx2, deckY + 1, z + 2.6); g.add(b2); }
    },
    // the red brick school with its domed tower on the hill at Fener: a castle in brick
    redschool({ a, r, s = 1 }) {
      const [x, y, z] = where(a, r), T = root(x, y - 0.6, z, s), brick = M('#b4473a', r, 0.4), trim = M('#efe2d0', r, 0.4), lead = M('#6f748f', r, 0.4), win = lit ? glow : B('#4a3a44', r, 0.4);
      put(new BoxGeometry(34, 14, 12), brick, 0, 7, 0, T); put(new BoxGeometry(35, 1, 13), trim, 0, 14.4, 0, T);
      for (let k = 0; k < 9; k++) put(new BoxGeometry(2, 1.6, 0.6), brick, -16 + k * 4, 15.6, 6.2, T); // battlements
      for (const fl of [3.5, 8, 12]) for (let k = 0; k < 10; k++) if (Math.abs(k - 4.5) > 1) put(new PlaneGeometry(1.2, 2.2), win, -14.5 + k * 3.2, fl, 6.05, T);
      put(new BoxGeometry(10, 22, 12.5), brick, 0, 11, 0.4, T); put(new CylinderGeometry(4.2, 4.6, 5, 16), brick, 0, 24.5, 0.4, T);
      const d = put(new SphereGeometry(4.5, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), lead, 0, 27, 0.4, T); d.scale.y = 1.15; put(new CylinderGeometry(0.15, 0.15, 3, 6), lead, 0, 33, 0.4, T);
      for (const sd of [-1, 1]) { put(new CylinderGeometry(2.4, 2.6, 18, 12), brick, sd * 17, 9, 0, T); put(new ConeGeometry(3, 4, 12), lead, sd * 17, 20, 0, T); }
    },
    // the tall towers of the business district, far off on the horizon, lit at dusk
    towers({ a, r, s = 1, n = 9, span = 0.3 }) {
      const glass = tex(32, 128, (x2, w, h) => { x2.fillStyle = '#6f80a6'; x2.fillRect(0, 0, w, h); for (let yy = 4; yy < h; yy += 6) for (let xx = 3; xx < w; xx += 6) { x2.fillStyle = lit && Math.random() < 0.55 ? '#ffd68a' : '#a9bcdc'; x2.fillRect(xx, yy, 3, 3); } x2.fillStyle = 'rgba(255,255,255,0.18)'; x2.fillRect(0, 0, 6, h); /* a lit edge */ });
      for (let k = 0; k < n; k++) { const q = a + (k / (n - 1) - 0.5) * span + (R() - 0.5) * 0.03, rr = r + R() * 30, [x, y, z] = where(q, rr), h = (40 + R() * 70) * s, w = (7 + R() * 6) * s; const m = new MeshLambertMaterial({ map: glass, color: haze('#eef2fa', rr, 0.32), emissive: new Color(lit ? '#3a3020' : '#262c3c'), fog: false }); put(new BoxGeometry(w, h, w), m, x, y + h / 2 - 1, z, g); put(new BoxGeometry(w * 1.04, 1.2 * s, w * 1.04), new MeshLambertMaterial({ color: haze('#5d6684', rr, 0.22), fog: false }), x, y + h - 0.4, z, g); /* solid glass and steel, softened by the haze but never see-through */ if (k % 3 === 0) put(new CylinderGeometry(0.2, 0.2, 10 * s, 6), M('#c8cede', rr, 0.5), x, y + h + 4 * s, z, g); }
    },
    // a hill of tall dark cypresses (the old hillside above Eyüp)
    cypresses({ a, r, n = 160, span = 0.4 }) {
      const cyp = new CylinderGeometry(0.1, 1.1, 9, 7); cyp.translate(0, 4.5, 0); const im = new InstancedMesh(cyp, new MeshLambertMaterial({ color: '#ffffff' }), n), o = new Object3D();
      for (let k = 0; k < n; k++) { const q = a + (R() - 0.5) * span, rr = r + (R() - 0.5) * 40, [x, y, z] = where(q, rr); o.position.set(x, y - 0.3, z); o.scale.setScalar(0.8 + R() * 0.7); o.updateMatrix(); im.setMatrixAt(k, o.matrix); im.setColorAt(k, haze('#2a4a40', rr, 0.4)); }
      im.instanceColor.needsUpdate = true; g.add(im);
    },
  };
  for (const it of items) build[it.kind]?.(it);
}
let glowT0 = null;
const glowTex = () => glowT0 || (glowT0 = tex(64, 64, (x, S) => { const gr = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, S, S); }));
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

// ---------- street life: the little things that make a place feel lived in ----------
// Placed in the scene's frame by tile (i, j) or by x/z relative to the landmark. Nothing tall stands
// on the camera's way in (the middle, towards the track) or on its orbit round the landmark.
const tw = (i, j) => [PLACE.x + i + 0.5 - CX, PLACE.z + j + 0.5 - CZ]; // a tile's middle
const rel = (x, z) => [PLACE.x + x, PLACE.z + z];
const up = ([x, z], y = 0) => [x, y, z]; // a point at height y
function lifeKit(g) {
  const ticks = [], mats = {}, Lm = c => mats[c] || (mats[c] = new MeshLambertMaterial({ color: c })), Bm = c => mats['b' + c] || (mats['b' + c] = new MeshBasicMaterial({ color: c }));
  const snow = Lm('#f6f8ff'), iron = Lm('#2f3550'), wood = Lm('#8a5a3c');
  const add = (gm, m, x, y, z, ry = 0, root = g) => { const o = new Mesh(gm, m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = true; o.receiveShadow = true; root.add(o); return o; };
  const grp = (x, z, ry = 0) => { const q = new Group(); q.position.set(x, 0, z); q.rotation.y = ry; g.add(q); return q; };
  const R = rng(5);
  const kit = {
    ticks,
    // a café table under a striped parasol, two chairs, a steaming glass of tea
    cafe([x, z], col = '#c8443c', ry = 0) {
      const q = grp(x, z, ry); add(new CylinderGeometry(0.42, 0.42, 0.05, 14), Lm('#f2ece2'), 0, 0.74, 0, 0, q); add(new CylinderGeometry(0.04, 0.05, 0.74, 6), iron, 0, 0.37, 0, 0, q);
      add(new CylinderGeometry(0.03, 0.03, 2.1, 6), iron, 0, 1.05, 0, 0, q);
      const top = add(new ConeGeometry(1.15, 0.5, 8, 1, true), Lm(col), 0, 2.1, 0, 0, q); top.material.side = DoubleSide; add(new ConeGeometry(1.05, 0.34, 8), snow, 0, 2.27, 0, 0, q);
      for (const sd of [-1, 1]) { const c = grp(0, 0); q.add(c); c.position.set(sd * 0.68, 0, 0.1); add(new BoxGeometry(0.36, 0.05, 0.36), wood, 0, 0.44, 0, 0, c); add(new BoxGeometry(0.36, 0.4, 0.05), wood, 0, 0.66, sd * 0.0 - 0.17, 0, c); for (const [a, b] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) add(new CylinderGeometry(0.02, 0.02, 0.44, 4), iron, a, 0.22, b, 0, c); c.rotation.y = sd * Math.PI / 2; }
      add(new CylinderGeometry(0.035, 0.03, 0.09, 8), Bm('#d9542c'), 0.1, 0.81, 0.05, 0, q); kit.steam([x + 0.1, 0.9, z + 0.05], 0.25);
      return q;
    },
    // a thin curl of steam rising from a glass, a pot or a brazier
    steam([x, y, z], size = 0.4) {
      const t = glowTex(), list = []; for (let k = 0; k < 4; k++) { const sp = new Sprite(new SpriteMaterial({ map: t, color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); sp.position.set(x, y, z); g.add(sp); list.push({ sp, ph: k / 4 }); }
      ticks.push(tt => { for (const q of list) { const u = (tt * 0.45 + q.ph) % 1; q.sp.position.set(x + Math.sin(tt + q.ph * 6) * 0.08 * u, y + u * size * 3, z); q.sp.scale.setScalar(size * (0.4 + u)); q.sp.material.opacity = 0.45 * Math.sin(u * Math.PI); } });
    },
    // a string of warm bulbs hung between posts, twinkling
    lights(points, { y = 2.6, sag = 0.35, cols = ['#ffd27a', '#ffe9b0', '#ffb36a'] } = {}) {
      const bulbs = [], gm = new SphereGeometry(0.07, 6, 4), wire = [];
      for (let k = 0; k < points.length - 1; k++) {
        const [x0, z0] = points[k], [x1, z1] = points[k + 1], n = Math.max(4, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.6));
        for (let u = 0; u <= n; u++) { const f = u / n, px = x0 + (x1 - x0) * f, pz = z0 + (z1 - z0) * f, py = y - Math.sin(f * Math.PI) * sag; wire.push(px, py, pz); if (u < n) { const b = new Mesh(gm, new MeshBasicMaterial({ color: cols[(k + u) % cols.length] })); b.position.set(px, py - 0.06, pz); g.add(b); bulbs.push(b); } }
      }
      const geo = new BufferGeometry(); geo.setAttribute('position', new Float32BufferAttribute(wire, 3)); const line = new Line(geo, new LineBasicMaterial({ color: '#3a3346' })); g.add(line);
      ticks.push(tt => bulbs.forEach((b, k) => b.scale.setScalar(0.85 + 0.3 * Math.max(0, Math.sin(tt * 3 + k * 1.7)))));
    },
    // an Istanbul street cat, sitting, its tail swishing
    cat([x, y, z], ry = 0, col = '#e09a4a') {
      const q = grp(x, z, ry); q.position.y = y; const fur = Lm(col), w = Lm('#f7f2ea');
      const body = add(new SphereGeometry(0.16, 10, 8), fur, 0, 0.16, 0, 0, q); body.scale.set(0.85, 1.15, 1.05);
      add(new SphereGeometry(0.075, 8, 6), w, 0, 0.2, 0.12, 0, q); add(new SphereGeometry(0.11, 10, 8), fur, 0, 0.36, 0.05, 0, q);
      for (const sd of [-1, 1]) { const e = add(new ConeGeometry(0.045, 0.09, 4), fur, sd * 0.06, 0.47, 0.05, 0, q); e.rotation.z = -sd * 0.25; add(new SphereGeometry(0.016, 6, 4), Bm('#2a2a2a'), sd * 0.04, 0.38, 0.15, 0, q); }
      const tail = new Group(); tail.position.set(0, 0.06, -0.15); q.add(tail); const tl = add(new CylinderGeometry(0.022, 0.03, 0.32, 6), fur, 0, 0.15, -0.04, 0, tail); tl.rotation.x = -0.5;
      const ph = R() * 6; ticks.push(tt => { tail.rotation.z = Math.sin(tt * 1.8 + ph) * 0.45; });
    },
    // a quay: an iron railing along the water, bollards, fishing rods leaning out with their buckets
    quay(x0, x1, z, { rods = 0, bollards = 0 } = {}) {
      const len = x1 - x0; add(new BoxGeometry(len, 0.05, 0.05), iron, (x0 + x1) / 2, 0.95, z); add(new BoxGeometry(len, 0.04, 0.04), iron, (x0 + x1) / 2, 0.55, z);
      for (let x = x0; x <= x1 + 0.01; x += 0.9) add(new BoxGeometry(0.05, 0.95, 0.05), iron, x, 0.47, z);
      for (let k = 0; k < bollards; k++) { const x = x0 + (k + 0.5) * len / bollards; add(new CylinderGeometry(0.16, 0.2, 0.5, 10), iron, x, 0.25, z + 0.4); add(new CylinderGeometry(0.15, 0.15, 0.08, 10), snow, x, 0.53, z + 0.4); }
      for (let k = 0; k < rods; k++) {
        const x = x0 + 0.6 + k * (len - 1.2) / Math.max(1, rods - 1), rod = add(new CylinderGeometry(0.012, 0.025, 2.6, 5), Lm('#3a3036'), x, 1.3, z - 0.25); rod.rotation.x = -0.75; rod.position.z = z - 0.55;
        const tipZ = z - 0.55 - Math.sin(0.75) * 1.3, tipY = 1.3 + Math.cos(0.75) * 1.3, lineM = new Mesh(new CylinderGeometry(0.004, 0.004, tipY, 3), Bm('#f2eff6')); lineM.position.set(x, tipY / 2, tipZ); g.add(lineM);
        add(new CylinderGeometry(0.16, 0.13, 0.3, 10), Lm(['#2d6fb5', '#e8a10a', '#3f9b5a'][k % 3]), x + 0.35, 0.15, z + 0.35);
      }
    },
    // a grand old stone building of the bank street: a rusticated ground floor, columns, lit windows, a cornice under snow
    bank([x, z], { w = 5.6, h = 7.5, d = 4.4, col = '#e4d7c3', ry = 0 } = {}) {
      const q = grp(x, z, ry), stone = Lm(col), dark = Lm(new Color(col).multiplyScalar(0.82).getStyle()), lit = Bm('#ffd98a');
      add(new BoxGeometry(w, h, d), stone, 0, h / 2, 0, 0, q); add(new BoxGeometry(w + 0.1, 2.0, d + 0.1), dark, 0, 1.0, 0, 0, q);
      for (let y = 0.4; y < 2; y += 0.4) add(new BoxGeometry(w + 0.12, 0.04, d + 0.12), Lm('#9e8f7a'), 0, y, 0, 0, q); // rustication lines
      add(new BoxGeometry(w + 0.5, 0.35, d + 0.5), stone, 0, h + 0.1, 0, 0, q); add(new BoxGeometry(w + 0.45, 0.22, d + 0.45), snow, 0, h + 0.38, 0, 0, q);
      const cols = Math.max(4, Math.round(w / 1.1)); for (let k = 0; k < cols; k++) { const cx = -w / 2 + 0.5 + k * (w - 1) / (cols - 1); add(new CylinderGeometry(0.16, 0.18, h - 2.6, 10), Lm('#fbf5ea'), cx, 2.0 + (h - 2.6) / 2, d / 2 + 0.2, 0, q); add(new BoxGeometry(0.46, 0.18, 0.46), Lm('#fbf5ea'), cx, h - 0.6, d / 2 + 0.2, 0, q); add(new BoxGeometry(0.46, 0.14, 0.46), Lm('#fbf5ea'), cx, 2.05, d / 2 + 0.2, 0, q); }
      for (let k = 0; k < cols - 1; k++) { const cx = -w / 2 + 0.5 + (k + 0.5) * (w - 1) / (cols - 1); for (const fy of [3.0, 3.0 + (h - 3.4) / 2]) if (fy + 1.0 < h) add(new PlaneGeometry(0.52, 1.0), R() < 0.8 ? lit : Bm('#5d5468'), cx, fy + 0.5, d / 2 + 0.02, 0, q); add(new PlaneGeometry(0.6, 1.1), lit, cx, 1.0, d / 2 + 0.06, 0, q); }
      return q;
    },
    // the curving stone stairs climbing the hill off the bank street, two flights and a landing, iron rails
    stairs([x, z], ry = 0) {
      const q = grp(x, z, ry), stone = Lm('#efe8dc');
      for (let k = 0; k < 8; k++) add(new BoxGeometry(1.5, 0.2 + k * 0.2, 0.42), stone, -0.9, (0.2 + k * 0.2) / 2, -k * 0.42, 0, q);
      add(new BoxGeometry(3.4, 1.8, 1.4), stone, 0, 0.9, -3.9, 0, q);
      for (let k = 0; k < 8; k++) add(new BoxGeometry(1.5, 1.8 + 0.2 + k * 0.2, 0.42), stone, 0.9, (2.0 + k * 0.2) / 2, -3.4 + k * 0.42, 0, q);
      for (const [sx, y0, z0, dir] of [[-1.7, 1.0, 0, -1], [1.7, 2.6, -3.4, 1]]) { const r = add(new BoxGeometry(0.05, 0.05, 3.6), iron, sx, y0 + 0.9, z0 + dir * 1.6, 0, q); r.rotation.x = dir * 0.44; }
      add(new BoxGeometry(3.4, 0.12, 1.4), snow, 0, 1.86, -3.9, 0, q);
    },
    // a snowy flower bed with a few bright winter flowers poking through
    bed([x, z], w = 2.4, d = 0.8, cols = ['#e2406a', '#f6c14e', '#9a5ad6', '#ff8aa6']) {
      add(new BoxGeometry(w, 0.22, d), Lm('#b8ad9e'), x, 0.11, z); add(new BoxGeometry(w - 0.12, 0.08, d - 0.12), snow, x, 0.25, z);
      for (let k = 0; k < Math.round(w * 4); k++) add(new SphereGeometry(0.06, 6, 4), Bm(cols[k % cols.length]), x - w / 2 + 0.15 + R() * (w - 0.3), 0.32, z - d / 2 + 0.12 + R() * (d - 0.24));
    },
    // a tall dark cypress with a dusting of snow
    cypress([x, z], s2 = 1) { add(new CylinderGeometry(0.06 * s2, 0.5 * s2, 4.2 * s2, 8), Lm('#2b5446'), x, 2.1 * s2, z); add(new ConeGeometry(0.22 * s2, 0.6 * s2, 8), snow, x, 4.05 * s2, z); },
    // a round garden fountain with a little jet of water
    fountain([x, z]) {
      add(new CylinderGeometry(1.0, 1.1, 0.45, 18), Lm('#e9e2d6'), x, 0.22, z); add(new CylinderGeometry(0.88, 0.88, 0.05, 18), Lm('#a9d6ff'), x, 0.43, z); add(new CylinderGeometry(0.12, 0.18, 0.8, 10), Lm('#e9e2d6'), x, 0.7, z);
      const jet = add(new ConeGeometry(0.08, 0.5, 8), new MeshBasicMaterial({ color: '#dff1ff', transparent: true, opacity: 0.7 }), x, 1.35, z); ticks.push(tt => { jet.scale.y = 0.85 + 0.25 * Math.sin(tt * 5); });
    },
    // a rowing boat frozen into the ice
    boat([x, z], ry = 0, col = '#3d6fb0') { const q = grp(x, z, ry); const b = add(new SphereGeometry(1, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), Lm(col), 0, 0.3, 0, 0, q); b.scale.set(0.5, 0.35, 1.3); add(new BoxGeometry(0.9, 0.04, 2.3), snow, 0, 0.31, 0, 0, q); add(new BoxGeometry(0.9, 0.06, 0.18), wood, 0, 0.34, 0.2, 0, q); },
    // a flag pole with a flag waving
    flag([x, z], col = '#c8443c', h = 3.2) {
      add(new CylinderGeometry(0.04, 0.05, h, 6), Lm('#e8e8ef'), x, h / 2, z); const geo = new PlaneGeometry(0.9, 0.55, 8, 1), base = geo.attributes.position.array.slice(); const f = add(geo, new MeshLambertMaterial({ color: col, side: DoubleSide }), x + 0.45, h - 0.35, z);
      const ph = R() * 6; ticks.push(tt => { const a = geo.attributes.position.array; for (let k = 0; k < a.length; k += 3) { const u = (base[k] + 0.45) / 0.9; a[k + 2] = Math.sin(tt * 4 + u * 4 + ph) * 0.12 * u; } geo.attributes.position.needsUpdate = true; });
      return f;
    },
    // a little model in the park of models, on its plinth with a plaque
    model([x, z], kind, s2 = 1) {
      const q = grp(x, z); q.scale.setScalar(s2); const stone = Lm('#e2d8ca'), slate = Lm('#5d5f86'), red = Lm('#b4473a'), w = Lm('#f6f3f8');
      add(new BoxGeometry(1.6, 0.18, 1.6), Lm('#8f8a9e'), 0, 0.09, 0, 0, q); add(new BoxGeometry(0.5, 0.25, 0.04), Lm('#3d4a6b'), 0, 0.3, 0.85, 0, q);
      if (kind === 'galata') { add(new CylinderGeometry(0.26, 0.3, 1.6, 12), stone, 0, 1.0, 0, 0, q); add(new CylinderGeometry(0.33, 0.33, 0.08, 12), stone, 0, 1.82, 0, 0, q); add(new ConeGeometry(0.3, 0.6, 12), slate, 0, 2.15, 0, 0, q); add(new ConeGeometry(0.24, 0.2, 12), snow, 0, 1.98, 0, 0, q); }
      if (kind === 'maiden') { add(new CylinderGeometry(0.7, 0.7, 0.06, 16), Lm('#9fc8ec'), 0, 0.21, 0, 0, q); add(new SphereGeometry(0.35, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), Lm('#9a8f86'), 0, 0.22, 0, 0, q); add(new BoxGeometry(0.4, 0.3, 0.3), w, -0.1, 0.55, 0, 0, q); add(new CylinderGeometry(0.1, 0.12, 0.7, 10), w, 0.15, 0.75, 0, 0, q); add(new ConeGeometry(0.13, 0.25, 10), slate, 0.15, 1.22, 0, 0, q); }
      if (kind === 'clock') { add(new BoxGeometry(0.4, 1.8, 0.4), stone, 0, 1.08, 0, 0, q); add(new SphereGeometry(0.22, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), slate, 0, 1.98, 0, 0, q); add(new CircleGeometry(0.12, 12), Bm('#fff8e6'), 0, 1.6, 0.21, 0, q); }
      if (kind === 'bridge') { add(new BoxGeometry(1.4, 0.04, 0.5), Lm('#9fc8ec'), 0, 0.2, 0, 0, q); for (const sx of [-0.45, 0.45]) add(new BoxGeometry(0.08, 0.9, 0.08), red, sx, 0.6, 0, 0, q); add(new BoxGeometry(1.5, 0.06, 0.32), Lm('#5d6b8f'), 0, 0.42, 0, 0, q); }
      if (kind === 'fort') { for (const sx of [-0.5, 0.5]) { add(new CylinderGeometry(0.22, 0.24, 0.9, 10), stone, sx, 0.63, -0.2, 0, q); add(new ConeGeometry(0.26, 0.35, 10), slate, sx, 1.25, -0.2, 0, q); } add(new BoxGeometry(1.0, 0.5, 0.15), stone, 0, 0.43, -0.2, 0, q); }
      return q;
    },
    // a flock of city pigeons pecking at the snow, now and then one flutters up and lands again
    pigeons([x, z], n = 9) {
      const grey = Lm('#b4b9cc'), dark = Lm('#7a8098'), birds = [];
      for (let k = 0; k < n; k++) {
        const q = grp(x + (R() - 0.5) * 2.6, z + (R() - 0.5) * 1.8, R() * 6.28); q.scale.setScalar(1.35); const body = add(new SphereGeometry(0.11, 8, 6), grey, 0, 0.11, 0, 0, q); body.scale.set(0.8, 0.8, 1.3);
        const head = new Group(); head.position.set(0, 0.17, 0.11); q.add(head); add(new SphereGeometry(0.055, 8, 6), dark, 0, 0, 0.02, 0, head); add(new ConeGeometry(0.015, 0.05, 4), Lm('#e8a10a'), 0, -0.01, 0.08, 0, head).rotation.x = Math.PI / 2;
        add(new BoxGeometry(0.1, 0.02, 0.12), dark, 0, 0.12, -0.14, 0, q);
        birds.push({ q, head, ph: R() * 6, hop: R() * 7, x0: q.position.x, z0: q.position.z });
      }
      ticks.push(tt => birds.forEach(b => { b.head.rotation.x = Math.max(0, Math.sin(tt * 3 + b.ph)) * 0.9; const u = ((tt + b.hop) % 7) / 7; b.q.position.y = u > 0.9 ? Math.sin((u - 0.9) / 0.1 * Math.PI) * 0.6 : 0; }));
    },
    // a see-saw in the park, rocking
    seesaw([x, z], ry = 0) {
      const q = grp(x, z, ry); add(new BoxGeometry(0.3, 0.45, 0.3), Lm('#c8443c'), 0, 0.22, 0, 0, q);
      const arm = new Group(); arm.position.y = 0.48; q.add(arm); add(new BoxGeometry(2.6, 0.08, 0.32), Lm('#e8a10a'), 0, 0, 0, 0, arm); add(new BoxGeometry(2.5, 0.05, 0.3), snow, 0, 0.06, 0, 0, arm);
      for (const sd of [-1, 1]) add(new BoxGeometry(0.05, 0.3, 0.3), iron, sd * 1.05, 0.18, 0, 0, arm);
      ticks.push(tt => { arm.rotation.z = Math.sin(tt * 1.4) * 0.22; });
    },
    // a wooden sled with its rope, left in the snow
    sled([x, z], ry = 0, col = '#c8443c') { const q = grp(x, z, ry); add(new BoxGeometry(0.55, 0.06, 1.1), Lm(col), 0, 0.2, 0, 0, q); for (const sd of [-1, 1]) { add(new BoxGeometry(0.05, 0.05, 1.2), iron, sd * 0.24, 0.05, 0, 0, q); for (const zz of [-0.35, 0.35]) add(new BoxGeometry(0.04, 0.15, 0.04), iron, sd * 0.24, 0.12, zz, 0, q); } const tip = add(new BoxGeometry(0.5, 0.05, 0.2), iron, 0, 0.12, 0.62, 0, q); tip.rotation.x = 0.7; },
    // a wooden rack of arrows with red fletching, by the targets
    quiver([x, z], ry = 0) {
      const q = grp(x, z, ry); add(new BoxGeometry(1.2, 0.08, 0.3), wood, 0, 0.5, 0, 0, q); for (const sd of [-1, 1]) add(new BoxGeometry(0.08, 0.9, 0.08), wood, sd * 0.55, 0.45, 0, 0, q);
      for (let k = 0; k < 7; k++) { const ax = -0.45 + k * 0.15; add(new CylinderGeometry(0.012, 0.012, 1.0, 4), Lm('#d9b07a'), ax, 0.6, 0, 0, q); add(new BoxGeometry(0.01, 0.1, 0.07), Lm(k % 2 ? '#c8443c' : '#f6f3f8'), ax, 1.05, 0, 0, q); }
    },
    // a line of little triangular pennants between posts, fluttering
    pennants(points, { y = 2.8, cols = ['#c8443c', '#f6c14e', '#2d6fb5', '#3f9b5a', '#ffffff'] } = {}) {
      const tri = new BufferGeometry(); tri.setAttribute('position', new Float32BufferAttribute([-0.13, 0, 0, 0.13, 0, 0, 0, -0.3, 0], 3)); tri.computeVertexNormals(); const flags = [];
      for (let k = 0; k < points.length - 1; k++) { const [x0, z0] = points[k], [x1, z1] = points[k + 1], n = Math.max(4, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.45)), ry = Math.atan2(-(z1 - z0), x1 - x0);
        for (let u = 0; u < n; u++) { const f = (u + 0.5) / n, m = new Mesh(tri, new MeshLambertMaterial({ color: cols[(k + u) % cols.length], side: DoubleSide })); m.position.set(x0 + (x1 - x0) * f, y - Math.sin(f * Math.PI) * 0.3, z0 + (z1 - z0) * f); m.rotation.y = ry; g.add(m); flags.push(m); } }
      ticks.push(tt => flags.forEach((m, k) => { m.rotation.x = Math.sin(tt * 3.5 + k) * 0.35; }));
    },
  };
  return kit;
}
// a scene's street life: build it, and step its little animations
const life = build => g => { const k = lifeKit(g); build(k); return (t) => { for (const f of k.ticks) f(t); }; };

// ---------- a scene: the neighbourhood, the layer over it, the light and the shots ----------
function vista({ hood, light, shots, wide, far = [], extra = null }) {
  return ({ camera = null } = {}) => {
    const g = new Group(), world = neighbourhood(hood); g.add(world.group);
    world.group.traverse(o => { if (o.isMesh && !o.material?.transparent) o.castShadow = o.receiveShadow = true; });
    sky(g, { ...light, seed: hood.seed }); const hH = townscape(g, light, { seed: hood.seed, sea: !!hood.sea }); skyline(g, light, hH, far);
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
  hood: { landmark: 'treehouse', seed: 11, flag: '#3f9b5a', trees: 'TTvT', tiles: [...[24, 28].flatMap(j => [['b', 16, j], ['b', 30, j]]), ...[28, 31].flatMap(j => [['l', 15, j], ['l', 31, j]]), ['l', 17, 12], ['l', 28, 12], ['n', 12, 21], ['n', 34, 19]], props: [
    ...[0, 1, 2].flatMap(k => [{ type: 'plane-tree', i: CX - 6, j: CZ + 7 + k * 4, w: 2, h: 2 }, { type: 'plane-tree', i: CX + 4, j: CZ + 7 + k * 4, w: 2, h: 2 }]),
    { type: 'stall', kind: 'chestnut', i: CX - 9, j: CZ + 2, w: 2, h: 1 }, { type: 'stall', kind: 'salep', i: CX + 7, j: CZ + 2, w: 2, h: 1 }] },
  light: { sun: '#fff3dc', intensity: 2.0, sky: '#e6eeff', ground: '#9b93c8', dir: [-0.45, 0.62, -0.62], top: '#5d93e0', horizon: '#dbe7fb', far: '#a6b4d8', fog: '#dbe7fb' },
  shots: [
    move(0, 2.6, [at(-2, 1.8, 22), at(0, 3.6, 0)], [at(-1.2, 3.2, 14), at(0, 4.3, 0)]), // down the avenue of plane trees to the tree
    orbit(2.6, 5.0, { r: [12, 10.5], a: [0.6, -0.3], y: [3, 7.5], look: [at(0, 4, 0), at(0, 5.6, 0)] }), // up and round to the fort
    move(5.0, 7.2, [at(-1, 11, 15), at(0, 3.2, 0)], [at(-1, 17.5, 25), at(0, 2.4, -1)]), // up the middle of the avenue, over the park and the town
  ],
  wide: [at(-11, 11, 20), at(0, 3, -1)],
  extra: life(k => {
    k.bed(rel(-3.4, 4.0), 1.6, 0.7); k.bed(rel(3.4, 4.0), 1.6, 0.7); k.cat(up(rel(3.0, 4.0), 0.3), -0.5, '#e09a4a'); // close by the landmark, in view even on a phone
    k.lights([rel(-5, 7.5), rel(-5, 11.5), rel(-5, 15.5)], { y: 3.4 }); k.lights([rel(5, 7.5), rel(5, 11.5), rel(5, 15.5)], { y: 3.4 }); // lights strung down the avenue of plane trees
    k.steam(up(rel(-8.5, 2.5), 1.3), 0.45); k.steam(up(rel(7.5, 2.5), 1.3), 0.45); // the chestnut and salep stalls steaming
    k.cafe(rel(-11.5, 3.5), '#3f9b5a'); k.cafe(rel(11, 4), '#c8443c'); k.sled(rel(-8.6, 9), 0.5, '#2d6fb5');
    k.bed(rel(-9, -4), 2.4, 0.8); k.bed(rel(9, -4), 2.4, 0.8, ['#ffffff', '#e2406a']);
    k.pigeons(rel(-9, 6.5), 7); k.cat(up(tw(16, 24), 0.55), 0.3, '#3b3b44'); k.flag(rel(-6.5, -2.5), '#3f9b5a', 3.6); k.flag(rel(6.5, -2.5), '#3f9b5a', 3.6);
  }),
  far: [{ kind: 'ridge', a: -0.25, r: 205, s: 1.3, n: 3, span: 0.45 }, { kind: 'galata', a: 0.42, r: 150, s: 1.4 }], // down the valley: the old city's domes across the water, Galata Tower on its hill
});
// Archery Ground (bright late afternoon, long shadows): the archers' lodge with its lead domes and
// golden bow, the old record stones in a row, straw targets, pennants, houses round the ground.
const archery = vista({
  hood: { landmark: 'archers-lodge', seed: 21, flag: '#c8443c', trees: 'xvxT', tiles: [['b', 30, 19], ['b', 32, 19], ['b', 34, 19], ['l', 17, 11], ['l', 29, 11], ['l', 13, 22], ['l', 35, 15]], props: [
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
  extra: life(k => {
    k.bed(rel(-3.4, 4.0), 1.6, 0.7); k.bed(rel(3.4, 4.0), 1.6, 0.7); k.cat(up(rel(3.0, 4.0), 0.3), -0.5, '#e09a4a'); // close by the landmark, in view even on a phone
    k.quiver(rel(8.5, 4.2)); k.quiver(rel(11.5, 4.2)); // arrow racks by the straw targets
    k.pennants([rel(-14, -5.5), rel(-9, -5.5), rel(-4.5, -5.5)], { y: 3.2 }); k.pennants([rel(4.5, -5.5), rel(9, -5.5), rel(14, -5.5)], { y: 3.2 }); // pennants along the back of the ground
    for (const x of [-12, -8.5, 8.5, 12]) k.flag(rel(x, -6.2), x < 0 ? '#c8443c' : '#f6c14e', 4.0);
    k.cafe(rel(-13.5, -1), '#c8443c'); k.cafe(rel(-11, -2.4), '#f2f2f2'); k.steam(up(rel(-9.5, 1.5), 1.3), 0.45); // a tea garden by the salep stall
    k.cypress(rel(-15.5, -3), 1.1); k.cypress(rel(15.5, -3), 1.1); k.cypress(rel(-17, 2), 1.0); k.cypress(rel(17, 2), 1.0);
    k.cat(up(tw(32, 19), 0.55), -0.2, '#f2ede4'); k.pigeons(rel(-6, 11.5), 6);
  }),
  far: [{ kind: 'ridge', a: 0.12, r: 215, s: 1.5, n: 3, span: 0.6 }, { kind: 'galata', a: -0.5, r: 165, s: 1.35 }], // from the hilltop ground: down over the Golden Horn to the old city, Galata Tower to the left
});
// Kızılay Square (a lavender afternoon, the lamps coming on): the tiled fountain kiosk in the middle
// of the square, simit, tea and roasted-corn stalls, plane trees, the houses all round.
const kizilay = vista({
  hood: { landmark: 'fountain', seed: 31, flag: '#35b0b0', trees: 'vTvT', plazaR: 5.5, tiles: [...[13, 17].flatMap(j => [['b', 13, j], ['b', 32, j]]), ['l', 17, 9], ['l', 29, 9], ['l', 12, 20], ['l', 34, 20], ['b', 21, 9], ['b', 24, 9]], props: [
    { type: 'stall', kind: 'simit', i: CX - 5, j: CZ + 4, w: 2, h: 1 }, { type: 'stall', kind: 'cay', i: CX + 3, j: CZ + 4, w: 2, h: 1 }, { type: 'stall', kind: 'corn', i: CX + 7, j: CZ - 3, w: 2, h: 1 },
    { type: 'plane-tree', i: CX - 11, j: CZ + 6, w: 2, h: 2 }, { type: 'plane-tree', i: CX + 9, j: CZ + 6, w: 2, h: 2 }, { type: 'plane-tree', i: CX - 11, j: CZ - 4, w: 2, h: 2 }] },
  light: { sun: '#f3e4ff', intensity: 1.7, sky: '#e6dcf5', ground: '#8f86bf', dir: [-0.4, 0.4, -0.82], top: '#7c7fd0', horizon: '#ead7ee', far: '#a69cc8', fog: '#e4d6ec', dusk: 0.45 },
  shots: [
    move(0, 2.6, [at(0.5, 1.6, 19), at(0, 2.3, 0)], [at(0.3, 2.4, 12), at(0, 2.5, 0)]), // across the square to the kiosk
    orbit(2.6, 5.0, { r: [11, 9.5], a: [1.0, -0.6], y: [2.6, 3.6], look: [at(0, 2.5, 0), at(0, 2.7, 0)] }), // round the kiosk
    move(5.0, 7.2, [at(-4, 5, 10), at(0, 2, 0)], [at(-9, 15, 18), at(0, 1.4, -1)]), // up over the square
  ],
  wide: [at(-7, 12, 18), at(0, 2, 0)],
  extra: life(k => {
    k.bed(rel(-1.7, 6.6), 1.4, 0.6); k.bed(rel(1.7, 6.6), 1.4, 0.6); k.cat(up(rel(1.4, 6.6), 0.3), -0.5, '#e09a4a'); // between the stalls // close by the landmark, in view even on a phone
    k.pigeons(rel(-2.2, 6.8), 12); k.pigeons(rel(5.5, 3.2), 7); // the square's pigeons
    k.cafe(rel(-11.5, 1.2), '#35b0b0'); k.cafe(rel(-12.5, -1.6), '#f2f2f2'); k.cafe(rel(11.5, 0.6), '#c8443c'); // tea gardens round the square
    k.lights([rel(-9, -5), rel(-4.5, -6.5), rel(0, -7), rel(4.5, -6.5), rel(9, -5)], { y: 3.4 }); // lights strung across the back of the square
    k.steam(up(rel(-4, 4.5), 1.3), 0.4); k.steam(up(rel(4, 4.5), 1.3), 0.4); k.steam(up(rel(8, -2.5), 1.3), 0.4);
    k.bed(rel(-8, -3.5), 2.2, 0.8); k.bed(rel(8, 3.6), 2.0, 0.8, ['#ffffff', '#9a5ad6']);
    k.cat(up(tw(13, 13), 0.55), 0.6, '#3b3b44'); k.flag(rel(-6.2, -4.2), '#35b0b0', 3.6); k.flag(rel(6.2, -4.2), '#35b0b0', 3.6);
  }),
  far: [{ kind: 'galata', a: 0.12, r: 130, s: 1.5 }, { kind: 'towers', a: -0.55, r: 235, n: 7, span: 0.28 }], // up the hill to Galata Tower; the city's tall towers far off
});
// Sururi Park (golden hour): the snow castle being built, slides and swings, the giant snowman with
// its ladder, a corn stall, pines all round.
const sururi = vista({
  hood: { landmark: 'snow-castle', seed: 41, flag: '#e8a10a', trees: 'yxyT', tiles: [...[12, 16].flatMap(j => [['b', 13, j], ['b', 33, j]]), ['l', 17, 10], ['l', 29, 10], ['l', 12, 21], ['l', 35, 21], ['n', 15, 21], ['n', 31, 13], ['n', 34, 24]], props: [
    { type: 'slide', i: CX + 8, j: CZ + 5, w: 2, h: 2 }, { type: 'swings', i: CX - 10, j: CZ + 5, w: 2, h: 2 }, { type: 'giant-snowman', i: CX + 8, j: CZ - 3, w: 2, h: 2 },
    { type: 'stall', kind: 'corn', i: CX - 9, j: CZ - 2, w: 2, h: 1 }] },
  light: { sun: '#ffd28a', intensity: 2.2, sky: '#fbe7cf', ground: '#a88fb4', dir: [-0.82, 0.24, -0.5], top: '#7f8fd1', horizon: '#ffd9a8', far: '#c0a5b8', fog: '#f6d9bf', sunSize: 90, dusk: 0.25 },
  shots: [
    move(0, 2.6, [at(11, 1.8, 17), at(1, 3, 0)], [at(7, 5, 14), at(0, 3.2, 0)]), // in past the slide
    orbit(2.6, 5.0, { r: [13, 11.5], a: [-0.8, 0.25], y: [3.5, 5], look: [at(0, 3.1, 0), at(0, 3.5, 0)] }), // round the towers
    move(5.0, 7.2, [at(0, 9, 12), at(0, 2.6, -1)], [at(0, 17, 22), at(0, 1.6, -3)]), // high over the park
  ],
  wide: [at(0, 12, 20), at(0, 2.5, -1)],
  extra: life(k => {
    k.bed(rel(-3.4, 4.0), 1.6, 0.7); k.bed(rel(3.4, 4.0), 1.6, 0.7); k.cat(up(rel(3.0, 4.0), 0.3), -0.5, '#e09a4a'); // close by the landmark, in view even on a phone
    k.seesaw(rel(-8.6, -2.6), 0.3); k.sled(rel(-5.8, 6.4), -0.4, '#e8a10a'); k.sled(rel(10.6, 1.4), 0.8, '#2d6fb5'); k.sled(rel(-12, 7.5), 0.2, '#3f9b5a'); // sleds left in the snow, a see-saw rocking
    k.pennants([rel(-6, -6), rel(-2, -7), rel(2, -7), rel(6, -6)], { y: 4.0 }); // pennants over the castle
    k.lights([rel(-14, 2.5), rel(-10, 1.5), rel(-6.5, 2.5)], { y: 2.8 }); k.lights([rel(6.5, 2.5), rel(10, 1.5), rel(14, 2.5)], { y: 2.8 });
    k.steam(up(rel(-8.5, -1.5), 1.3), 0.45); k.cat(up(tw(13, 12), 0.55), 0.4, '#e09a4a'); k.pigeons(rel(4.5, 6.5), 6);
    k.flag(rel(-6, -3.6), '#e8a10a', 3.8); k.flag(rel(6, -3.6), '#e8a10a', 3.8);
  }),
  far: [{ kind: 'towers', a: 0.28, r: 240, n: 9, span: 0.35 }, { kind: 'cypresses', a: -0.45, r: 120, n: 120 }, { kind: 'galata', a: -0.85, r: 170, s: 1.2 }], // the towers of Şişli lit by the low sun, a cypress hill
});
// The Pier (sunset, the lamps lit): the admiral and his lion on the quay, the frozen Golden Horn
// behind with a ferry stuck in the ice, the wooden pier and the ferry building, the far shore.
const pier = vista({
  hood: { landmark: 'admiral', seed: 51, flag: '#e8584a', sea: 11, trees: 'xTx', plazaR: 5, tiles: [...[5, 8, 11, 35, 38, 41].map(i => ['l', i, 11]), ...[6, 9, 12, 36, 39].map(i => ['b', i, 12]), ...[16, 20].flatMap(j => [['T', 5, j], ['T', 40, j]]), ['l', 17, 19], ['l', 28, 19]], props: [
    { type: 'pier', i: CX - 8, j: 5, w: 2, h: 3, along: 'z' }, { type: 'iskele', i: CX + 6, j: 8, w: 4, h: 2, along: 'x', dir: 1 }, { type: 'ferry', i: CX - 2, j: 2, w: 5, h: 2, along: 'x' },
    { type: 'stall', kind: 'fish', i: CX - 10, j: CZ + 2, w: 2, h: 1 }] },
  light: { sun: '#ffb38a', intensity: 1.9, sky: '#f6d6dc', ground: '#8f7fb8', dir: [-0.6, 0.18, -0.78], top: '#6c6fc4', horizon: '#ffc1a4', far: '#9b88b4', fog: '#f2c6bc', sunDisc: '#ffb070', sunSize: 95, dusk: 0.8 },
  shots: [
    move(0, 2.6, [at(-7, 1.8, 15), at(0, 3.4, -1)], [at(-4, 3, 10), at(0, 3.8, -1)]), // the statue against the sunset
    orbit(2.6, 5.0, { r: [10, 9], a: [0.7, -0.5], y: [2.5, 3.6], look: [at(0, 3.4, 0), at(0, 3.6, 0)] }), // round the admiral and his lion
    move(5.0, 7.2, [at(2, 5, 8), at(0, 1.2, -10)], [at(6, 12, 16), at(0, 0.8, -26)]), // out over the frozen Golden Horn
  ],
  wide: [at(4, 10, 16), at(0, 1.5, -8)],
  extra: life(k => {
    k.bed(rel(-3.4, 4.0), 1.6, 0.7); k.bed(rel(3.4, 4.0), 1.6, 0.7); k.cat(up(rel(3.0, 4.0), 0.3), -0.5, '#e09a4a'); // close by the landmark, in view even on a phone
    k.quay(-19, -10, -4.4, { rods: 4, bollards: 2 }); k.quay(10, 19, -4.4, { rods: 4, bollards: 2 }); // the quay: rods out over the ice, buckets, bollards
    k.lights([rel(-17.5, -3.6), rel(-14.5, -3.6), rel(-11.5, -3.6)]); k.lights([rel(12.5, -3.6), rel(15.5, -3.6), rel(18.5, -3.6)]);
    k.cafe(rel(-12.5, 1.5), '#e8584a'); k.cafe(rel(12, 2), '#2d6fb5'); k.cafe(rel(14.5, 0.4), '#f2f2f2'); k.steam(up(rel(-9.5, 2.5), 1.3), 0.4);
    k.boat(rel(-14, -9), 0.5, '#c8443c'); k.boat(rel(15, -8.5), -0.4, '#3d6fb0');
    k.cat(up(tw(36, 12), 0.55), -0.3, '#3b3b44'); k.pigeons(rel(-6.5, 3), 6); k.flag(rel(-6.5, -2.4), '#e8584a', 3.8); k.flag(rel(6.5, -2.4), '#2d6fb5', 3.8);
  }),
  far: [{ kind: 'ridge', a: 0.05, r: 165, s: 1.5, n: 3, span: 0.7 }, { kind: 'bridge', type: 'metro', r: 120, a0: -0.8, a1: -0.15 }], // across the Golden Horn: the old city's ridge of domes, the bridges to the left
});


// ---------- Arena 2: up the Golden Horn, from a bright morning at its mouth to dusk at Miniatürk ----------
// Karaköy Pier (a clear blue morning, mist on the water): the bridge with its row of
// fishermen's rods, the pier hall, ferries in the ice, the far shore.
const karakoy = vista({
  hood: { landmark: 'karakoy', seed: 61, flag: '#2d6fb5', sea: 11, trees: 'xTx', plazaR: 5, tiles: [...[5, 8, 11, 14, 32, 35, 38, 41].map(i => ['l', i, 11]), ...[6, 9, 12, 33, 36, 39].map(i => ['b', i, 12]), ...[15, 19, 23].flatMap(j => [['T', 6, j], ['T', 39, j]]), ['n', 12, 17], ['l', 17, 19], ['l', 28, 19]], props: [
    { type: 'ferry', i: CX - 12, j: 3, w: 5, h: 2, along: 'x' }, { type: 'ferry', i: CX + 7, j: 6, w: 5, h: 2, along: 'x' }, { type: 'pier', i: CX + 7, j: 9, w: 2, h: 3, along: 'z' },
    { type: 'stall', kind: 'fish', i: CX - 10, j: CZ + 2, w: 2, h: 1 }, { type: 'stall', kind: 'simit', i: CX + 7, j: CZ + 2, w: 2, h: 1 }] },
  light: { sun: '#fff1d6', intensity: 2.0, sky: '#e2ecff', ground: '#9a94c6', dir: [0.5, 0.5, -0.7], top: '#5a8ede', horizon: '#dbe8fb', far: '#a3b3d8', fog: '#d8e5f8' },
  shots: [
    move(0, 2.6, [at(-8, 1.6, 14), at(0, 2.2, -1)], [at(-4.5, 2.6, 9.5), at(0, 2.4, -1)]), // along the quay to the bridge and its rods
    orbit(2.6, 5.0, { r: [10, 9], a: [-0.8, 0.5], y: [2.4, 3.4], look: [at(0, 2.0, -0.5), at(0, 2.2, -0.5)] }), // round the pier hall and the ferry
    move(5.0, 7.2, [at(2, 5, 8), at(0, 1.2, -10)], [at(5, 12, 16), at(0, 0.8, -26)]), // up and out over the frozen water
  ],
  wide: [at(3, 9, 15), at(0, 1.5, -6)],
  extra: life(k => {
    k.bed(rel(-3.4, 4.0), 1.6, 0.7); k.bed(rel(3.4, 4.0), 1.6, 0.7); k.cat(up(rel(3.0, 4.0), 0.3), -0.5, '#e09a4a'); // close by the landmark, in view even on a phone
    k.quay(-19, -6.5, -4.4, { rods: 6, bollards: 3 }); k.quay(6.5, 19, -4.4, { rods: 6, bollards: 3 }); // the quay: rods out over the ice, buckets, bollards
    k.lights([rel(-17.5, -3.6), rel(-14.5, -3.6), rel(-11.5, -3.6), rel(-8.5, -3.6)]); k.lights([rel(9.5, -3.6), rel(12.5, -3.6), rel(15.5, -3.6), rel(18.5, -3.6)]);
    k.cafe(rel(-10.5, 1.5), '#2d6fb5'); k.cafe(rel(-13.5, 2.5), '#f2f2f2'); k.cafe(rel(11, 1.8), '#e8a10a');
    k.cat(up(tw(9, 12), 0.55), 0.3, '#e09a4a'); k.cat(up(rel(15.2, -3.9), 0.53), -0.4, '#3b3b44');
    k.flag(rel(-7, -2), '#c8443c', 3.6); k.flag(rel(7, -2), '#2d6fb5', 3.6);
  }),
  far: [{ kind: 'bridge', type: 'galata', r: 70, a0: -0.95, a1: 0.95 }, { kind: 'ridge', a: -0.2, r: 168, s: 1.6, n: 3, span: 0.8 }], // Galata Bridge right across with its rods and lamps, the old city's domes beyond
});
// Bankers Street (bright noon): the street of grand old banks, the great stone bank building at
// its heart with its columns and bronze door, lamps, a simit and a tea stall, plane trees.
const bankalar = vista({
  hood: { landmark: 'bankalar', seed: 71, flag: '#7a1f1f', trees: 'TvTT', plazaR: 5, tiles: [...[25, 29].flatMap(j => [['l', 16, j], ['l', 30, j]]), ...[19, 23, 27].flatMap(j => [['T', 12, j], ['T', 34, j]]), ...[21, 25].flatMap(j => [['b', 13, j], ['b', 33, j]]), ['l', 17, 19], ['l', 28, 19]], props: [
    { type: 'plane-tree', i: CX - 9, j: CZ + 5, w: 2, h: 2 }, { type: 'plane-tree', i: CX + 7, j: CZ + 5, w: 2, h: 2 },
    { type: 'stall', kind: 'simit', i: CX - 6, j: CZ + 4, w: 2, h: 1 }, { type: 'stall', kind: 'cay', i: CX + 4, j: CZ + 4, w: 2, h: 1 }] },
  light: { sun: '#fffaf0', intensity: 2.25, sky: '#eef0fb', ground: '#a49dc8', dir: [-0.3, 0.75, -0.55], top: '#6f9ae0', horizon: '#e7eefb', far: '#b0b8d8', fog: '#e6ecf8' },
  shots: [
    move(0, 2.6, [at(0.5, 1.4, 16), at(0, 2.4, 0)], [at(0.3, 2.2, 10), at(0, 2.9, 0)]), // up the street to the great door
    orbit(2.6, 5.0, { r: [10, 9], a: [0.8, -0.6], y: [2.2, 3.6], look: [at(0, 2.6, 0), at(0, 3.0, 0)] }), // along the columns
    move(5.0, 7.2, [at(-3, 6, 9), at(0, 2.5, 0)], [at(-7, 14, 18), at(0, 1.8, -1)]), // over the rooftops of the street
  ],
  wide: [at(-6, 11, 18), at(0, 2.5, 0)],
  extra: life(k => {
    k.bed(rel(-3.4, 4.0), 1.6, 0.7); k.bed(rel(3.4, 4.0), 1.6, 0.7); k.cat(up(rel(3.0, 4.0), 0.3), -0.5, '#e09a4a'); // close by the landmark, in view even on a phone
    k.bank(rel(-10.4, -4.2), { w: 5, h: 5.8, col: '#efe0c4' }); k.bank(rel(10.4, -4.2), { w: 5, h: 5.4, col: '#ead7c0' }); // the street of grand old banks
    k.bank(rel(-16.2, -4.8), { w: 5, h: 6.4, col: '#e6d2b8' }); k.bank(rel(16.2, -4.8), { w: 5, h: 6.8, col: '#f0e4d0' });
    k.stairs(rel(6.6, -4.6)); // the curving stairs up the hill beside the bank
    k.flag(rel(-10.4, -1.2), '#c8443c', 3.4); k.flag(rel(10.4, -1.2), '#c8443c', 3.4);
    k.bed(rel(-6.5, 4.2), 2.2, 0.7); k.bed(rel(6.5, 4.2), 2.2, 0.7);
    k.cat(up(tw(13, 21), 0.55), 0.4, '#f2ede4'); k.cat(up(rel(-3.2, 3.4), 0), 0.8, '#e09a4a');
  }),
  far: [{ kind: 'galata', a: 0.24, r: 118, s: 1.35 }, { kind: 'towers', a: 0.62, r: 265, n: 6, span: 0.22 }], // Galata Tower up the hill at the top of the street
});
// Tersane İstanbul (golden afternoon): the old shipyard on the water: the brick workshop and its
// chimney, the dry dock with a ship, the crane, the new promenade under its glass canopy.
const tersane = vista({
  hood: { landmark: 'tersane', seed: 81, flag: '#e8a10a', sea: 10, trees: 'xvx', plazaR: 5, tiles: [...[5, 8, 11, 14, 32, 35, 38, 41].map(i => ['l', i, 10]), ...[6, 9, 12, 33, 36, 39].map(i => ['b', i, 11]), ...[15, 19, 23].flatMap(j => [['T', 5, j], ['T', 40, j]]), ['z', 30, 12], ['z', 31, 12], ['z', 30, 13], ['f', 15, 19], ['f', 31, 19], ['l', 17, 19], ['l', 28, 19]], props: [
    { type: 'ferry', i: CX - 11, j: 4, w: 5, h: 2, along: 'x' }, { type: 'stall', kind: 'cay', i: CX - 10, j: CZ + 2, w: 2, h: 1 }, { type: 'stall', kind: 'chestnut', i: CX + 7, j: CZ + 2, w: 2, h: 1 }] },
  light: { sun: '#ffdca8', intensity: 2.2, sky: '#f6e8d8', ground: '#a693bc', dir: [-0.75, 0.32, -0.55], top: '#7790d6', horizon: '#f8dcbc', far: '#b6a7c4', fog: '#f0dcc8', sunSize: 85, dusk: 0.2 },
  shots: [
    move(0, 2.6, [at(-9, 1.6, 13), at(0, 1.8, 0)], [at(-5.5, 2.4, 9), at(0, 2.0, 0)]), // along the promenade under the canopy
    orbit(2.6, 5.0, { r: [11, 9.5], a: [-0.5, 0.6], y: [2.6, 4.2], look: [at(0, 2.0, -0.8), at(0, 2.6, -0.8)] }), // round the workshop and the dry dock
    move(5.0, 7.2, [at(3, 7, 9), at(0, 2.4, -1)], [at(7, 15, 18), at(0, 1.4, -6)]), // up past the crane over the water
  ],
  wide: [at(4, 10, 16), at(0, 2, -2)],
  extra: life(k => {
    k.bed(rel(-3.4, 4.0), 1.6, 0.7); k.bed(rel(3.4, 4.0), 1.6, 0.7); k.cat(up(rel(3.0, 4.0), 0.3), -0.5, '#e09a4a'); // close by the landmark, in view even on a phone
    k.quay(-19, -6, -5.4, { bollards: 4 }); k.quay(6, 19, -5.4, { bollards: 4 });
    for (const [x, z, c] of [[-8.5, 1.2, '#c8443c'], [-11, 2.6, '#f2f2f2'], [-13.5, 1.0, '#e8a10a'], [8.8, 1.6, '#2d6fb5'], [11.4, 3.0, '#c8443c'], [13.8, 1.2, '#f2f2f2']]) k.cafe(rel(x, z), c); // the promenade's café terraces
    k.lights([rel(-15, 4.2), rel(-12, 0.2), rel(-9, 4.2), rel(-6.5, 0.4)], { y: 2.9 }); k.lights([rel(6.5, 0.4), rel(9, 4.2), rel(12, 0.2), rel(15, 4.2)], { y: 2.9 });
    k.lights([rel(-18, -4.8), rel(-12, -4.8), rel(-6.5, -4.8)], { y: 2.4 }); k.lights([rel(6.5, -4.8), rel(12, -4.8), rel(18, -4.8)], { y: 2.4 });
    k.cat(up(rel(-11, 2.6), 0), 1.2, '#3b3b44'); k.cat(up(tw(33, 11), 0.55), -0.3, '#e09a4a');
    k.flag(rel(-6, -3.4), '#e8a10a', 3.4); k.flag(rel(6, -3.4), '#c8443c', 3.4);
  }),
  far: [{ kind: 'redschool', a: -0.22, r: 150, s: 1.4 }, { kind: 'ridge', a: 0.22, r: 168, s: 1.3, n: 2, span: 0.45 }, { kind: 'bridge', type: 'metro', r: 100, a0: -0.95, a1: -0.3 }], // across the water: the red school on the hill at Fener, domes on the ridge, the metro bridge to the left
});
// Aynalıkavak Pavilion (pink sunset): the pavilion on its stone base, wide eaves, mirror-bright
// windows catching the sunset, cypresses and the pool, the Golden Horn behind.
const aynalikavak = vista({
  hood: { landmark: 'aynalikavak', seed: 91, flag: '#c8443c', sea: 9, trees: 'xyxT', plazaR: 5, tiles: [['l', 17, 19], ['l', 28, 19], ['b', 16, 21], ['b', 29, 21], ['l', 18, 24], ['l', 27, 24], ['l', 14, 12], ['l', 31, 12]], props: [
    { type: 'pier', i: CX - 7, j: 4, w: 2, h: 3, along: 'z' }, { type: 'stall', kind: 'salep', i: CX + 7, j: CZ + 2, w: 2, h: 1 }] },
  light: { sun: '#ffb79a', intensity: 1.9, sky: '#f6d8e0', ground: '#9285bd', dir: [-0.7, 0.2, -0.68], top: '#7273c8', horizon: '#ffc6ae', far: '#a28fb8', fog: '#f2cbc2', sunDisc: '#ffb878', sunSize: 95, dusk: 0.65 },
  shots: [
    move(0, 2.6, [at(0.6, 1.3, 14), at(0, 1.4, 0)], [at(0.3, 1.8, 8.5), at(0, 1.8, 0)]), // low across the pool to the steps
    orbit(2.6, 5.0, { r: [9, 8], a: [0.9, -0.5], y: [2.0, 3.0], look: [at(0, 1.6, -0.5), at(0, 1.9, -0.5)] }), // round the eaves, the windows catching the sunset
    move(5.0, 7.2, [at(-2, 5, 7), at(0, 1.4, -6)], [at(-5, 12, 15), at(0, 0.8, -22)]), // over the roof to the water
  ],
  wide: [at(-5, 9, 15), at(0, 1.5, -4)],
  extra: life(k => {
    k.bed(rel(-3.4, 4.0), 1.6, 0.7); k.bed(rel(3.4, 4.0), 1.6, 0.7); k.cat(up(rel(3.0, 4.0), 0.3), -0.5, '#e09a4a'); // close by the landmark, in view even on a phone
    for (const x of [-8, -10, -12, -14]) { k.cypress(rel(x, -1.5 + (x % 4 ? 0 : 0.6)), 1.15); k.cypress(rel(-x, -1.5 + (x % 4 ? 0 : 0.6)), 1.15); } // rows of cypresses along the garden
    for (const z of [3, 6]) { k.cypress(rel(-11, z), 1.0); k.cypress(rel(11, z), 1.0); }
    k.bed(rel(-6.8, 3.0), 2.6, 0.8); k.bed(rel(6.8, 3.0), 2.6, 0.8); k.bed(rel(-6.8, 5.0), 2.6, 0.8, ['#ffffff', '#ff8aa6']); k.bed(rel(6.8, 5.0), 2.6, 0.8, ['#ffffff', '#ff8aa6']);
    for (const z of [8, 11]) { k.bed(rel(-2.4, z), 1.4, 0.6, ['#ffffff', '#ff8aa6']); k.bed(rel(2.4, z), 1.4, 0.6, ['#ffffff', '#ff8aa6']); } k.fountain(rel(-9.5, 9)); k.boat(rel(-12, -9), 0.4, '#3d6fb0'); k.boat(rel(13, -10.5), -0.3, '#c8443c');
    k.quay(-19, -6.2, -6.6, { bollards: 3 }); k.quay(6.2, 19, -6.6, { bollards: 3 });
    k.cat(up(tw(16, 21), 0.55), 0.2, '#f2ede4'); k.cat(up(rel(-9.5, 8.1), 0.45), 0.6, '#3b3b44');
  }),
  far: [{ kind: 'redschool', a: 0.08, r: 150, s: 1.45 }, { kind: 'ridge', a: -0.45, r: 175, s: 1.2, n: 2, span: 0.4 }, { kind: 'cypresses', a: 0.55, r: 160, n: 90, span: 0.3 }], // straight across: Fener and Balat, the red school on its hill
});
// Miniatürk (dusk, the lamps lit): the park of little models on snowy lawns, the big sign, giant
// snowmen among the models, the town's lights coming on beyond.
const miniaturk = vista({
  hood: { landmark: 'miniaturk', seed: 101, flag: '#7a1f1f', sea: 8, trees: 'xTxv', plazaR: 5, tiles: [['l', 19, 11], ['l', 26, 11], ['b', 12, 19], ['b', 33, 19], ['b', 12, 24], ['b', 33, 24], ['l', 15, 26], ['l', 30, 26], ['l', 11, 13], ['l', 34, 13]], props: [
    { type: 'giant-snowman', i: CX - 9, j: CZ - 3, w: 2, h: 2 }, { type: 'giant-snowman', i: CX + 7, j: CZ - 3, w: 2, h: 2 },
    { type: 'stall', kind: 'corn', i: CX - 9, j: CZ + 3, w: 2, h: 1 }, { type: 'stall', kind: 'chestnut', i: CX + 7, j: CZ + 3, w: 2, h: 1 }] },
  light: { sun: '#e8c8ff', intensity: 1.5, sky: '#d8d0f0', ground: '#7f78b2', dir: [-0.5, 0.25, -0.83], top: '#4c5aa8', horizon: '#d9b8d8', far: '#8f86b4', fog: '#d4c2dc', sunDisc: '#ffb0a0', sunSize: 80, dusk: 0.95 },
  shots: [
    move(0, 2.6, [at(0.2, 1.2, 13), at(0, 1.0, 0)], [at(0.1, 1.5, 7.5), at(0, 1.1, 0)]), // up the path between the models
    orbit(2.6, 5.0, { r: [7.5, 6.5], a: [-0.9, 0.6], y: [1.6, 2.6], look: [at(0, 0.9, 0), at(0, 1.1, 0)] }), // low round the little towers
    move(5.0, 7.2, [at(3, 5, 7), at(0, 1.0, 0)], [at(7, 13, 16), at(0, 0.8, -2)]), // up over the park and the giant snowmen
  ],
  wide: [at(4, 9, 14), at(0, 1, 0)],
  extra: life(k => {
    k.bed(rel(-3.4, 4.0), 1.6, 0.7); k.bed(rel(3.4, 4.0), 1.6, 0.7); k.cat(up(rel(3.0, 4.0), 0.3), -0.5, '#e09a4a'); // close by the landmark, in view even on a phone
    k.model(rel(-9, -1), 'galata', 1.2); k.model(rel(9.5, -1.5), 'maiden', 1.3); k.model(rel(-12.5, 3.5), 'bridge', 1.2); k.model(rel(12.5, 3.2), 'clock', 1.2); k.model(rel(-15, -3.5), 'fort', 1.3); k.model(rel(15, -4), 'galata', 0.9); // more little models on the lawns
    k.bed(rel(-7, 5.5), 2.4, 0.8); k.bed(rel(7, 5.5), 2.4, 0.8); k.bed(rel(-12, 7), 2.0, 0.7, ['#e2406a', '#ffffff']); k.bed(rel(-6.5, 8.5), 3.4, 0.6, ['#3f9b5a']); k.bed(rel(6.5, 8.5), 3.4, 0.6, ['#3f9b5a']); k.bed(rel(12, 7), 2.0, 0.7, ['#9a5ad6', '#ffffff']);
    for (const x of [-6, -3, 3, 6]) k.flag(rel(x, -6.2), ['#c8443c', '#2d6fb5', '#e8a10a', '#3f9b5a'][(x + 6) % 4], 3.0);
    k.lights([rel(-14, 1.5), rel(-10, 1.5), rel(-6, 1.5)], { y: 2.5 }); k.lights([rel(6, 1.5), rel(10, 1.5), rel(14, 1.5)], { y: 2.5 });
    k.cat(up(tw(12, 19), 0.55), 0.3, '#e09a4a'); k.cat(up(rel(8.5, 3.6), 0), -0.6, '#f2ede4');
  }),
  far: [{ kind: 'bridge', type: 'highway', r: 124, a0: -0.75, a1: 0.75 }, { kind: 'cypresses', a: -0.05, r: 165, n: 220, span: 0.7 }], // the Haliç highway bridge high over the water, the cypress hill above Eyüp
});


// ---------- Arena 3: Downtown, an evening loop through Beyoğlu ----------
// Galata Tower (golden late afternoon): the tower above the rooftops, bakeries and dessert shops at
// its foot, the queues at its door; across the water the old city's domes.
const galataTower = vista({
  hood: { landmark: 'galata-tower', seed: 111, flag: '#c8443c', trees: 'TvTx', plazaR: 5, tiles: [['l', 17, 19], ['l', 28, 19], ['l', 15, 11], ['l', 30, 11], ['b', 13, 18], ['b', 32, 18]], props: [
    { type: 'stall', kind: 'simit', i: CX - 10, j: CZ + 2, w: 2, h: 1 }, { type: 'stall', kind: 'chestnut', i: CX + 7, j: CZ + 2, w: 2, h: 1 }] },
  light: { sun: '#ffd8a0', intensity: 2.1, sky: '#f6e6d6', ground: '#a693bc', dir: [-0.7, 0.3, -0.6], top: '#6f8fd6', horizon: '#f8d9b8', far: '#b6a7c4', fog: '#f0d8c4', sunSize: 85, dusk: 0.3 },
  shots: [
    move(0, 2.6, [at(0.5, 1.4, 15), at(0, 3.6, 0)], [at(0.3, 2.2, 10), at(0, 4.4, -0.7)]), // up the lane, the eye climbing the tower
    orbit(2.6, 5.0, { r: [10, 9], a: [0.8, -0.6], y: [2.5, 5.2], look: [at(0, 4.2, -0.7), at(0, 5.2, -0.7)] }), // round the tower and up to its cap
    move(5.0, 7.2, [at(-3, 7, 9), at(0, 4, -1)], [at(-7, 15, 18), at(0, 2.5, -2)]), // over the rooftops
  ],
  wide: [at(-6, 11, 18), at(0, 3, -1)],
  extra: life(k => {
    k.bed(rel(-3.4, 4.0), 1.6, 0.7); k.bed(rel(3.4, 4.0), 1.6, 0.7); k.cat(up(rel(3.0, 4.0), 0.3), -0.5, '#e09a4a'); // close by the landmark, in view even on a phone
    k.cafe(rel(-9.5, -1.0), '#c8443c'); k.cafe(rel(-12, 0.6), '#f2f2f2'); k.cafe(rel(10, -0.6), '#3f9b5a'); k.cafe(rel(12.5, 1.0), '#f2c9d2'); // the dessert shops' tables
    k.lights([rel(-14, -3), rel(-10, -4.2), rel(-6.5, -3)], { y: 2.9 }); k.lights([rel(6.5, -3), rel(10, -4.2), rel(14, -3)], { y: 2.9 });
    k.steam(up(rel(-9.5, 2.5), 1.3), 0.45); k.steam(up(rel(7.5, 2.5), 1.3), 0.45);
    k.pigeons(rel(-6, 7), 7); k.cat(up(tw(13, 18), 0.55), 0.3, '#3b3b44'); k.flag(rel(-6.4, -3.2), '#c8443c', 3.6); k.flag(rel(6.4, -3.2), '#c8443c', 3.6);
  }),
  far: [{ kind: 'ridge', a: -0.12, r: 205, s: 1.5, n: 3, span: 0.6 }, { kind: 'towers', a: 0.85, r: 260, n: 5, span: 0.15 }], // across the Golden Horn: the old city's domes
});
// İstiklal Avenue (dusk, the festive lights on): the red tram on its rails, the Flower Passage and the
// old school gate, strings of lights across the street; Galata Tower at the far end.
const istiklal = vista({
  hood: { landmark: 'istiklal', seed: 121, flag: '#c8302e', trees: 'TTvT', plazaR: 5, tiles: [['l', 17, 19], ['l', 28, 19], ...[24, 28].flatMap(j => [['b', 14, j], ['b', 32, j]]), ...[28, 31].flatMap(j => [['l', 15, j], ['l', 31, j]])], props: [
    { type: 'stall', kind: 'corn', i: CX - 10, j: CZ + 2, w: 2, h: 1 }, { type: 'stall', kind: 'simit', i: CX + 7, j: CZ + 2, w: 2, h: 1 },
    { type: 'plane-tree', i: CX - 12, j: CZ + 6, w: 2, h: 2 }, { type: 'plane-tree', i: CX + 10, j: CZ + 6, w: 2, h: 2 }] },
  light: { sun: '#ffb98a', intensity: 1.7, sky: '#e8d0e0', ground: '#8f80b8', dir: [-0.6, 0.2, -0.75], top: '#5f62b8', horizon: '#f5bfae', far: '#9a8ab6', fog: '#e9c4c0', sunDisc: '#ffb070', sunSize: 80, dusk: 0.75 },
  shots: [
    move(0, 2.6, [at(-1.5, 1.5, 15), at(0, 1.8, 0.5)], [at(-1, 2.1, 9.5), at(0, 1.6, 0.5)]), // down the avenue to the tram
    orbit(2.6, 5.0, { r: [9.5, 8.5], a: [-0.7, 0.7], y: [2.2, 3.4], look: [at(0, 1.6, 0), at(0, 2.2, -0.5)] }), // along the tram, the passage and the gate behind
    move(5.0, 7.2, [at(3, 6, 9), at(0, 2, -1)], [at(7, 14, 18), at(0, 1.4, -3)]), // up over the lights
  ],
  wide: [at(5, 10, 16), at(0, 2, -1)],
  extra: life(k => {
    k.bed(rel(-3.4, 4.2), 1.6, 0.7); k.bed(rel(3.4, 4.2), 1.6, 0.7); k.cat(up(rel(3.0, 4.2), 0.3), -0.5, '#e09a4a');
    for (const z of [-3, 0.5, 3.5]) k.lights([rel(-9, z - 0.6), rel(-4.5, z + 0.3), rel(0, z - 0.2), rel(4.5, z + 0.3), rel(9, z - 0.6)], { y: 4.0, sag: 0.25 }); // the avenue's festive lights
    k.cafe(rel(-11.5, 0.5), '#c8302e'); k.cafe(rel(11.5, 0.8), '#f2f2f2'); k.steam(up(rel(-9.5, 2.5), 1.3), 0.4); k.steam(up(rel(7.5, 2.5), 1.3), 0.4);
    k.flag(rel(-6.5, -2.6), '#c8302e', 3.6); k.flag(rel(6.5, -2.6), '#c8302e', 3.6); k.cat(up(tw(14, 24), 0.55), 0.3, '#3b3b44'); k.pigeons(rel(-7, 8), 6);
  }),
  far: [{ kind: 'galata', a: 0.22, r: 160, s: 1.3 }, { kind: 'ridge', a: -0.35, r: 230, s: 1.2, n: 2, span: 0.3 }], // Galata Tower at the far end of the avenue
});
// Taksim Square (blue hour): the opera house's glass front with its red sphere, the tall hotel tower,
// the park's snowy trees, a red and white city bus, pigeons on the square; the city's towers beyond.
const taksim = vista({
  hood: { landmark: 'taksim', seed: 131, flag: '#2d6fb5', trees: 'TTTv', plazaR: 6, tiles: [['l', 16, 20], ['l', 30, 20], ['b', 12, 18], ['b', 12, 22], ['b', 34, 18], ['l', 14, 11], ['l', 32, 11]], props: [
    ...[[CX - 13, CZ + 3], [CX - 13, CZ - 2], [CX - 10, CZ + 7], [CX - 15, CZ + 7]].map(([i, j]) => ({ type: 'plane-tree', i, j, w: 2, h: 2 })), // the park
    { type: 'stall', kind: 'simit', i: CX + 8, j: CZ + 3, w: 2, h: 1 }, { type: 'stall', kind: 'corn', i: CX + 8, j: CZ - 2, w: 2, h: 1 }] },
  light: { sun: '#c8b8ff', intensity: 1.45, sky: '#c8c4ec', ground: '#6f6aa8', dir: [-0.5, 0.22, -0.8], top: '#3f4aa0', horizon: '#c9b0d8', far: '#8580b0', fog: '#bfb0d6', sunDisc: '#ffa898', sunSize: 70, dusk: 0.95 },
  shots: [
    move(0, 2.6, [at(0.5, 1.5, 16), at(0, 2.0, -0.5)], [at(0.3, 2.3, 10.5), at(0, 2.2, -1)]), // across the square to the opera house
    orbit(2.6, 5.0, { r: [11, 9.5], a: [0.9, -0.6], y: [2.6, 4.2], look: [at(0, 2.0, -0.5), at(0.6, 3.0, -1)] }), // round the bus and up the hotel tower
    move(5.0, 7.2, [at(-3, 6, 10), at(0, 2, -1)], [at(-8, 15, 19), at(0, 1.6, -3)]), // up over the square and the park
  ],
  wide: [at(-6, 11, 18), at(0, 2, -1)],
  extra: life(k => {
    k.bed(rel(-3.4, 4.6), 1.6, 0.7); k.bed(rel(3.4, 4.6), 1.6, 0.7); k.cat(up(rel(3.0, 4.6), 0.3), -0.5, '#f2ede4');
    k.pigeons(rel(-7, 4.5), 12); k.pigeons(rel(6.5, 2.5), 9); // the square's pigeons, off to the sides
    k.steam(up(rel(8.5, 3.5), 1.3), 0.4); k.steam(up(rel(8.5, -1.5), 1.3), 0.4);
    k.lights([rel(-16, 1.5), rel(-12, 0), rel(-8.5, 1.5)], { y: 3.2 }); k.flag(rel(6.8, -3.4), '#2d6fb5', 4.2); k.flag(rel(-6.8, -3.4), '#2d6fb5', 4.2);
    k.bed(rel(-9, 5.5), 2.4, 0.8, ['#ffffff', '#e2406a']); k.bed(rel(9, 6), 2.4, 0.8); k.cat(up(tw(12, 18), 0.55), 0.3, '#3b3b44');
  }),
  far: [{ kind: 'towers', a: 0.18, r: 270, n: 8, span: 0.4, s: 0.7 }], // the city's tall towers far off to the north
});
// Cihangir (evening, the café lamps lit): pastel houses on the steep slope, the café tables under the big
// plane tree, an antique shop, cats everywhere; below, the Bosphorus, the Maiden's Tower, the great bridge lit.
const cihangir = vista({
  hood: { landmark: 'cihangir', seed: 141, flag: '#e8a10a', sea: 9, trees: 'TvyT', plazaR: 5, tiles: [['l', 17, 19], ['l', 28, 19], ['b', 13, 17], ['b', 32, 17], ['b', 13, 21], ['l', 14, 12], ['l', 31, 12]], props: [
    { type: 'stall', kind: 'cay', i: CX - 10, j: CZ + 2, w: 2, h: 1 }, { type: 'plane-tree', i: CX + 9, j: CZ + 5, w: 2, h: 2 }] },
  light: { sun: '#b8a8f0', intensity: 1.35, sky: '#b8b4e4', ground: '#666098', dir: [0.5, 0.2, -0.8], top: '#363f92', horizon: '#b9a2cf', far: '#7c76a8', fog: '#b2a6cc', sunDisc: '#e8b0c8', sunSize: 60, dusk: 1.0 },
  shots: [
    move(0, 2.6, [at(-0.8, 1.3, 14), at(0, 1.4, -0.5)], [at(-0.4, 1.9, 8.5), at(0, 1.6, -0.5)]), // low among the café tables and the cats
    orbit(2.6, 5.0, { r: [9, 8], a: [-0.8, 0.6], y: [2.0, 3.0], look: [at(0, 1.4, -0.5), at(0, 1.9, -0.8)] }), // round the square, the houses up the slope
    move(5.0, 7.2, [at(2, 5, 7), at(0, 1.2, -6)], [at(5, 12, 15), at(0, 0.8, -22)]), // out over the roofs to the Bosphorus
  ],
  wide: [at(4, 9, 15), at(0, 1.5, -4)],
  extra: life(k => {
    k.bed(rel(-3.4, 4.0), 1.6, 0.7); k.bed(rel(3.4, 4.0), 1.6, 0.7); k.cat(up(rel(3.0, 4.0), 0.3), -0.5, '#e09a4a');
    for (const [x, z, c, ry] of [[-6.2, 5.2, '#3b3b44', 0.6], [6.4, 5.6, '#f2ede4', -0.4], [-9.6, 2.4, '#e09a4a', 1.2], [9.2, 2.2, '#9a9aa6', -0.9], [-4.8, 7.5, '#e8c9a0', 0.2], [5.2, 8.2, '#e09a4a', -0.3]]) k.cat(up(rel(x, z), 0), ry, c); // Cihangir's famous cats
    k.cat(up(tw(13, 17), 0.55), 0.3, '#3b3b44'); k.cat(up(tw(32, 17), 0.55), -0.3, '#f2ede4');
    k.cafe(rel(-10, 0.2), '#e8a10a'); k.cafe(rel(-12.5, 1.6), '#c8443c'); k.cafe(rel(10.5, -0.4), '#3f9b5a'); k.steam(up(rel(-9.5, 2.5), 1.3), 0.4);
    k.lights([rel(-14, -2), rel(-10, -3.2), rel(-6.5, -2)], { y: 2.8 }); k.lights([rel(6.5, -2), rel(10, -3.2), rel(14, -2)], { y: 2.8 });
    k.quay(-19, -6.2, -6.6, { bollards: 2 }); k.quay(6.2, 19, -6.6, { bollards: 2 });
  }),
  far: [{ kind: 'maiden', a: -0.1, r: 112, s: 0.9 }, { kind: 'suspension', r: 175, a0: -0.95, a1: -0.45 }, { kind: 'ridge', a: 0.45, r: 175, s: 1.0, n: 2, span: 0.35 }], // the Bosphorus: the Maiden's Tower, the great bridge, the far shore
});
// Tophane (night by the water): the clock tower and the marble fountain on the promenade, the art museum
// and a cruise ship at the quay; across the dark water the Maiden's Tower, the great bridge lit up.
const tophane = vista({
  hood: { landmark: 'tophane', seed: 151, flag: '#2d6fb5', sea: 10, trees: 'xTx', plazaR: 5, tiles: [...[5, 8, 11, 34, 37, 40].map(i => ['l', i, 10]), ...[6, 9, 12, 35, 38].map(i => ['b', i, 11]), ['l', 17, 19], ['l', 28, 19]], props: [
    { type: 'ferry', i: CX - 12, j: 3, w: 5, h: 2, along: 'x' }, { type: 'pier', i: CX + 8, j: 5, w: 2, h: 3, along: 'z' }, { type: 'stall', kind: 'fish', i: CX - 10, j: CZ + 2, w: 2, h: 1 }] },
  light: { sun: '#9aa8f0', intensity: 1.15, sky: '#9a9ad8', ground: '#55508c', dir: [0.4, 0.3, -0.8], top: '#262c74', horizon: '#8f88c0', far: '#6a669c', fog: '#8f88bc', sunDisc: '#f4f0ff', sunSize: 45, dusk: 1.0 },
  shots: [
    move(0, 2.6, [at(-8, 1.6, 13), at(0, 2.2, -0.5)], [at(-5, 2.4, 9), at(0.3, 2.6, -0.5)]), // along the promenade to the clock tower
    orbit(2.6, 5.0, { r: [10, 9], a: [-0.6, 0.7], y: [2.4, 3.6], look: [at(0.3, 2.4, -0.5), at(0.6, 2.6, -0.5)] }), // round the clock tower and the fountain
    move(5.0, 7.2, [at(2, 5, 8), at(0, 1.2, -10)], [at(6, 12, 16), at(0, 0.8, -26)]), // out over the water to the far shore's lights
  ],
  wide: [at(4, 10, 16), at(0, 1.5, -6)],
  extra: life(k => {
    k.bed(rel(-3.4, 4.0), 1.6, 0.7); k.bed(rel(3.4, 4.0), 1.6, 0.7); k.cat(up(rel(3.0, 4.0), 0.3), -0.5, '#e09a4a');
    k.quay(-19, -6, -5.4, { rods: 5, bollards: 3 }); k.quay(6, 19, -5.4, { rods: 5, bollards: 3 }); // fishermen's rods along the quay
    k.lights([rel(-18, -4.8), rel(-12, -4.8), rel(-6.5, -4.8)], { y: 2.4 }); k.lights([rel(6.5, -4.8), rel(12, -4.8), rel(18, -4.8)], { y: 2.4 });
    k.cafe(rel(-11, 1.5), '#2d6fb5'); k.cafe(rel(11.5, 1.8), '#f2f2f2'); k.boat(rel(-14, -9.5), 0.5, '#c8443c'); k.boat(rel(14, -10), -0.4, '#3d6fb0');
    k.flag(rel(-6, -3.4), '#2d6fb5', 3.6); k.flag(rel(6, -3.4), '#2d6fb5', 3.6); k.cat(up(tw(35, 11), 0.55), -0.3, '#3b3b44');
  }),
  far: [{ kind: 'ridge', a: -1.0, r: 52, s: 0.55, n: 1, span: 0 }, { kind: 'maiden', a: 0.2, r: 110, s: 0.9 }, { kind: 'suspension', r: 172, a0: -0.92, a1: -0.42 }, { kind: 'ridge', a: 0.62, r: 170, s: 1.2, n: 3, span: 0.4 }], // the mosque beside the square (scenery), the Maiden's Tower, the great bridge, the old city's domes to the right
});

// The scenes, by place; each one's welcome is read aloud with its name card.
export const CINEMA = {
  boulevard: { title: 'Boulevard Park', welcome: 'Welcome to Boulevard Park!', build: boulevard },
  archery: { title: 'Archery Ground', welcome: 'Welcome to Archery Ground!', build: archery },
  kizilay: { title: 'Kızılay Square', welcome: 'Welcome to Kızılay Square!', build: kizilay },
  sururi: { title: 'Sururi Park', welcome: 'Welcome to Sururi Park!', build: sururi },
  pier: { title: 'The Pier', welcome: 'Welcome to the Pier!', build: pier },
  karakoy: { title: 'Karaköy Pier', welcome: 'Welcome to Karaköy!', build: karakoy },
  bankalar: { title: 'Bankers Street', welcome: 'Welcome to Bankers Street!', build: bankalar },
  tersane: { title: 'Tersane İstanbul', welcome: 'Welcome to Tersane İstanbul!', build: tersane },
  aynalikavak: { title: 'Aynalıkavak Pavilion', welcome: 'Welcome to Aynalıkavak Pavilion!', build: aynalikavak },
  miniaturk: { title: 'Miniatürk', welcome: 'Welcome to Miniatürk!', build: miniaturk },
  'galata-tower': { title: 'Galata Tower', welcome: 'Welcome to Galata Tower!', build: galataTower },
  istiklal: { title: 'İstiklal Avenue', welcome: 'Welcome to İstiklal Avenue!', build: istiklal },
  taksim: { title: 'Taksim Square', welcome: 'Welcome to Taksim Square!', build: taksim },
  cihangir: { title: 'Cihangir', welcome: 'Welcome to Cihangir!', build: cihangir },
  tophane: { title: 'Tophane', welcome: 'Welcome to Tophane!', build: tophane },
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
