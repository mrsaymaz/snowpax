// The sled journeys between outposts: an endless-runner ride through snowy Kasımpaşa.
// The sled runs forward by itself in three lanes: left/right to change lane, up to jump, down to
// duck. Jump over buried cars, snowmen and fences; duck under frozen laundry lines, low branches,
// awnings and swooping gulls; steer round sleeping cats. Collect snowflakes, golden word
// snowflakes (English word + Turkish meaning) and, on some runs, the letters of a word to spell
// (practice: never counted toward the 80%). A crash costs a life. Each run has its own themed
// scenery and ends at the next outpost.
import {
  Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, Fog, Color, Group, Mesh, MeshLambertMaterial, MeshBasicMaterial, Object3D,
  BoxGeometry, SphereGeometry, CylinderGeometry, ConeGeometry, PlaneGeometry, TorusGeometry, CapsuleGeometry, BufferAttribute, CanvasTexture,
  SRGBColorSpace, RepeatWrapping, Sprite, SpriteMaterial, InstancedMesh, AdditiveBlending,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Kid } from './render/kids.js';

const LANE = 1.8, LANES = [-LANE, 0, LANE];
const rnd = (a, b = 0) => { let h = Math.imul((a * 73856093) ^ (b * 19349663), 2654435761); h ^= h >>> 13; h = Math.imul(h, 1597334677); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// bake simple parts into one vertex-coloured geometry: [geometry, colour, x, y, z, rx, ry, rz, sx, sy, sz]
function bake(parts) {
  const o = new Object3D();
  return mergeGeometries(parts.map(([geo, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx]) => {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()); for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
    o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); o.updateMatrix(); g.applyMatrix4(o.matrix);
    const c = new Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new BufferAttribute(a, 3)); return g;
  }));
}
const B = (w, h, d) => new BoxGeometry(w, h, d), Sp = (r, a = 10, b = 7) => new SphereGeometry(r, a, b), Cy = (t, b, h, s = 10) => new CylinderGeometry(t, b, h, s), Co = (r, h, s = 8) => new ConeGeometry(r, h, s);
const SNOW = '#f4f7ff';

