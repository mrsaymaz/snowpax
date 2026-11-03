// Art styles. One style is chosen for the game; the others exist so Mr. Saymaz can compare.
//   toybox  — snow-globe miniature: chunky short buildings, puffy snow pillows, toon shading
//   cartoon — cel-shaded: bold outlines, flat two-tone colour, saturated palette
//   paper   — papercraft diorama: card colours, paper grain, cut-out trees, crisp shadows
//   clay    — plasticine: rounded blocks, soft matte surfaces, warm light
import {
  MeshToonMaterial, MeshLambertMaterial, MeshStandardMaterial, DataTexture, RedFormat, NearestFilter, CanvasTexture,
  RepeatWrapping, SRGBColorSpace, Color,
} from 'three';

export const STYLES = {
  // The chosen mix: clay's rounded matte blocks and warm light + toybox's candy colours,
  // snow pillows, icicles and round glowing windows, with extra miniature details.
  snowclay: {
    name: 'Snowclay (toybox + clay)', levels: [2, 4], floor: 1.8, bay: 2.4,
    walls: ['#ff9f8f', '#ffd27a', '#94d5c8', '#a3c4f5', '#c8aef2', '#ffb8cf', '#b2e3a6', '#ffc792', '#f6e3c4'],
    eave: '#e0634e', snow: '#fdfeff', ground: '#f5f8fc', road: '#d9e1f0', roadMain: '#cfd9ec',
    areas: { park: '#e4f3e2', pitch: '#ddf0db', playground: '#eef5df', wood: '#d8ecd5', cemetery: '#ebe7ef', schoolyard: '#fff1d4', ourYard: '#ffedbf' },
    zone: '#efe9fb', sky: '#c9e4f7', roof: 'pillow', trees: 'blob', outline: null, rounded: true, clay: true,
    hemi: ['#fffaf2', '#dfe7f2', 1.95], sun: ['#ffefd8', 2.3], shadows: true, overlay: 'tiltshift', mixedRoofs: true,
    details: { doors: true, chimneys: 0.4, plinth: true, ao: true, banks: true, lamps: true },
    bumpScale: 0.45,
    windows: { lit: 0.45, glass: '#7f9fce', litColor: '#ffc65c', shape: 'mix', big: true },
  },
  toybox: {
    name: 'Snow-globe toybox', levels: [2, 4], floor: 1.75, bay: 2.5,
    walls: ['#ff9a8b', '#ffd36e', '#8fd3c7', '#9ec5ff', '#c9a7ff', '#ffb3d1', '#a8e6a1', '#ffc48c'],
    eave: '#e8604c', snow: '#ffffff', ground: '#f4f9ff', road: '#d7e3f7', roadMain: '#cbd9f2',
    areas: { park: '#e3f6e6', pitch: '#dcf3df', playground: '#eef7e0', wood: '#d6efd8', cemetery: '#ece8f2', schoolyard: '#fff3d6', ourYard: '#fff0c4' },
    zone: '#efe8ff', sky: '#bfe3ff', roof: 'pillow', trees: 'lollipop', outline: null,
    hemi: ['#ffffff', '#dfe9f7', 2.1], sun: ['#fff4e0', 1.1], shadows: true, overlay: 'tiltshift',
    windows: { lit: 0.5, glass: '#7fa6d9', litColor: '#ffc75a', shape: 'round', big: true },
  },
  cartoon: {
    name: 'Cel-shaded cartoon', levels: [2, 4], floor: 1.7, bay: 2.2,
    walls: ['#ff5d5d', '#ffcf3f', '#3fc1c9', '#5b8def', '#9b6bff', '#ff8c42', '#4cd17a', '#f2f2f2'],
    eave: '#d63c2f', snow: '#ffffff', ground: '#ffffff', road: '#c9d6e6', roadMain: '#b9c9dd',
    areas: { park: '#c8f0c0', pitch: '#bdeab5', playground: '#d6f2b8', wood: '#a9e0a1', cemetery: '#e2dccf', schoolyard: '#ffe9a8', ourYard: '#ffdf7a' },
    zone: '#e9ddff', sky: '#9fdcff', roof: 'gable', trees: 'cone', outline: { color: '#1d1b2e', width: 0.085 },
    hemi: ['#ffffff', '#e8eef5', 1.6], sun: ['#ffffff', 1.5], shadows: false, overlay: null, toonSteps: 2,
    windows: { lit: 0.3, glass: '#2d4a7a', litColor: '#ffe066', shape: 'comic', big: false },
  },
  paper: {
    name: 'Papercraft diorama', levels: [2, 4], floor: 1.7, bay: 2.3,
    walls: ['#e9c9a6', '#d9a58a', '#b9cfc0', '#c4d3e3', '#e6d39b', '#d8b4c7', '#cfc3a8', '#f0e3cf'],
    eave: '#b8664a', snow: '#fbf8f2', ground: '#f6f2ea', road: '#d9d6cf', roadMain: '#cfcbc3',
    areas: { park: '#d9e6cf', pitch: '#d2e2c6', playground: '#e3e8cc', wood: '#c9dbbd', cemetery: '#e2dcd0', schoolyard: '#efe2c2', ourYard: '#f2d998' },
    zone: '#e8e2ee', sky: '#e7eef3', roof: 'gable', trees: 'cutout', outline: { color: '#8a7765', width: 0.04 },
    hemi: ['#fffaf0', '#e9e2d6', 1.75], sun: ['#fff1dc', 1.25], shadows: true, overlay: 'paper', grain: true,
    windows: { lit: 0.25, glass: '#7d8fa0', litColor: '#f5c96a', shape: 'cut', big: false },
  },
  clay: {
    name: 'Clay / plasticine', levels: [2, 3], floor: 1.8, bay: 2.4,
    walls: ['#e2856e', '#e9b872', '#9cc5a1', '#8fb3d9', '#c49bd6', '#f2a7a0', '#d6c38e', '#e8d6c0'],
    eave: '#c0583f', snow: '#fbfdff', ground: '#f3f5f8', road: '#d5dae2', roadMain: '#cbd1da',
    areas: { park: '#dcefd9', pitch: '#d4eacf', playground: '#e6f0d4', wood: '#cbe4c6', cemetery: '#e6e1da', schoolyard: '#f5e9cc', ourYard: '#f6dd9e' },
    zone: '#ebe5f3', sky: '#d7e7f3', roof: 'blob', trees: 'blob', outline: null, rounded: true,
    hemi: ['#fff6ea', '#d9dfe8', 1.5], sun: ['#ffe9cc', 2.0], shadows: true, overlay: 'vignette', clay: true,
    windows: { lit: 0.35, glass: '#6b7f99', litColor: '#ffc26b', shape: 'arch', big: true },
  },
};
export const styleOf = name => STYLES[name] || STYLES.snowclay;

