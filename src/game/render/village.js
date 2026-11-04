// The arena as a handcrafted snowy miniature diorama.
// Chunky timber-and-stone buildings with thick snow-pillow roofs, prominent chimneys, framed
// amber windows and readable details, arranged around a dominant central outpost lodge.
// Cold palette (icy blue, lavender, slate, navy) with amber windows and orange firelight.
// Materials are softly painted canvas textures (wood, stone, plaster, slate, metal, fabric,
// snow). Static meshes are merged per material and repeated details are instanced, so the
// scene stays light on phones. Nothing is downloaded: every texture is painted here.
import {
  Group, Mesh, InstancedMesh, Object3D, Matrix4, Vector3, Euler, Quaternion, Color, Shape, ExtrudeGeometry, BoxGeometry,
  SphereGeometry, CylinderGeometry, ConeGeometry, IcosahedronGeometry, PlaneGeometry, TorusGeometry, CircleGeometry, RingGeometry,
  CapsuleGeometry, MeshLambertMaterial, MeshStandardMaterial, MeshBasicMaterial, CanvasTexture, RepeatWrapping, SRGBColorSpace,
  Sprite, SpriteMaterial, AdditiveBlending, PointLight, DoubleSide, BufferGeometry, Float32BufferAttribute, Points, PointsMaterial,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { addCutout } from './cutout.js';
import { CONFIG } from '../../config.js';
import { Grid, GRID } from '../grid.mjs';
import { GridNav } from '../gridnav.mjs';
import { buildSnowtown } from './snowtown.js';
import { LOOK, toon, addRim, outlineMaterial } from './look.js';

export const PAL = {
  snow: '#e6eef9', snowShade: '#cdd6ef', ice: '#bfe3f5', lavender: '#b7a9da', lavDeep: '#8e7fbf', slate: '#5d6b80', slateDark: '#3d475d', navy: '#24304f',
  wood: '#8a6c60', woodDark: '#4f3e3d', stone: '#8892a8', stoneDark: '#5f6981', metal: '#4b5568', amber: '#ffb347', amberHot: '#ffd27a', fire: '#ff7a1a',
  plaster: ['#c6bde2', '#b6cde8', '#d0d6ea', '#beb2de', '#aac0e2', '#c9c3e6'], pine: '#2d5a5d', pine2: '#356b6a', fabric: ['#8e7fbf', '#4f6fa8', '#c8584a', '#d99a3e'],
};
export const LIGHTING = { sky: '#9fb3db', fog: ['#aeb9df', 30, 62], hemi: ['#d3e0ff', '#8173b8', 1.15], sun: ['#eef2ff', 2.25], sunDir: [-9, 17, 8] };
// Arena 1 light: a late snowy afternoon that slides into dusk as the match goes on
// (pink-orange low sun, long blue shadows, windows and lamps glowing brighter).
export const DAYLIGHT = {
  afternoon: { sky: '#b4bde6', fog: '#c3c6ea', hemi: ['#dae2ff', '#7d72b8', 1.12], sun: ['#fff0e0', 2.3], sunDir: [-11, 14, 7], grade: { tint: '#fbf6ff', sat: 1.18 } },
  morning: { sky: '#a8cdf2', fog: '#c6def6', hemi: ['#e2efff', '#86a8d6', 0.95], sun: ['#ffeccc', 1.9], sunDir: [12, 9, 8], grade: { tint: '#eef6ff', sat: 1.16 } }, // crisp, blue, long shadows from the east
  dusk: { sky: '#c3a3cc', fog: '#b9aad8', hemi: ['#c6c7f4', '#6556a8', 1.02], sun: ['#ffb68c', 2.0], sunDir: [-14, 8, 5] },
  // the stages, each at its own time of day (morning → evening through Arena 1)
  noon: { sky: '#9cc8f5', fog: '#d3e6f8', hemi: ['#ffffff', '#a6b6da', 1.05], sun: ['#ffffff', 2.15], sunDir: [2, 20, 4], grade: { tint: '#ffffff', sat: 1.24 } },          // bright, white, short shadows
  golden: { sky: '#e6c7b4', fog: '#e8d2c2', hemi: ['#ffe6c8', '#9c7fb2', 0.9], sun: ['#ffbe78', 2.35], sunDir: [-13, 8, 6], grade: { tint: '#fff0d6', sat: 1.2 } }, // warm amber, low sun
  sunset: { sky: '#d6a9c4', fog: '#cdb0d6', hemi: ['#d9cdf4', '#6a5aa8', 0.95], sun: ['#ffae7a', 2.0], sunDir: [-15, 7, 4], grade: { tint: '#ffe8e4', sat: 1.18 } },
  evening: { sky: '#7b78b8', fog: '#8f8cc4', hemi: ['#aeb4ec', '#4c4590', 0.95], sun: ['#ffc59a', 1.35], sunDir: [-13, 9, 6], grade: { tint: '#e8e8ff', sat: 1.12 } },
};

const rnd = (a, b = 0) => { let h = Math.imul((a * 73856093) ^ (b * 19349663), 2654435761); h ^= h >>> 13; h = Math.imul(h, 1597334677); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ---------- painted textures (soft, restrained) ----------
const texCache = new Map();
function canvasTex(key, size, paint, repeat = 1) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  paint(g, size);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping; t.anisotropy = 4; t.repeat.set(repeat, repeat);
  texCache.set(key, t); return t;
}
const soft = (g, x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
const T = {
  // vertical planks with soft grain (tinted by the material colour)
  wood: () => canvasTex('wood', 256, (g, S) => {
    g.fillStyle = '#d8d0cc'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 8; i++) { const v = 200 + Math.floor(rnd(i, 3) * 40); g.fillStyle = `rgb(${v},${v - 6},${v - 10})`; g.fillRect(i * 32, 0, 32, S); g.fillStyle = 'rgba(40,30,30,0.35)'; g.fillRect(i * 32, 0, 2, S); }
    g.strokeStyle = 'rgba(60,45,40,0.12)'; g.lineWidth = 1.2;
    for (let k = 0; k < 40; k++) { const x = rnd(k, 7) * S; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= S; y += 16) g.lineTo(x + Math.sin(y * 0.05 + k) * 3, y); g.stroke(); }
    for (let k = 0; k < 10; k++) soft(g, rnd(k, 9) * S, rnd(k, 11) * S, 5, 'rgba(60,40,35,A)', 0.35);
  }, 0.5),
  // oversized beams: darker wood with a soft highlight edge
  beam: () => canvasTex('beam', 128, (g, S) => {
    g.fillStyle = '#c9bfba'; g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(50,35,32,0.18)'; for (let k = 0; k < 18; k++) { const y = rnd(k, 2) * S; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(S / 3, y + 4, S * 2 / 3, y - 4, S, y); g.stroke(); }
  }, 1),
  // rounded stones with lavender mortar
  stone: () => canvasTex('stone', 256, (g, S) => {
    g.fillStyle = '#b9b6cc'; g.fillRect(0, 0, S, S);
    let row = 0;
    for (let y = 0; y < S; y += 32, row++) for (let x = -(row % 2) * 24; x < S; x += 48) {
      const v = 190 + Math.floor(rnd(x + 99, y) * 45), w = 42 + rnd(x, y) * 4;
      g.fillStyle = `rgb(${v - 8},${v - 2},${v + 12})`; g.beginPath(); g.roundRect(x + 3, y + 3, w, 26, 10); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.roundRect(x + 7, y + 5, w * 0.6, 6, 3); g.fill();
      g.fillStyle = 'rgba(40,40,70,0.18)'; g.beginPath(); g.roundRect(x + 5, y + 22, w - 4, 6, 3); g.fill();
    }
  }, 0.6),
  // plaster with soft brush blotches
  plaster: () => canvasTex('plaster', 256, (g, S) => {
    g.fillStyle = '#e6e3ee'; g.fillRect(0, 0, S, S);
    for (let k = 0; k < 60; k++) soft(g, rnd(k, 1) * S, rnd(k, 2) * S, 20 + rnd(k, 3) * 40, k % 2 ? 'rgba(255,255,255,A)' : 'rgba(150,140,190,A)', 0.12);
  }, 0.4),
  // slate shingles (visible at the thick roof edges)
  shingle: () => canvasTex('shingle', 256, (g, S) => {
    g.fillStyle = '#7e86a6'; g.fillRect(0, 0, S, S);
    for (let y = 0, r = 0; y < S; y += 24, r++) for (let x = -(r % 2) * 16; x < S; x += 32) {
      const v = 110 + Math.floor(rnd(x, y + 5) * 40);
      g.fillStyle = `rgb(${v - 10},${v},${v + 30})`; g.beginPath(); g.roundRect(x + 1, y, 30, 26, [2, 2, 12, 12]); g.fill();
      g.fillStyle = 'rgba(20,25,50,0.25)'; g.fillRect(x + 1, y + 22, 30, 4);
    }
  }, 0.7),
  snow: () => canvasTex('snow', 256, (g, S) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
    for (let k = 0; k < 40; k++) soft(g, rnd(k, 5) * S, rnd(k, 6) * S, 18 + rnd(k, 7) * 36, 'rgba(170,175,225,A)', 0.07);
    for (let k = 0; k < 90; k++) { g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(rnd(k, 8) * S, rnd(k, 9) * S, 2, 2); }
  }, 0.5),
  metal: () => canvasTex('metal', 128, (g, S) => {
    g.fillStyle = '#c6cbd8'; g.fillRect(0, 0, S, S);
    for (let k = 0; k < 20; k++) soft(g, rnd(k, 4) * S, rnd(k, 12) * S, 10 + rnd(k, 1) * 20, 'rgba(90,95,130,A)', 0.15);
  }, 1),
  fabric: () => canvasTex('fabric', 128, (g, S) => {
    g.fillStyle = '#e8e4ee'; g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(80,70,110,0.12)'; for (let i = 0; i < S; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(S, i); g.stroke(); }
  }, 1),
};