// ---------- shapes (one merged geometry each) ----------
const SHAPES = {
  car: () => bake([[B(1.3, 0.55, 1.9), '#c8584a', 0, 0.3, 0], [B(1.1, 0.35, 1.0), '#46557a', 0, 0.7, 0.1], [Sp(0.8, 10, 5), SNOW, 0, 0.75, 0, 0, 0, 0, 0.95, 0.5, 1.25], [Sp(0.85, 10, 4), SNOW, 0, 0.05, 0, 0, 0, 0, 1.0, 0.3, 1.3]]),
  snowman: () => bake([[Sp(0.5), SNOW, 0, 0.45, 0], [Sp(0.36), SNOW, 0, 1.05, 0], [Sp(0.25), SNOW, 0, 1.5, 0], [Co(0.05, 0.25, 6), '#f08a24', 0, 1.5, 0.3, Math.PI / 2], [Cy(0.2, 0.2, 0.25), '#2b2f45', 0, 1.78, 0], [Cy(0.3, 0.3, 0.03), '#2b2f45', 0, 1.66, 0], [Sp(0.04, 5, 4), '#1c2340', 0.09, 1.56, 0.22], [Sp(0.04, 5, 4), '#1c2340', -0.09, 1.56, 0.22], [new TorusGeometry(0.28, 0.07, 5, 12), '#e0463c', 0, 1.27, 0, Math.PI / 2]]),
  fence: () => bake([...[-2.4, -1.2, 0, 1.2, 2.4].map(x => [B(0.12, 0.85, 0.12), '#b9845a', x, 0.42, 0]), [B(5.4, 0.12, 0.08), '#b9845a', 0, 0.62, 0], [B(5.4, 0.12, 0.08), '#b9845a', 0, 0.3, 0], [B(5.5, 0.14, 0.22), SNOW, 0, 0.92, 0]]),
  line: () => bake([[Cy(0.07, 0.07, 2.4, 6), '#6a4a3a', -3.1, 1.2, 0], [Cy(0.07, 0.07, 2.4, 6), '#6a4a3a', 3.1, 1.2, 0], [B(6.2, 0.03, 0.03), '#4a4f6a', 0, 1.45, 0],
    ...[-2.2, -1.4, -0.6, 0.3, 1.1, 1.9, 2.6].map((x, k) => [B(k % 2 ? 0.28 : 0.42, k % 2 ? 0.34 : 0.48, 0.04), ['#e8584a', '#f2c14e', '#4f9de0', '#7cc47a', '#e889b5', '#ffffff', '#e8584a'][k], x, 1.45 - (k % 2 ? 0.2 : 0.27), 0]),
    ...[-2.2, -0.6, 1.1, 2.6].map(x => [B(0.44, 0.05, 0.08), SNOW, x, 1.47, 0])]),
  branch: () => bake([[Cy(0.22, 0.32, 3.2, 8), '#9a8c84', 3.0, 1.6, 0], [new CapsuleGeometry(0.11, 3.2, 3, 8), '#8a7a70', 1.1, 1.3, 0, 0, 0, Math.PI / 2 - 0.12], [Sp(0.5, 8, 5), SNOW, 0.6, 1.5, 0, 0, 0, 0, 2.6, 0.45, 0.9]]),
  awning: () => bake([[B(0.12, 1.6, 0.12), '#5d6b8f', -1.2, 0.8, 0.5], [B(0.12, 1.6, 0.12), '#5d6b8f', 1.2, 0.8, 0.5], [B(2.8, 0.1, 1.4), '#c8443c', 0, 1.3, 0, 0.12], ...[-1.05, -0.35, 0.35, 1.05].map(x => [B(0.35, 0.11, 1.42), '#f4f1ea', x, 1.31, 0, 0.12]), [B(2.8, 0.16, 1.3), SNOW, 0, 1.42, -0.05, 0.12]]),
  crate: () => bake([[B(0.9, 0.7, 0.9), '#b9845a', 0, 0.35, 0], [B(0.94, 0.12, 0.94), SNOW, 0, 0.76, 0], [Sp(0.18, 8, 6), '#e39a4f', 0, 0.95, 0, 0, 0, 0, 1.4, 0.8, 1], [Sp(0.13, 8, 6), '#e39a4f', 0, 1.05, 0.2], [Co(0.05, 0.1, 4), '#e39a4f', 0.07, 1.17, 0.2], [Co(0.05, 0.1, 4), '#e39a4f', -0.07, 1.17, 0.2]]), // a crate with a sleeping cat
  gull: () => bake([[Sp(0.18, 8, 6), '#ffffff', 0, 0, 0, 0, 0, 0, 1, 0.8, 1.8], [B(1.4, 0.03, 0.3), '#a9b1c6', 0, 0.05, 0], [Co(0.04, 0.12, 5), '#f0a43a', 0, 0.02, 0.36, Math.PI / 2]]),
  ramp: () => bake([[B(1.6, 0.05, 2.4), '#dfe8fa', 0, 0.3, 0, -0.26], [Sp(0.9, 10, 5), SNOW, 0, 0, -0.4, 0, 0, 0, 1.0, 0.65, 1.6], [B(0.08, 0.6, 0.08), '#e0463c', -0.85, 0.5, 1.0], [B(0.08, 0.6, 0.08), '#e0463c', 0.85, 0.5, 1.0]]),
  flake: () => { const arm = B(0.06, 0.5, 0.04); return mergeGeometries([0, 1, 2].map(k => { const g = arm.clone(); g.rotateZ(k * Math.PI / 3); return g; })); },
  house: k => { const cols = ['#d7cbe6', '#c9d9e8', '#e6d3c4', '#d3e3d6', '#e7cfd8'], roof = ['#5f6b95', '#6d6a9c', '#56709a'][k % 3], w = 2.6 + (k % 3) * 0.6, h = 1.6 + (k % 2) * 0.8;
    return bake([[B(w, h, 2.4), cols[k % cols.length], 0, h / 2, 0], [B(w + 0.3, 0.2, 2.7), roof, 0, h, 0], [Sp(1, 10, 4), SNOW, 0, h + 0.05, 0, 0, 0, 0, w * 0.6, 0.55, 1.5], [B(0.5, 0.6, 0.05), '#ffcf7a', -w / 4, h * 0.55, 1.22], [B(0.5, 0.6, 0.05), '#ffcf7a', w / 4, h * 0.55, 1.22], [B(0.3, 0.9, 0.3), '#4a4f6a', w / 3, h + 0.3, -0.4], [Sp(1, 8, 4), SNOW, 0, 0, 1.2, 0, 0, 0, w * 0.55, 0.45, 0.6]]); },
  plane: () => bake([[Cy(0.2, 0.32, 2.6, 8), '#9a8c84', 0, 1.3, 0], [Sp(0.18, 6, 4), '#d9cdb4', 0.15, 1.0, 0.2, 0, 0, 0, 1, 1.6, 0.4], [Sp(1, 9, 6), SNOW, 0, 3.0, 0, 0, 0, 0, 1.5, 0.9, 1.5], [Sp(0.7, 8, 5), SNOW, 0.8, 2.6, 0.3], [Sp(0.7, 8, 5), SNOW, -0.7, 2.7, -0.2]]),
  pine: () => bake([[Cy(0.12, 0.16, 0.8, 7), '#7a5a46', 0, 0.4, 0], [Co(1.0, 1.2), '#2e5f5e', 0, 1.1, 0], [Co(0.78, 1.0), '#3a7370', 0, 1.8, 0], [Co(0.52, 0.85), '#2e5f5e', 0, 2.4, 0], [Sp(0.5, 8, 4), SNOW, 0, 2.75, 0, 0, 0, 0, 0.8, 0.5, 0.8]]),
  lamp: () => bake([[Cy(0.07, 0.09, 2.6, 8), '#3d4a6b', 0, 1.3, 0], [B(0.5, 0.06, 0.06), '#3d4a6b', 0.22, 2.55, 0], [B(0.22, 0.3, 0.22), '#ffcf7a', 0.45, 2.35, 0], [Sp(0.5, 8, 4), SNOW, 0, 0, 0, 0, 0, 0, 0.9, 0.4, 0.8]]),
  stone: () => bake([[B(0.6, 0.3, 0.6), '#9aa0b8', 0, 0.15, 0], [Cy(0.13, 0.17, 2.4, 8), '#f1eef6', 0, 1.5, 0], [new TorusGeometry(0.15, 0.03, 5, 10), '#e2b450', 0, 1.2, 0, Math.PI / 2], [new TorusGeometry(0.14, 0.03, 5, 10), '#e2b450', 0, 2.2, 0, Math.PI / 2], [Sp(0.16, 8, 6), '#f1eef6', 0, 2.82, 0], [Sp(0.2, 8, 4), SNOW, 0, 2.92, 0, 0, 0, 0, 1, 0.5, 1]]),
  target: () => bake([[B(0.08, 1.5, 0.08), '#7a5a46', -0.3, 0.75, -0.15], [B(0.08, 1.5, 0.08), '#7a5a46', 0.3, 0.75, -0.15], ...['#f4efe2', '#2f2f3a', '#4f6fa8', '#c8584a', '#e6b93e'].map((c, k) => [Cy(0.6 - k * 0.12, 0.6 - k * 0.12, 0.12 + k * 0.01, 18), c, 0, 1.1, 0, Math.PI / 2 - 0.15])]),
  pennant: () => bake([[Cy(0.04, 0.04, 3, 6), '#3d4a6b', 0, 1.5, 0], [B(0.8, 0.45, 0.02), '#e8b84a', 0.42, 2.7, 0]]),
  kiosk: () => bake([[Cy(0.9, 0.95, 1.6, 8), '#f6f2f8', 0, 0.8, 0, 0, Math.PI / 8], [Cy(0.86, 0.86, 1.0, 8), '#2d6fb5', 0, 0.9, 0, 0, Math.PI / 8, 0, 1.01, 1, 1.01], [Cy(1.3, 1.1, 0.14, 8), '#6b4e5e', 0, 1.7, 0, 0, Math.PI / 8], [Sp(0.7, 12, 6, 0), '#8a96b8', 0, 1.78, 0], [Sp(0.72, 10, 4), SNOW, 0, 1.85, 0, 0, 0, 0, 1, 0.55, 1]]),
  cart: () => bake([[B(1.0, 0.6, 0.6), '#c8443c', 0, 0.55, 0], [B(0.9, 0.42, 0.5), '#ffe6b0', 0, 1.06, 0], [B(1.05, 0.06, 0.65), '#c8443c', 0, 1.3, 0], [B(1.0, 0.16, 0.6), SNOW, 0, 1.38, 0], [Cy(0.22, 0.22, 0.06, 10), '#3a2a2a', -0.42, 0.22, 0.32, Math.PI / 2], [Cy(0.22, 0.22, 0.06, 10), '#3a2a2a', 0.42, 0.22, 0.32, Math.PI / 2]]),
  castle: () => bake([[B(1.6, 1.2, 1.6), '#f2f6ff', 0, 0.6, 0], ...[[-0.8, -0.8, '#7cc4f0'], [0.8, -0.8, '#f3a6c8'], [-0.8, 0.8, '#8fdcb5'], [0.8, 0.8, '#f6d365']].flatMap(([x, z, c]) => [[Cy(0.32, 0.36, 1.8, 10), '#f2f6ff', x, 0.9, z], [Co(0.45, 0.7, 10), c, x, 2.15, z]])]),
  slide: () => bake([[B(0.5, 1.1, 0.5), '#c8584a', -0.3, 0.55, 0], [B(0.3, 0.06, 1.4), '#d99a3e', 0.25, 0.6, 0.35, -0.75], [B(0.32, 0.12, 1.4), SNOW, 0.25, 0.66, 0.35, -0.75]]),
  bollard: () => bake([[Cy(0.12, 0.15, 0.6, 8), '#2b2f45', 0, 0.3, 0], [Sp(0.16, 8, 4), SNOW, 0, 0.62, 0, 0, 0, 0, 1, 0.5, 1]]),
  ferry: () => bake([[B(6, 1, 2.4), '#2f3b63', 0, 0.2, 0], [B(5.8, 0.6, 2.3), '#f6f3f8', 0, 0.95, 0], [B(4, 0.9, 1.8), '#f6f3f8', 0, 1.7, 0], ...[-1.5, -0.7, 0.1, 0.9, 1.7].map(x => [B(0.4, 0.3, 0.02), '#ffcf7a', x, 1.75, 0.92]), [Cy(0.25, 0.3, 1.1, 10), '#f2c14e', 1.2, 2.7, 0], [B(4.1, 0.2, 1.9), SNOW, 0, 2.2, 0]]),
  school: () => bake([[B(7, 3, 3), '#efd9a6', 0, 1.5, 0], [B(7.4, 0.3, 3.4), '#8a5a4a', 0, 3.05, 0], [B(7.2, 0.3, 3.2), SNOW, 0, 3.3, 0], ...[-2.5, -1.2, 1.2, 2.5].flatMap(x => [[B(0.7, 0.8, 0.05), '#ffcf7a', x, 1.1, 1.52], [B(0.7, 0.8, 0.05), '#ffcf7a', x, 2.3, 1.52]]), [B(1.2, 1.6, 0.06), '#6a4a3a', 0, 0.8, 1.53], [B(0.9, 1.2, 0.9), '#efd9a6', 0, 3.8, 0], [Co(0.8, 0.9, 4), '#8a5a4a', 0, 4.75, 0, 0, Math.PI / 4]]),
  letter: () => B(0.9, 0.9, 0.12),
};

