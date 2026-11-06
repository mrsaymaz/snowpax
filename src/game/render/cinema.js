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
  DoubleSide, Color, Vector3, InstancedMesh, Object3D,
} from 'three';
import { buildTileArena } from '../tilemap.mjs';
import { buildVillage } from './village.js';
import { buildBackdrop } from './look.js';

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
  const geo = new SphereGeometry(190, 32, 16), pos = geo.attributes.position, col = [], top = new Color(L.top), hor = new Color(L.horizon), c = new Color();
  for (let v = 0; v < pos.count; v++) { const y = pos.getY(v) / 190, k = Math.pow(Math.max(0, y), 0.55); c.copy(hor).lerp(top, k); col.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  const dome = new Mesh(geo, new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false })); dome.position.set(PLACE.x, -10, PLACE.z); dome.renderOrder = -10; g.add(dome);
  const glowT = tex(128, 128, (x, S) => { const gr = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,244,214,0.85)'); gr.addColorStop(0.5, 'rgba(255,214,150,0.22)'); gr.addColorStop(1, 'rgba(255,200,140,0)'); x.fillStyle = gr; x.fillRect(0, 0, S, S); });
  const d = new Vector3(...L.dir).normalize(), sun = new Sprite(new SpriteMaterial({ map: glowT, color: L.sunDisc || L.sun, transparent: true, depthWrite: false, fog: false, blending: AdditiveBlending }));
  sun.position.set(PLACE.x + d.x * 160, Math.max(6, d.y * 160) - 6, PLACE.z + d.z * 160); sun.scale.setScalar(L.sunSize || 70); g.add(sun);
  // a soft band of haze along the horizon
  const hazeT = tex(4, 64, (x) => { const gr = x.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 4, 64); });
  const haze = new Mesh(new CylinderGeometry(150, 150, 26, 40, 1, true), new MeshBasicMaterial({ map: hazeT, color: L.horizon, transparent: true, side: BackSide, depthWrite: false, fog: false })); haze.position.set(PLACE.x, 6, PLACE.z); g.add(haze);
}
// the town beyond: the game's painted backdrop of rooftops, trees and towers on a ring round the
// neighbourhood (never on it, never by the track), then long snowy hills and an old stone tower
function beyond(g, { seed = 3, color = '#a6b4d8' }) {
  const vx = W / 2 + 2, vz0 = PLACE.z - CZ - 2, vz1 = PLACE.z + (H - CZ) + 1;
  g.add(buildBackdrop(PLACE.x, PLACE.z, { rIn: 30, rOut: 78, seed, avoid: (x, z) => (Math.abs(x - PLACE.x) < vx && z > vz0 && z < vz1) || z > TRACK_Z - 7 }));
  const R = rng(seed), far = new MeshLambertMaterial({ color: new Color(color).lerp(new Color('#ffffff'), 0.2) }), stone = new MeshLambertMaterial({ color }), snowM = new MeshLambertMaterial({ color: '#f4f6ff' });
  for (let k = 0; k < 6; k++) { const a = -1.7 + k * 0.68, r = 150 + R() * 20, hill = new Mesh(new SphereGeometry(45 + R() * 25, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), far); hill.scale.y = 0.28 + R() * 0.1; hill.position.set(PLACE.x + Math.sin(a) * r, -3, PLACE.z - Math.cos(a) * r); g.add(hill); }
  const a = 0.55, r = 128, x = PLACE.x + Math.sin(a) * r, z = PLACE.z - Math.cos(a) * r; // an old round tower on the far hill
  const t = new Mesh(new CylinderGeometry(3.0, 3.6, 26, 16), stone); t.position.set(x, 13, z); g.add(t);
  const c = new Mesh(new ConeGeometry(4.1, 8.5, 16), new MeshLambertMaterial({ color: new Color(color).multiplyScalar(0.8) })); c.position.set(x, 30.2, z); g.add(c);
  const sc = new Mesh(new ConeGeometry(3.8, 3, 16), snowM); sc.position.set(x, 28.3, z); g.add(sc);
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
    const ground = new Mesh(new CircleGeometry(170, 48), new MeshLambertMaterial({ color: light.snow || '#eef1fb' })); ground.rotation.x = -Math.PI / 2; ground.position.set(PLACE.x, -0.08, PLACE.z); ground.receiveShadow = true; g.add(ground);
    world.group.traverse(o => { if (o.isMesh && !o.material?.transparent) o.castShadow = o.receiveShadow = true; });
    sky(g, light); beyond(g, { color: light.far, seed: hood.seed });
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

// The scenes, by place; each one's welcome is read aloud with its name card.
export const CINEMA = {
  boulevard: { title: 'Boulevard Park', welcome: 'Welcome to Boulevard Park!', build: boulevard },
  archery: { title: 'Archery Ground', welcome: 'Welcome to Archery Ground!', build: archery },
  kizilay: { title: 'Kızılay Square', welcome: 'Welcome to Kızılay Square!', build: kizilay },
  sururi: { title: 'Sururi Park', welcome: 'Welcome to Sururi Park!', build: sururi },
  pier: { title: 'The Pier', welcome: 'Welcome to the Pier!', build: pier },
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