// ---------- materials ----------
const matCache = new Map();
function M(kind, color, extra = {}) {
  const key = (LOOK.v2 ? 'v2' : '') + kind + color + JSON.stringify(extra);
  if (matCache.has(key)) return matCache.get(key);
  let m;
  if (LOOK.v2 && kind !== 'glow') { m = toon({ color, map: T[kind] && kind !== 'metal' ? T[kind]() : null, ...extra }); addCutout(m); if (kind !== 'snow') addRim(m, 0.07); matCache.set(key, m); return m; }
  if (kind === 'metal') m = new MeshStandardMaterial({ color, map: T.metal(), roughness: 0.55, metalness: 0.45, ...extra });
  else if (kind === 'glow') m = new MeshBasicMaterial({ color, ...extra });
  else m = new MeshLambertMaterial({ color, map: T[kind] ? T[kind]() : null, ...extra });
  addCutout(m); matCache.set(key, m); return m;
}

// ---------- geometry helpers ----------
function rbox(w, d, h, r = 0.08, segs = 2) {
  r = Math.min(r, w / 2 - 0.01, d / 2 - 0.01, h / 2 - 0.01);
  if (r < 0.07) segs = 1; // small bevels need no extra segments
  const sh = new Shape(), x = -w / 2 + r, y = -d / 2 + r;
  sh.moveTo(x, y); sh.lineTo(x + w - 2 * r, y); sh.lineTo(x + w - 2 * r, y + d - 2 * r); sh.lineTo(x, y + d - 2 * r); sh.lineTo(x, y);
  const g = new ExtrudeGeometry(sh, { depth: Math.max(0.001, h - 2 * r), bevelEnabled: r > 0.005, bevelThickness: r, bevelSize: r, bevelSegments: segs, curveSegments: 3 });
  g.rotateX(-Math.PI / 2); g.translate(0, r, 0); return g;
}
function prism(span, length, rise) { // triangular gable prism, ridge along z, base at y = 0
  const sh = new Shape(); sh.moveTo(-span / 2, 0); sh.lineTo(span / 2, 0); sh.lineTo(0, rise); sh.lineTo(-span / 2, 0);
  const g = new ExtrudeGeometry(sh, { depth: length, bevelEnabled: false }); g.translate(0, 0, -length / 2); return g;
}

// Collects static pieces per material and merges them; instanced pieces per (geometry, material).
class Kit {
  constructor() { this.statics = new Map(); this.inst = new Map(); this.m = new Matrix4(); this.q = new Quaternion(); this.e = new Euler(); this.s = new Vector3(); this.p = new Vector3(); }
  mat4(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) { this.e.set(rx, ry, rz); this.q.setFromEuler(this.e); this.m.compose(this.p.set(x, y, z), this.q, this.s.set(sx, sy, sz)); return this.m; }
  add(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(this.mat4(x, y, z, rx, ry, rz, sx, sy, sz));
    if (!this.statics.has(mat)) this.statics.set(mat, []); this.statics.get(mat).push(g);
  }
  put(key, geo, mat, x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) {
    if (!this.inst.has(key)) this.inst.set(key, { geo, mat, list: [] });
    this.inst.get(key).list.push(this.mat4(x, y, z, rx, ry, rz, sx, sy, sz).clone());
  }
  build(group, shadows = true) {
    // static repeated pieces: bake each placement and merge with the rest of its material
    for (const { geo, mat, list } of this.inst.values()) {
      const base = geo.index ? geo.toNonIndexed() : geo.clone();
      for (const k of Object.keys(base.attributes)) if (!['position', 'normal', 'uv'].includes(k)) base.deleteAttribute(k);
      if (!base.attributes.uv) base.setAttribute('uv', new Float32BufferAttribute(new Float32Array(base.attributes.position.count * 2), 2));
      if (!this.statics.has(mat)) this.statics.set(mat, []);
      for (const m of list) this.statics.get(mat).push(base.clone().applyMatrix4(m));
    }
    this.inst.clear();
    // merge per material and per 12×12 area, so the camera can skip what is off screen
    const CH = 12, buckets = new Map();
    for (const [mat, list] of this.statics) for (const g of list) {
      g.computeBoundingBox(); const b = g.boundingBox, cx = Math.floor((b.min.x + b.max.x) / 2 / CH), cz = Math.floor((b.min.z + b.max.z) / 2 / CH);
      const key = mat.uuid + '|' + cx + '|' + cz; if (!buckets.has(key)) buckets.set(key, { mat, list: [] }); buckets.get(key).list.push(g);
    }
    for (const { mat, list } of buckets.values()) {
      const g = mergeGeometries(list); g.computeBoundingSphere();
      const mesh = new Mesh(g, mat); mesh.castShadow = shadows && !mat.isMeshBasicMaterial; mesh.receiveShadow = true; group.add(mesh);
      if (LOOK.v2 && !mat.isMeshBasicMaterial && !mat.transparent) { const ink = new Mesh(g, outlineMaterial(0.045, '#1c2340', addCutout)); ink.renderOrder = -1; group.add(ink); } // cartoon outlines
    }
    for (const { geo, mat, list } of this.inst.values()) {
      const im = new InstancedMesh(geo, mat, list.length); list.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = shadows && !mat.isMeshBasicMaterial; im.receiveShadow = true; im.computeBoundingSphere(); group.add(im);
    }
  }
}

