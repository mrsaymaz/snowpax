// The sled journeys between outposts: an endless-runner ride through snowy Kasımpaşa.
// The sled runs forward by itself in three lanes: left/right to change lane, up to jump, down to
// duck. Jump over buried cars, snowmen and fences; duck under frozen laundry lines, low branches,
// awnings and swooping gulls; steer round sleeping cats. Collect snowballs (lots of them, the
// ride's score) and a few rare golden word snowflakes (English word + Turkish meaning: each one is
// a ❄ to spend in the Snow Shop) and, on some runs, the letters of a word to spell
// (practice: never counted toward the 80%). A crash costs a life. Each run has its own themed
// scenery and ends at the next outpost. The track winds: it turns left and right, banks into the
// curves and rolls over gentle hills (the lane rules stay the same, in the track's own frame).
import {
  Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, PointLight, Fog, Color, Group, Mesh, MeshLambertMaterial, MeshBasicMaterial, Object3D,
  BoxGeometry, SphereGeometry, CylinderGeometry, ConeGeometry, PlaneGeometry, TorusGeometry, CapsuleGeometry, BufferAttribute, CanvasTexture,
  SRGBColorSpace, RepeatWrapping, Sprite, SpriteMaterial, InstancedMesh, AdditiveBlending, Vector3, Float32BufferAttribute, BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Kid } from './render/kids.js';
import { CINEMA, shotAt, TRACK_Z, SCENE_SECONDS } from './render/cinema.js';
import { CUT } from './render/cutout.js';

const LANE = 1.8, LANES = [-LANE, 0, LANE];
const CHIME = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]; // a major pentatonic run up from D, in semitones
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
  tram: () => bake([[B(1.5, 1.5, 4.2), '#c8302e', 0, 1.15, 0], [B(1.52, 0.42, 4.22), '#f3ead8', 0, 1.25, 0], ...[-1.5, -0.75, 0, 0.75, 1.5].flatMap(z => [[B(0.02, 0.36, 0.5), '#ffd98a', 0.77, 1.62, z], [B(0.02, 0.36, 0.5), '#ffd98a', -0.77, 1.62, z]]), [B(1.6, 0.14, 4.4), '#7a1f1f', 0, 1.97, 0], [B(1.4, 0.12, 4.0), SNOW, 0, 2.1, 0], [Cy(0.025, 0.025, 1.6, 5), '#2b2f45', 0, 2.75, 0.6, -0.6], [B(1.0, 0.3, 3.6), '#2b2f45', 0, 0.25, 0], ...[-1.3, 1.3].flatMap(z => [[Cy(0.28, 0.28, 0.12, 10), '#2b2f45', 0.62, 0.3, z, 0, 0, Math.PI / 2], [Cy(0.28, 0.28, 0.12, 10), '#2b2f45', -0.62, 0.3, z, 0, 0, Math.PI / 2]]), [B(0.5, 0.18, 0.02), '#ffffff', 0, 1.82, 2.12]]), // the red nostalgic tram of İstiklal
  clock: () => bake([[Cy(0.08, 0.12, 2.6, 8), '#2b3556', 0, 1.3, 0], [Cy(0.32, 0.32, 0.22, 16), '#2b3556', 0, 2.75, 0, Math.PI / 2], [Cy(0.27, 0.27, 0.24, 16), '#fff6dc', 0, 2.75, 0, Math.PI / 2], [Sp(0.1, 8, 6), '#e8b84a', 0, 3.0, 0], [Sp(0.5, 8, 4), SNOW, 0, 0, 0, 0, 0, 0, 0.9, 0.4, 0.8]]), // an old street clock
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
  goldenhorn: { fog: '#c4d2ea', props: ['bollard', 'lamp', 'house', 'bollard', 'house', 'plane'], sea: true, finish: 'The Golden Horn', end: 'ferry', gap: 3.1 },
  downtown: { fog: '#b9b4dc', props: ['lamp', 'house', 'tram', 'house', 'clock', 'cart', 'lamp', 'house'], finish: 'Downtown', end: 'tram', gap: 3.1 },
  kasimpasa: { fog: '#c6cfe6', props: ['kiosk', 'plane', 'house', 'lamp', 'cart', 'target', 'house', 'castle'], finish: 'Kasımpaşa', end: 'kiosk', gap: 3.3 },
  sururi: { fog: '#d3cdea', props: ['castle', 'slide', 'pine', 'pennant', 'house'], finish: 'Sururi Park', end: 'castle', gap: 3.5 },
  waterfront: { fog: '#c4d2ea', props: ['bollard', 'lamp', 'bollard', 'house'], sea: true, finish: 'Waterfront Park', end: 'ferry', gap: 3.0 },
  home: { fog: '#cfc6e4', props: ['house', 'lamp', 'pine', 'plane'], finish: 'Our School', end: 'school', gap: 3.2 },
};
// what each obstacle needs: jump (j), duck (d) or a different lane (lane); full = all three lanes
// obstacles in proportion to the (smaller) kid: jump ones low enough to clear with a jump, duck
// ones at head height of the kid sitting on the sled, above the kid tucked down
const OBST_SCALE = { snowman: [0.62, 0.62, 0.62], crate: [0.85, 0.85, 0.85], car: [0.9, 0.9, 0.9], fence: [1, 0.92, 1], line: [1, 0.84, 1], branch: [1, 0.8, 1], awning: [1, 0.85, 1] };
const OBST = {
  car: { needs: 'j', h: 1.0 }, snowman: { needs: 'j', h: 1.0 }, crate: { needs: 'j', h: 1.1 },
  fence: { needs: 'j', full: true, h: 1.0 }, line: { needs: 'd', full: true }, branch: { needs: 'd', lanes: 2 }, awning: { needs: 'd' }, gull: { needs: 'd' },
};