// ---------- the themes: scenery on both sides and what waits at the end ----------
const THEMES = {
  boulevard: { fog: '#c8cbe8', props: ['plane', 'plane', 'lamp', 'house'], finish: 'Boulevard Park', end: 'plane', gap: 3.2 },
  archery: { fog: '#cfcbe4', props: ['stone', 'target', 'pine', 'pennant', 'house'], finish: 'Archery Ground', end: 'stone', gap: 3.6 },
  kizilay: { fog: '#c6cfe6', props: ['kiosk', 'cart', 'plane', 'house', 'lamp'], finish: 'Kızılay Square', end: 'kiosk', gap: 3.4 },
  sururi: { fog: '#d3cdea', props: ['castle', 'slide', 'pine', 'pennant', 'house'], finish: 'Sururi Park', end: 'castle', gap: 3.5 },
  waterfront: { fog: '#c4d2ea', props: ['bollard', 'lamp', 'bollard', 'house'], sea: true, finish: 'Waterfront Park', end: 'ferry', gap: 3.0 },
  home: { fog: '#cfc6e4', props: ['house', 'lamp', 'pine', 'plane'], finish: 'Our School', end: 'school', gap: 3.2 },
};
// what each obstacle needs: jump (j), duck (d) or a different lane (lane); full = all three lanes
const OBST = {
  car: { needs: 'j', h: 1.0 }, snowman: { needs: 'j', h: 1.0 }, crate: { needs: 'j', h: 1.1 },
  fence: { needs: 'j', full: true, h: 1.0 }, line: { needs: 'd', full: true }, branch: { needs: 'd', lanes: 2 }, awning: { needs: 'd' }, gull: { needs: 'd' },
};

