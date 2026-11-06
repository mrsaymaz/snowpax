// The sled ride's cinematic scenes: on the way into Kasımpaşa the camera turns, for about seven
// seconds, to each place whose English task is played at the outpost, in task order, and shows it
// alive: people, a little story, the light of the hour. A scene is built just before it is needed
// and thrown away after. Each scene sits beside the track in its own frame: the track runs along
// local +x at z = TRACK_Z (the sled rides from -x to +x), the place faces it (+z).
//
// A scene: { group, duration, shots: [{ t0, t1, from: [pos, look], to: [pos, look] }], wide,
// light: { sun, sky, dir }, tick(t, dt), dispose() }. Shots are cuts; the sled ride blends the
// first one in from its chase camera and the last one back out.
import {
  Group, Mesh, MeshLambertMaterial, MeshBasicMaterial, BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry, TorusGeometry,
  PlaneGeometry, CircleGeometry, CapsuleGeometry, CanvasTexture, SRGBColorSpace, DoubleSide, Sprite, SpriteMaterial, AdditiveBlending,
  BufferGeometry, Float32BufferAttribute, Vector3,
} from 'three';
import { buildKid, bakeKid, setKidMood } from './kids2.js';
import { makeLook } from '../looks.mjs';

export const TRACK_Z = 14, SCENE_SECONDS = 7.2;
const L = (c, extra = {}) => new MeshLambertMaterial({ color: c, ...extra });
const tex = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; };
const ease = t => t * t * (3 - 2 * t);
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