const signTex = (text, bg = '#a83a32') => { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#5a463f'; g.beginPath(); g.roundRect(4, 4, 504, 120, 24); g.fill(); g.fillStyle = bg; g.beginPath(); g.roundRect(14, 14, 484, 100, 18); g.fill(); g.fillStyle = '#ffe2a8'; g.textAlign = 'center'; g.textBaseline = 'middle'; let fs = 64; g.font = `900 ${fs}px system-ui, sans-serif`; while (g.measureText(text).width > 460 && fs > 28) { fs -= 4; g.font = `900 ${fs}px system-ui, sans-serif`; } g.fillText(text, 256, 68); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; };
const tagTex = (text, gold = true) => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.font = '900 34px system-ui, sans-serif'; const w = Math.min(244, g.measureText(text).width + 28); g.fillStyle = gold ? 'rgba(122,72,10,0.9)' : 'rgba(43,53,86,0.92)'; g.beginPath(); g.roundRect((256 - w) / 2, 6, w, 52, 18); g.fill(); g.strokeStyle = gold ? '#ffd166' : '#bfe8ff'; g.lineWidth = 3; g.stroke(); g.fillStyle = '#fff6d6'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 33, 236); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; };
const letterTex = (ch, col) => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(4, 4, 120, 120, 22); g.fill(); g.lineWidth = 8; g.strokeStyle = col; g.stroke(); g.fillStyle = '#2b3556'; g.font = '900 82px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 64, 70); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; };