const signTex = (text, bg = '#a83a32') => { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#5a463f'; g.beginPath(); g.roundRect(4, 4, 504, 120, 24); g.fill(); g.fillStyle = bg; g.beginPath(); g.roundRect(14, 14, 484, 100, 18); g.fill(); g.fillStyle = '#ffe2a8'; g.textAlign = 'center'; g.textBaseline = 'middle'; let fs = 64; g.font = `900 ${fs}px system-ui, sans-serif`; while (g.measureText(text).width > 460 && fs > 28) { fs -= 4; g.font = `900 ${fs}px system-ui, sans-serif`; } g.fillText(text, 256, 68); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; };
const tagTex = (text, gold = true) => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.font = '900 34px system-ui, sans-serif'; const w = Math.min(244, g.measureText(text).width + 28); g.fillStyle = gold ? 'rgba(122,72,10,0.9)' : 'rgba(43,53,86,0.92)'; g.beginPath(); g.roundRect((256 - w) / 2, 6, w, 52, 18); g.fill(); g.strokeStyle = gold ? '#ffd166' : '#bfe8ff'; g.lineWidth = 3; g.stroke(); g.fillStyle = '#fff6d6'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 33, 236); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; };
const letterTex = (ch, col) => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(4, 4, 120, 120, 22); g.fill(); g.lineWidth = 8; g.strokeStyle = col; g.stroke(); g.fillStyle = '#2b3556'; g.font = '900 82px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 64, 70); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; };