let toonMaps = {};
function toonGradient(steps) {
  if (!toonMaps[steps]) {
    const data = steps === 2 ? new Uint8Array([110, 255]) : new Uint8Array([120, 200, 255]);
    const t = new DataTexture(data, data.length, 1, RedFormat); t.minFilter = t.magFilter = NearestFilter; t.needsUpdate = true;
    toonMaps[steps] = t;
  }
  return toonMaps[steps];
}

let grain = null, bump = null;
export function grainTexture() { // soft paper fibres, very light
  if (grain) return grain;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
  let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 1800; i++) { const v = 238 + Math.floor(r() * 17); g.fillStyle = `rgba(${v},${v},${v - 3},0.6)`; g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2); }
  g.lineCap = 'round';
  for (let i = 0; i < 140; i++) { g.strokeStyle = `rgba(160,140,115,${0.03 + r() * 0.04})`; g.lineWidth = 0.6 + r(); g.beginPath(); const x = r() * 256, y = r() * 256, a = r() * 6.28, L = 6 + r() * 18; g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.6) * L * 0.5, y + Math.sin(a + 0.6) * L * 0.5, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
  grain = new CanvasTexture(c); grain.wrapS = grain.wrapT = RepeatWrapping; grain.colorSpace = SRGBColorSpace; grain.repeat.set(0.12, 0.12);
  return grain;
}
export function bumpTexture() { // soft lumpy "thumbprint" noise for clay
  if (bump) return bump;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
  let s = 5; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 500; i++) { const x = r() * 256, y = r() * 256, rad = 4 + r() * 14, v = 110 + Math.floor(r() * 40); const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${v},${v},${v},0.5)`); gr.addColorStop(1, 'rgba(128,128,128,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  bump = new CanvasTexture(c); bump.wrapS = bump.wrapT = RepeatWrapping;
  return bump;
}

// One material factory per style. opts: { color, vertexColors, map, emissiveMap, emissive, side, transparent, opacity }
export function makeMaterial(style, opts = {}) {
  const S = styleOf(style);
  const base = { ...opts };
  if (S.grain && !base.map && !base.noGrain) base.map = grainTexture();
  delete base.noGrain;
  if (style === 'toybox' || style === 'cartoon') return new MeshToonMaterial({ gradientMap: toonGradient(S.toonSteps || 3), ...base });
  if (S.clay) return new MeshStandardMaterial({ roughness: 0.85, metalness: 0, bumpMap: bumpTexture(), bumpScale: S.bumpScale ?? 1.2, ...base });
  return new MeshLambertMaterial(base);
}

// Window texture atlas: 8 bays × 8 floors with style-specific windows (and a glow map).
export function windowTextures(style) {
  const S = styleOf(style), W = S.windows, size = 512, n = 8, cs = size / n;
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = size; return [c, c.getContext('2d')]; };
  const [mc, m] = mk(), [ec, e] = mk();
  m.fillStyle = '#ffffff'; m.fillRect(0, 0, size, size);
  if (S.grain) { const gt = grainTexture().image; for (let y = 0; y < size; y += 256) for (let x = 0; x < size; x += 256) m.drawImage(gt, x, y); }
  e.fillStyle = '#000'; e.fillRect(0, 0, size, size);
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const rr = (g, x, y, w, h, rad) => { g.beginPath(); g.roundRect(x, y, w, h, rad); g.fill(); };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = i * cs, y = j * cs, lit = r() < W.lit;
    const w = cs * (W.big ? 0.52 : 0.42), h = cs * (W.big ? 0.56 : 0.5), wx = x + (cs - w) / 2, wy = y + cs * 0.18;
    const glass = lit ? W.litColor : W.glass;
    const shape = W.shape === 'mix' ? (i % 3 === 1 ? 'arch' : 'round') : W.shape;
    if (shape === 'arch' && W.shape === 'mix') {
      m.fillStyle = '#fff6ea'; m.beginPath(); m.moveTo(wx - 4, wy + h + 2); m.lineTo(wx - 4, wy + w / 2); m.arc(wx + w / 2, wy + w / 2, w / 2 + 4, Math.PI, 0); m.lineTo(wx + w + 4, wy + h + 2); m.fill();
      m.fillStyle = glass; m.beginPath(); m.moveTo(wx, wy + h); m.lineTo(wx, wy + w / 2); m.arc(wx + w / 2, wy + w / 2, w / 2, Math.PI, 0); m.lineTo(wx + w, wy + h); m.fill();
      m.fillStyle = 'rgba(255,255,255,0.55)'; m.fillRect(wx + w / 2 - 1.5, wy + 4, 3, h - 4); m.fillRect(wx, wy + h * 0.55, w, 3);
      m.fillStyle = '#ffffff'; rr(m, wx - 8, wy + h - 1, w + 16, 11, 5);
    } else if (shape === 'round') {
      if (W.shape === 'mix') { m.fillStyle = '#fff6ea'; rr(m, wx - 5, wy - 5, w + 10, h + 10, 15); m.fillStyle = glass; rr(m, wx, wy, w, h, 10); m.fillStyle = 'rgba(255,255,255,0.55)'; m.fillRect(wx + w / 2 - 1.5, wy, 3, h); m.fillStyle = '#ffffff'; rr(m, wx - 8, wy + h - 1, w + 16, 11, 5); }
      else {
      m.fillStyle = 'rgba(40,60,110,0.35)'; rr(m, wx - 3, wy - 3, w + 6, h + 6, 13);
      m.fillStyle = glass; rr(m, wx, wy, w, h, 10);
      m.fillStyle = '#ffffff'; rr(m, wx - 7, wy + h - 1, w + 14, 10, 5); // snow pillow on the sill
      }
    } else if (W.shape === 'comic') {
      m.fillStyle = '#1d1b2e'; m.fillRect(wx - 4, wy - 4, w + 8, h + 8);
      m.fillStyle = glass; m.fillRect(wx, wy, w, h);
      m.strokeStyle = 'rgba(255,255,255,0.8)'; m.lineWidth = 3; m.beginPath(); m.moveTo(wx + 5, wy + h * 0.45); m.lineTo(wx + w * 0.45, wy + 5); m.stroke();
      m.fillStyle = '#ffffff'; m.fillRect(wx - 6, wy + h + 2, w + 12, 6);
    } else if (W.shape === 'cut') {
      m.fillStyle = 'rgba(80,60,40,0.25)'; m.fillRect(wx + 3, wy + 3, w, h); // cut-out shadow
      m.fillStyle = glass; m.fillRect(wx, wy, w, h);
      m.fillStyle = 'rgba(255,255,255,0.18)'; m.fillRect(wx + w / 2 - 1, wy, 2, h); m.fillRect(wx, wy + h / 2 - 1, w, 2);
    } else { // arch
      m.fillStyle = 'rgba(60,40,30,0.25)'; m.beginPath(); m.moveTo(wx - 3, wy + h + 3); m.lineTo(wx - 3, wy + w / 2); m.arc(wx + w / 2, wy + w / 2, w / 2 + 3, Math.PI, 0); m.lineTo(wx + w + 3, wy + h + 3); m.fill();
      m.fillStyle = glass; m.beginPath(); m.moveTo(wx, wy + h); m.lineTo(wx, wy + w / 2); m.arc(wx + w / 2, wy + w / 2, w / 2, Math.PI, 0); m.lineTo(wx + w, wy + h); m.fill();
    }
    if (lit) { e.fillStyle = W.litColor; e.globalAlpha = 0.6; if (shape === 'arch') { e.beginPath(); e.moveTo(wx, wy + h); e.lineTo(wx, wy + w / 2); e.arc(wx + w / 2, wy + w / 2, w / 2, Math.PI, 0); e.lineTo(wx + w, wy + h); e.fill(); } else e.fillRect(wx + 3, wy + 3, w - 6, h - 6); e.globalAlpha = 1; }
  }
  const tex = c => { const t = new CanvasTexture(c); t.wrapS = t.wrapT = RepeatWrapping; t.colorSpace = SRGBColorSpace; t.anisotropy = 4; return t; };
  return { map: tex(mc), emissiveMap: tex(ec) };
}

export const color = hex => new Color(hex);