export class SledRun {
  // words: [{en, tr}] for the golden word snowflakes (all of them on the track, spread out);
  // spell: {en, tr} or null; lives: Lives
  // cinema: the places the ride passes, in task order ([{ id, title, task, part }]); the ones with a
  // scene in render/cinema.js get a clear, straight stretch where the camera turns to them
  constructor({ theme = 'boulevard', seconds = 50, pace = 'relaxed', team = 'hufflepuff', kit = 'thrower', look = null, words = [], spell = null, lives, rng = Math.random, first = false, reduceMotion = false, cinema = [], views = null, on = {} }) {
    this.views = views; // the places' scenes, built ahead (stagerun.js builds them while the map is shown)
    Object.assign(this, { theme, seconds, pace, words, spell, lives, rng, first, reduceMotion, on });
    const T = this.T = THEMES[theme] || THEMES.boulevard;
    this.vmax = pace === 'challenge' ? 12.5 : 10.2; this.v = 6; this.dist = 0;
    const base = Math.round(seconds * this.vmax * 0.88), slow = 0.6 * this.vmax; // the sled rides itself at 60% through a scene
    const span = () => 10 + slow * SCENE_SECONDS + 16; // the approach, the scene, the way out
    const withScene = cinema.filter(sc => CINEMA[sc.id]);
    this.length = base + withScene.reduce((s2, sc) => s2 + span(sc), 0);
    // each place's stretch, spread along the ride in task order: [a, b) clear of everything
    this.slots = cinema.map((sc, k) => { const has = !!CINEMA[sc.id], mid = this.length * (k + 1) / (cinema.length + 1), len = has ? span(sc) : 0; return { ...sc, has, a: mid - len / 2, b: mid + len / 2, lead: 10, dur: SCENE_SECONDS, scene: null, played: false }; }).filter(q => q.has);
    this.cine = null;
    this.react = pace === 'challenge' ? 1.15 : 1.5; // seconds between things that need a move
    this.lane = 1; this.x = 0; this.y = 0; this.vy = 0; this.duckT = 0; this.stumbleT = 0; this.blinkT = 0; this.flakes = 0; this.snowballs = 0; this.spelled = ''; this.finished = false; this.time = 0;
    this.hintDone = new Set();

    const scene = this.scene = new Scene(); scene.background = new Color(T.fog); scene.fog = new Fog(T.fog, 18, 60);
    const hemi = this.hemi = new HemisphereLight('#e4e8ff', '#8a7fc0', 1.25); scene.add(hemi);
    const sun = this.sun = new DirectionalLight('#fff0dc', 1.9); sun.position.set(-6, 12, 4); scene.add(sun, sun.target);
    // The lights never change during the ride (a light, or a shadow, switched on or off makes the GPU
    // recompile every shader: a stutter). The sun always casts shadows, but on the ride its shadow
    // camera looks at nothing and is not redrawn, so it costs nothing; two lamps wait at zero for the
    // places' scenes, which only move them and turn them up.
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0006; this.shadowOff();
    this.lamps = [0, 1].map(() => { const l = new PointLight('#ffd29a', 0, 10, 1.8); l.position.set(0, -50, 0); scene.add(l); return l; });
    this.camera = new PerspectiveCamera(58, 1, 0.3, 120);
    this.mats = { vc: new MeshLambertMaterial({ vertexColors: true }) };
    // the track: snow ground with three trodden lanes, banks either side
    const groundTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#eef2fc'; g.fillRect(0, 0, 128, 256); for (const x of [22, 64, 106]) { g.fillStyle = 'rgba(160,165,215,0.35)'; g.fillRect(x - 15, 0, 30, 256); g.fillStyle = 'rgba(120,130,200,0.35)'; g.fillRect(x - 9, 0, 3, 256); g.fillRect(x + 6, 0, 3, 256); } for (let k = 0; k < 40; k++) { g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(rnd(k, 1) * 128, rnd(k, 2) * 256, 2, 3); } const t = new CanvasTexture(c); t.wrapS = t.wrapT = RepeatWrapping; t.colorSpace = SRGBColorSpace; return t; })();
    groundTex.repeat.set(1, 1); this.groundTex = groundTex;
    this.buildPath(theme);
    this.buildGround(groundTex, T);
    this.geo = {}; this.pool = new Map(); this.items = []; this.props = [];
    // the student on a sled
    this.fakeC = { id: 1, team, kit, look, x: 0, z: 0, face: Math.PI, moving: 6, sled: true, frozen: 0, thaw: 0, flash: 0, hidden: false, revealT: 0, shield: 0, warmth: 100, maxWarmth: 100, ammo: 3, super: 0, captain: false, side: 'home', role: 'player' };
    this.kid = new Kid(this.fakeC, { isPlayer: true }); this.kid.bar.visible = false; this.kid.ring.visible = false; if (this.kid.innerRing) this.kid.innerRing.visible = false; scene.add(this.kid.root);
    // sparkle particles for pickups and crashes
    this.sparks = []; const sg = new SphereGeometry(0.06, 5, 4);
    this.sparkMesh = new InstancedMesh(sg, new MeshBasicMaterial({ color: '#ffffff' }), 120); this.sparkMesh.count = 0; scene.add(this.sparkMesh);
    this.flakeMat = new MeshBasicMaterial({ color: '#ffc93c' });
    this.halo = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,214,110,0.9)'); gr.addColorStop(1, 'rgba(255,150,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new CanvasTexture(c); })();

    this.plan();
    this.scenery();
    this.stock();
    for (const q of this.slots) { try { this.prepare(q); } catch (err) { console.warn('scene', q.id, err); q.played = true; } } // the places' scenes are built now, before the ride starts (no stutter while steering); one that fails is skipped
  }

  // ---------- the winding path: centre, heading, height and bank for every metre ----------
  buildPath(theme) {
    const N = Math.ceil(this.length + 160), seed = [...theme].reduce((a, c) => a + c.charCodeAt(0), 0), r = k => rnd(seed, k) * 6.28;
    const P = this.path = { N, x: new Float32Array(N + 1), z: new Float32Array(N + 1), h: new Float32Array(N + 1), th: new Float32Array(N + 1), bank: new Float32Array(N + 1) };
    const flat = this.T.sea ? 0 : 1, end = this.length + 12;
    let x = 0, z = 0;
    for (let i = 0; i <= N; i++) {
      let ramp = Math.max(0, Math.min(1, (i - 18) / 45, (end - i) / 45));
      for (const q of this.slots || []) ramp = Math.min(ramp, Math.max(0, Math.min(1, (q.a - 30 - i) / 30, (i - q.b - 10) / 30))); // straight and flat through a scene's stretch
      const e = ramp * ramp * (3 - 2 * ramp); // straight at the start and the finish
      P.th[i] = e * (0.85 * Math.sin(i / 37 + r(1)) + 0.5 * Math.sin(i / 16 + r(2)) + 0.18 * Math.sin(i / 7.5 + r(3)));
      P.h[i] = e * flat * (1.5 * Math.sin(i / 43 + r(4)) + 0.7 * Math.sin(i / 17 + r(5)));
      P.x[i] = x; P.z[i] = z; x += Math.sin(P.th[i]); z -= Math.cos(P.th[i]);
    }
    for (let i = 0; i <= N; i++) { const a = P.th[Math.min(N, i + 2)] - P.th[Math.max(0, i - 2)]; P.bank[i] = Math.max(-0.24, Math.min(0.24, a / 4 * 11)); } // outer edge higher in a turn
    { const raw = P.bank.slice(), W = 6; for (let i = 0; i <= N; i++) { let s = 0, n = 0; for (let k = -W; k <= W; k++) { const j = i + k; if (j < 0 || j > N) continue; const w = W + 1 - Math.abs(k); s += raw[j] * w; n += w; } P.bank[i] = s / n; } } // eased in and out of each turn
  }
  // where a point of the track is: distance s along it, lat metres to the right, y up from the snow
  at(s, lat = 0, y = 0, out = new Vector3()) {
    const P = this.path, i0 = Math.max(0, Math.min(P.N - 1, Math.floor(s))), t = Math.max(-40, Math.min(40, s - i0));
    const lerp = a => a[i0] + (a[i0 + 1] - a[i0]) * Math.max(0, Math.min(1, t)), th = lerp(P.th), bank = lerp(P.bank);
    const ex = t < 0 || t > 1 ? (t < 0 ? t : t - 1) : 0, base = t > 1 ? i0 + 1 : i0; // beyond the ends: straight on
    const cx = (t >= 0 && t <= 1 ? lerp(P.x) : P.x[base] + Math.sin(th) * ex), cz = (t >= 0 && t <= 1 ? lerp(P.z) : P.z[base] - Math.cos(th) * ex);
    return out.set(cx + Math.cos(th) * lat, lerp(P.h) + y - lat * bank, cz + Math.sin(th) * lat);
  }
  heading(s) { const P = this.path, i = Math.max(0, Math.min(P.N - 1, Math.floor(s))), t = Math.max(0, Math.min(1, s - i)); return P.th[i] + (P.th[i + 1] - P.th[i]) * t; }
  // bank and slope blend smoothly between metres (no steps from one metre to the next)
  bankAt(s) { const P = this.path, i = Math.max(0, Math.min(P.N - 1, Math.floor(s))), t = Math.max(0, Math.min(1, s - i)); return P.bank[i] + (P.bank[i + 1] - P.bank[i]) * t; }
  slope(s) { const P = this.path, i = Math.max(1, Math.min(P.N - 2, Math.floor(s))), t = Math.max(0, Math.min(1, s - i)), at = k => (P.h[k + 1] - P.h[k - 1]) / 2; return at(i) + (at(i + 1) - at(i)) * t; }
  // the track ribbon, the snowfield either side (banked near the track), the snowbanks along it
  buildGround(groundTex, T) {
    const P = this.path, N = P.N, v = new Vector3();
    const ribbon = (lats, colorOf = null, bankK = () => 1, lift = 0) => {
      const pos = [], uv = [], col = [], idx = [], W = lats.length, c = new Color();
      for (let i = 0; i <= N; i++) for (let k = 0; k < W; k++) {
        const lat = lats[k], bk = bankK(Math.abs(lat)); this.at(i, lat, lift, v); v.y += lat * P.bank[i] * (1 - bk); // less bank away from the track
        pos.push(v.x, v.y, v.z); uv.push(k / (W - 1), i / 10);
        if (colorOf) { c.set(colorOf(lat)); col.push(c.r, c.g, c.b); }
        if (i < N && k < W - 1) { const a = i * W + k, b = a + W; idx.push(a, a + 1, b, b, a + 1, b + 1); /* facing up */ }
      }
      const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
      if (colorOf) g.setAttribute('color', new Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
    };
    const half = LANE * 1.5 + 0.4;
    const track = new Mesh(ribbon([-half, half], null, () => 1, 0.03), new MeshLambertMaterial({ map: groundTex })); track.receiveShadow = true; this.scene.add(track); // shadows only show in a scene's light
    const sea = T.sea ? '#79acd8' : '#f2f5fd';
    const field = ribbon([-19, -11, -6, -half, half, 6, 11, 19], lat => (lat < -6.5 ? sea : '#f2f5fd'), a => (a <= 6 ? 1 : a >= 11 ? 0 : 1 - (a - 6) / 5));
    const fieldM = new Mesh(field, new MeshLambertMaterial({ vertexColors: true })); fieldM.receiveShadow = true; this.scene.add(fieldM);
    let minH = 0, cx = 0, cz = 0; for (let i = 0; i <= N; i++) { minH = Math.min(minH, P.h[i]); cx += P.x[i] / (N + 1); cz += P.z[i] / (N + 1); }
    const base = new Mesh(new PlaneGeometry(900, 900), new MeshLambertMaterial({ color: T.sea ? '#a9c7e6' : '#eef2fb' })); base.rotation.x = -Math.PI / 2; base.position.set(cx, minH - 0.4, cz); this.scene.add(base);
    const bankGeo = bake([[Sp(1, 10, 5), SNOW, 0, 0, 0, 0, 0, 0, 0.7, 0.45, 3.2]]), n = Math.floor(N / 5), banks = new InstancedMesh(bankGeo, this.mats.vc, n * 2), o = new Object3D();
    let k = 0; for (let j = 0; j < n; j++) for (const sd of [-1, 1]) { this.at(j * 5, sd * (LANE * 1.5 + 0.9), 0, o.position); o.rotation.set(0, -P.th[j * 5], 0); o.updateMatrix(); banks.setMatrixAt(k++, o.matrix); }
    this.scene.add(banks);
  }
  // put a mesh at a point of the track, turned to face along it
  put(m, s, lat, y = 0, ry = 0) { this.at(s, lat, y, m.position); m.rotation.set(0, -this.heading(s) + ry, 0); }

  mesh(kind) {
    const list = this.pool.get(kind) || []; this.pool.set(kind, list);
    const free = list.find(m => !m.visible); if (free) { free.visible = true; return free; }
    if (!this.geo[kind]) this.geo[kind] = kind.startsWith('house') ? SHAPES.house(+kind.slice(5) || 0) : (SHAPES[kind] || SHAPES.crate)(0);
    const m = new Mesh(this.geo[kind], this.mats.vc); if (OBST_SCALE[kind]) m.scale.set(...OBST_SCALE[kind]); this.scene.add(m); list.push(m); return m;
  }

  // ---------- lay out the whole run ----------
  plan() {
    const rng = this.rng, L = this.length, items = this.items, gap = () => this.vmax * this.react * (0.95 + rng() * 0.5);
    const wordGap = (L - 110) / Math.max(1, this.words.length - 1); // the rare word snowflakes, evenly from near the start to near the end
    // each word snowflake has its spot; one that falls in a scene's stretch moves just before it
    const spots = this.words.map((_, k) => { let at = 40 + k * wordGap; const q = this.slots.find(q2 => at >= q2.a - 8 && at < q2.b + 4); if (q) at = q.a - 14 > 30 ? q.a - 14 : q.b + 6; return at; });
    let d = 26, wordK = 0, spellAt = this.spell ? L * 0.38 : Infinity, spellI = 0;
    const kinds = ['car', 'snowman', 'crate', 'fence', 'line', 'branch', 'awning', 'gull'];
    while (d < L - 30) {
      const clear = this.slots.find(q => d >= q.a - 8 && d < q.b); if (clear) { d = clear.b; continue; } // a scene's stretch stays clear
      // a rare golden word snowflake at its spot (each word once), between the letter gates too
      if (wordK < this.words.length && d >= spots[wordK]) { items.push({ kind: 'word', d, lane: Math.floor(rng() * 3), word: this.words[wordK++], y: 0.9 }); d += this.vmax * 0.9; }
      // spelling gates: one row of three letters, the next letter of the word in one lane
      if (d >= spellAt && spellI < this.spell.en.length) {
        const ch = this.spell.en[spellI].toLowerCase(), lane = Math.floor(rng() * 3), abc = 'abcdefghijklmnopqrstuvwxyz'.replace(ch, '');
        const wrong = [abc[Math.floor(rng() * abc.length)], abc[Math.floor(rng() * abc.length)]];
        for (let l = 0; l < 3; l++) items.push({ kind: 'letter', d, lane: l, ch: l === lane ? ch : wrong.pop(), right: l === lane, idx: spellI });
        spellI++; d += this.vmax * 1.7; continue;
      }
      // an obstacle (harder mix as the run goes on)
      const prog = d / L, pick = kinds[Math.floor(rng() * Math.min(kinds.length, 3 + Math.floor(prog * 6)))];
      const o = OBST[pick];
      if (o.full) items.push({ kind: pick, d, lane: 1, full: true, needs: o.needs });
      else {
        const n = o.lanes || (rng() < 0.35 + prog * 0.3 ? 2 : 1), start = Math.floor(rng() * (4 - n));
        for (let l = start; l < start + n; l++) items.push({ kind: pick, d, lane: l, needs: o.needs });
        const free = [0, 1, 2].filter(l => l < start || l >= start + n);
        // snowballs in a free lane before it, or an arc over a jump
        const fl = free[Math.floor(rng() * free.length)];
        if (o.needs === 'j' && rng() < 0.5) for (let k = -2; k <= 2; k++) items.push({ kind: 'ball', d: d + k * 0.9, lane: start, y: 0.6 + 1.3 * Math.cos(k / 2.5 * Math.PI / 2) });
        else for (let k = 0; k < 5; k++) items.push({ kind: 'ball', d: d - 6 + k * 1.3, lane: fl, y: 0.6 });
      }
      if (rng() < 0.12 && prog > 0.2) { const l = Math.floor(rng() * 3); items.push({ kind: 'ramp', d: d + gap() * 0.5, lane: l, needs: 'ramp' }); for (let k = 0; k < 6; k++) items.push({ kind: 'ball', d: d + gap() * 0.5 + 3 + k * 1.1, lane: l, y: 2.2 + Math.sin(k / 5 * Math.PI) * 0.8 }); }
      d += gap();
    }
    items.sort((a, b) => a.d - b.d);
    this.letterCount = this.spell ? this.spell.en.length : 0;
  }

  // scenery on both sides, recycled as the sled goes by
  scenery() {
    const T = this.T;
    for (let k = 0; k * T.gap < this.length - 6; k++) for (const s of [-1, 1]) { // along the whole winding track
      if (T.sea && s < 0) continue;
      const kind = T.props[Math.floor(rnd(k, s + 3) * T.props.length)], m = this.mesh(kind === 'house' ? 'house' + (k % 4) : kind);
      const off = kind === 'house' ? 7 + rnd(k, s) * 2 : 4.3 + rnd(s, k) * 1.4, d = k * T.gap + rnd(k, s * 7) * 1.5;
      if (this.slots.some(q => d > q.a - 4 && d < q.b + 4)) { m.visible = false; continue; } // nothing between the camera and a scene
      this.put(m, d, s * off, 0, kind === 'house' ? (s > 0 ? -Math.PI / 2 : Math.PI / 2) : rnd(k, s) * 6);
    }
    // the outpost at the end of the run: a big landmark and a banner over the track
    const end = this.mesh(T.end); end.scale.setScalar(T.end === 'ferry' || T.end === 'school' ? 1 : 2.2); this.endMesh = end;
    const banner = new Mesh(new PlaneGeometry(4.8, 1.2), new MeshBasicMaterial({ map: signTex(T.finish), transparent: true })); this.scene.add(banner); this.banner = banner;
    this.archPosts = [-1, 1].map(s => { const m = new Mesh(new BoxGeometry(0.3, 3.4, 0.3), new MeshLambertMaterial({ color: '#6a4a3a' })); this.scene.add(m); return { m, s }; });
  }

  // ---------- input ----------
  move(dir) { if (this.finished || this.cine) return; this.lane = Math.max(0, Math.min(2, this.lane + dir)); }
  jump() { if (this.finished || this.cine || this.y > 0.05 || this.duckT > 0.2) return; this.vy = 7.4; this.on.sound?.('dodge'); }
  duck() { if (this.finished || this.cine) return; this.duckT = 0.65; if (this.y > 0.05) this.vy = -9; }

  spark(x, y, z, n, col, power = 3) { const c = new Color(col), w = this.at(this.dist + z, x, y); x = w.x; y = w.y; z = w.z; for (let k = 0; k < n; k++) { if (this.sparks.length > 110) this.sparks.shift(); const a = this.rng() * 6.28; this.sparks.push({ x, y, z, vx: Math.cos(a) * power * this.rng(), vy: 1 + this.rng() * power, vz: Math.sin(a) * power * this.rng(), t: 0.6, c }); } }

  crash() {
    if (this.blinkT > 0 || this.finished) return;
    this.stumbleT = 0.9; this.blinkT = 1.8; this.v = 3.5;
    const lost = Math.min(5, this.snowballs); this.snowballs -= lost; // a crash spills snowballs (never the snowflakes)
    this.spark(this.x, 0.8, 0, 26 + lost * 3, '#ffffff', 4);
    this.on.crash?.(lost);
  }

  // ---------- every frame ----------
  update(dt) {
    if (this.finished) { this.time += dt; this.v = Math.max(0, this.v - dt * 8); this.dist += this.v * dt; this.place(); return; }
    this.time += dt;
    CUT.radius.value = 0; // the arena's see-through effect is off on the ride
    this.updateCinema(dt);
    const target = this.cine ? this.vmax * 0.6 : this.stumbleT > 0 ? 3.5 : this.vmax;
    if (this.cine) this.lane = 1;
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
      if (it.kind === 'ball' || it.kind === 'word') { if (Math.abs((it.y || 0.6) - (this.y + 0.6)) > 1.1 && it.kind === 'ball') continue; it.done = true; this.collect(it); continue; }
      if (it.kind === 'letter') { it.done = true; this.letter(it); continue; }
      if (it.kind === 'ramp') { it.done = true; if (this.y < 0.2) { this.vy = 10.5; this.on.sound?.('sled'); } continue; }
      if (it.needs === 'j' && this.y < (OBST[it.kind].h || 1) * 0.55) { it.done = true; this.crash(); }
      else if (it.needs === 'd' && this.duckT <= 0) { it.done = true; this.crash(); }
      else it.done = true;
    }
    // first ride: say what to do just before each new kind of obstacle
    if (this.first) for (const it of this.items) { const dz = it.d - this.dist; if (dz > this.v * 1.3) break; if (dz < 0 || this.hintDone.has(it.needs) || !it.needs || it.needs === 'ramp') continue; this.hintDone.add(it.needs); this.on.hint?.(it.needs === 'j' ? 'JUMP! Swipe up' : 'DUCK! Swipe down'); }
    if (this.dist >= this.length + 4) { this.finished = true; this.on.done?.({ flakes: this.flakes, snowballs: this.snowballs, spelled: this.spelled, word: this.spell }); }
    this.on.progress?.(Math.min(1, this.dist / this.length));
    this.place(dt);
  }

  // ---------- the places on the way: a cinematic scene beside a clear stretch ----------
  // a place's scene, beside its clear stretch (hidden until the sled is near)
  // the sun's shadow on the ride: a camera that sees nothing, drawn once, then left alone
  shadowOff() { const sh = this.sun.shadow; Object.assign(sh.camera, { left: -1, right: 1, top: 1, bottom: -1, near: 5000, far: 5001 }); sh.camera.updateProjectionMatrix(); sh.autoUpdate = false; sh.needsUpdate = true; }
  prepare(q) {
    const sc = q.scene = this.views?.get(q.id) || CINEMA[q.id].build({ camera: this.camera }); sc.camera = this.camera; const mid = q.a + q.lead + (this.vmax * 0.6 * q.dur) / 2, th = this.heading(mid);
    this.at(mid, -TRACK_Z, 0, sc.group.position); sc.group.rotation.y = Math.PI / 2 - th; this.scene.add(sc.group); sc.group.updateMatrixWorld(true);
    sc.tick(0, 0); sc.group.visible = false;
  }
  updateCinema(dt) {
    for (const q of this.slots) {
      if (!q.played && this.dist > q.b && this.cine?.q !== q) q.played = true; // already past it
      if (q.scene && !q.played) q.scene.group.visible = this.dist > q.a - 40 && this.dist < q.b + 20; // only near its stretch (the sky would cover the ride)
      if (q.scene && !q.played && !this.cine && this.dist >= q.a + q.lead) { this.cine = { q, t: 0, ready: false }; this.lightFor(q.scene); this.on.cinema?.({ phase: 'start', id: q.id, title: q.title, task: q.task, part: q.part, welcome: CINEMA[q.id].welcome }); }
      if (q.played && q.scene && this.dist > q.b + 20) { this.scene.remove(q.scene.group); q.scene.dispose(); q.scene = null; }
    }
    const c = this.cine; if (!c) return;
    c.t += dt; c.q.scene.tick(c.t, dt);
    if (!c.ready && c.t > c.q.dur - 1.0) { c.ready = true; this.on.cinema?.({ phase: 'ready', id: c.q.id }); this.on.hint?.('GET READY!'); }
    if (c.t >= c.q.dur) { c.q.played = true; this.cine = null; this.lightFor(null); this.on.cinema?.({ phase: 'end', id: c.q.id }); }
  }
  // tap during a scene: straight to its last second (the camera swings back)
  skipCine() { const c = this.cine; if (c && c.t < c.q.dur - 1.0) c.t = c.q.dur - 1.0; }
  // a scene's own light: a low warm sun with long shadows over the place; back to the ride's after
  lightFor(sc) {
    const sun = this.sun, hemi = this.hemi, sceneT = this.scene, cam = this.camera;
    if (!this.light0) this.light0 = { col: sun.color.clone(), int: sun.intensity, pos: sun.position.clone(), sky: hemi.color.clone(), gr: hemi.groundColor.clone(), bg: sceneT.background.clone(), fog: sceneT.fog.color.clone(), near: sceneT.fog.near, far: sceneT.fog.far, cfar: cam.far };
    if (!sc) { const L0 = this.light0; sun.color.copy(L0.col); sun.intensity = L0.int; sun.position.copy(L0.pos); sun.target.position.set(0, 0, 0); hemi.color.copy(L0.sky); hemi.groundColor.copy(L0.gr); sceneT.background.copy(L0.bg); sceneT.fog.color.copy(L0.fog); sceneT.fog.near = L0.near; sceneT.fog.far = L0.far; cam.far = L0.cfar; cam.updateProjectionMatrix(); this.shadowOff(); for (const l of this.lamps) { l.intensity = 0; l.position.set(0, -50, 0); } return; }
    const c = sc.group.position.clone().add(new Vector3(0, 0, -9).applyAxisAngle(new Vector3(0, 1, 0), sc.group.rotation.y)), d = new Vector3(...sc.light.dir).applyAxisAngle(new Vector3(0, 1, 0), sc.group.rotation.y).normalize();
    sun.color.set(sc.light.sun); sun.intensity = sc.light.intensity; hemi.color.set(sc.light.sky); if (sc.light.ground) hemi.groundColor.set(sc.light.ground);
    sceneT.background.set(sc.light.horizon); sceneT.fog.color.set(sc.light.fog || sc.light.horizon); sceneT.fog.near = 80; sceneT.fog.far = 360; cam.far = 700; cam.updateProjectionMatrix(); // a long view, hazing into the scene's sky
    sun.target.position.copy(c); sun.position.copy(c).addScaledVector(d, 30);
    Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 80 }); sun.shadow.camera.updateProjectionMatrix(); sun.shadow.autoUpdate = true;
    this.lamps.forEach((l, k) => { const L = sc.lamps?.[k]; if (!L) { l.intensity = 0; return; } l.color.set(L.color); l.intensity = L.intensity; l.distance = L.distance; l.decay = L.decay; l.position.copy(sc.group.localToWorld(new Vector3(...L.pos))); }); // the place's floodlights
  }

  collect(it) {
    if (it.kind === 'word') { this.flakes += 1; this.on.word?.(it.word); this.spark(LANES[it.lane], 1, 0, 30, '#ffd166', 3); this.on.sound?.('flake'); }
    else { // a chime for every snowball, a step up the scale while the run of them goes on
      this.snowballs += 1; this.spark(LANES[it.lane], it.y, 0, 5, '#ffffff', 1.5);
      this.chimeK = this.time - (this.chimeT ?? -9) < 0.7 ? Math.min(CHIME.length - 1, this.chimeK + 1) : 0; this.chimeT = this.time;
      this.on.sound?.('chime', { freq: 587.3 * 2 ** (CHIME[this.chimeK] / 12) });
    }
    this.on.count?.();
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
    // the student
    const k = this.kid; this.fakeC.moving = this.v; this.fakeC.flash = this.stumbleT > 0.7 ? 0.1 : 0;
    k.update(dt, { visible: !(this.blinkT > 0 && Math.floor(this.blinkT * 10) % 2), reduceMotion: this.reduceMotion });
    k.bar.visible = false; this.at(d, this.x, this.y, k.root.position); k.root.rotation.order = 'YXZ';
    k.root.rotation.set(this.slope(d) * 0.9, -this.heading(d), (LANES[this.lane] - this.x) * -0.12 - this.bankAt(d) * 0.8); // leans into the curve
    // ducking: tuck down and forward over the sled (eased in and out, not a squash)
    this.tuck = (this.tuck || 0) + ((this.duckT > 0 ? 1 : 0) - (this.tuck || 0)) * Math.min(1, dt * 18);
    k.kid.scale.y = k.kid.scale.x * (1 - 0.28 * this.tuck); k.kid.rotation.x = 0.6 * this.tuck; k.kid.position.z = 0.12 * this.tuck;
    if (this.tuck > 0.05) { k.arms[0].rotation.x = k.arms[1].rotation.x = -1.1 * this.tuck; }
    // the obstacles and pickups in view
    for (const it of this.items) {
      const dz = it.d - d;
      if (dz < -6 || dz > 70) { if (it.m) { it.m.visible = false; it.m = null; if (it.tag) it.tag.visible = false; } continue; }
      if (it.done && (it.kind === 'ball' || it.kind === 'word' || it.kind === 'letter')) { if (it.m) { it.m.visible = false; it.m = null; } if (it.tag) it.tag.visible = false; continue; }
      if (!it.m) {
        if (it.kind === 'ball') it.m = this.ballMesh();
        else if (it.kind === 'word') { it.m = this.flakeMesh(true); it.tag = it.tag || this.wordTag(it.word.en); it.tag.visible = true; } // its tag made ahead (stock)
        else if (it.kind === 'letter') { it.m = it.pre || this.letterMesh(it.ch); it.m.visible = true; }
        else it.m = this.mesh(it.kind);
      }
      const x = it.full ? 0 : LANES[it.lane];
      if (it.kind === 'ball' || it.kind === 'word') { this.put(it.m, it.d, x, (it.y || 0.6) + Math.sin(this.time * 3 + it.d) * 0.08, this.time * 2 + it.d); it.m.scale.setScalar(it.kind === 'word' ? 2.1 : 1); if (it.tag) { it.tag.visible = true; this.at(it.d, x, 1.9, it.tag.position); } }
      else if (it.kind === 'letter') { this.put(it.m, it.d, x, 1.0 + Math.sin(this.time * 3 + it.lane) * 0.06); }
      else if (it.kind === 'gull') { this.put(it.m, it.d, x + Math.sin(this.time * 2 + it.d) * 0.3, 1.05 + Math.sin(this.time * 6) * 0.05); it.m.rotation.z = Math.sin(this.time * 12) * 0.3; }
      else if (it.kind === 'branch') this.put(it.m, it.d, x, 0, it.lane === 0 ? Math.PI : 0);
      else this.put(it.m, it.d, x, 0);
    }
    const L = this.length;
    this.put(this.endMesh, L + 16, 0); this.put(this.banner, L + 2, 0, 3.3);
    for (const a of this.archPosts) this.put(a.m, L + 2, a.s * 2.6, 1.7);
    // camera behind and above the sled, following the bends and leaning a little with the bank
    const th = this.heading(d); this.camTh = this.camTh === undefined ? th : this.camTh + (th - this.camTh) * Math.min(1, dt * 4); // smoothed, so the bends sweep past
    const sp = this.at(d, this.x * 0.5, 0), ct = this.camTh;
    this.camera.position.set(sp.x - Math.sin(ct) * 7.2, sp.y + 4.3 + this.y * 0.3, sp.z + Math.cos(ct) * 7.2);
    const look = this.at(d + 7, this.x * 0.3, 0.9 + this.y * 0.4); look.lerp(new Vector3(sp.x + Math.sin(ct) * 7, sp.y + 0.9 + this.y * 0.4, sp.z - Math.cos(ct) * 7), 0.5);
    // the camera leans with the bank, gently: a smoothed roll, so it never jerks
    const roll = this.bankAt(d + 4) * 0.45; this.camRoll = this.camRoll === undefined ? roll : this.camRoll + (roll - this.camRoll) * Math.min(1, dt * 2.5);
    const c = this.cine;
    if (c) { // a place on the way: the camera swings to the scene's shots, and back for the last second
      const sc = c.q.scene, T = c.q.dur, [sp, sl] = this.reduceMotion ? sc.wide : shotAt(sc, c.t), E = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
      // in: the camera turns its head to the place first, then glides to the shot; out: back the other way
      const kLook = this.reduceMotion ? (c.t < T - 0.6 ? 1 : 0) : Math.min(E(c.t / 0.55), E((T - c.t) / 0.45));
      const kPos = this.reduceMotion ? kLook : Math.min(E((c.t - 0.2) / 0.85), E((T - c.t - 0.25) / 0.75));
      const P = sc.group.localToWorld(new Vector3(...sp)), Lk = sc.group.localToWorld(new Vector3(...sl));
      this.camera.position.lerp(P, kPos); look.lerp(Lk, kLook); this.camRoll *= 1 - kLook;
      const lens = 58 + ((this.camera.aspect < 1 ? 58 : 40) - 58) * kPos; // a longer lens for the views: the landmark fills the frame, the skyline draws close behind it
      if (Math.abs(this.camera.fov - lens) > 0.01) { this.camera.fov = lens; this.camera.updateProjectionMatrix(); }
    } else if (this.camera.fov !== 58) { this.camera.fov = 58; this.camera.updateProjectionMatrix(); }
    this.camera.lookAt(look); this.camera.rotateZ(this.camRoll);
    // sparks
    let n = 0;
    for (const s of this.sparks) { if (s.t <= 0) continue; s.t -= dt; s.vy -= 9 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; o.position.set(s.x, s.y, s.z); o.scale.setScalar(Math.max(0.1, s.t * 1.6)); o.updateMatrix(); this.sparkMesh.setMatrixAt(n, o.matrix); this.sparkMesh.setColorAt(n, s.c); n++; }
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
  // everything the ride will show, made now (hidden) rather than the moment it comes into view: one of
  // each obstacle, the snowball and the snowflake, each word snowflake's tag, each spelling letter
  stock() {
    const hide = m => { m.visible = false; return m; };
    for (const kind of new Set(this.items.map(it => it.kind))) if (!['ball', 'word', 'letter'].includes(kind)) hide(this.mesh(kind));
    hide(this.ballMesh()); hide(this.flakeMesh(true));
    for (const it of this.items) { if (it.kind === 'word') it.tag = hide(this.wordTag(it.word.en)); if (it.kind === 'letter') it.pre = hide(this.letterMesh(it.ch)); }
  }
  // a snowball to pick up (the common thing on the track)
  ballMesh() {
    const list = this.pool.get('ball') || []; this.pool.set('ball', list);
    const free = list.find(m => !m.visible); if (free) { free.visible = true; return free; }
    if (!this.geo.ball) { this.geo.ball = new SphereGeometry(0.2, 12, 9); this.ballMat = new MeshLambertMaterial({ color: '#ffffff', emissive: '#c9dcff', emissiveIntensity: 0.35 }); }
    const m = new Mesh(this.geo.ball, this.ballMat); this.scene.add(m); list.push(m); return m;
  }
  wordTag(text) { const sp = new Sprite(new SpriteMaterial({ map: tagTex(text), depthWrite: false, transparent: true })); sp.scale.set(2.2, 0.55, 1); this.scene.add(sp); return sp; }
  letterMesh(ch) { const m = new Mesh(SHAPES.letter(), [new MeshLambertMaterial({ color: '#ffffff' }), new MeshLambertMaterial({ color: '#ffffff' }), new MeshLambertMaterial({ color: '#ffffff' }), new MeshLambertMaterial({ color: '#ffffff' }), new MeshBasicMaterial({ map: letterTex(ch, '#7cc4f0') }), new MeshBasicMaterial({ map: letterTex(ch, '#7cc4f0') })]); this.scene.add(m); return m; }

  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  dispose() { for (const q of this.slots || []) q.scene?.dispose(); this.scene.traverse(o => { if (o.isMesh || o.isSprite) { o.geometry?.dispose?.(); const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { m?.map?.dispose?.(); m?.dispose?.(); } } }); }
}