export class SledRun {
  // words: [{en, tr}] for golden word flakes; spell: {en, tr} or null; lives: Lives
  constructor({ theme = 'boulevard', seconds = 50, pace = 'relaxed', team = 'hufflepuff', kit = 'thrower', words = [], spell = null, lives, rng = Math.random, first = false, reduceMotion = false, on = {} }) {
    Object.assign(this, { theme, seconds, pace, words, spell, lives, rng, first, reduceMotion, on });
    const T = this.T = THEMES[theme] || THEMES.boulevard;
    this.vmax = pace === 'challenge' ? 12.5 : 10.2; this.v = 6; this.dist = 0;
    this.length = Math.round(seconds * this.vmax * 0.88);
    this.react = pace === 'challenge' ? 1.15 : 1.5; // seconds between things that need a move
    this.lane = 1; this.x = 0; this.y = 0; this.vy = 0; this.duckT = 0; this.stumbleT = 0; this.blinkT = 0; this.flakes = 0; this.spelled = ''; this.finished = false; this.time = 0;
    this.hintDone = new Set();

    const scene = this.scene = new Scene(); scene.background = new Color(T.fog); scene.fog = new Fog(T.fog, 18, 60);
    scene.add(new HemisphereLight('#e4e8ff', '#8a7fc0', 1.25));
    const sun = new DirectionalLight('#fff0dc', 1.9); sun.position.set(-6, 12, 4); scene.add(sun);
    this.camera = new PerspectiveCamera(58, 1, 0.3, 120);
    this.mats = { vc: new MeshLambertMaterial({ vertexColors: true }) };
    // the track: snow ground with three trodden lanes, banks either side
    const groundTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#eef2fc'; g.fillRect(0, 0, 128, 256); for (const x of [22, 64, 106]) { g.fillStyle = 'rgba(160,165,215,0.35)'; g.fillRect(x - 15, 0, 30, 256); g.fillStyle = 'rgba(120,130,200,0.35)'; g.fillRect(x - 9, 0, 3, 256); g.fillRect(x + 6, 0, 3, 256); } for (let k = 0; k < 40; k++) { g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(rnd(k, 1) * 128, rnd(k, 2) * 256, 2, 3); } const t = new CanvasTexture(c); t.wrapS = t.wrapT = RepeatWrapping; t.colorSpace = SRGBColorSpace; return t; })();
    groundTex.repeat.set(1, 12); this.groundTex = groundTex;
    const ground = new Mesh(new PlaneGeometry(LANE * 3 + 0.8, 120), new MeshLambertMaterial({ map: groundTex })); ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -50); scene.add(ground);
    const field = new Mesh(new PlaneGeometry(80, 120), new MeshLambertMaterial({ color: T.sea ? '#79acd8' : '#f2f5fd' })); field.rotation.x = -Math.PI / 2; field.position.set(T.sea ? -44 : 0, -0.02, -50); scene.add(field);
    if (T.sea) { const snowR = new Mesh(new PlaneGeometry(40, 120), new MeshLambertMaterial({ color: '#f2f5fd' })); snowR.rotation.x = -Math.PI / 2; snowR.position.set(22, -0.01, -50); scene.add(snowR); }
    const bankGeo = bake([[Sp(1, 10, 5), SNOW, 0, 0, 0, 0, 0, 0, 0.7, 0.45, 3.2]]);
    this.banks = []; for (let k = 0; k < 24; k++) for (const s of [-1, 1]) { const m = new Mesh(bankGeo, this.mats.vc); m.position.set(s * (LANE * 1.5 + 0.9), 0, -k * 5); scene.add(m); this.banks.push(m); }