// shared geometry
const GEO = {
  winFrame: rbox(0.66, 0.1, 0.8, 0.03), winGlass: new PlaneGeometry(0.46, 0.6), winBarV: new BoxGeometry(0.05, 0.6, 0.04), winBarH: new BoxGeometry(0.46, 0.05, 0.04),
  sill: rbox(0.8, 0.22, 0.12, 0.05), drip: new SphereGeometry(0.14, 7, 5), icicle: new ConeGeometry(0.05, 0.5, 6),
  barrel: new CylinderGeometry(0.28, 0.28, 0.62, 12), band: new TorusGeometry(0.285, 0.025, 4, 12), crate: rbox(0.55, 0.55, 0.5, 0.04),
  log: new CylinderGeometry(0.09, 0.09, 0.9, 8), lanternBody: rbox(0.2, 0.2, 0.3, 0.03), lanternGlass: new BoxGeometry(0.14, 0.2, 0.14),
  snowCap: new SphereGeometry(0.5, 11, 5, 0, Math.PI * 2, 0, Math.PI / 2), rock: new IcosahedronGeometry(0.5, 1), cone: new ConeGeometry(1, 1, 8),
  post: new CylinderGeometry(0.07, 0.08, 1, 8), pipe: new CylinderGeometry(0.06, 0.06, 1, 8), elbow: new TorusGeometry(0.15, 0.06, 6, 10, Math.PI / 2),
};
let glowTex = null;
function glow() {
  if (!glowTex) glowTex = canvasTex('glow', 64, (g, S) => { const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); gr.addColorStop(0, 'rgba(255,200,120,0.9)'); gr.addColorStop(0.35, 'rgba(255,160,70,0.35)'); gr.addColorStop(1, 'rgba(255,140,50,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); });
  return glowTex;
}
function sign(text, w = 2.2, bg = '#2b3556') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d');
  g.fillStyle = '#5a463f'; g.beginPath(); g.roundRect(4, 4, 504, 152, 26); g.fill();
  g.fillStyle = bg; g.beginPath(); g.roundRect(18, 18, 476, 124, 18); g.fill();
  g.fillStyle = '#ffe2a8'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = 72; g.font = `900 ${fs}px system-ui, sans-serif`; while (g.measureText(text).width > 450 && fs > 30) { fs -= 4; g.font = `900 ${fs}px system-ui, sans-serif`; } // long names shrink to fit
  g.fillText(text, 256, 84);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
  const m = new Mesh(new PlaneGeometry(w, w * 160 / 512), new MeshBasicMaterial({ map: t, transparent: true })); return m;
}

export function buildVillage(arena, { rivalTeam = 'gryffindor', homeTeam = 'hufflepuff', quality = 'medium', look = 'v1', clip = null } = {}) {
  LOOK.v2 = look === 'v2';
  // a stage build: only the cells near one outpost (the rest becomes '~', nothing)
  if (clip) {
    const near = (x, z, pad = 0) => Math.hypot(x - clip.x, z - clip.z) <= clip.r + pad;
    const cx0 = arena.x0, cz0 = arena.z0;
    arena = { ...arena, clip,
      rows: arena.rows.map((row, j) => [...row].map((c, i) => (near(cx0 + i + 0.5, cz0 + j + 0.5) ? c : '~')).join('')),
      landmarks: arena.landmarks.filter(l => near(cx0 + (l.i ?? l.a?.[0] ?? 0) + 0.5, cz0 + (l.j ?? l.a?.[1] ?? 0) + 0.5, 2)),
      scenery: arena.scenery.filter(s2 => s2.type !== 'cemetery' && near(cx0 + s2.x, cz0 + s2.z, 2)),
      signposts: (arena.signposts || []).filter(sp => near(sp.x, sp.z)),
      sledRuns: (arena.sledRuns || []).filter(r => near(r.pts[0][0], r.pts[0][1], 6)),
      places: arena.places.filter(p => p.kind !== 'zone' || near(p.x, p.z, 2)),
    };
  }
  const group = new Group(), K = new Kit(), rows = arena.rows, W = arena.w, H = arena.h, x0 = arena.x0, z0 = arena.z0;
  const at = (i, j) => [x0 + i + 0.5, z0 + j + 0.5];
  const tiles = ch => { const out = []; for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (rows[j][i] === ch) out.push([i, j]); return out; };
  const low = quality === 'low';
  const smokeSources = [], fires = [], glows = [], lights = [], pools = [], life = { perches: [], cats: [], steam: [] }, centreFlags = new Map();
  // the outpost flag (its colour shows who holds the outpost); landmark outposts put it on top of themselves
  const makeFlag = (x, y, z) => { const f = new Mesh(new PlaneGeometry(1.1, 0.62, 8, 1), new MeshLambertMaterial({ color: '#ffffff', map: T.fabric(), side: DoubleSide })); f.position.set(x + 0.56, y, z); group.add(f); return f; };

  const mSnow = M('snow', PAL.snow), mStone = M('stone', PAL.stone), mStoneDark = M('stone', PAL.stoneDark), mBeam = M('beam', PAL.woodDark), mWood = M('wood', PAL.wood);
  const mShingle = M('shingle', '#6f7aa0'), mMetal = M('metal', PAL.metal), mIce = M('glow', '#d9f0ff', { transparent: true, opacity: 0.85 });
  const mGlass = M('glow', PAL.amber), mGlassDark = M('glow', '#46557a'), mFire = M('glow', PAL.fire), mFireHot = M('glow', PAL.amberHot);

  // ---------- ground: painted snow, cobbled street, flagstone yard, plaza, trodden paths, contact shadows ----------
  const PX = low ? 32 : 48;
  if (!arena.world) {
    const c = document.createElement('canvas'); c.width = W * PX; c.height = H * PX; const g = c.getContext('2d');
    g.fillStyle = '#e2e9f6'; g.fillRect(0, 0, c.width, c.height);
    for (let k = 0; k < W * H * 0.5; k++) soft(g, rnd(k, 31) * c.width, rnd(k, 37) * c.height, PX * (0.6 + rnd(k, 41) * 1.6), k % 3 ? 'rgba(170,165,215,A)' : 'rgba(255,255,255,A)', 0.09);
    const grid = new Grid(arena), zp = arena.places.find(p => p.kind === 'zone');
    const tx = x => (x - x0) * PX, tz = z => (z - z0) * PX;
    // trodden paths from both bases to the plaza
    const nav = new GridNav(grid, 0.36);
    for (const pl of arena.places.filter(p => p.kind !== 'zone')) {
      const path = nav.path(pl.x, pl.z, zp.x, zp.z + (pl.z > zp.z ? zp.r + 0.3 : -zp.r - 0.3));
      if (!path) continue;
      const pts = [[pl.x, pl.z], ...path];
      g.lineCap = g.lineJoin = 'round';
      for (const [w, col] of [[1.5, 'rgba(205,210,235,0.35)'], [1.1, 'rgba(200,205,232,0.5)'], [0.8, 'rgba(196,200,230,0.55)']]) {
        g.strokeStyle = col; g.lineWidth = w * PX; g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(tx(x), tz(z)) : g.moveTo(tx(x), tz(z)))); g.stroke();
      }
      g.fillStyle = 'rgba(150,145,200,0.22)'; // footprints
      for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az); for (let s = 0; s < L; s += 0.45) { const t = s / L, side = (Math.floor(s / 0.45) % 2 ? 1 : -1) * 0.12, nx = -(bz - az) / L, nz = (bx - ax) / L; g.beginPath(); g.ellipse(tx(ax + (bx - ax) * t + nx * side), tz(az + (bz - az) * t + nz * side), PX * 0.07, PX * 0.1, Math.atan2(bz - az, bx - ax) + Math.PI / 2, 0, 7); g.fill(); } }
    }
    const cobbles = (cx, cz, r0) => { for (let k = 0; k < 7; k++) { const a = rnd(cx * 7 + k, cz) * 6.28, d = rnd(cz + k, cx * 3) * r0, v = 150 + Math.floor(rnd(k, cx + cz) * 50); g.fillStyle = `rgb(${v - 15},${v - 5},${v + 25})`; g.beginPath(); g.ellipse(cx + Math.cos(a) * d, cz + Math.sin(a) * d, PX * 0.2, PX * 0.15, a, 0, 7); g.fill(); } };
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const ch = rows[j][i], X = i * PX, Z = j * PX;
      if ('_O'.includes(ch)) {
        g.fillStyle = '#9ea4c0'; g.fillRect(X, Z, PX, PX);
        // hand-laid cobbles: irregular rows, varied size and tone
        for (let b = 0; b < 4; b++) for (let a = -1; a < 4; a++) {
          const k = i * 97 + j * 31 + a * 7 + b, w = PX * (0.22 + rnd(k, 1) * 0.1), hgt = PX * (0.17 + rnd(k, 2) * 0.06);
          const x = X + a * PX / 3.2 + (b % 2) * PX / 6.4 + (rnd(k, 3) - 0.5) * PX * 0.05, y = Z + b * PX / 4 + (rnd(k, 4) - 0.5) * PX * 0.04, v = 140 + Math.floor(rnd(k, 5) * 55);
          g.fillStyle = `rgb(${v - 14},${v - 6},${v + 24})`; g.beginPath(); g.ellipse(x + w / 2, y + hgt / 2, w / 2, hgt / 2, (rnd(k, 6) - 0.5) * 0.4, 0, 7); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(x + w * 0.42, y + hgt * 0.35, w * 0.25, hgt * 0.16, 0, 0, 7); g.fill();
        }
        if (rnd(i, j * 5) < 0.45) soft(g, X + rnd(i, j) * PX, Z + rnd(j, i) * PX, PX * 0.7, 'rgba(255,255,255,A)', 0.7);
      }
      if ('Yh'.includes(ch)) {
        g.fillStyle = '#c8c3dd'; g.fillRect(X, Z, PX, PX);
        const v = 205 + Math.floor(rnd(i, j) * 25); g.fillStyle = `rgb(${v - 5},${v - 8},${v + 10})`; g.beginPath(); g.roundRect(X + 2, Z + 2, PX - 4, PX - 4, 6); g.fill();
        if (rnd(j, i) < 0.5) soft(g, X + PX / 2, Z + PX / 2, PX * 0.6, 'rgba(255,255,255,A)', 0.6);
      }
      if (ch === 'i') { g.fillStyle = '#bfe0f4'; g.fillRect(X, Z, PX, PX); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(X + PX * 0.2, Z + PX * 0.3); g.lineTo(X + PX * 0.7, Z + PX * 0.2); g.moveTo(X + PX * 0.3, Z + PX * 0.75); g.lineTo(X + PX * 0.8, Z + PX * 0.6); g.stroke(); }
    }
    // snowy kerbs along the street edges
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      if (rows[j][i] !== '_') continue;
      for (const dj of [-1, 1]) { const n = rows[j + dj]?.[i]; if (n && !'_OiF'.includes(n)) { const y = (dj < 0 ? j : j + 1) * PX; const gr = g.createLinearGradient(0, y, 0, y - dj * PX * 0.4); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(i * PX, Math.min(y, y - dj * PX * 0.4), PX, PX * 0.4); } }
    }
    // the plaza: rings of cobbles around the outpost
    if (zp) {
      const cx = tx(zp.x), cz = tz(zp.z), R = (zp.r + 0.35) * PX;
      g.fillStyle = '#9da5c2'; g.beginPath(); g.arc(cx, cz, R, 0, 7); g.fill();
      for (let ring = 1.3; ring < zp.r + 0.3; ring += 0.36) { const n = Math.floor(ring * 6.28 / 0.38); for (let k = 0; k < n; k++) { const a = k / n * 6.283 + ring, v = 155 + Math.floor(rnd(k, ring * 10) * 45); g.fillStyle = `rgb(${v - 14},${v - 5},${v + 24})`; g.beginPath(); g.ellipse(cx + Math.cos(a) * ring * PX, cz + Math.sin(a) * ring * PX, PX * 0.16, PX * 0.12, a, 0, 7); g.fill(); } }
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = PX * 0.12; g.beginPath(); g.arc(cx, cz, R, 0, 7); g.stroke();
      for (let k = 0; k < 14; k++) soft(g, cx + (rnd(k, 3) - 0.5) * R * 1.8, cz + (rnd(k, 4) - 0.5) * R * 1.8, PX * 0.8, 'rgba(255,255,255,A)', 0.45);
    }
    // quiet zone tint
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const [x, z] = at(i, j); if (grid.has(x, z, GRID.ZONE) && !grid.blocked(x, z)) { g.fillStyle = 'rgba(185,160,235,0.18)'; g.fillRect(i * PX, j * PX, PX, PX); } }
    // contact shadows: soft lavender darkening around everything solid
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (grid.blocked(...at(i, j))) soft(g, (i + 0.62) * PX, (j + 0.42) * PX, PX * 0.95, 'rgba(80,70,140,A)', 0.2);
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 8;
    const ground = new Mesh(new PlaneGeometry(W, H), new MeshLambertMaterial({ map: t })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; group.add(ground);
    const around = new Mesh(new PlaneGeometry(W + 90, H + 90), new MeshLambertMaterial({ color: '#dfe6f5', map: T.snow() })); around.rotation.x = -Math.PI / 2; around.position.y = -0.03; around.receiveShadow = true; group.add(around);
  }

  // ---------- details ----------
  const lantern = (x, y, z, light = false) => {
    K.add(GEO.lanternBody, mMetal, x, y, z); K.put('lanternGlass', GEO.lanternGlass, mGlass, x, y + 0.16, z); K.add(rbox(0.26, 0.26, 0.06, 0.02), mMetal, x, y + 0.3, z); K.put('lanternSnow', GEO.snowCap, mSnow, x, y + 0.34, z, 0, 0.18, 0.1, 0.18);
    glows.push([x, y + 0.16, z, 0.9]); if (light) lights.push([x, y + 0.3, z]);
  };
  const barrel = (x, z, snow = true) => { K.put('barrel', GEO.barrel, mWood, x, 0.31, z); for (const y of [0.12, 0.5]) K.put('band', GEO.band, mMetal, x, y, z, 0, 1, 1, 1, Math.PI / 2); if (snow) K.put('capS', GEO.snowCap, mSnow, x, 0.6, z, 0, 0.3, 0.14, 0.3); };
  const crate = (x, z, ry = 0, y = 0) => { K.put('crate', GEO.crate, mWood, x, y, z, ry); K.put('capS', GEO.snowCap, mSnow, x, y + 0.5, z, ry, 0.33, 0.12, 0.33); };
  const firewood = (x, z, ry = 0) => { // stacked logs under a small slate roof
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3 - r; k++) K.put('log', GEO.log, M('wood', '#9a7a62'), x + Math.cos(ry) * ((k - (2 - r) / 2) * 0.19), 0.09 + r * 0.16, z - Math.sin(ry) * ((k - (2 - r) / 2) * 0.19), ry, 1, 1, 1, Math.PI / 2);
    K.add(rbox(1.05, 0.5, 0.06, 0.02), mShingle, x, 0.62, z, 0.15, ry); K.add(rbox(1.1, 0.55, 0.14, 0.06), mSnow, x, 0.66, z, 0.15, ry);
  };
  const shovel = (x, z, ry = 0) => { K.add(new CylinderGeometry(0.03, 0.03, 1.1, 6), mWood, x, 0.55, z, 0.25, ry); K.add(rbox(0.26, 0.04, 0.3, 0.02), mMetal, x + Math.sin(ry) * -0.05, 0.12, z, 0.25, ry); };
  const pipe = (x, z, h, ry) => { K.put('pipe', GEO.pipe, mMetal, x, h / 2, z, 0, 1, h, 1); K.put('elbow', GEO.elbow, mMetal, x - Math.sin(ry) * 0.15, h, z - Math.cos(ry) * 0.15, ry + Math.PI / 2, 1, 1, 1, 0, Math.PI); };
  const rock = (x, z, s = 1) => { K.put('rock', GEO.rock, mStone, x, 0.18 * s, z, rnd(x * 9, z) * 6, s * (0.9 + rnd(x, z) * 0.4), s * 0.7, s); K.put('rockSnow', GEO.snowCap, mSnow, x, 0.42 * s, z, 0, s * 0.42, s * 0.22, s * 0.42); };
  const pine = (x, z, s = 1) => {
    K.put('trunk', new CylinderGeometry(0.12, 0.16, 0.8, 7), mWood, x, 0.4 * s, z, 0, s);
    [[0.95, 1.0, 1.1], [1.65, 0.78, 0.95], [2.25, 0.55, 0.8]].forEach(([y, r, h], k) => {
      K.put('pineTier' + (k % 2), GEO.cone, M('plaster', k % 2 ? PAL.pine : PAL.pine2), x, y * s, z, rnd(x, z + k) * 3, r * s, h * s, r * s);
      K.put('pineSnow', GEO.snowCap, mSnow, x, (y + h * 0.18) * s, z, 0, r * s * 0.95, h * s * 0.42, r * s * 0.95);
    });
  };
  const fireBarrel = (x, z) => {
    K.put('fbarrel', new CylinderGeometry(0.32, 0.28, 0.7, 14), mMetal, x, 0.35, z); for (const y of [0.15, 0.55]) K.put('fband', new TorusGeometry(0.32, 0.03, 6, 16), mBeam, x, y, z, 0, 1, 1, 1, Math.PI / 2);
    fires.push({ x, z }); glows.push([x, 1.0, z, 2.2]);
  };

  // windows on one wall: facing ±x or ±z, starting height y, count by length
  const windows = (cx, cz, along, len, face, y, skip = null, darkRatio = 0.25) => {
    const n = Math.max(1, Math.floor((len - 0.5) / 1.25)), step = len / n;
    for (let k = 0; k < n; k++) {
      const u = -len / 2 + step * (k + 0.5); if (skip !== null && Math.abs(u - skip) < 0.6) continue;
      const [nx, nz] = face, x = cx + (along === 'x' ? u : 0) + nx * 0.02, z = cz + (along === 'z' ? u : 0) + nz * 0.02, ry = Math.atan2(nx, nz);
      K.put('winFrame', GEO.winFrame, mBeam, x, y, z, ry);
      const lit = rnd(x * 13, z * 7 + y) > darkRatio;
      K.put(lit ? 'glassLit' : 'glassDark', GEO.winGlass, lit ? mGlass : mGlassDark, x + nx * 0.055, y + 0.4, z + nz * 0.055, ry);
      K.put('barV', GEO.winBarV, mBeam, x + nx * 0.07, y + 0.4, z + nz * 0.07, ry); K.put('barH', GEO.winBarH, mBeam, x + nx * 0.07, y + 0.45, z + nz * 0.07, ry);
      K.put('sill', GEO.sill, mSnow, x + nx * 0.06, y - 0.04, z + nz * 0.06, ry);
    }
  };

  // ---------- the house: stone base, plaster + oversized beams, thick slate roof under a snow pillow, chimney ----------
  const ROOF_TINTS = ['#5f6b95', '#6d6a9c', '#56709a', '#4f5a82', '#76749f'];
  const house = ({ cx, cz, w, d, storeys = 2, face = [0, 1], seed = 1, school = false, signText = null, details = true, signOnRoof = false }) => {
    const mRoof = M('shingle', ROOF_TINTS[Math.floor(rnd(seed, 61) * ROOF_TINTS.length)]);
    const base = school ? 0.45 : 0.5, sh = 1.15, hw = storeys * sh, top = base + hw;
    const plaster = M('plaster', school ? '#d9cfa6' : PAL.plaster[Math.floor(rnd(seed, 3) * PAL.plaster.length)]);
    K.add(rbox(w + 0.14, d + 0.14, base + 0.05, 0.08), mStone, cx, 0, cz);
    K.add(rbox(w, d, hw, 0.06), plaster, cx, base, cz);
    // oversized beams: corner posts, floor bands, braces on the long faces
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.add(rbox(0.22, 0.22, hw + 0.04, 0.04), mBeam, cx + sx * (w / 2 - 0.06), base - 0.02, cz + sz * (d / 2 - 0.06));
    for (let s = 1; s <= storeys; s++) { const y = base + s * sh - 0.12; K.add(rbox(w + 0.06, 0.16, 0.18, 0.04), mBeam, cx, y, cz + d / 2 + 0.01); K.add(rbox(w + 0.06, 0.16, 0.18, 0.04), mBeam, cx, y, cz - d / 2 - 0.01); K.add(rbox(0.16, d + 0.06, 0.18, 0.04), mBeam, cx + w / 2 + 0.01, y, cz); K.add(rbox(0.16, d + 0.06, 0.18, 0.04), mBeam, cx - w / 2 - 0.01, y, cz); }
    const longX = w >= d;
    if (Math.max(w, d) > 1.6) for (const sgn of [-1, 1]) { // diagonal braces near the corners
      const L = Math.min(1.1, sh * 0.95), ang = Math.atan2(sh * 0.7, 0.6);
      if (longX) for (const fz of [d / 2 + 0.03, -d / 2 - 0.03]) K.add(rbox(L, 0.1, 0.12, 0.03), mBeam, cx + sgn * (w / 2 - 0.5), base + 0.4, cz + fz, 0, 0, sgn * ang);
      else for (const fx of [w / 2 + 0.03, -w / 2 - 0.03]) K.add(rbox(0.1, L, 0.12, 0.03), mBeam, cx + fx, base + 0.4, cz + sgn * (d / 2 - 0.5), sgn * ang, 0, 0);
    }
    // windows on all four faces, door on the facing side
    const doorU = 0;
    for (let s = 0; s < storeys; s++) {
      const y = base + s * sh + 0.2;
      windows(cx, cz + d / 2, 'x', w, [0, 1], y, s === 0 && face[1] > 0 ? doorU : null); windows(cx, cz - d / 2, 'x', w, [0, -1], y, s === 0 && face[1] < 0 ? doorU : null);
      if (d > 1.3) { windows(cx + w / 2, cz, 'z', d, [1, 0], y, s === 0 && face[0] > 0 ? doorU : null); windows(cx - w / 2, cz, 'z', d, [-1, 0], y, s === 0 && face[0] < 0 ? doorU : null); }
    }
    {
      const [fx, fz] = face, dx = cx + fx * ((w / 2) + 0.03), dz = cz + fz * ((d / 2) + 0.03), ry = Math.atan2(fx, fz);
      K.add(rbox(0.96, 0.14, 1.32, 0.04), mBeam, dx, base - 0.02, dz, 0, ry); K.add(rbox(0.72, 0.1, 1.12, 0.03), mWood, dx + fx * 0.03, base, dz + fz * 0.03, 0, ry);
      K.put('knob', new SphereGeometry(0.04, 6, 4), mMetal, dx + fx * 0.1 + Math.cos(ry) * 0.22, base + 0.55, dz + fz * 0.1 - Math.sin(ry) * 0.22);
      K.add(rbox(1.1, 0.5, 0.12, 0.05), mStoneDark, dx + fx * 0.25, 0, dz + fz * 0.25, 0, ry); // step
      K.add(rbox(1.25, 0.55, 0.06, 0.03), mShingle, dx + fx * 0.25, base + 1.42, dz + fz * 0.25, fz ? -fz * 0.35 : 0, ry, fx ? fx * 0.35 : 0); // little awning
      K.add(rbox(1.3, 0.6, 0.14, 0.06), mSnow, dx + fx * 0.27, base + 1.5, dz + fz * 0.27, fz ? -fz * 0.35 : 0, ry, fx ? fx * 0.35 : 0);
      lantern(dx + fx * 0.15 + Math.cos(ry) * 0.62, base + 1.0, dz + fz * 0.15 - Math.sin(ry) * 0.62);
      if (signText && !signOnRoof) { const sg = sign(signText, Math.min(3.2, w * 0.55)); sg.position.set(cx + fx * (w / 2 + 0.06), top + 0.05, cz + fz * (d / 2 + 0.06)); sg.rotation.y = ry; group.add(sg); }
      else if (details && rnd(seed, 17) < 0.45) { // hanging sign on a bracket
        const bx = dx + Math.cos(ry) * -0.85, bz = dz - Math.sin(ry) * -0.85;
        K.add(rbox(0.06, 0.6, 0.06, 0.02), mMetal, bx + fx * 0.3, base + 1.55, bz + fz * 0.3, Math.PI / 2 * (fz ? 1 : 0), 0, Math.PI / 2 * (fx ? 1 : 0));
        K.add(rbox(0.5, 0.05, 0.36, 0.03), M('fabric', PAL.fabric[Math.floor(rnd(seed, 5) * PAL.fabric.length)]), bx + fx * 0.5, base + 1.1, bz + fz * 0.5, 0, ry);
      }
    }
    // thick roof: wooden gable, two slate slabs, a rounded snow pillow, ridge snow, drips and icicles
    const span = (longX ? d : w), L = (longX ? w : d) + 0.5, rise = Math.min(1.5, span * 0.5), over = 0.3, ry = longX ? Math.PI / 2 : 0;
    K.add(prism(span, (longX ? w : d), rise * 0.92), M('wood', '#7b625c'), cx, top, cz, 0, ry);
    const half = span / 2 + over, slope = Math.atan2(rise, span / 2), slab = Math.hypot(half, rise * (half / (span / 2)));
    for (const sgn of [-1, 1]) {
      const ox = sgn * (half / 2) * Math.cos(slope) * 0 + sgn * span / 4, oy = rise / 2;
      const lx = longX ? cx : cx + sgn * span / 4 * 1.0, lz = longX ? cz + sgn * span / 4 : cz;
      const tilt = -sgn * slope;
      const rx = longX ? -tilt : 0, rz = longX ? 0 : tilt;
      K.add(rbox(longX ? L : slab, longX ? slab : L, 0.3, 0.07), mRoof, lx, top + oy - 0.16, lz, rx, 0, rz);
      K.add(rbox(longX ? L - 0.42 : slab * 0.8, longX ? slab * 0.8 : L - 0.42, 0.34, 0.16, 3), mSnow, lx - (longX ? 0 : sgn * 0.06), top + oy + 0.08, lz - (longX ? sgn * 0.06 : 0), rx, 0, rz);
      // eave drips + icicles along the low edge
      const reach = span / 2 + over / 2 - 0.25, ex = longX ? cx : cx + sgn * reach, ez = longX ? cz + sgn * reach : cz, ey = top - (over / 2 - 0.17) * Math.tan(slope) + 0.12;
      for (let k = 0, n = Math.floor(L / 0.45); k <= n; k++) {
        const u = -L / 2 + 0.4 + (L - 0.8) * k / n, px = longX ? ex + u : ex, pz = longX ? ez : ez + u;
        if (low) continue;
        K.put('drip', GEO.drip, mSnow, px, ey + 0.06, pz, 0, 1 + rnd(k, seed) * 0.4, 0.8, 1);
        if (rnd(k * 3, seed) < 0.35) K.put('icicle', GEO.icicle, mIce, px, ey - 0.25, pz, 0, 1, 0.6 + rnd(k, seed * 2) * 0.8, 1, Math.PI);
      }
    }
    K.add(new CapsuleGeometry(0.22, L - 0.8, 4, 10), mSnow, cx, top + rise + 0.12, cz, longX ? 0 : Math.PI / 2, 0, longX ? Math.PI / 2 : 0);
    if (signText && signOnRoof) { const sg = sign(signText, Math.min(3.6, w * 0.5)); sg.position.set(cx, top + rise + 0.75, cz + 0.05); group.add(sg); K.add(rbox(0.1, 0.1, 0.8, 0.03), mBeam, cx - 1.2, top + rise - 0.1, cz); K.add(rbox(0.1, 0.1, 0.8, 0.03), mBeam, cx + 1.2, top + rise - 0.1, cz); }
    // prominent chimney with a snow cap and smoke
    if (details && rnd(seed, 23) < 0.8) {
      const u = (rnd(seed, 29) < 0.5 ? -1 : 1) * (L / 2 - 0.7), side = rnd(seed, 31) < 0.5 ? -1 : 1;
      const chx = cx + (longX ? u : side * span * 0.2), chz = cz + (longX ? side * span * 0.2 : u), chH = rise + 1.35;
      K.add(rbox(0.68, 0.68, chH, 0.07), mStoneDark, chx, top + 0.1, chz);
      K.add(rbox(0.86, 0.86, 0.16, 0.05), M('stone', PAL.slateDark), chx, top + 0.1 + chH, chz);
      K.add(rbox(0.88, 0.88, 0.24, 0.12), mSnow, chx, top + 0.26 + chH, chz);
      K.put('chimneyPot', new CylinderGeometry(0.12, 0.14, 0.32, 10), mMetal, chx + 0.15, top + 0.4 + chH, chz - 0.1);
      glows.push([chx + 0.15, top + 0.62 + chH, chz - 0.1, 0.55]);
      smokeSources.push([chx + 0.15, top + 0.65 + chH, chz - 0.1]);
    }
    // a metal pipe down a back corner
    if (details && rnd(seed, 37) < 0.5) { const [fx, fz] = face; pipe(cx - fx * (w / 2 + 0.08) + (fz ? w / 2 - 0.3 : 0), cz - fz * (d / 2 + 0.08) + (fx ? d / 2 - 0.3 : 0), top - 0.1, Math.atan2(-fx, -fz)); }
    return { top: top + rise };
  };

  // ---------- edge buildings and nature (quieter around the edges) ----------
  if (arena.world) buildSnowtown({ arena: { ...arena, x0, z0 }, K, M, T, PAL, GEO, rbox, prism, rnd, at, group, glows, smokeSources, lights, low, lantern, windows, pine, rock, barrel, crate, firewood, shovel, mSnow, mStone, mStoneDark, mBeam, mWood, mMetal, mIce, mGlass, sign, life, pools, centreFlags, makeFlag, look });
  else {
  const used = new Set(), key = (i, j) => i + ',' + j;
  const isH = (i, j) => i >= 0 && j >= 0 && i < W && j < H && rows[j][i] === 'H' && !used.has(key(i, j));
  let seed = 1;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!isH(i, j)) continue;
    const horizontal = isH(i + 1, j);
    let len = 1; const maxLen = 2 + Math.floor(rnd(i, j) * 2);
    while (len < maxLen && (horizontal ? isH(i + len, j) : isH(i, j + len))) len++;
    for (let k = 0; k < len; k++) used.add(horizontal ? key(i + k, j) : key(i, j + k));
    const [ax, az] = at(i, j), [bx, bz] = at(horizontal ? i + len - 1 : i, horizontal ? j : j + len - 1);
    const cx = (ax + bx) / 2, cz = (az + bz) / 2, top = j < 2, bottom = j > H - 3, left = i === 0, right = i === W - 1;
    const out = top ? -0.7 : bottom ? 0.7 : 0, sideOut = left ? -0.7 : right ? 0.7 : 0;
    const face = top ? [0, 1] : bottom ? [0, -1] : left ? [1, 0] : [-1, 0];
    seed++;
    const natureChance = bottom ? 1 : (left || right) ? 0.35 : 0.15;
    if (rnd(i * 5, j * 3) < natureChance) { // pines, rocks and a fence stub
      for (let k = 0; k < len; k++) { const [x, z] = at(horizontal ? i + k : i, horizontal ? j : j + k); if (bottom) { rock(x + sideOut * 0.4, z + 0.2, 0.9 + rnd(x, z) * 0.5); if (rnd(z, x) < 0.5) rock(x + 0.4, z + 0.5, 0.6); } else pine(x + sideOut * 0.5, z + out * 0.5, 0.95 + rnd(x, z) * 0.35); }
      continue;
    }
    const w = horizontal ? len - 0.08 : 1.2 + 0.4, d = horizontal ? 1.6 : len - 0.08;
    house({ cx: cx + sideOut, cz: cz + out, w, d, storeys: top ? 2 + (rnd(i, j * 7) < 0.4 ? 1 : 0) : 2, face, seed });
    // outside the edge: quiet props (barrels, crates, firewood, shovels)
    const px = cx + sideOut * 2.1 + (horizontal ? (rnd(seed, 2) - 0.5) * len : 0), pz = cz + out * 2.1 + (horizontal ? 0 : (rnd(seed, 3) - 0.5) * len);
    const pick = rnd(seed, 41);
    if (pick < 0.3) { barrel(px, pz); barrel(px + 0.55, pz + 0.2); } else if (pick < 0.55) { crate(px, pz, 0.3); crate(px + 0.6, pz - 0.1, -0.2); crate(px + 0.3, pz, 0.1, 0.5); } else if (pick < 0.8) firewood(px, pz, horizontal ? 0 : Math.PI / 2); else shovel(px, pz, 0.8);
  }
  // a few pines and rocks scattered beyond the edge: the harsh land around the settlement
  for (let k = 0; k < (low ? 18 : quality === 'high' ? 50 : 34); k++) {
    const a = rnd(k, 101) * 6.28, x = Math.cos(a) * (W / 2 + 2.5 + rnd(k, 103) * 7), z = Math.sin(a) * (H / 2 + 2.5 + rnd(k, 107) * 7);
    if (rnd(k, 109) < 0.65) pine(x, z, 0.9 + rnd(k, 111) * 0.6); else rock(x, z, 0.8 + rnd(k, 113) * 0.8);
  }
  }

  // ---------- Our School: long building with a bell tower and a sign ----------
  {
    const s = tiles('S'); if (s.length) { const is = s.map(t => t[0]), js = s.map(t => t[1]);
    const [ax, az] = at(Math.min(...is), Math.min(...js)), [bx, bz] = at(Math.max(...is), Math.max(...js));
    const cx = (ax + bx) / 2, cz = (az + bz) / 2 + 0.35, w = bx - ax + 1, d = bz - az + 1.3;
    const r = house({ cx, cz, w, d, storeys: 1, face: [0, -1], seed: 77, school: true, signText: 'Our School', signOnRoof: true });
    // bell tower
    K.add(rbox(1.0, 1.0, 1.2, 0.06), M('plaster', '#d9cfa6'), cx, r.top - 0.4, cz); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.add(rbox(0.14, 0.14, 1.25, 0.03), mBeam, cx + sx * 0.45, r.top - 0.4, cz + sz * 0.45);
    K.add(new CylinderGeometry(0.22, 0.3, 0.36, 12, 1, true), M('metal', '#c9a24a'), cx, r.top + 0.45, cz);
    K.add(new ConeGeometry(0.85, 0.9, 4), mShingle, cx, r.top + 1.25, cz, 0, Math.PI / 4); K.add(new ConeGeometry(0.8, 0.7, 4), mSnow, cx, r.top + 1.36, cz, 0, Math.PI / 4);
    lights.push([cx, 1.6, cz - d / 2 - 0.6]); }
  }

  // ---------- the rivals' snow fort ----------
  {
    const k = tiles('K'); const rc = CONFIG.teams[rivalTeam]?.color || '#c8584a'; if (k.length) {
    for (const [i, j] of k) { const [x, z] = at(i, j); K.add(rbox(1.02, 1.02, 1.3, 0.22, 3), mSnow, x, 0, z); if ((i + j) % 2 === 0) K.add(rbox(0.5, 0.5, 0.45, 0.18, 3), mSnow, x, 1.25, z); K.add(rbox(1.04, 1.04, 0.35, 0.08), mStone, x, 0, z); }
    const is = k.map(t => t[0]), js = k.map(t => t[1]), [fx, fz] = at((Math.min(...is) + Math.max(...is)) / 2, Math.min(...js));
    K.add(new CylinderGeometry(0.05, 0.05, 3.2, 8), mWood, fx, 2.6, fz - 0.4);
    const flag = new Mesh(new PlaneGeometry(1.3, 0.75, 8, 1), new MeshLambertMaterial({ color: rc, map: T.fabric(), side: DoubleSide })); flag.position.set(fx + 0.65, 3.7, fz - 0.4); group.add(flag); group.userData.rivalFlag = flag;
    fireBarrel(fx - 2.4, fz - 1.1); fireBarrel(fx + 2.4, fz - 1.1); // just outside the fort wall
    lights.push([fx, 1.6, fz - 1.0]); }
  }

  // ---------- quiet scenery: the mosque behind its fence ----------
  {
    const m = tiles('M'); if (m.length) {
      const js = m.map(t => t[1]), is = m.map(t => t[0]), [cx, cz] = at(Math.max(...is) + 2, (Math.min(...js) + Math.max(...js)) / 2);
      const stoneLight = M('stone', '#c9c6dc');
      K.add(rbox(4.4, 4.4, 2.4, 0.14), stoneLight, cx, 0, cz);
      K.add(new SphereGeometry(1.8, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), M('plaster', '#a99bd2'), cx, 2.4, cz);
      K.add(new SphereGeometry(1.85, 28, 6, 0, Math.PI * 2, 0, Math.PI / 4.5), mSnow, cx, 2.4, cz);
      const mx = cx - 1.7, mz = cz - 2.5;
      K.add(new CylinderGeometry(0.3, 0.36, 6.4, 14), stoneLight, mx, 3.2, mz); K.add(new CylinderGeometry(0.52, 0.52, 0.24, 14), mSnow, mx, 5.0, mz); K.add(new ConeGeometry(0.34, 1.4, 14), M('plaster', '#a99bd2'), mx, 7.1, mz);
      windows(cx, cz + 2.2, 'x', 4.4, [0, 1], 0.7, null, 0.1); windows(cx - 2.2, cz, 'z', 4.4, [-1, 0], 0.7, null, 0.1);
    }
  }

  // ---------- the central outpost lodge (dominant) ----------
  const zonePlaces = arena.places.filter(p => p.kind === 'zone');
  const flags = new Map();
  const lodge = (cx, cz) => {
    let flag = null;
    K.add(rbox(2.5, 2.5, 0.95, 0.12), mStone, cx, 0, cz);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { K.add(rbox(0.5, 0.5, 1.1, 0.08), mStoneDark, cx + sx * 1.15, 0, cz + sz * 1.15); K.put('capS', GEO.snowCap, mSnow, cx + sx * 1.15, 1.08, cz + sz * 1.15, 0, 0.32, 0.16, 0.32); }
    K.add(rbox(2.0, 2.0, 1.4, 0.08), M('plaster', '#c2b6e2'), cx, 0.9, cz);
    K.add(rbox(2.5, 2.5, 1.35, 0.08), M('plaster', '#b3c6e6'), cx, 2.3, cz); // jettied upper floor
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { K.add(rbox(0.28, 0.28, 1.45, 0.05), mBeam, cx + sx * 0.92, 0.88, cz + sz * 0.92); K.add(rbox(0.28, 0.28, 1.4, 0.05), mBeam, cx + sx * 1.16, 2.28, cz + sz * 1.16); K.add(rbox(0.22, 0.6, 0.22, 0.05), mBeam, cx + sx * 1.04, 2.05, cz + sz * 1.04, sz * 0.6, 0, -sx * 0.6); }
    for (const y of [2.24, 3.58]) for (const sgn of [-1, 1]) { K.add(rbox(2.62, 0.2, 0.22, 0.05), mBeam, cx, y, cz + sgn * 1.26); K.add(rbox(0.2, 2.62, 0.22, 0.05), mBeam, cx + sgn * 1.26, y, cz); }
    for (const [fx, fz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { windows(cx + fx * 1.0, cz + fz * 1.0, fz ? 'x' : 'z', 2.0, [fx, fz], 1.15, fz ? 0 : null, 0); windows(cx + fx * 1.25, cz + fz * 1.25, fz ? 'x' : 'z', 2.5, [fx, fz], 2.55, null, 0); }
    // doors front and back, lanterns on all sides
    for (const fz of [1, -1]) { K.add(rbox(0.96, 0.14, 1.3, 0.04), mBeam, cx, 0.88, cz + fz * 1.03, 0, 0); K.add(rbox(0.72, 0.1, 1.12, 0.03), mWood, cx, 0.9, cz + fz * 1.07); }
    for (const [fx, fz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) lantern(cx + fx * 1.32 + (fz ? 0.75 : 0), 2.0, cz + fz * 1.32 + (fx ? 0.75 : 0), fz === 1 && fx === 0);
    // big pyramid roof: slate under a thick snow cap, a lookout with a bell and the outpost flag
    K.add(new ConeGeometry(2.75, 2.0, 4, 1), M('shingle', '#4f5a86'), cx, 4.65, cz, 0, Math.PI / 4);
    K.add(new ConeGeometry(2.6, 0.32, 4, 1, true), M('beam', PAL.woodDark), cx, 3.72, cz, 0, Math.PI / 4);
    K.add(new ConeGeometry(2.15, 1.72, 4, 1), mSnow, cx, 4.95, cz, 0, Math.PI / 4);
    K.add(new SphereGeometry(0.5, 14, 10), mSnow, cx, 5.55, cz, 0, 0, 0, 1, 0.5, 1);
    for (const sgn of [-1, 1]) for (let k = 0; k < 8; k++) { const u = -1.6 + k * 0.46, uu = u * 0.9; K.put('drip', GEO.drip, mSnow, cx + uu, 4.12, cz + sgn * 1.48, 0, 1.25, 0.9, 1); K.put('drip', GEO.drip, mSnow, cx + sgn * 1.48, 4.12, cz + uu, 0, 1.25, 0.9, 1); if (k % 2) { K.put('icicle', GEO.icicle, mIce, cx + u, 3.42, cz + sgn * 1.9, 0, 1.2, 1.2, 1.2, Math.PI); K.put('icicle', GEO.icicle, mIce, cx + sgn * 1.9, 3.42, cz + u, 0, 1.2, 1.2, 1.2, Math.PI); } }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.add(rbox(0.12, 0.12, 0.9, 0.03), mBeam, cx + sx * 0.38, 5.55, cz + sz * 0.38);
    K.add(new ConeGeometry(0.72, 0.6, 4), mShingle, cx, 6.75, cz, 0, Math.PI / 4); K.add(new ConeGeometry(0.66, 0.5, 4), mSnow, cx, 6.84, cz, 0, Math.PI / 4);
    K.add(new CylinderGeometry(0.16, 0.24, 0.32, 12, 1, true), M('metal', '#c9a24a'), cx, 6.1, cz);
    K.add(new CylinderGeometry(0.035, 0.035, 1.8, 8), mWood, cx, 7.7, cz);
    flag = new Mesh(new PlaneGeometry(1.1, 0.62, 8, 1), new MeshLambertMaterial({ color: '#ffffff', map: T.fabric(), side: DoubleSide })); flag.position.set(cx + 0.56, 8.25, cz); group.add(flag);
    // a tall stone chimney with firelight and smoke
    K.add(rbox(0.6, 0.6, 3.4, 0.07), mStone, cx + 0.95, 3.4, cz - 0.6); K.add(rbox(0.76, 0.76, 0.16, 0.05), mStoneDark, cx + 0.95, 6.8, cz - 0.6); K.add(rbox(0.8, 0.8, 0.22, 0.1), mSnow, cx + 0.95, 6.95, cz - 0.6);
    smokeSources.push([cx + 0.95, 7.3, cz - 0.6], [cx + 0.95, 7.3, cz - 0.6]);
    const sg = sign('OUTPOST', 1.8); sg.position.set(cx, 3.95, cz + 1.31); group.add(sg);
    const sg2 = sign('OUTPOST', 1.8); sg2.position.set(cx, 3.95, cz - 1.31); sg2.rotation.y = Math.PI; group.add(sg2);
    lights.push([cx, 1.8, cz + 1.9]);
    return flag;
  };
  for (const zp of zonePlaces) flags.set(zp.id, centreFlags.get(zp.id) || lodge(zp.x, zp.z));

  // ---------- cover pieces ----------
  for (const [i, j] of tiles('#')) { const [x, z] = at(i, j); K.add(rbox(1.0, 1.0, 0.45, 0.06), mStone, x, 0, z); K.add(rbox(0.96, 0.94, 0.85, 0.26, 3), M('snow', '#dfe6f7'), x, 0.35, z); K.put('wallCap', GEO.snowCap, mSnow, x, 1.12, z, rnd(i, j) * 3, 0.42, 0.18, 0.42); }
  for (const [i, j] of tiles('b')) { const [x, z] = at(i, j); K.add(rbox(0.95, 0.46, 0.14, 0.04), mWood, x, 0.4, z); K.add(rbox(0.95, 0.12, 0.42, 0.04), mWood, x, 0.55, z - 0.2); for (const dx of [-0.38, 0.38]) K.add(rbox(0.08, 0.4, 0.42, 0.02), mMetal, x + dx, 0, z); K.add(rbox(0.92, 0.48, 0.16, 0.08), mSnow, x, 0.54, z + 0.02); }
  if (!arena.world) for (const [i, j] of tiles('c')) { // a loaded cargo sled with a tarp and snow
    const [x, z] = at(i, j), ry = rnd(i, j) < 0.5 ? 0 : Math.PI;
    K.add(rbox(1.7, 0.85, 0.45, 0.06), mWood, x, 0.15, z, 0, ry); for (const s of [-0.38, 0.38]) K.add(rbox(1.9, 0.07, 0.1, 0.03), mMetal, x, 0.02, z + s, 0, ry);
    crate(x - 0.4, z, 0.1, 0.6); barrel(x + 0.45, z, false); K.put('barrelY', GEO.barrel, mWood, x + 0.45, 0.6 + 0.31, z);
    K.add(rbox(1.0, 0.9, 0.22, 0.1), M('fabric', PAL.fabric[(i + j) % PAL.fabric.length]), x - 0.35, 1.1, z, 0, ry); K.add(rbox(1.1, 0.95, 0.22, 0.12, 3), mSnow, x - 0.3, 1.25, z, 0, ry);
  }
  for (const [i, j] of tiles('n')) { const [x, z] = at(i, j); K.put('snowB', new SphereGeometry(0.42, 16, 12), mSnow, x, 0.38, z); K.put('snowT', new SphereGeometry(0.29, 16, 12), mSnow, x, 0.96, z); K.put('nose', new ConeGeometry(0.05, 0.26, 8), M('glow', '#f08a24'), x, 0.98, z + 0.34, 0, 1, 1, 1, Math.PI / 2); K.put('scarf', new TorusGeometry(0.25, 0.06, 6, 16), M('fabric', '#c8584a'), x, 0.73, z, 0, 1, 1, 1, Math.PI / 2); K.put('hat', new CylinderGeometry(0.17, 0.2, 0.28, 12), M('fabric', PAL.navy), x, 1.3, z); }
  for (const [i, j] of tiles('t')) { const [x, z] = at(i, j); pine(x, z, 0.9); }
  if (!arena.world) for (const [i, j] of tiles('L')) { const [x, z] = at(i, j); K.put('lampPost', GEO.post, mMetal, x, 1.0, z, 0, 1, 2.0, 1); K.add(rbox(0.3, 0.3, 0.08, 0.03), mMetal, x, 0.0, z); lantern(x, 2.0, z); }
  for (const [i, j] of tiles('F')) { const [x, z] = at(i, j); const v = rows[j][i - 1] !== 'F' && rows[j][i + 1] !== 'F'; for (const d of [-0.4, 0.4]) K.put('fpost', rbox(0.14, 0.14, 0.85, 0.03), mWood, x + (v ? 0 : d), 0, z + (v ? d : 0)); for (const y of [0.3, 0.62]) K.add(rbox(v ? 0.08 : 1.0, v ? 1.0 : 0.08, 0.1, 0.02), mWood, x, y, z); K.add(rbox(v ? 0.16 : 1.0, v ? 1.0 : 0.16, 0.1, 0.05), mSnow, x, 0.72, z); for (const d of [-0.4, 0.4]) K.put('fcap', GEO.snowCap, mSnow, x + (v ? 0 : d), 0.84, z + (v ? d : 0), 0, 0.11, 0.08, 0.11); }
  for (const [i, j] of tiles('B')) { const [x, z] = at(i, j); for (let k = 0; k < 3; k++) { const a = rnd(i * 3 + k, j) * 6.28, r = 0.15 + rnd(j, i * 5 + k) * 0.12, s = 0.42 + rnd(i, j + k) * 0.1; K.put('shrub' + (k % 2), new IcosahedronGeometry(1, 1), M('plaster', k % 2 ? PAL.pine : PAL.pine2), x + Math.cos(a) * r, s * 0.9, z + Math.sin(a) * r, a, s); } K.put('shrubSnow', GEO.snowCap, mSnow, x, 0.82, z, 0, 0.52, 0.32, 0.52); }
  for (const [i, j] of tiles('f')) { const [x, z] = at(i, j); fireBarrel(x, z); }

  // snowdrifts (refill mounds) — instanced so they can shrink while refilling
  const o = new Object3D();
  const drift = new InstancedMesh(new IcosahedronGeometry(0.55, 2), new MeshLambertMaterial({ color: '#ffffff', map: T.snow(), emissive: new Color('#c7dcff'), emissiveIntensity: 0.25 }), arena.drifts.length);
  const setDrift = (k, t) => { const [x, z] = arena.drifts[k]; o.position.set(x, -0.1 + 0.16 * t, z); o.rotation.set(0, k, 0); o.scale.set(1.2, 0.5 + 0.45 * t, 1.0); o.updateMatrix(); drift.setMatrixAt(k, o.matrix); };
  arena.drifts.forEach((_, k) => setDrift(k, 1)); drift.receiveShadow = true; group.add(drift);

  // strings of lanterns round each outpost plaza: warm while free, the holder's colour once taken
  const bulbs = [], bulbZone = [];
  if (arena.world) for (const zp of zonePlaces) {
    const posts = [];
    for (let k = 0; k < 8; k++) {
      const a = (k + 0.5) / 8 * Math.PI * 2, x = zp.x + Math.cos(a) * (zp.r + 1.7), z = zp.z + Math.sin(a) * (zp.r + 1.7);
      const ci = Math.floor(x - x0), cj = Math.floor(z - z0), c = rows[cj]?.[ci] || 'X';
      if ('HSKQCGRDlWO#f'.includes(c)) { posts.push(null); continue; }
      K.put('lpost', GEO.post, mBeam, x, 0.9, z, 0, 1.1, 1.8, 1.1); K.put('lpostCap', GEO.snowCap, mSnow, x, 1.8, z, 0, 0.2, 0.1, 0.2); K.put('lpostMound', GEO.snowCap, mSnow, x, 0, z, 0, 0.6, 0.25, 0.6);
      posts.push([x, 1.72, z]);
    }
    for (let k = 0; k < 8; k++) {
      const a = posts[k], b = posts[(k + 1) % 8]; if (!a || !b) continue;
      const L = Math.hypot(b[0] - a[0], b[2] - a[2]), ry = Math.atan2(b[0] - a[0], b[2] - a[2]);
      for (let s2 = 0; s2 < 2; s2++) { const t0 = s2 / 2, t1 = (s2 + 1) / 2, y0 = a[1] - 0.35 * 4 * t0 * (1 - t0), y1 = a[1] - 0.35 * 4 * t1 * (1 - t1); K.put('lwire', new BoxGeometry(1, 1, 1), mBeam, a[0] + (b[0] - a[0]) * (t0 + t1) / 2, (y0 + y1) / 2, a[2] + (b[2] - a[2]) * (t0 + t1) / 2, ry, 0.02, 0.02, L / 2 + 0.05, (y1 - y0) / (L / 2) * -1); }
      for (let m = 1; m <= 5; m++) { const t = m / 6; bulbs.push([a[0] + (b[0] - a[0]) * t, a[1] - 0.35 * 4 * t * (1 - t) - 0.06, a[2] + (b[2] - a[2]) * t]); bulbZone.push(zp.id); }
    }
  }

  K.build(group, true);

  // warm pools of light on the snow under street lamps and round the fire barrels
  if (arena.world) for (const { x, z } of fires) pools.push([x, z, 2.2]);
  const poolGeo = new PlaneGeometry(1, 1); poolGeo.rotateX(-Math.PI / 2);
  const poolMesh = new InstancedMesh(poolGeo, new MeshBasicMaterial({ map: glow(), blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: LOOK.v2 ? 0.14 : 0.35 }), Math.max(1, pools.length));
  poolMesh.count = pools.length; poolMesh.renderOrder = 2;
  pools.forEach(([x, z, r], k) => { const o2 = new Object3D(); o2.position.set(x, 0.2, z); o2.scale.set(r * 2, 1, r * 2); o2.updateMatrix(); poolMesh.setMatrixAt(k, o2.matrix); });
  group.add(poolMesh);
  // the lantern bulbs
  const BULB_WARM = [new Color('#ffcf7a'), new Color('#fff1c9')];
  const bulbMesh = new InstancedMesh(new IcosahedronGeometry(0.11, 0), new MeshBasicMaterial({ color: '#ffffff' }), Math.max(1, bulbs.length)); bulbMesh.count = bulbs.length;
  bulbs.forEach(([x, y, z], k) => { const o2 = new Object3D(); o2.position.set(x, y, z); o2.updateMatrix(); bulbMesh.setMatrixAt(k, o2.matrix); bulbMesh.setColorAt(k, BULB_WARM[k % 2]); });
  group.add(bulbMesh);
  const owners = new Map(); // zone id → { color, flash }
  // a soft glow on the snow round each held outpost
  const discs = new Map();
  if (arena.world) for (const zp of zonePlaces) { // three stacked translucent circles: soft towards the edge
    const d = new Group(); d.visible = false; d.userData.mats = [];
    for (const r of [zp.r + 3.4, zp.r + 2.0, zp.r + 0.6]) { const m = new MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, opacity: 0.13 }); const c = new Mesh(new CircleGeometry(r, 40), m); c.rotation.x = -Math.PI / 2; c.renderOrder = 2; d.add(c); d.userData.mats.push(m); }
    d.position.set(zp.x, 0.07, zp.z); group.add(d); discs.set(zp.id, d);
  }

  // glows (lanterns, fires, chimney pots) and chimney smoke: one billboard mesh each
  const bill = new PlaneGeometry(1, 1);
  const glowMesh = new InstancedMesh(bill, new MeshBasicMaterial({ map: glow(), blending: AdditiveBlending, depthWrite: false, transparent: true }), Math.max(1, glows.length));
  glowMesh.renderOrder = 4; glowMesh.frustumCulled = false; glowMesh.count = glows.length; group.add(glowMesh);
  const flameGeo = new ConeGeometry(0.15, 0.5, 7); flameGeo.translate(0, 0.25, 0);
  const flameMesh = new InstancedMesh(flameGeo, new MeshBasicMaterial({ color: '#ffffff' }), Math.max(1, fires.length * 3)); flameMesh.count = fires.length * 3; group.add(flameMesh);
  for (let k = 0; k < fires.length * 3; k++) flameMesh.setColorAt(k, new Color(k % 3 ? PAL.amberHot : PAL.fire));
  if (flameMesh.instanceColor) flameMesh.instanceColor.needsUpdate = true;
  // warm point lights (only a few: phones pay for every light)
  const pls = low ? [] : lights.slice(0, quality === 'high' ? 4 : 2).map(([x, y, z]) => { const l = new PointLight(PAL.amber, 14, 7.5, 1.6); l.position.set(x, y, z); group.add(l); return l; });
  const smokeTex = canvasTex('smoke', 64, (g, S) => { const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); gr.addColorStop(0, 'rgba(225,225,245,0.5)'); gr.addColorStop(1, 'rgba(225,225,245,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); });
  const smokeN = low ? 0 : smokeSources.length * 5;
  const smokeMesh = new InstancedMesh(bill, new MeshBasicMaterial({ map: smokeTex, transparent: true, depthWrite: false }), Math.max(1, smokeN)); smokeMesh.count = smokeN; smokeMesh.frustumCulled = false; group.add(smokeMesh);
  const smoke = []; for (const src of smokeSources) for (let k = 0; k < 5; k++) smoke.push({ src, t: k / 5 * 3 });
  const bo = new Object3D();

  // falling snow, blown by the wind
  const flakesN = low ? 250 : quality === 'high' ? 1100 : 600, fp = new Float32Array(flakesN * 3);
  for (let k = 0; k < flakesN; k++) { fp[k * 3] = (rnd(k, 1) - 0.5) * 40; fp[k * 3 + 1] = rnd(k, 2) * 14; fp[k * 3 + 2] = (rnd(k, 3) - 0.5) * 30; }
  const fg = new BufferGeometry(); fg.setAttribute('position', new Float32BufferAttribute(fp, 3));
  const flakeTex = canvasTex('flake', 32, (g, S) => { const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); });
  const flakes = new Points(fg, new PointsMaterial({ size: 0.16, map: flakeTex, transparent: true, depthWrite: false, opacity: 0.9 })); flakes.frustumCulled = false; group.add(flakes);

  // capture ring around the outpost (progress drawn each frame)
  const rings = new Map();
  for (const zp of zonePlaces) {
    const ringBase = new Mesh(new RingGeometry(zp.r - 0.16, zp.r, 72), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false }));
    ringBase.rotation.x = -Math.PI / 2; ringBase.position.set(zp.x, 0.045, zp.z); group.add(ringBase);
    const fill = new Mesh(new RingGeometry(1.25, zp.r - 0.16, 72, 1, 0, 0.001), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, depthWrite: false }));
    fill.rotation.x = -Math.PI / 2; fill.position.set(zp.x, 0.04, zp.z); group.add(fill);
    rings.set(zp.id, { ringBase, fill, r: zp.r, flag: flags.get(zp.id) });
  }

  let time = 0;
  return {
    group,
    life,
    updateDrift(k, t) { setDrift(k, t); drift.instanceMatrix.needsUpdate = true; },
    // who holds an outpost: lanterns, chimney smoke nearby and the snow glow take their colour
    setOwner(id, color) {
      const zp = zonePlaces.find(z => z.id === id); if (!zp) return;
      const col = new Color(color); owners.set(id, { col, flash: 2.5 });
      const d = discs.get(id); if (d) { d.userData.mats.forEach(m => m.color.copy(col)); d.visible = true; }
      smoke.forEach((u, k) => { if (Math.hypot(u.src[0] - zp.x, u.src[2] - zp.z) < 16) smokeMesh.setColorAt(k, new Color('#ffffff').lerp(col, 0.65)); });
      if (smokeMesh.instanceColor) smokeMesh.instanceColor.needsUpdate = true;
    },
    // weather: heavier, faster snow in a blizzard; the poyraz blows it sideways
    setWeather({ snow = 1, wx = 0, wz = 0 } = {}) { this.snowMul = snow; this.windX = wx; this.windZ = wz; flakes.material.size = 0.16 * (snow > 1.5 ? 1.5 : 1); flakes.material.opacity = snow > 1.5 ? 1 : 0.9; },
    // 0 = late afternoon, 1 = dusk: lamps, windows and lantern glows brighten
    setDusk(k) {
      glowMesh.material.opacity = 0.8 + 0.2 * k; poolMesh.material.opacity = LOOK.v2 ? 0.14 : 0.3 + 0.4 * k;
      mGlass.color.set(PAL.amber).lerp(new Color('#ffd27a'), k);
    },
    setZone(progress, homeColor, rivalColor, contested, t, id = null) {
      const zone = id ? rings.get(id) : rings.values().next().value; if (!zone) return; const flag = zone.flag;
      const p = Math.abs(progress), col = progress >= 0 ? homeColor : rivalColor;
      zone.fill.geometry.dispose(); zone.fill.geometry = new RingGeometry(1.25, zone.r - 0.16, 72, 1, Math.PI / 2, Math.max(0.001, p * Math.PI * 2));
      zone.fill.material.color.set(col); zone.fill.material.opacity = 0.32 + (contested ? 0.15 * Math.sin(t * 12) : 0);
      zone.ringBase.material.color.set(contested ? '#ffe066' : p > 0 ? col : '#ffffff');
      if (flag) flag.material.color.set(p > 0.02 ? col : '#ffffff');
    },
    tick(dt, focus, reduceMotion = false, camera = null) {
      time += dt;
      const q = camera ? camera.quaternion : null;
      fires.forEach(({ x, z }, f) => { for (let k = 0; k < 3; k++) { const s1 = 1 + Math.sin(time * (9 + k * 3) + f + k) * 0.12 + Math.sin(time * 23 + k) * 0.05; bo.position.set(x + (k - 1) * 0.08, 0.68, z + (k % 2) * 0.06); bo.quaternion.identity(); bo.scale.set(s1 * (1 - k * 0.2), s1 * (1 + 0.15 * Math.sin(time * 7 + k)) * (1 - k * 0.15), s1 * (1 - k * 0.2)); bo.updateMatrix(); flameMesh.setMatrixAt(f * 3 + k, bo.matrix); } });
      flameMesh.instanceMatrix.needsUpdate = true;
      if (owners.size) {
        let dirty = false;
        for (const [id, ow] of owners) {
          if (ow.flash < -1) continue; ow.flash -= dt; dirty = true;
          const chase = Math.floor(time * 10), white = new Color('#ffffff');
          bulbZone.forEach((zid, k) => { if (zid !== id) return; bulbMesh.setColorAt(k, ow.flash > 0 ? ((k + chase) % 3 ? ow.col : white) : (k % 2 ? ow.col : white.clone().lerp(ow.col, 0.35))); });
        }
        if (dirty && bulbMesh.instanceColor) bulbMesh.instanceColor.needsUpdate = true;
      }
      if (arena.world && pls.length && (this._lt = (this._lt || 0) - dt) <= 0) { this._lt = 0.5; const near = lights.map(p => [Math.hypot(p[0] - focus.x, p[2] - focus.z), p]).sort((a, b) => a[0] - b[0]); pls.forEach((l, k) => { const p = near[k]?.[1]; if (p) l.position.set(p[0], p[1], p[2]); }); }
      pls.forEach((l, k) => { l.intensity = 14 + Math.sin(time * 11 + k) * 1.5 + Math.sin(time * 27 + k * 2) * 0.8; });
      if (q) {
        glows.forEach(([x, y, z, sc], k) => { bo.position.set(x, y, z); bo.quaternion.copy(q); bo.scale.setScalar(sc * (0.93 + Math.sin(time * 6 + k) * 0.07)); bo.updateMatrix(); glowMesh.setMatrixAt(k, bo.matrix); });
        glowMesh.instanceMatrix.needsUpdate = true;
        smoke.forEach((u, k) => { u.t += dt * 0.35; if (u.t > 3) u.t -= 3; const a = u.t / 3, grow = Math.sin(Math.PI * Math.min(1, a * 1.15)); bo.position.set(u.src[0] + a * 1.6 + Math.sin(time + u.t * 3) * 0.1, u.src[1] + a * 2.4, u.src[2] - a * 0.5); bo.quaternion.copy(q); bo.scale.setScalar((0.4 + a * 1.4) * Math.max(0.05, grow)); bo.updateMatrix(); smokeMesh.setMatrixAt(k, bo.matrix); });
        if (smokeN) smokeMesh.instanceMatrix.needsUpdate = true;
      }
      for (const flag of flags.values()) { if (!flag) continue; const pos = flag.geometry.attributes.position; for (let v = 0; v < pos.count; v++) { const x = pos.getX(v) + 0.55; pos.setZ(v, Math.sin(time * 6 - x * 4) * 0.08 * x); } pos.needsUpdate = true; }
      const rf = group.userData.rivalFlag; if (rf) { const pos = rf.geometry.attributes.position; for (let v = 0; v < pos.count; v++) { const x = pos.getX(v) + 0.65; pos.setZ(v, Math.sin(time * 6 - x * 4 + 1) * 0.08 * x); } pos.needsUpdate = true; }
      const fpos = flakes.geometry.attributes.position.array;
      for (let k = 0; k < flakesN; k++) {
        const sm = this.snowMul || 1, wx = this.windX || 0, wz = this.windZ || 0;
        let x = fpos[k * 3] + dt * ((1.6 + Math.sin(time * 0.7 + k) * 0.5) * sm + wx * 3), y = fpos[k * 3 + 1] - dt * (1.4 + (k % 5) * 0.2) * sm, z = fpos[k * 3 + 2] + dt * wz * 3;
        if (y < 0) y += 14;
        if (x - focus.x > 20) x -= 40; else if (x - focus.x < -20) x += 40;
        if (z - focus.z > 15) z -= 30; else if (z - focus.z < -15) z += 30;
        fpos[k * 3] = x; fpos[k * 3 + 1] = y; fpos[k * 3 + 2] = z;
      }
      flakes.geometry.attributes.position.needsUpdate = true;
    },
  };
}