// a person of the neighbourhood: the game's kid model in their own coat (adults a size up)
function person({ gender = 'boy', coat = '#5b7db1', dark = '#3b5480', design = 'puffer', kit = 'thrower', scale = 0.8, seed = 1, mood = 'happy' } = {}) {
  let s = seed; const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const k = bakeKid(buildKid({ design, team: 'neutral', kit, colors: { color: coat, dark }, mood, ...makeLook(gender, rng) }));
  k.scale.setScalar(scale); k.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const g = new Group(); g.add(k);
  const sh = new Mesh(new CircleGeometry(0.42 * scale / 0.8, 16), new MeshBasicMaterial({ color: '#46557a', transparent: true, opacity: 0.25, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; g.add(sh);
  g.userData = { kid: k, arms: k.userData.arms, legs: k.userData.legs };
  return g;
}

// ---------- the Archery Ground scene ----------
// Bright late afternoon, long shadows. A row of kids throws snowballs at straw targets while a coach
// keeps score; pennants snap in the wind; an old man sweeps the lodge steps with a cat beside him;
// salep steams at a stall; the old record stones stand along the way. The moment: a small girl hits
// the bullseye, the row jumps, and the coach flips the score to 10.
export function archeryScene({ sound = () => {} } = {}) {
  const g = new Group(), anim = [];
  const marble = L('#f6f2f8'), marbleShade = L('#e4dcea'), lead = L('#8492b4'), gold = L('#e8b84a', { emissive: '#6b4a10' }), red = L('#c8443c'), redArch = L('#d0573f');
  const snow = L('#fbfdff'), stone = L('#a9a3bd'), wood = L('#a5714f'), dark = L('#6e4a32'), straw = L('#e8c46a');
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0, parent = g) => { const o = new Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };

  // the ground: snow, and a flagstone plaza in front of the lodge with trodden paths
  const groundM = L('#eef2fb'); const ground = new Mesh(new CircleGeometry(30, 48), groundM); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.04; ground.receiveShadow = true; g.add(ground);
  const flag = tex(256, 256, (c, W) => { c.fillStyle = '#b9b4cc'; c.fillRect(0, 0, W, W); for (let b = 0; b < 8; b++) for (let a = 0; a < 8; a++) { const v = 170 + ((a * 7 + b * 13) % 5) * 9; c.fillStyle = `rgb(${v},${v - 4},${v + 14})`; c.fillRect(a * 32 + (b % 2) * 16 + 2, b * 32 + 2, 28, 28); } c.fillStyle = 'rgba(255,255,255,0.55)'; for (let k = 0; k < 40; k++) c.fillRect((k * 53) % W, (k * 97) % W, 18, 9); });
  const plaza = new Mesh(new PlaneGeometry(16, 11), L('#ffffff', { map: flag })); plaza.rotation.x = -Math.PI / 2; plaza.position.set(1.5, 0.01, -2.2); plaza.receiveShadow = true; g.add(plaza);

  // the archers' lodge: white marble, three lead domes under snow, a porch of red-and-white arches, a golden bow
  const S = 1.7, LX = 0, LZ = -8.2;
  add(new BoxGeometry(4.4 * S, 0.32 * S, 4.4 * S), stone, LX, 0.16 * S, LZ);
  add(new BoxGeometry(4.0 * S, 2.1 * S, 2.3 * S), marble, LX, 1.35 * S, LZ - 0.75 * S);
  add(new BoxGeometry(4.2 * S, 0.16 * S, 2.5 * S), marbleShade, LX, 2.48 * S, LZ - 0.75 * S);
  for (const dx of [-1.25, 0, 1.25]) {
    const big = dx === 0 ? 1.25 : 1, x = LX + dx * S, y0 = 2.56 * S, z0 = LZ - 0.75 * S;
    add(new CylinderGeometry(0.46 * big * S, 0.5 * big * S, 0.3 * S, 18), marble, x, y0 + 0.15 * S, z0);
    add(new SphereGeometry(0.5 * big * S, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), lead, x, y0 + 0.3 * S, z0);
    add(new SphereGeometry(0.52 * big * S, 18, 5, 0, Math.PI * 2, 0, Math.PI / 4.2), snow, x, y0 + 0.32 * S, z0);
    add(new SphereGeometry(0.07 * S, 8, 6), gold, x, y0 + 0.32 * S + 0.52 * big * S, z0); add(new ConeGeometry(0.035 * S, 0.26 * S, 6), gold, x, y0 + 0.5 * S + 0.52 * big * S, z0);
  }
  add(new BoxGeometry(4.1 * S, 0.14 * S, 1.5 * S), stone, LX, 0.39 * S, LZ + 1.15 * S);
  for (let k = 0; k < 5; k++) { const cx = LX + (-1.7 + k * 0.85) * S; add(new CylinderGeometry(0.09 * S, 0.1 * S, 1.35 * S, 12), marble, cx, 1.13 * S, LZ + 1.7 * S); add(new BoxGeometry(0.24 * S, 0.1 * S, 0.24 * S), stone, cx, 1.85 * S, LZ + 1.7 * S); }
  for (let k = 0; k < 4; k++) { const cx = LX + (-1.275 + k * 0.85) * S; add(new TorusGeometry(0.36 * S, 0.09 * S, 6, 14, Math.PI), redArch, cx, 1.85 * S, LZ + 1.7 * S); add(new TorusGeometry(0.36 * S, 0.092 * S, 6, 14, Math.PI / 3), marble, cx, 1.85 * S, LZ + 1.7 * S, 0, 0, Math.PI / 3); }
  add(new BoxGeometry(4.2 * S, 0.12 * S, 1.5 * S), wood, LX, 2.31 * S, LZ + 1.12 * S, 0.16); add(new BoxGeometry(4.15 * S, 0.16 * S, 1.45 * S), snow, LX, 2.42 * S, LZ + 1.12 * S, 0.16);
  const glass = L('#ffcf7a', { emissive: '#b4782a' });
  for (let k = 0; k < 4; k++) { const wx = LX + (-1.275 + k * 0.85) * S; add(new PlaneGeometry(0.46 * S, 0.72 * S), glass, wx, 1.05 * S, LZ + 0.41 * S); add(new CircleGeometry(0.23 * S, 12, 0, Math.PI), glass, wx, 1.41 * S, LZ + 0.411 * S); }
  add(new TorusGeometry(1.05 * S, 0.08 * S, 6, 28, Math.PI * 0.8), gold, LX, 2.7 * S, LZ + 1.95 * S, 0, 0, Math.PI * 0.1);
  const signT = tex(512, 128, (c) => { c.fillStyle = '#5a3a2a'; c.beginPath(); c.roundRect(6, 6, 500, 116, 26); c.fill(); c.strokeStyle = '#e8b84a'; c.lineWidth = 8; c.stroke(); c.fillStyle = '#fff6dc'; c.font = '900 60px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText("Archers' Lodge", 256, 68); });
  const sg = new Mesh(new PlaneGeometry(1.9 * S, 0.47 * S), new MeshBasicMaterial({ map: signT, transparent: true })); sg.position.set(LX, 2.2 * S, LZ + 2.06 * S); g.add(sg);
  for (const lx of [-1.6, 1.6]) { const lan = add(new BoxGeometry(0.2, 0.3, 0.2), L('#ffd98a', { emissive: '#c8902a' }), LX + lx * S, 1.6 * S, LZ + 1.6 * S); anim.push(t => { lan.material.emissiveIntensity = 0.9 + Math.sin(t * 9 + lx) * 0.1; }); }
  // steps down to the plaza
  for (let k = 0; k < 3; k++) add(new BoxGeometry(3.2, 0.18, 0.5), stone, LX, 0.09 + k * 0.18, LZ + 2.2 * S + 0.9 - k * 0.42);

  // pennants on tall poles either side of the porch, snapping in the wind
  const pennants = [];
  for (const [px, col] of [[-4.6, '#c8443c'], [4.6, '#e8b84a'], [-6.2, '#e8b84a'], [6.2, '#c8443c']]) {
    add(new CylinderGeometry(0.05, 0.06, 5.2, 8), L('#5d6b8f'), px, 2.6, -4.4); add(new SphereGeometry(0.09, 8, 6), gold, px, 5.25, -4.4);
    const geo = new BufferGeometry(), N = 8, pos = []; for (let i = 0; i <= N; i++) { const u = i / N; pos.push(u * 1.6, 0.4 * (1 - u), 0, u * 1.6, -0.4 * (1 - u), 0); }
    const idx = []; for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new Mesh(geo, L(col, { side: DoubleSide })); m.position.set(px, 4.75, -4.4); m.castShadow = true; g.add(m); pennants.push({ m, base: pos.slice(), seed: px });
  }
  anim.push((t) => { for (const p of pennants) { const a = p.m.geometry.attributes.position; for (let v = 0; v < a.count; v++) { const x = p.base[v * 3]; a.setZ(v, Math.sin(t * 9 - x * 3.2 + p.seed) * 0.16 * x); a.setY(v, p.base[v * 3 + 1] + Math.sin(t * 7 - x * 2) * 0.04 * x); } a.needsUpdate = true; p.m.geometry.computeVertexNormals(); } });

  // the record stones (menzil taşları) along the way: tall white marble with gold bands
  for (let k = 0; k < 6; k++) {
    const x = -16 + k * 2.1, z = 8.4 + (k % 2) * 0.5, h = 2.0 + ((k * 37) % 5) * 0.16;
    add(new BoxGeometry(0.34, h, 0.26), marble, x, h / 2, z); add(new ConeGeometry(0.25, 0.36, 4), marble, x, h + 0.18, z, 0, Math.PI / 4);
    for (const by of [h * 0.72, h * 0.82]) add(new BoxGeometry(0.36, 0.05, 0.28), gold, x, by, z);
    add(new SphereGeometry(0.24, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), snow, x, h + 0.28, z);
    add(new SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), snow, x, 0, z, 0, 0, 0).scale.set(1, 0.4, 1);
  }

  // the practice range: three straw targets on easels, a row of kids throwing, the coach with the score
  const ringsT = tex(256, 256, (c, W) => { const cols = ['#f4efe2', '#2f2f3a', '#4f6fa8', '#c8584a', '#e6b93e']; for (let k = 0; k < 5; k++) { c.fillStyle = cols[k]; c.beginPath(); c.arc(W / 2, W / 2, W / 2 - k * 24, 0, 7); c.fill(); } c.strokeStyle = 'rgba(120,90,40,0.35)'; c.lineWidth = 2; for (let k = 0; k < 30; k++) { c.beginPath(); const a = k / 30 * 6.28; c.moveTo(W / 2 + Math.cos(a) * 20, W / 2 + Math.sin(a) * 20); c.lineTo(W / 2 + Math.cos(a) * 126, W / 2 + Math.sin(a) * 126); c.stroke(); } });
  const targets = [5.4, 7.2, 9.0].map((x, k) => {
    const tg = new Group(); tg.position.set(x, 0, -4.6); g.add(tg);
    for (const s2 of [-1, 1]) add(new CylinderGeometry(0.04, 0.05, 1.9, 6), wood, s2 * 0.45, 0.9, 0.18, -0.2, 0, s2 * 0.18, tg);
    add(new CylinderGeometry(0.04, 0.05, 1.8, 6), wood, 0, 0.85, -0.35, 0.35, 0, 0, tg);
    const face = new Group(); face.position.set(0, 1.25, 0.1); tg.add(face);
    add(new CylinderGeometry(0.62, 0.62, 0.22, 24), straw, 0, 0, 0, Math.PI / 2, 0, 0, face);
    const f = new Mesh(new CircleGeometry(0.6, 32), new MeshLambertMaterial({ map: ringsT })); f.position.z = 0.115; face.add(f);
    add(new SphereGeometry(0.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), snow, 0, 0.6, 0, 0, 0, 0, face).scale.set(1.6, 0.35, 0.5);
    return { tg, face, x, wob: 0 };
  });
  const coats = [['#e0463c', '#a32c25'], ['#3d8bd8', '#24609e'], ['#5bb36a', '#367a43'], ['#f2a23c', '#b8711e']];
  const throwers = [4.9, 6.5, 8.1, 9.7].map((x, k) => {
    const p = person({ gender: k === 2 ? 'girl' : k % 2 ? 'girl' : 'boy', coat: coats[k][0], dark: coats[k][1], scale: k === 2 ? 0.66 : 0.76, seed: 11 + k * 7, kit: ['thrower', 'lobber', 'thrower', 'sprayer'][k] });
    p.position.set(x, 0, 1.6); p.rotation.y = Math.PI; g.add(p); // facing the targets (-z)
    return { p, x, k, throwT: 0, jump: 0, target: targets[Math.min(2, Math.max(0, Math.round((x - 5.4) / 1.8)))] };
  });
  const girl = throwers[2]; girl.target = targets[1];
  // the coach in a long coat, holding up the score board
  const coach = person({ gender: 'boy', coat: '#2f4a7a', dark: '#1f3256', design: 'vinyl', scale: 1.02, seed: 77 }); coach.position.set(10.4, 0, -3.35); coach.rotation.y = -0.15; g.add(coach); // beside the targets, facing the row
  const scoreT = n => tex(128, 128, (c, W) => { c.fillStyle = '#f7f1e3'; c.fillRect(0, 0, W, W); c.strokeStyle = '#5a3a2a'; c.lineWidth = 10; c.strokeRect(5, 5, W - 10, W - 10); c.fillStyle = n === 10 ? '#c8443c' : '#2b3556'; c.font = '900 76px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), W / 2, W / 2 + 4); });
  const boardM = new MeshBasicMaterial({ map: scoreT(8), side: DoubleSide }), board = new Mesh(new PlaneGeometry(0.62, 0.62), boardM); board.position.set(10.4, 2.45, -3.05); board.rotation.y = -0.1; g.add(board); // held up over his head
  coach.userData.arms[0].rotation.x = -2.3; coach.userData.arms[1].rotation.x = -2.3; // both hands up, holding the board

  // the old man sweeping the lodge steps, a cat on the warm step beside him
  const sweeper = person({ gender: 'boy', coat: '#7a5a8c', dark: '#523b60', design: 'vinyl', scale: 0.98, seed: 31 }); sweeper.position.set(-2.8, 0.2, -3.2); sweeper.rotation.y = 0.5; g.add(sweeper);
  const broom = new Group(); broom.position.set(-2.45, 0.2, -2.75); g.add(broom);
  add(new CylinderGeometry(0.025, 0.025, 1.3, 6), wood, 0, 0.75, 0, 0, 0, 0.35, broom); add(new ConeGeometry(0.16, 0.32, 8), straw, -0.22, 0.12, 0, 0, 0, 0.35, broom);
  const sweepPuffs = [];
  const cat = new Group(); cat.position.set(-1.6, 0.42, -3.6); cat.rotation.y = 0.4; g.add(cat);
  const ginger = L('#e08a3c'), cream = L('#f6e2c4');
  add(new SphereGeometry(0.2, 12, 8), ginger, 0, 0.16, 0, 0, 0, 0, cat).scale.set(1, 1.1, 1.35); add(new SphereGeometry(0.14, 12, 8), ginger, 0, 0.42, 0.14, 0, 0, 0, cat);
  for (const s2 of [-1, 1]) add(new ConeGeometry(0.05, 0.11, 4), ginger, s2 * 0.07, 0.55, 0.14, 0, 0, s2 * -0.25, cat);
  add(new SphereGeometry(0.07, 8, 6), cream, 0, 0.38, 0.25, 0, 0, 0, cat);
  const tail = new Group(); tail.position.set(0, 0.08, -0.25); cat.add(tail); add(new CylinderGeometry(0.03, 0.04, 0.42, 6), ginger, 0, 0.18, -0.06, -0.5, 0, 0, tail);

  // the salep stall: a purple-and-white awning, a copper urn, steam, the seller
  const stall = new Group(); stall.position.set(-9.6, 0, -1.6); stall.rotation.y = 0.35; g.add(stall);
  add(new BoxGeometry(2.2, 0.95, 0.9), wood, 0, 0.48, 0, 0, 0, 0, stall); add(new BoxGeometry(2.3, 0.08, 1.0), dark, 0, 0.98, 0, 0, 0, 0, stall);
  for (const sx of [-1.05, 1.05]) add(new CylinderGeometry(0.04, 0.04, 2.0, 6), dark, sx, 1.0, -0.4, 0, 0, 0, stall);
  for (let k = 0; k < 6; k++) add(new BoxGeometry(0.4, 0.05, 1.3), L(k % 2 ? '#ffffff' : '#7a4fa0'), -1.0 + k * 0.4, 2.0, 0.1, 0.25, 0, 0, stall);
  add(new BoxGeometry(2.45, 0.1, 1.2), snow, 0, 2.1, 0.12, 0.25, 0, 0, stall);
  const copper = L('#c8743a', { emissive: '#40200a' });
  add(new CylinderGeometry(0.22, 0.26, 0.5, 14), copper, -0.5, 1.27, 0.1, 0, 0, 0, stall); add(new SphereGeometry(0.22, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), copper, -0.5, 1.52, 0.1, 0, 0, 0, stall);
  for (let k = 0; k < 4; k++) add(new CylinderGeometry(0.05, 0.04, 0.11, 8), L('#f6f2ea'), 0.2 + k * 0.17, 1.08, 0.25, 0, 0, 0, stall);
  const seller = person({ gender: 'girl', coat: '#c8443c', dark: '#8c2b25', design: 'vinyl', scale: 0.98, seed: 53 }); seller.position.set(0.2, 0, -0.75); stall.add(seller);
  const salepT = tex(256, 64, (c) => { c.fillStyle = '#7a4fa0'; c.beginPath(); c.roundRect(4, 4, 248, 56, 14); c.fill(); c.fillStyle = '#fff6dc'; c.font = '900 34px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SALEP', 128, 34); });
  const salepSign = new Mesh(new PlaneGeometry(1.1, 0.28), new MeshBasicMaterial({ map: salepT, transparent: true })); salepSign.position.set(0, 1.75, 0.5); stall.add(salepSign);

  // a few pines and houses behind, for depth; snow drifting off the lodge roof; steam
  const pine = L('#2f6b5a'), pineD = L('#255647');
  for (const [x, z, s2] of [[-11, -12, 1.2], [-7.5, -14, 1.4], [8, -13, 1.3], [12, -11, 1.1], [15, -6, 1.0], [-15, -7, 1.1]]) {
    add(new CylinderGeometry(0.12 * s2, 0.16 * s2, 0.8 * s2, 6), dark, x, 0.4 * s2, z);
    for (let k = 0; k < 3; k++) { add(new ConeGeometry((1.2 - k * 0.3) * s2, 1.3 * s2, 8), k % 2 ? pineD : pine, x, (1.2 + k * 0.75) * s2, z); add(new ConeGeometry((1.0 - k * 0.27) * s2, 0.5 * s2, 8), snow, x, (1.55 + k * 0.75) * s2, z); }
  }
  for (const [x, z, w, c] of [[-3, -17, 5, '#e7d3c0'], [3.5, -18, 4.5, '#d5e2ee'], [-9, -18, 4, '#e9d6de']]) { add(new BoxGeometry(w, 3.2, 3), L(c), x, 1.6, z); add(new ConeGeometry(w * 0.78, 1.4, 4), L('#6d6a9c'), x, 3.9, z, 0, Math.PI / 4).scale.z = 0.62; add(new BoxGeometry(w * 1.05, 0.35, 2.4), snow, x, 4.05, z); for (const dx of [-w * 0.25, w * 0.25]) add(new PlaneGeometry(0.6, 0.7), glass, x + dx, 1.8, z + 1.51); }
  const puffTex = tex(64, 64, (c, W) => { const gr = c.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, W, W); });
  const puffs = []; // snow puffs, steam, sparkle: sprites with a short life
  const puff = (x, y, z, { n = 6, size = 0.35, speed = 1.2, life = 0.8, color = '#ffffff', up = 0.6, add: additive = false } = {}) => {
    for (let k = 0; k < n; k++) { const m = new SpriteMaterial({ map: puffTex, color, transparent: true, depthWrite: false, blending: additive ? AdditiveBlending : undefined }), sp = new Sprite(m); sp.position.set(x, y, z); sp.scale.setScalar(size); g.add(sp); const a = Math.random() * 6.28; puffs.push({ sp, vx: Math.cos(a) * speed * Math.random(), vy: up + Math.random() * speed * 0.6, vz: Math.sin(a) * speed * Math.random(), t: life, life, size }); }
  };
  // snowballs in flight
  const balls = [], ballGeo = new SphereGeometry(0.09, 10, 8);
  const throwAt = (th, bull = false) => {
    th.throwT = 0.3; const tg = th.target, from = new Vector3(th.x + 0.15, 1.05 * (th.k === 2 ? 0.85 : 1), 1.35), off = bull ? [0, 0] : [(Math.sin(th.x * 7 + performance.now()) * 0.3), (Math.cos(th.x * 3 + performance.now()) * 0.25)];
    const to = new Vector3(tg.x + off[0], 1.25 + off[1], -4.48);
    const m = new Mesh(ballGeo, snow); m.castShadow = true; g.add(m); balls.push({ m, from, to, t: 0, T: 0.55, tg, bull, th });
  };
  // the throwing schedule (seconds into the scene): everyone throws now and then; the girl's bullseye at 4.7
  const plan = [[0.3, 0], [0.9, 3], [1.4, 1], [2.1, 0], [2.6, 3], [3.2, 1], [3.7, 0], [4.15, 3], [4.7, 2, true], [5.9, 1], [6.4, 3]].map(([t, k, bull]) => ({ t, k, bull: !!bull, done: false }));
  let flipped = false, flipT = 0, cheer = 0;

  const tick = (t, dt) => {
    for (const f of anim) f(t);
    for (const p of plan) if (!p.done && t >= p.t) { p.done = true; throwAt(throwers[p.k], p.bull); if (!p.bull) sound('tap', { volume: 0.25 }); }
    for (const b of balls) {
      if (b.done) continue; b.t += dt; const k = Math.min(1, b.t / b.T), p = b.from.clone().lerp(b.to, k); p.y += Math.sin(k * Math.PI) * 0.9; b.m.position.copy(p);
      if (k >= 1) {
        b.done = true; g.remove(b.m); b.tg.wob = 1;
        puff(b.to.x, b.to.y, b.to.z + 0.08, { n: b.bull ? 16 : 7, size: b.bull ? 0.55 : 0.32, speed: b.bull ? 2.2 : 1.1, life: b.bull ? 1.1 : 0.6 });
        if (b.bull) { puff(b.to.x, b.to.y, b.to.z + 0.1, { n: 14, size: 0.3, speed: 2.6, life: 1.0, color: '#ffd166', add: true }); cheer = 1.4; sound('fanfare'); for (const th of throwers) setKidMood(th.p.userData.kid, 'joy'); setKidMood(coach.userData.kid, 'joy'); }
      }
    }
    // the row jumps for joy; arms up
    cheer = Math.max(0, cheer - dt * 0.9);
    for (const th of throwers) {
      th.throwT = Math.max(0, th.throwT - dt); const a = th.p.userData.arms;
      const hop = cheer > 0 ? Math.abs(Math.sin((t * 7 + th.k * 0.9))) * 0.32 * Math.min(1, cheer) : 0;
      th.p.position.y = hop;
      a[1].rotation.x = th.throwT > 0 ? -2.9 * Math.sin((th.throwT / 0.3) * Math.PI) : cheer > 0 ? -2.6 : -0.15 + Math.sin(t * 2 + th.k) * 0.08;
      a[0].rotation.x = cheer > 0 ? -2.6 : -0.1;
    }
    for (const tg of targets) { tg.wob = Math.max(0, tg.wob - dt * 2.5); tg.face.rotation.x = -Math.sin(tg.wob * 14) * 0.12 * tg.wob; }
    // the coach flips the score to 10 just after the bullseye
    if (cheer > 0 && !flipped) { flipT += dt; if (flipT > 0.35) { flipped = true; flipT = 0; } }
    if (flipped && flipT < 0.3) { flipT += dt; const k = flipT / 0.3; board.rotation.x = Math.sin(k * Math.PI) * 1.5; if (k > 0.5 && boardM.map.userData?.n !== 10) { boardM.map.dispose(); boardM.map = scoreT(10); boardM.map.userData = { n: 10 }; boardM.needsUpdate = true; } }
    // the old man sweeps; a little snow flies off the step; the cat's tail swishes
    broom.rotation.y = Math.sin(t * 4) * 0.45; sweeper.userData.arms[0].rotation.x = -0.9 + Math.sin(t * 4) * 0.25; sweeper.userData.arms[1].rotation.x = -0.9 + Math.sin(t * 4) * 0.25;
    if (Math.sin(t * 4) > 0.97 && Math.random() < 0.6) puff(-2.2, 0.3, -2.6, { n: 2, size: 0.18, speed: 0.6, life: 0.6, up: 0.3 });
    tail.rotation.z = Math.sin(t * 2.2) * 0.5; cat.children[1].rotation.y = Math.sin(t * 0.8) * 0.3;
    // steam from the salep urn, snow blowing off the lodge's domes
    if (Math.random() < dt * 10) { const p = stall.localToWorld(new Vector3(-0.5, 1.75, 0.1)); g.worldToLocal(p); puff(p.x, p.y, p.z, { n: 1, size: 0.35, speed: 0.15, life: 1.6, up: 0.5, color: '#f4f0ff' }); }
    if (Math.random() < dt * 8) puff(LX + (Math.random() - 0.5) * 6, 5.2 + Math.random() * 0.6, LZ - 1.2, { n: 1, size: 0.22, speed: 0.2, life: 1.8, up: -0.1 });
    for (const p of puffs) { if (p.t <= 0) continue; p.t -= dt; p.sp.position.x += (p.vx + 0.6) * dt; p.sp.position.y += p.vy * dt; p.sp.position.z += p.vz * dt; p.vy -= 0.4 * dt; const k = Math.max(0, p.t / p.life); p.sp.material.opacity = k; p.sp.scale.setScalar(p.size * (1.6 - k * 0.6)); if (p.t <= 0) { g.remove(p.sp); p.sp.material.dispose(); } }
    for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i].t <= 0) puffs.splice(i, 1);
  };

  return {
    group: g, duration: SCENE_SECONDS,
    // cuts: along the record stones → a slow push to the lodge → down the line of targets for the bullseye
    shots: [
      { t0: 0, t1: 2.0, from: [[-17, 1.3, 12.6], [-12, 1.6, 7.5]], to: [[-9.5, 1.5, 12.2], [-3, 2.0, 0]] },
      { t0: 2.0, t1: 4.35, from: [[-1.2, 2.6, 9.4], [0, 2.8, -6]], to: [[0.2, 2.4, 5.6], [0, 2.9, -7.5]] },
      { t0: 4.35, t1: 7.2, from: [[8.3, 3.1, 7.4], [8.1, 1.4, -4.2]], to: [[8.1, 2.6, 5.8], [8.1, 1.45, -4.4]] }, // behind the row, down the range
    ],
    wide: [[3, 6.5, 15], [2, 1.6, -3]],
    light: { sun: '#ffe9cc', intensity: 2.0, sky: '#eef0fa', dir: [-0.55, 0.42, 0.72] }, // low and warm from the west: long shadows
    tick, cheer: () => cheer,
    dispose() { g.traverse(o => { if (o.isMesh || o.isSprite) { o.geometry?.dispose?.(); const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { m?.map?.dispose?.(); m?.dispose?.(); } } }); },
  };
}

// The scenes, by place (the other four come next: Boulevard Park, Kızılay Square, Sururi Park, the Pier).
export const CINEMA = {
  archery: { title: 'Archery Ground', welcome: 'Welcome to Archery Ground!', build: archeryScene },
};

// the camera of a shot at time t: [position, look-at] in the scene's frame
export function shotAt(scene, t) {
  const s = scene.shots.find(q => t >= q.t0 && t < q.t1) || scene.shots[scene.shots.length - 1];
  const k = ease(Math.max(0, Math.min(1, (t - s.t0) / (s.t1 - s.t0))));
  return [lerp3(s.from[0], s.to[0], k), lerp3(s.from[1], s.to[1], k)];
}