    this.geo = {}; this.pool = new Map(); this.items = []; this.props = [];
    // the student on a sled
    this.fakeC = { id: 1, team, kit, x: 0, z: 0, face: Math.PI, moving: 6, sled: true, frozen: 0, thaw: 0, flash: 0, hidden: false, revealT: 0, shield: 0, warmth: 100, maxWarmth: 100, ammo: 3, super: 0, captain: false, side: 'home', role: 'player' };
    this.kid = new Kid(this.fakeC, { isPlayer: true }); this.kid.bar.visible = false; this.kid.ring.visible = false; if (this.kid.innerRing) this.kid.innerRing.visible = false; scene.add(this.kid.root);
    // sparkle particles for pickups and crashes
    this.sparks = []; const sg = new SphereGeometry(0.06, 5, 4);
    this.sparkMesh = new InstancedMesh(sg, new MeshBasicMaterial({ color: '#ffffff' }), 120); this.sparkMesh.count = 0; scene.add(this.sparkMesh);
    this.flakeMat = new MeshBasicMaterial({ color: '#ffc93c' });
    this.halo = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,214,110,0.9)'); gr.addColorStop(1, 'rgba(255,150,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new CanvasTexture(c); })();

    this.plan();
    this.scenery();
  }

  mesh(kind) {
    const list = this.pool.get(kind) || []; this.pool.set(kind, list);
    const free = list.find(m => !m.visible); if (free) { free.visible = true; return free; }
    if (!this.geo[kind]) this.geo[kind] = kind.startsWith('house') ? SHAPES.house(+kind.slice(5) || 0) : (SHAPES[kind] || SHAPES.crate)(0);
    const m = new Mesh(this.geo[kind], this.mats.vc); this.scene.add(m); list.push(m); return m;
  }

  // ---------- lay out the whole run ----------
  plan() {
    const rng = this.rng, L = this.length, items = this.items, gap = () => this.vmax * this.react * (0.95 + rng() * 0.5);
    let d = 26, wordK = 0, nextWord = 40, spellAt = this.spell ? L * 0.38 : Infinity, spellI = 0;
    const kinds = ['car', 'snowman', 'crate', 'fence', 'line', 'branch', 'awning', 'gull'];
    while (d < L - 30) {
      // spelling gates: one row of three letters, the next letter of the word in one lane
      if (d >= spellAt && spellI < this.spell.en.length) {
        const ch = this.spell.en[spellI].toLowerCase(), lane = Math.floor(rng() * 3), abc = 'abcdefghijklmnopqrstuvwxyz'.replace(ch, '');
        const wrong = [abc[Math.floor(rng() * abc.length)], abc[Math.floor(rng() * abc.length)]];
        for (let l = 0; l < 3; l++) items.push({ kind: 'letter', d, lane: l, ch: l === lane ? ch : wrong.pop(), right: l === lane, idx: spellI });
        spellI++; d += this.vmax * 1.7; continue;
      }
      // a word snowflake now and then
      if (d >= nextWord && this.words.length) { items.push({ kind: 'word', d, lane: Math.floor(rng() * 3), word: this.words[wordK++ % this.words.length], y: 0.9 }); nextWord = d + this.vmax * 8; d += this.vmax * 0.9; }
      // an obstacle (harder mix as the run goes on)
      const prog = d / L, pick = kinds[Math.floor(rng() * Math.min(kinds.length, 3 + Math.floor(prog * 6)))];
      const o = OBST[pick];
      if (o.full) items.push({ kind: pick, d, lane: 1, full: true, needs: o.needs });
      else {
        const n = o.lanes || (rng() < 0.35 + prog * 0.3 ? 2 : 1), start = Math.floor(rng() * (4 - n));
        for (let l = start; l < start + n; l++) items.push({ kind: pick, d, lane: l, needs: o.needs });
        const free = [0, 1, 2].filter(l => l < start || l >= start + n);
        // snowflakes in a free lane before it, or an arc over a jump
        const fl = free[Math.floor(rng() * free.length)];
        if (o.needs === 'j' && rng() < 0.5) for (let k = -2; k <= 2; k++) items.push({ kind: 'flake', d: d + k * 0.9, lane: start, y: 0.6 + 1.3 * Math.cos(k / 2.5 * Math.PI / 2) });
        else for (let k = 0; k < 5; k++) items.push({ kind: 'flake', d: d - 6 + k * 1.3, lane: fl, y: 0.6 });
      }
      if (rng() < 0.12 && prog > 0.2) { const l = Math.floor(rng() * 3); items.push({ kind: 'ramp', d: d + gap() * 0.5, lane: l, needs: 'ramp' }); for (let k = 0; k < 6; k++) items.push({ kind: 'flake', d: d + gap() * 0.5 + 3 + k * 1.1, lane: l, y: 2.2 + Math.sin(k / 5 * Math.PI) * 0.8 }); }
      d += gap();
    }
    items.sort((a, b) => a.d - b.d);
    this.letterCount = this.spell ? this.spell.en.length : 0;
  }

  // scenery on both sides, recycled as the sled goes by
  scenery() {
    const T = this.T;
    for (let k = 0; k < 30; k++) for (const s of [-1, 1]) {
      if (T.sea && s < 0) continue;
      const kind = T.props[Math.floor(rnd(k, s + 3) * T.props.length)], m = this.mesh(kind === 'house' ? 'house' + (k % 4) : kind);
      const off = kind === 'house' ? 7 + rnd(k, s) * 2 : 4.3 + rnd(s, k) * 1.4;
      this.props.push({ m, d: k * T.gap * (kind === 'house' ? 1 : 1) + rnd(k, s * 7) * 1.5, x: s * off, ry: kind === 'house' ? (s > 0 ? -Math.PI / 2 : Math.PI / 2) : rnd(k, s) * 6 });
    }
    // the outpost at the end of the run: a big landmark and a banner over the track
    const end = this.mesh(T.end); end.scale.setScalar(T.end === 'ferry' || T.end === 'school' ? 1 : 2.2); this.endMesh = end;
    const banner = new Mesh(new PlaneGeometry(4.8, 1.2), new MeshBasicMaterial({ map: signTex(T.finish), transparent: true })); this.scene.add(banner); this.banner = banner;
    this.archPosts = [-1, 1].map(s => { const m = new Mesh(new BoxGeometry(0.3, 3.4, 0.3), new MeshLambertMaterial({ color: '#6a4a3a' })); this.scene.add(m); return { m, s }; });
  }

  // ---------- input ----------
  move(dir) { if (this.finished) return; this.lane = Math.max(0, Math.min(2, this.lane + dir)); }
  jump() { if (this.finished || this.y > 0.05 || this.duckT > 0.2) return; this.vy = 7.4; this.on.sound?.('dodge'); }
  duck() { if (this.finished) return; this.duckT = 0.65; if (this.y > 0.05) this.vy = -9; }

  spark(x, y, z, n, col, power = 3) { const c = new Color(col); for (let k = 0; k < n; k++) { if (this.sparks.length > 110) this.sparks.shift(); const a = this.rng() * 6.28; this.sparks.push({ x, y, z, vx: Math.cos(a) * power * this.rng(), vy: 1 + this.rng() * power, vz: Math.sin(a) * power * this.rng(), t: 0.6, c }); } }

  crash() {
    if (this.blinkT > 0 || this.finished) return;
    this.stumbleT = 0.9; this.blinkT = 1.8; this.v = 3.5;
    const lost = Math.min(3, this.flakes); this.flakes -= lost;
    this.spark(this.x, 0.8, 0, 26, '#ffffff', 4); if (lost) this.spark(this.x, 1, 0, lost * 4, '#ffc93c', 3);
    this.on.crash?.(lost);
  }

  // ---------- every frame ----------
  update(dt) {
    if (this.finished) { this.time += dt; this.v = Math.max(0, this.v - dt * 8); this.dist += this.v * dt; this.place(); return; }
    this.time += dt;
    const target = this.stumbleT > 0 ? 3.5 : this.vmax;
    this.v += (target - this.v) * Math.min(1, dt * (this.stumbleT > 0 ? 4 : 0.5));
    this.stumbleT = Math.max(0, this.stumbleT - dt); this.blinkT = Math.max(0, this.blinkT - dt); this.duckT = Math.max(0, this.duckT - dt);
    this.dist += this.v * dt;
    this.x += (LANES[this.lane] - this.x) * Math.min(1, dt * 12);
    this.vy -= 22 * dt; this.y = Math.max(0, this.y + this.vy * dt); if (this.y === 0 && this.vy < 0) this.vy = 0;
    // hits and pickups as things reach the sled
    const laneNow = LANES.reduce((b, lx, i) => (Math.abs(lx - this.x) < Math.abs(LANES[b] - this.x) ? i : b), 0);
    for (const it of this.items) {
      const dz = it.d - this.dist; if (dz > 1.2) break; if (it.done || dz < -1.0) continue;
      if (Math.abs(dz) > 0.55) continue;
      const sameLane = it.full || it.lane === laneNow;
      if (!sameLane) continue;
      if (it.kind === 'flake' || it.kind === 'word') { if (Math.abs((it.y || 0.6) - (this.y + 0.6)) > 1.1 && it.kind === 'flake') continue; it.done = true; this.collect(it); continue; }
      if (it.kind === 'letter') { it.done = true; this.letter(it); continue; }
      if (it.kind === 'ramp') { it.done = true; if (this.y < 0.2) { this.vy = 10.5; this.on.sound?.('sled'); } continue; }
      if (it.needs === 'j' && this.y < (OBST[it.kind].h || 1) * 0.55) { it.done = true; this.crash(); }
      else if (it.needs === 'd' && this.duckT <= 0) { it.done = true; this.crash(); }
      else it.done = true;
    }
    // first ride: say what to do just before each new kind of obstacle
    if (this.first) for (const it of this.items) { const dz = it.d - this.dist; if (dz > this.v * 1.3) break; if (dz < 0 || this.hintDone.has(it.needs) || !it.needs || it.needs === 'ramp') continue; this.hintDone.add(it.needs); this.on.hint?.(it.needs === 'j' ? 'JUMP! Swipe up' : 'DUCK! Swipe down'); }
    if (this.dist >= this.length + 4) { this.finished = true; this.on.done?.({ flakes: this.flakes, spelled: this.spelled, word: this.spell }); }
    this.on.progress?.(Math.min(1, this.dist / this.length));
    this.place(dt);
  }

  collect(it) {
    if (it.kind === 'word') { this.flakes += 5; this.on.word?.(it.word); this.spark(LANES[it.lane], 1, 0, 18, '#ffd166', 2.5); this.on.sound?.('sparkle'); }
    else { this.flakes += 1; this.spark(LANES[it.lane], it.y, 0, 5, '#ffd166', 1.5); if (this.flakes % 5 === 0) this.on.sound?.('pickup'); }
    this.on.flakes?.(this.flakes);
  }
  letter(it) {
    if (it.idx !== this.spelled.length) return;
    // only the row's letters for the next position count
    for (const o of this.items) if (o.kind === 'letter' && o.d === it.d) o.done = true;
    if (it.right) { this.spelled += it.ch; this.spark(LANES[it.lane], 1, 0, 14, '#7cc4f0', 2.5); this.on.sound?.('tap'); }
    else { this.spelled += this.spell.en[it.idx].toLowerCase(); this.spark(LANES[it.lane], 1, 0, 10, '#e0463c', 2); this.missedLetters = (this.missedLetters || 0) + 1; }
    this.on.spell?.(this.spelled, it.right);
  }

  place(dt = 0) {
    const d = this.dist, o = new Object3D();
    this.groundTex.offset.y = (d / 10) % 1;
    for (const b of this.banks) { b.position.z += this.v * dt; if (b.position.z > 6) b.position.z -= 120; }
    // the student
    const k = this.kid; this.fakeC.moving = this.v; this.fakeC.flash = this.stumbleT > 0.7 ? 0.1 : 0;
    k.update(dt, { visible: !(this.blinkT > 0 && Math.floor(this.blinkT * 10) % 2), reduceMotion: this.reduceMotion });
    k.bar.visible = false; k.root.position.set(this.x, this.y, 0); k.root.rotation.z = (LANES[this.lane] - this.x) * -0.12;
    k.kid.scale.y = k.kid.scale.x * (this.duckT > 0 ? 0.55 : 1);
    // the obstacles and pickups in view
    for (const it of this.items) {
      const dz = it.d - d;
      if (dz < -6 || dz > 70) { if (it.m) { it.m.visible = false; it.m = null; if (it.tag) it.tag.visible = false; } continue; }
      if (it.done && (it.kind === 'flake' || it.kind === 'word' || it.kind === 'letter')) { if (it.m) { it.m.visible = false; it.m = null; } if (it.tag) it.tag.visible = false; continue; }
      if (!it.m) {
        if (it.kind === 'flake' || it.kind === 'word') { it.m = this.flakeMesh(it.kind === 'word'); if (it.kind === 'word') it.tag = this.wordTag(it.word.en); }
        else if (it.kind === 'letter') it.m = this.letterMesh(it.ch);
        else it.m = this.mesh(it.kind);
      }
      const x = it.full ? 0 : LANES[it.lane], z = -dz;
      if (it.kind === 'flake' || it.kind === 'word') { it.m.position.set(x, (it.y || 0.6) + Math.sin(this.time * 3 + it.d) * 0.08, z); it.m.rotation.y = this.time * 2 + it.d; it.m.scale.setScalar(it.kind === 'word' ? 1.6 : 0.9); if (it.tag) { it.tag.visible = true; it.tag.position.set(x, 1.9, z); } }
      else if (it.kind === 'letter') { it.m.position.set(x, 1.0 + Math.sin(this.time * 3 + it.lane) * 0.06, z); }
      else if (it.kind === 'gull') { it.m.position.set(x + Math.sin(this.time * 2 + it.d) * 0.3, 1.25 + Math.sin(this.time * 6) * 0.05, z); it.m.rotation.z = Math.sin(this.time * 12) * 0.3; }
      else if (it.kind === 'branch') { it.m.position.set(x + (it.lane === 2 ? 0 : 0), 0, z); it.m.rotation.y = it.lane === 0 ? Math.PI : 0; }
      else it.m.position.set(x, 0, z);
    }
    for (const p of this.props) {
      let dz = p.d - d; const span = 30 * this.T.gap; while (dz < -8) { p.d += span; dz += span; }
      p.m.position.set(p.x, 0, -dz); p.m.rotation.y = p.ry; p.m.visible = dz < 70 && p.d < this.length - 6;
    }
    const endZ = -(this.length + 10 - d);
    this.endMesh.position.set(0, 0, endZ - 6); this.endMesh.visible = endZ > -75;
    this.banner.position.set(0, 3.3, endZ + 8); this.banner.visible = endZ > -75;
    for (const a of this.archPosts) { a.m.position.set(a.s * 2.6, 1.7, endZ + 8); a.m.visible = endZ > -75; }
    // camera behind and above the sled
    this.camera.position.set(this.x * 0.5, 4.3 + this.y * 0.3, 7.2); this.camera.lookAt(this.x * 0.3, 0.9 + this.y * 0.4, -7);
    // sparks
    let n = 0;
    for (const s of this.sparks) { if (s.t <= 0) continue; s.t -= dt; s.vy -= 9 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += (s.vz + this.v) * dt; o.position.set(s.x, s.y, s.z); o.scale.setScalar(Math.max(0.1, s.t * 1.6)); o.updateMatrix(); this.sparkMesh.setMatrixAt(n, o.matrix); this.sparkMesh.setColorAt(n, s.c); n++; }
    this.sparkMesh.count = n; this.sparkMesh.instanceMatrix.needsUpdate = true; if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;
  }
  flakeMesh(big) {
    const kind = big ? 'wordFlake' : 'flakeS', list = this.pool.get(kind) || []; this.pool.set(kind, list);
    const free = list.find(m => !m.visible); if (free) { free.visible = true; return free; }
    if (!this.geo.flake) this.geo.flake = SHAPES.flake();
    const m = new Mesh(this.geo.flake, this.flakeMat);
    const halo = new Sprite(new SpriteMaterial({ map: this.halo, blending: AdditiveBlending, depthWrite: false, transparent: true })); halo.scale.setScalar(big ? 1.4 : 0.9); m.add(halo);
    this.scene.add(m); list.push(m); return m;
  }
  wordTag(text) { const sp = new Sprite(new SpriteMaterial({ map: tagTex(text), depthWrite: false, transparent: true })); sp.scale.set(2.2, 0.55, 1); this.scene.add(sp); return sp; }
  letterMesh(ch) { const m = new Mesh(SHAPES.letter(), [new MeshLambertMaterial({ color: '#ffffff' }), new MeshLambertMaterial({ color: '#ffffff' }), new MeshLambertMaterial({ color: '#ffffff' }), new MeshLambertMaterial({ color: '#ffffff' }), new MeshBasicMaterial({ map: letterTex(ch, '#7cc4f0') }), new MeshBasicMaterial({ map: letterTex(ch, '#7cc4f0') })]); this.scene.add(m); return m; }

  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  dispose() { this.scene.traverse(o => { if (o.isMesh || o.isSprite) { o.geometry?.dispose?.(); const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { m?.map?.dispose?.(); m?.dispose?.(); } } }); }
}
