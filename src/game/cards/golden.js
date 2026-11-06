// Task stations for Arena 2, the Golden Horn (staged 3D sets, like the first arena's):
//   Karaköy Bridge and Pier · Listening – hear the word, cast your line to the fish that has it
//   Bankalar Caddesi · Sorting           – toss each gold coin card into its category's vault door
//   Tersane İstanbul · Builder           – build the ship's hull in the dry dock, plank by plank
//   Aynalıkavak Pavilion · Answer        – snowball the mirrored window with the right answer
//   Miniatürk · Matching                 – match the little signs across the park of models
// Each scene scores exactly like its flat card (basic.js): one item per question, pair or card,
// right first time or not; a miss shows the right one glowing and the task goes on.
import {
  Mesh, Group, MeshLambertMaterial, MeshStandardMaterial, MeshBasicMaterial, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, TorusGeometry,
  PlaneGeometry, CircleGeometry, Vector3, Color, DoubleSide, CanvasTexture, SRGBColorSpace,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { stage, pines, mounds, bunting, row, actor } from './stationkit.js';
import { tall, fountainMatch } from './stations.js';
import { castleWorldOrder, castleWorldSpell } from './castle3d.js';
import { esc, shuffle } from './util.js';

const L = c => new MeshLambertMaterial({ color: c });
const frameFor = (s, desk, short, port = null) => {
  if (port && tall()) { s.frame(port.eye, port.look, port.width); return; }
  const c = innerHeight < 430 ? short : desk, d = innerWidth / innerHeight < 1.6 ? 1.12 : 1; s.frame([c.eye[0], c.eye[1], c.eye[2] * d], c.look);
};
const caption = st => `${st.context ? `<span class="ctx">${esc(st.context)}</span>` : ''}<span ${st.promptLang === 'tr' ? 'lang="tr"' : ''}>${esc(st.prompt)}</span>${st.hintTr ? ` <span class="tr">${esc(st.hintTr)}</span>` : ''}`;
const sized = (s, el, min, pad) => Math.max(min, s.measure(el).w / s.pxPerMeter() + pad);
const add = (P, geo, mat, x, y, z, ry = 0) => { const m = new Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; P.add(m); return m; };
const signTex = (text, bg = '#7a1f1f') => { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#4a2f22'; g.beginPath(); g.roundRect(6, 6, 500, 116, 26); g.fill(); g.fillStyle = bg; g.beginPath(); g.roundRect(16, 16, 480, 96, 20); g.fill(); g.fillStyle = '#fff6dc'; g.font = '900 60px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 68); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; };
const sign = (P, text, w, x, y, z, bg) => { const m = new Mesh(new PlaneGeometry(w, w / 4), new MeshBasicMaterial({ map: signTex(text, bg), transparent: true })); m.position.set(x, y, z); P.add(m); return m; };
// the far shore of the Golden Horn: houses climbing a hill, an old round tower
function farShore(P, z = -18) {
  const cols = ['#d9cfe8', '#e7d3c0', '#c9d8ea', '#ecd2b4', '#d3e4d2'];
  for (let k = 0; k < 16; k++) { const x = -15 + k * 2, h = 1.6 + ((k * 37) % 5) * 0.45, y = Math.sin(k * 0.7) * 0.6 + 1.2; add(P, new BoxGeometry(1.8, h, 1.6), L(cols[k % 5]), x, y + h / 2, z - (k % 3) * 0.8); add(P, new ConeGeometry(1.35, 0.8, 4), L('#f4f6ff'), x, y + h + 0.4, z - (k % 3) * 0.8, Math.PI / 4); }
  add(P, new CylinderGeometry(0.9, 1.0, 5.4, 16), L('#cdbfb4'), 7, 3.4, z - 3); add(P, new ConeGeometry(1.1, 1.8, 16), L('#6d6f96'), 7, 7.0, z - 3);
  const hill = add(P, new SphereGeometry(16, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), L('#e8ecf8'), 0, -1, z - 6); hill.scale.y = 0.18;
}
// one-of-n: right first time or not, a miss glows the right one
function chooser(ctx, { onRight, onWrong, glow, answerText }) {
  const st = ctx.step; let tried = false, done = false;
  const pick = i => {
    if (ctx.busy || done) return;
    if (i === st.answer) {
      done = true; ctx.item(st.sourceIds?.[0], !tried); onRight(i); ctx.sound('sparkle');
      if (st.readback) ctx.speech.say(st.readback);
      ctx.reveal(st.readback || st.answerText || answerText); ctx.finish(tried ? 1300 : 1100);
    } else {
      onWrong(i); ctx.sound('tap'); glow(st.answer);
      if (!tried) { tried = true; ctx.coach(`Not quite. It's "${st.options[st.answer]}".`); }
    }
  };
  ctx.onTimeUp(() => { if (done) return; done = true; if (!tried) ctx.item(st.sourceIds?.[0], false); glow(st.answer); ctx.coach(`Time's up! It's "${st.options[st.answer]}".`); ctx.reveal(st.answerText || st.options[st.answer]); ctx.finish(1600); });
  return pick;
}

// ======================= Karaköy Bridge and Pier · Listening =======================
// Under the bridge, on the frozen Golden Horn: fishing holes in the ice, a fish peeking from each
// with a word. Hear the word, then cast your line to the fish that has it: it leaps out onto the
// ice in a sparkle. The wrong one dives with a splash.
export function karakoyStation(s, { color = '#f5b616' } = {}) {
  const K = stage(s, { ground: '#cfe3f3', top: '#7fb0e6', mid: '#d4e6f8', fog: '#dbe9f6' }), { P, snowM } = K;
  const ice = add(P, new PlaneGeometry(40, 24), new MeshStandardMaterial({ color: '#bcdcf2', roughness: 0.15, metalness: 0.05 }), 0, 0.02, -2); ice.rotation.x = -Math.PI / 2;
  // the bridge across the back on stone piers, its railing, lamps, and the fishermen's rods over the edge
  const deckM = L('#a9a5bd'), rail = L('#3d4a6b'), pierM = L('#8f93ac');
  for (const x of [-8, -2.7, 2.7, 8]) add(P, new BoxGeometry(1.2, 3.2, 1.8), pierM, x, 1.6, -4.4);
  add(P, new BoxGeometry(26, 0.5, 2.4), deckM, 0, 3.4, -4.4); add(P, new BoxGeometry(26, 0.14, 2.3), snowM, 0, 3.72, -4.4);
  add(P, new BoxGeometry(26, 0.08, 0.08), rail, 0, 4.5, -3.25);
  for (let k = 0; k < 27; k++) add(P, new CylinderGeometry(0.035, 0.035, 0.8, 6), rail, -13 + k, 4.1, -3.25);
  for (const x of [-9, -3, 3, 9]) { add(P, new CylinderGeometry(0.07, 0.09, 2.6, 8), rail, x, 5.0, -3.3); add(P, new BoxGeometry(0.34, 0.42, 0.34), new MeshBasicMaterial({ color: '#ffe3a0' }), x, 6.4, -3.3); }
  const rodM = L('#3a3036'), lineM = new MeshBasicMaterial({ color: '#f2eff6' });
  for (let k = 0; k < 11; k++) {
    const x = -11 + k * 2.2 + (k % 2) * 0.4, rod = add(P, new CylinderGeometry(0.02, 0.035, 2.8, 5), rodM, x, 4.6, -2.9); rod.rotation.x = 0.85;
    const tipY = 4.6 + 1.4 * Math.cos(0.85), tipZ = -2.9 + 1.4 * Math.sin(0.85); add(P, new CylinderGeometry(0.006, 0.006, tipY, 3), lineM, x, tipY / 2, tipZ);
  }
  // a ferry stuck in the ice on the left, the pier hall on the right, the far shore
  const ferry = new Group(); ferry.position.set(-9, 0, -8.5); P.add(ferry);
  add(ferry, new BoxGeometry(4.6, 0.9, 1.5), L('#2f3b63'), 0, 0.45, 0); add(ferry, new BoxGeometry(4.2, 0.8, 1.3), L('#f6f3f8'), 0, 1.3, 0); add(ferry, new CylinderGeometry(0.22, 0.26, 0.8, 10), L('#f2c14e'), 0.8, 2.1, 0);
  for (let k = 0; k < 6; k++) add(ferry, new PlaneGeometry(0.4, 0.32), new MeshBasicMaterial({ color: '#ffd98a' }), -1.6 + k * 0.62, 1.35, 0.66);
  const hall = new Group(); hall.position.set(8.5, 0, -7.5); P.add(hall);
  add(hall, new BoxGeometry(3.2, 0.3, 2.6), L('#a5714f'), 0, 0.15, 0); add(hall, new BoxGeometry(2.4, 1.8, 1.8), L('#f3e9d8'), 0, 1.2, 0);
  add(hall, new ConeGeometry(2.1, 1.2, 4), L('#5d6f9e'), 0, 2.7, 0, Math.PI / 4); add(hall, new ConeGeometry(1.9, 1.0, 4), snowM, 0, 2.86, 0, Math.PI / 4);
  add(hall, new CircleGeometry(0.3, 16), new MeshBasicMaterial({ color: '#fff8e6' }), 0, 1.5, 0.91);
  farShore(P);
  mounds(P, [[-6.5, 3.4, 1.0], [6.8, 3.6, 1.2]], snowM);
  for (const [x, z] of [[-6, 1.8], [5.5, 2.4], [-1.8, -1.6], [3.2, -1.2]]) { const h = add(P, new CircleGeometry(0.36, 20), new MeshBasicMaterial({ color: '#2f5a80' }), x, 0.03, z); h.rotation.x = -Math.PI / 2; const r = add(P, new TorusGeometry(0.38, 0.07, 6, 20), snowM, x, 0.05, z); r.rotation.x = Math.PI / 2; } // other fishing holes
  for (const [x, z] of [[-7.4, 2.4], [6.8, 1.2]]) { add(P, new CylinderGeometry(0.16, 0.13, 0.32, 10), L('#7a8aa8'), x, 0.16, z); add(P, new CylinderGeometry(0.17, 0.17, 0.04, 10), L('#59607e'), x, 0.33, z); } // buckets on the ice
  // the student stands on a little wooden landing with a fishing rod
  add(P, new BoxGeometry(2.2, 0.16, 1.6), L('#b9845a'), -3.4, 0.1, 3.9);
  const A = actor(s, P, { at: [-3.4, 0.18, 3.9], face: Math.PI - 0.5, scale: 0.78 });
  let t = 0, gullT = 3;
  return { K, A, colors: [color, '#ffffff', '#ffd166', '#7cc4f0'], tick: dt => { t += dt; K.tick(dt); A?.tick(dt); if ((gullT -= dt) <= 0) { gullT = 6 + Math.random() * 6; s.sound?.('gull'); } if (!s.reduceMotion) ferry.position.x = -9 + Math.sin(t * 0.12) * 0.4; } };
}
function fish() {
  const g = new Group(), body = new Mesh(new SphereGeometry(0.22, 14, 10), L('#b9c6d8')); body.scale.set(1, 0.7, 1.7); body.castShadow = true; g.add(body);
  const back = new Mesh(new SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), L('#3f6f9a')); back.scale.set(1, 0.7, 1.6); back.position.y = 0.02; g.add(back);
  const tail = new Mesh(new ConeGeometry(0.16, 0.3, 4), L('#3f6f9a')); tail.rotation.x = -Math.PI / 2; tail.position.z = -0.46; tail.scale.set(1.4, 0.4, 1); g.add(tail);
  for (const x of [-0.12, 0.12]) { const e = new Mesh(new SphereGeometry(0.04, 8, 6), new MeshBasicMaterial({ color: '#1c2340' })); e.position.set(x, 0.07, 0.24); g.add(e); }
  g.rotation.x = -0.9; // nose up out of the hole
  return g;
}
export function karakoyListen(ctx) {
  const s = ctx.world, st = ctx.step, set = s.set, K = set.K, A = set.A, voice = ctx.speech.available;
  const T = tall(); frameFor(s, { eye: [0, 5.2, 10.2], look: [0, 1.1, -0.4] }, { eye: [0, 5.6, 11.2], look: [0, 1.0, -0.4] }, { eye: [0, 8.4, 8.6], look: [0, 0.6, 0.0], width: 42 }); // from up on the quay, looking down onto the ice and up to the bridge
  s.say(`${esc(st.prompt)} <span class="tr">Cast your line to that fish!</span>${voice ? '' : ` <span class="tr">${esc(st.fallbackText || st.speak)}</span>`}`);
  const play = () => { ctx.sound('tap'); ctx.later(() => ctx.speech.say(st.speak), 150); };
  s.label('🔊 Hear it again', { cls: 'wt-bell', at: innerHeight < 430 ? [3.2, 2.6, -2] : T ? [0, 5.2, -2.6] : [0, 4.6, -2.6], onTap: play });
  if (voice) ctx.later(play, 450); else ctx.note('No English voice on this device: read the word instead.');
  const els = st.options.map((o, i) => s.label(st.pics?.[i] ? `<img src="${esc(st.pics[i])}" alt=""><span>${esc(o)}</span>` : esc(o), { cls: 'wt-opt', onTap: () => pick(i) }));
  const ws = els.map(el => sized(s, el, 1.9, 0.5)), xs = T ? st.options.map((o, i) => (i % 2 ? 1.1 : -1.1) + 0.3) : row(ws, 0.8);
  const holes = st.options.map((o, i) => {
    const z = T ? 2.2 - i * 1.5 : 0.8 + (i % 2) * 0.7, g = new Group(); g.position.set(xs[i], 0.03, z); g.scale.setScalar(1.45); s.step.add(g);
    const hole = new Mesh(new CircleGeometry(0.42, 24), new MeshBasicMaterial({ color: '#24476b' })); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.01; g.add(hole);
    const rim = new Mesh(new TorusGeometry(0.44, 0.08, 6, 24), K.snowM); rim.rotation.x = Math.PI / 2; rim.position.y = 0.04; g.add(rim);
    const f = fish(); f.position.set(0, 0.12, 0); g.add(f);
    els[i]._pin.obj = g; els[i]._pin.at.set(0, 0.02, 0.85); // on the ice in front of the hole; the fish shows above it
    const ph = i * 1.4; s.onTick(() => { if (f.userData.out || s.reduceMotion) return; const t = performance.now() / 1000; f.position.y = 0.1 + Math.max(0, Math.sin(t * 2.2 + ph)) * 0.12; f.rotation.z = Math.sin(t * 3 + ph) * 0.15; });
    return { g, f };
  });
  const cast = (i, done) => { // a red-and-white float flies from the student's rod to the hole
    const fl = new Group(), top = new Mesh(new SphereGeometry(0.08, 10, 8), L('#e0463c')), bot = new Mesh(new SphereGeometry(0.08, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), L('#ffffff')); fl.add(top, bot);
    const from = A ? A.hand() : new Vector3(-3, 1, 4), to = holes[i].g.position.clone().add(new Vector3(0, 0.12, 0.3)); fl.position.copy(from); s.step.add(fl); A?.throw();
    s.fly(fl, [to.x, to.y, to.z], { T: 0.5, lift: 1.4, done: () => done(fl) });
  };
  const glow = i => els[i].classList.add('show');
  const pick = chooser(ctx, {
    answerText: st.options[st.answer], glow,
    onRight: i => { els[i].classList.add('right'); cast(i, fl => { // the fish leaps out onto the ice with a sparkle
      const h = holes[i], f = h.f; f.userData.out = true; s.step.remove(fl); ctx.sound('superReady');
      s.fly(f, [0.9, 0.3, 0.7], { T: 0.6, lift: 1.6, spin: 6, done: () => { f.rotation.set(0, 0.6, Math.PI / 2); K.burst(h.g.position.clone().add(f.position).setY(0.6)); A?.cheer(); } });
    }); },
    onWrong: i => { els[i].classList.remove('wrong'); void els[i].offsetWidth; els[i].classList.add('wrong'); cast(i, fl => { // the fish dives: a splash
      const h = holes[i]; K.burst(h.g.position.clone().setY(0.3), ['#ffffff', '#bfe4ff'], 16, 1.6); s.step.remove(fl); A?.oops();
      h.f.userData.out = true; h.f.position.y = -0.3; ctx.later(() => { h.f.userData.out = false; }, 900);
    }); },
  });
}

// ======================= Bankalar Caddesi · Sorting =======================
// In front of the great stone bank: round steel vault doors on stands, one per category. Each card is
// a gold coin: pick it, then tap its vault door; the coin flies in and the door's wheel spins.
export function bankalarStation(s, { color = '#f5b616' } = {}) {
  const K = stage(s, { ground: '#e3e1ee' }), { P, snowM } = K;
  const stone = L('#e6ddd0'), stoneD = L('#b9ae9e'), glass = new MeshBasicMaterial({ color: '#ffd98a' });
  add(P, new BoxGeometry(17, 1.6, 2.4), L('#cfc4b2'), 0, 0.8, -7); // the rusticated ground floor
  add(P, new BoxGeometry(16.4, 3.6, 2.2), stone, 0, 3.4, -7.1);
  add(P, new BoxGeometry(17.6, 0.4, 2.8), stoneD, 0, 5.4, -7); add(P, new BoxGeometry(17.4, 0.24, 2.6), snowM, 0, 5.72, -7);
  add(P, new BoxGeometry(17, 0.3, 2.6), stoneD, 0, 1.7, -6.95);
  for (let k = 0; k < 10; k++) { const x = -7.2 + k * 1.6; add(P, new CylinderGeometry(0.18, 0.2, 3.4, 12), stone, x, 3.5, -5.85); for (const y of [2.6, 4.2]) if (k < 9) { add(P, new PlaneGeometry(0.62, 0.9), glass, x + 0.8, y, -5.98); add(P, new CircleGeometry(0.31, 12, 0, Math.PI), glass, x + 0.8, y + 0.45, -5.97); } }
  add(P, new BoxGeometry(1.6, 2.2, 0.1), L('#8a6a3a'), 0, 1.1, -5.84); add(P, new TorusGeometry(0.8, 0.12, 6, 16, Math.PI), stoneD, 0, 2.2, -5.8);
  for (const x of [-2.6, 2.6]) add(P, new PlaneGeometry(0.8, 1.0), glass, x, 0.9, -5.79);
  sign(P, 'Bankalar Caddesi', 3.2, 0, 1.75, -5.7);
  for (const x of [-9.5, 9.5]) { add(P, new CylinderGeometry(0.3, 0.42, 4, 10), L('#7a5236'), x, 2, -3.5); add(P, new SphereGeometry(1.7, 12, 10), L('#e9eef8'), x, 4.8, -3.5); }
  for (const x of [-5.5, 5.5]) { add(P, new CylinderGeometry(0.06, 0.08, 3.0, 8), L('#2b3556'), x, 1.5, -3.6); add(P, new BoxGeometry(0.34, 0.46, 0.34), new MeshBasicMaterial({ color: '#ffe3a0' }), x, 3.2, -3.6); }
  mounds(P, [[-7.5, 2.2, 1.0], [7.6, 2.4, 1.1]], snowM);
  // the counter the coins lie on, in the foreground
  add(P, new BoxGeometry(8.6, 0.12, 0.5), L('#6e4a32'), 0, 0.62, 2.45);
  for (const x of [-4.2, 4.2]) add(P, new BoxGeometry(0.14, 0.62, 0.4), L('#4e3426'), x, 0.31, 2.45);
  const A = actor(s, P, { at: [-3.0, 0, 4.4], face: Math.PI - 0.5, scale: 0.75 });
  const wave = bunting(P, { x0: -5.5, x1: 5.5, y: 3.8, sag: 0.35, z: -3.6, n: 19, colors: [color, '#ffffff', '#e8b84a', '#7a1f1f'] });
  let t = 0; return { tick: dt => { t += dt; K.tick(dt); A?.tick(dt); if (!s.reduceMotion) wave(t); }, K, A, colors: [color, '#ffffff', '#ffd166', '#e8b84a'] };
}
function vault() {
  const g = new Group(), steel = new MeshStandardMaterial({ color: '#a9b2c4', roughness: 0.35, metalness: 0.6 }), dark = L('#5d6680'), brass = new MeshStandardMaterial({ color: '#d9a640', roughness: 0.35, metalness: 0.6 });
  const door = new Mesh(new CylinderGeometry(0.95, 0.95, 0.16, 32), steel); door.rotation.x = Math.PI / 2; door.castShadow = true; g.add(door);
  const rim = new Mesh(new TorusGeometry(0.98, 0.07, 8, 32), dark); g.add(rim);
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, b = new Mesh(new SphereGeometry(0.045, 6, 5), brass); b.position.set(Math.cos(a) * 0.82, Math.sin(a) * 0.82, 0.09); g.add(b); }
  const wheel = new Group(); wheel.position.z = 0.12; g.add(wheel);
  wheel.add(new Mesh(new TorusGeometry(0.34, 0.035, 6, 20), brass)); const hub = new Mesh(new CylinderGeometry(0.09, 0.09, 0.08, 12), brass); hub.rotation.x = Math.PI / 2; wheel.add(hub);
  for (let k = 0; k < 3; k++) { const sp = new Mesh(new BoxGeometry(0.68, 0.035, 0.035), brass); sp.rotation.z = k * Math.PI / 3; wheel.add(sp); }
  for (const sx of [-0.6, 0.6]) { const leg = new Mesh(new BoxGeometry(0.12, 2.0, 0.12), dark); leg.position.set(sx, -0.8, -0.25); leg.rotation.x = -0.15; g.add(leg); }
  g.userData.wheel = wheel; return g;
}
export function bankalarSort(ctx) {
  const s = ctx.world, st = ctx.step, K = s.set.K, A = s.set.A;
  const T = tall(); frameFor(s, { eye: [0, 3.4, 11.4], look: [0, 1.5, 0] }, { eye: [0, 3.8, 12.6], look: [0, 1.4, 0] }, { eye: [0, 4.4, 10.0], look: [0, 2.2, 0.9], width: 40 });
  s.say(esc(st.prompt));
  const n = st.categories.length, tx = T ? (n === 2 ? [-1.5, 1.5] : [-2.15, 0, 2.15]) : n === 2 ? [-2.6, 2.6] : [-3.6, 0, 3.6];
  const doors = st.categories.map((c, i) => {
    const g = vault(); g.position.set(tx[i], 2.0, -1.2); if (T && n > 2) g.scale.setScalar(0.8); s.step.add(g);
    const title = s.label(`<b>${esc(c.title)}</b>${c.titleTr ? `<small>${esc(c.titleTr)}</small>` : ''}`, { cls: 'wt-target', obj: g, at: [0, 1.35, 0], onTap: () => drop(i) });
    s.label('', { cls: 'wt-hit', obj: g, at: [0, 0, 0.1], onTap: () => drop(i) });
    return { g, title, list: [], spin: 0 };
  });
  s.onTick(dt => { for (const d of doors) if (d.spin > 0) { d.spin = Math.max(0, d.spin - dt); d.g.userData.wheel.rotation.z += dt * 9 * d.spin; } });
  let sel = null, left = st.cards.length; const missed = new Set();
  const coinM = new MeshStandardMaterial({ color: '#f2c14e', roughness: 0.3, metalness: 0.55 });
  const cards = shuffle(st.cards, ctx.rng).map(c => {
    const el = s.label(esc(c.text), { cls: 'wt-card coin', onTap: () => select(card) });
    const w = sized(s, el, 1.1, 0.3);
    const plank = new Mesh(new RoundedBoxGeometry(w, 0.36, 0.08, 2, 0.03), L('#d8ecd0')); plank.castShadow = true; s.step.add(plank); // a banknote-green slip under each card
    el._pin.obj = plank; el._pin.at.set(0, 0, 0.06);
    const card = { c, el, plank, w, placed: false }; return card;
  });
  const per = T ? 2 : cards.length;
  for (let r = 0; r * per < cards.length; r++) { const rowCards = cards.slice(r * per, r * per + per), xs = row(rowCards.map(k => k.w), 0.25); rowCards.forEach((k, i) => { k.plank.position.set(xs[i], r ? 0.3 : 0.92, r ? 2.5 + r * 0.95 : 2.5); k.plank.rotation.x = -0.25; k.y0 = k.plank.position.y; }); }
  const select = k => { if (ctx.busy || k.placed || k.locked) return; if (sel) { sel.el.classList.remove('sel'); sel.plank.position.y = sel.y0; } sel = k; k.el.classList.add('sel'); k.plank.position.y = k.y0 + 0.16; ctx.sound('tap'); };
  const place = (k, ok) => {
    k.placed = true; left--; k.el.classList.remove('sel'); const D = doors[k.c.cat];
    s.unlabel(k.el); k.plank.visible = false;
    D.list.push(s.label(esc(k.c.text), { cls: 'wt-placed' + (ok ? '' : ' fixed'), obj: D.g, at: [0, -1.35 - D.list.length * 0.36, 0.3] }));
    if (!left) ctx.finish(900);
  };
  const toss = (k, i, then, inside = true) => { // a gold coin spins through the air into the vault's middle, or bounces off its rim
    const D = doors[i], coin = new Mesh(new CylinderGeometry(0.16, 0.16, 0.04, 20), coinM); coin.rotation.x = Math.PI / 2; coin.castShadow = true;
    const from = A ? A.hand() : k.plank.position.clone(); coin.position.copy(from); s.step.add(coin); A?.throw();
    const to = D.g.position.clone().add(new Vector3(inside ? 0 : 0.9 * D.g.scale.x, inside ? 0 : 0.6, 0.2));
    s.fly(coin, [to.x, to.y, to.z], { T: 0.42, lift: 1.0, spin: 8, done: () => then(coin) });
  };
  const drop = i => {
    if (ctx.busy) return;
    if (!sel) { ctx.coach('Pick a coin card first, then its vault!'); return; }
    const k = sel; sel = null; k.plank.position.y = k.y0;
    if (k.c.cat === i) {
      ctx.item(k.c.id, !missed.has(k.c.id)); ctx.sound('note', { freq: 659 + doors[i].list.length * 90 });
      toss(k, i, coin => { s.step.remove(coin); doors[i].spin = 1; ctx.sound('thunk'); K.burst(doors[i].g.position.clone().setZ(doors[i].g.position.z + 0.3), ['#ffd166', '#f2c14e', '#ffffff'], 16, 1.6); A?.cheer(); }); place(k, true);
    } else {
      k.el.classList.remove('wrong'); void k.el.offsetWidth; k.el.classList.add('wrong'); doors[i].title.classList.add('no'); ctx.later(() => doors[i].title.classList.remove('no'), 500);
      toss(k, i, coin => { ctx.sound('thunk'); s.fly(coin, [coin.position.x + 0.6, 0.05, coin.position.z + 1.2], { T: 0.4, lift: 0.4, spin: 3, done: () => s.step.remove(coin) }); A?.oops(); }, false);
      if (!missed.has(k.c.id)) { missed.add(k.c.id); k.locked = true; ctx.item(k.c.id, false); ctx.coach(`"${k.c.text}" goes in "${st.categories[k.c.cat].title}".`); doors[k.c.cat].title.classList.add('show'); ctx.later(() => { doors[k.c.cat].title.classList.remove('show'); if (!k.placed) { toss(k, k.c.cat, coin => { s.step.remove(coin); doors[k.c.cat].spin = 1; }); place(k, false); } }, 1000); }
    }
  };
  ctx.onTimeUp(() => { for (const k of cards) if (!k.placed) { if (!missed.has(k.c.id)) ctx.item(k.c.id, false); missed.add(k.c.id); place(k, false); } ctx.coach("Time's up! Look where they go."); });
}

// ======================= Tersane İstanbul · Builder =======================
// The old shipyard: a ship stands in the dry dock and the sentence is built onto its hull, plank by
// plank, in order. Each finished sentence stays as a new strake, so the ship grows; the flag on its
// mast rises. Behind: the brick workshop with its arched windows and chimney, the cranes, the
// promenade's glass canopy. (The castle's builder, castle3d.js, with wooden planks.)
export function tersaneStation(s, { color = '#f5b616' } = {}) {
  const K = stage(s, { ground: '#e1e3ee' }), { P, snowM } = K, base = 2.0;
  const navy = L('#2f3b63'), red = L('#c8443c'), stone = L('#c9c1d6'), brick = L('#b8735a'), yellow = L('#e8a10a');
  // the dry dock: stone walls either side, keel blocks, the hull (a long rounded box with pointed ends)
  for (const x of [-6.4, 6.4]) add(P, new BoxGeometry(1.4, 1.0, 5), stone, x, 0.5, -0.6);
  for (const x of [-3, -1, 1, 3]) add(P, new BoxGeometry(0.5, 0.4, 0.8), L('#8a5f3e'), x, 0.2, -0.6);
  add(P, new RoundedBoxGeometry(8.4, 0.9, 1.2, 4, 0.42), red, 0, 0.85, -0.6); // the red bottom, rounded at bow and stern
  add(P, new RoundedBoxGeometry(8.6, 0.95, 1.24, 4, 0.42), navy, 0, 1.55, -0.6); add(P, new RoundedBoxGeometry(8.5, 0.12, 1.2, 2, 0.05), L('#f6f3f8'), 0, 1.98, -0.6);
  for (let k = 0; k < 6; k++) add(P, new CircleGeometry(0.12, 12), L('#cfe4ff'), -3 + k * 1.2, 1.55, 0.01);
  const mast = add(P, new CylinderGeometry(0.07, 0.1, 8.5, 8), L('#6e4a32'), 4.4, 4.3, -0.6);
  add(P, new RoundedBoxGeometry(1.2, 0.95, 1.0, 2, 0.08), L('#f6f3f8'), -3.3, 2.5, -0.95); add(P, new RoundedBoxGeometry(1.3, 0.1, 1.1, 2, 0.04), snowM, -3.3, 3.0, -0.95); // the wheelhouse at the stern
  for (const x of [-3.65, -3.3, -2.95]) add(P, new PlaneGeometry(0.24, 0.3), new MeshBasicMaterial({ color: '#ffd98a' }), x, 2.6, -0.44);
  add(P, new CylinderGeometry(0.2, 0.24, 0.9, 12), L('#f2c14e'), -2.2, 2.45, -1.0); add(P, new CylinderGeometry(0.21, 0.21, 0.14, 12), L('#2f3b63'), -2.2, 2.92, -1.0); // the funnel
  for (const x of [-1.2, 1.4]) { add(P, new TorusGeometry(0.17, 0.05, 6, 14), L('#e8584a'), x, 1.55, 0.03); }
  // the brick workshop with tall arched windows and its chimney; two cranes; the promenade's canopy
  const ws = new Group(); ws.position.set(-3, 0, -7.5); P.add(ws);
  add(ws, new BoxGeometry(9, 4, 3), brick, 0, 2, 0); const roof = add(ws, new ConeGeometry(5.4, 1.6, 4), L('#5d6f9e'), 0, 4.8, 0, Math.PI / 4); roof.scale.z = 0.4; const rs = add(ws, new ConeGeometry(5.2, 1.3, 4), snowM, 0, 4.95, 0, Math.PI / 4); rs.scale.z = 0.38;
  for (let k = 0; k < 6; k++) { const x = -3.6 + k * 1.45; add(ws, new PlaneGeometry(0.7, 1.8), new MeshBasicMaterial({ color: '#ffd98a' }), x, 1.8, 1.51); add(ws, new CircleGeometry(0.35, 12, 0, Math.PI), new MeshBasicMaterial({ color: '#ffd98a' }), x, 2.7, 1.51); }
  add(ws, new CylinderGeometry(0.35, 0.45, 6.5, 12), L('#8f5644'), -4, 3.25, -1);
  // the shipyard crane behind the dock: it does the building, lifting each plank you tap off the quay
  // on its hook and lowering it onto the ship (a wrong one is lifted, swings, and is put back)
  const CR = { x: 0, z: -3.1, y: 5.4 }, crane = new Group(); crane.position.set(CR.x, 0, CR.z); P.add(crane);
  const dark = L('#2b3556');
  add(crane, new BoxGeometry(0.9, 0.5, 0.9), stone, 0, 0.25, 0);
  for (const [sx, sz] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) add(crane, new BoxGeometry(0.08, CR.y - 0.5, 0.08), yellow, sx, CR.y / 2 + 0.25, sz);
  for (let k = 0; k < 9; k++) { const b = add(crane, new BoxGeometry(0.5, 0.05, 0.05), yellow, 0, 0.8 + k * 0.52, 0.22); b.rotation.z = k % 2 ? 0.6 : -0.6; const b2 = add(crane, new BoxGeometry(0.05, 0.05, 0.5), yellow, 0.22, 0.8 + k * 0.52, 0); b2.rotation.x = k % 2 ? 0.6 : -0.6; }
  const slew = new Group(); slew.position.y = CR.y; crane.add(slew); // turns about the tower
  add(slew, new BoxGeometry(0.7, 0.55, 0.8), L('#3d4a6b'), 0, 0.3, -0.1); add(slew, new PlaneGeometry(0.4, 0.26), new MeshBasicMaterial({ color: '#ffd98a' }), 0, 0.35, 0.31);
  const jib = add(slew, new BoxGeometry(0.26, 0.24, 9.4), yellow, 0, 0.12, 4.4); add(slew, new BoxGeometry(0.28, 0.06, 9.4), snowM, 0, 0.27, 4.4);
  add(slew, new BoxGeometry(0.24, 0.22, 2.4), yellow, 0, 0.12, -1.4); add(slew, new BoxGeometry(0.6, 0.6, 0.6), stone, 0, -0.1, -2.4); // the counter-jib and its weight
  const trolley = new Group(); slew.add(trolley); add(trolley, new BoxGeometry(0.34, 0.14, 0.34), dark, 0, -0.07, 0);
  const cable = new Mesh(new CylinderGeometry(0.012, 0.012, 1, 4), dark); P.add(cable);
  const hook = new Group(); P.add(hook); add(hook, new BoxGeometry(0.3, 0.16, 0.2), L('#e0463c'), 0, 0.08, 0); { const h = add(hook, new TorusGeometry(0.09, 0.025, 6, 12, Math.PI * 1.4), dark, 0, -0.06, 0); h.rotation.z = Math.PI * 0.8; }
  let ang = 0.4, rad = 4.2, hy = 4.4, job = null; const jobs = [], idle = [];
  const target = (x, z) => { const dx = x - CR.x, dz = z - CR.z; return { a: Math.atan2(dx, dz), r: Math.max(1.2, Math.hypot(dx, dz)) }; };
  const turn = (a0, a1) => { let d = a1 - a0; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  const E = k => k * k * (3 - 2 * k);
  const hookAt = () => new Vector3(CR.x + Math.sin(ang) * rad, hy, CR.z + Math.cos(ang) * rad);
  const start = () => { if (job || !jobs.length) { if (!job && !jobs.length) while (idle.length) idle.shift()(); return; } job = jobs.shift(); job.t = 0; job.phase = 0; job.from = { a: ang, r: rad, y: hy }; };
  const H2 = 0.22; // half a plank's height: the hook rides just above it
  const phases = j => { // each phase: [seconds, angle/radius target, hook height]
    const p = target(j.mesh.position.x, j.mesh.position.z), up = Math.max(4.2, (j.to?.[1] || 2) + 1.3);
    if (j.back) return [[0.32, p, j.mesh.position.y + H2 + 0.2], [0.12, p, j.mesh.position.y + H2 + 0.04, 'grab'], [0.25, p, j.mesh.position.y + 1.4], [0.3, { a: p.a + 0.25, r: p.r }, j.mesh.position.y + 1.4], [0.3, p, j.mesh.position.y + H2 + 0.04, 'drop']];
    const q = target(j.to[0], j.to[2]);
    return [[0.32, p, j.mesh.position.y + H2 + 0.2], [0.12, p, j.mesh.position.y + H2 + 0.04, 'grab'], [0.22, p, up], [0.42, q, up], [0.24, q, j.to[1] + H2 + 0.04, 'drop']];
  };
  const step = dt => {
    if (!job) return start();
    const ph = job.plan || (job.plan = phases(job)), [T2, goal, gy, act] = ph[job.phase];
    job.t += dt; const k = E(Math.min(1, job.t / T2)), f = job.from;
    ang = f.a + turn(f.a, goal.a) * k; rad = f.r + (goal.r - f.r) * k; hy = f.y + (gy - f.y) * k;
    if (job.held) { const h = hookAt(); job.mesh.position.set(h.x, h.y - H2 - 0.04, h.z); job.mesh.rotation.y = job.rot0 * (1 - Math.min(1, job.t / 0.4)) + (job.back ? Math.sin(job.t * 9) * 0.1 : 0); }
    if (job.t < T2) return;
    if (act === 'grab') { job.held = true; job.rot0 = job.mesh.rotation.y; job.home = job.mesh.position.clone(); s.sound?.('tap'); }
    if (act === 'drop') { job.held = false; if (job.back) { job.mesh.position.copy(job.home); job.mesh.rotation.y = job.rot0; } else { job.mesh.position.set(...job.to); job.mesh.rotation.y = 0; } s.sound?.('thunk'); job.done?.(); }
    job.phase++; job.t = 0; job.from = { a: ang, r: rad, y: hy };
    if (job.phase >= ph.length) { job = null; start(); }
  };
  const place = () => { // the trolley, the cable and the hook follow the crane every frame
    slew.rotation.y = ang; trolley.position.z = rad; const h = hookAt(), top = CR.y - 0.12;
    hook.position.copy(h); hook.rotation.y = ang; cable.position.set(h.x, (top + h.y + 0.16) / 2, h.z); cable.scale.y = Math.max(0.05, top - h.y - 0.16);
  };
  const canopy = new Group(); canopy.position.set(5.2, 0, 2.6); P.add(canopy);
  for (const [x, z] of [[-1.4, -1], [1.4, -1], [-1.4, 1], [1.4, 1]]) add(canopy, new CylinderGeometry(0.05, 0.05, 2.4, 6), L('#3d4a6b'), x, 1.2, z);
  add(canopy, new BoxGeometry(3.2, 0.06, 2.4), new MeshStandardMaterial({ color: '#d6ecff', transparent: true, opacity: 0.45 }), 0, 2.4, 0);
  for (const x of [-0.7, 0.7]) { add(canopy, new CylinderGeometry(0.3, 0.3, 0.05, 12), L('#f6f3f8'), x, 0.8, 0); add(canopy, new CylinderGeometry(0.04, 0.04, 0.8, 6), L('#3d4a6b'), x, 0.4, 0); }
  sign(P, 'Tersane İstanbul', 2.8, -3, 3.45, -5.94);
  pines(P, [[-10.5, -1, 1.1], [10.8, -1.4, 1.2]], snowM);
  // the flag on the mast, in the team's colour
  const fl = new Mesh(new PlaneGeometry(0.95, 0.56), new MeshLambertMaterial({ color, side: DoubleSide })); fl.position.set(4.9, 7.4, -0.6); P.add(fl);
  const A = actor(s, P, { at: [-3.1, 0, 3.5], face: Math.PI - 0.5 });
  let t = 0;
  return {
    base, top: base, courses: 0, flag: fl, flagLow: 7.4, flagTop: 8.4, raise() {}, brickColor: '#e2b07a', pieceName: 'plank',
    carry(mesh, to, done) { jobs.push({ mesh, to, done }); start(); },
    carryBack(mesh) { if (jobs.some(j => j.mesh === mesh) || job?.mesh === mesh) return; jobs.push({ mesh, back: true }); start(); },
    idle(fn) { if (!job && !jobs.length) fn(); else idle.push(fn); },
    hurry() { const all = [job, ...jobs].filter(Boolean); job = null; jobs.length = 0; for (const j of all) { if (!j.back) { j.mesh.position.set(...j.to); j.mesh.rotation.y = 0; j.done?.(); } else if (j.home) j.mesh.position.copy(j.home); } while (idle.length) idle.shift()(); },
    A, K, colors: [color, '#ffffff', '#ffd166', '#7cc4f0'],
    tick(dt) { t += dt; K.tick(dt); A?.tick(dt); step(dt); place(); if (!s.reduceMotion) fl.rotation.y = Math.sin(t * 3) * 0.15; mast.position.y = 4.3; },
  };
}
export const tersaneOrder = castleWorldOrder, tersaneSpell = castleWorldSpell;

// ======================= Aynalıkavak Pavilion · Answer =======================
// The pavilion's front, its windows bright as mirrors: each answer is on a window. Snowball the right
// one: it flashes like a mirror in the sun, with a sparkle. A wrong one gets a splat of snow.
export function aynalikavakStation(s, { color = '#f5b616' } = {}) {
  const K = stage(s, { ground: '#e6e4f0', top: '#8a7ec8', mid: '#f0cfd6', bottom: '#ffe6d6', fog: '#f2dfe2', sun: '#ffd2b0' }), { P, snowM } = K;
  const wall = L('#f6ece0'), wood = L('#7a5a46'), stone = L('#bdb4c8'), roofM = L('#8f94ab'), glassL = new MeshStandardMaterial({ color: '#f4f8ff', roughness: 0.25, metalness: 0.1, emissive: new Color('#d9e6ff'), emissiveIntensity: 0.5 });
  const W = 12.4, Z = -3.7, fz = Z + 1.3;
  // the stone base where the garden slopes, with arched openings
  add(P, new BoxGeometry(W + 0.6, 1.2, 2.9), stone, 0, 0.6, Z);
  for (let k = 0; k < 9; k++) { if (k === 4) continue; const ax = -5.2 + k * 1.3; add(P, new CircleGeometry(0.32, 14, 0, Math.PI), new MeshBasicMaterial({ color: '#3d4363' }), ax, 0.62, fz + 0.16); add(P, new PlaneGeometry(0.64, 0.5), new MeshBasicMaterial({ color: '#3d4363' }), ax, 0.37, fz + 0.161); }
  // the main floor: pale walls, tall windows in pairs below, a row of small arched coloured windows above
  add(P, new BoxGeometry(W, 3.0, 2.6), wall, 0, 2.7, Z);
  add(P, new BoxGeometry(W + 0.1, 0.1, 2.7), wood, 0, 3.32, Z); // the string course
  for (let k = 0; k < 16; k++) { if (k === 7 || k === 8) continue; const x = -5.6 + k * 0.75 + (k % 2 ? -0.08 : 0.08); add(P, new BoxGeometry(0.5, 1.4, 0.06), wood, x, 2.3, fz + 0.01); add(P, new PlaneGeometry(0.4, 1.28), glassL, x, 2.3, fz + 0.05); }
  const COL = ['#5d8fd8', '#e0584a', '#f2c14e', '#5bb36a'];
  for (let k = 0; k < 24; k++) { const x = -5.75 + k * 0.5, m = new MeshBasicMaterial({ color: COL[k % 4] }); add(P, new PlaneGeometry(0.26, 0.3), m, x, 3.72, fz + 0.02); add(P, new CircleGeometry(0.13, 12, 0, Math.PI), m, x, 3.87, fz + 0.021); }
  add(P, new BoxGeometry(1.3, 2.0, 0.08), wood, 0, 2.2, fz + 0.02); add(P, new PlaneGeometry(1.1, 1.8), new MeshBasicMaterial({ color: '#ffd98a' }), 0, 2.15, fz + 0.07); // the door
  // the wide eaves on brackets, the grey hipped roof under snow
  add(P, new BoxGeometry(W + 2.2, 0.2, 4.6), wood, 0, 4.3, Z);
  for (let k = 0; k < 14; k++) { const b = add(P, new BoxGeometry(0.1, 0.1, 0.9), wood, -6.2 + k * 0.95, 4.05, fz + 0.35); b.rotation.x = 0.6; }
  { const r = add(P, new ConeGeometry(1, 1.6, 4), roofM, 0, 5.2, Z, Math.PI / 4); r.scale.set(W * 0.78, 1, 2.6); const sc = add(P, new ConeGeometry(1, 1.25, 4), snowM, 0, 5.38, Z, Math.PI / 4); sc.scale.set(W * 0.7, 1, 2.3); }
  // the double stair rising to the door from both sides, a landing in front of it
  add(P, new BoxGeometry(2.0, 1.2, 1.0), stone, 0, 0.6, fz + 0.5);
  for (const sd of [-1, 1]) for (let k = 0; k < 6; k++) add(P, new BoxGeometry(0.5, 0.2, 0.9), stone, sd * (1.25 + k * 0.42), 1.1 - k * 0.2, fz + 0.5);
  for (const sd of [-1, 1]) add(P, new BoxGeometry(2.8, 0.08, 0.06), wood, sd * 2.4, 1.15, fz + 0.96).rotation.z = sd * 0.42;
  // the garden: a pool, cypresses, lamps; beyond, the frozen Golden Horn and the far shore at sunset
  add(P, new BoxGeometry(5, 0.2, 1.6), stone, 0, 0.1, 1.6); add(P, new BoxGeometry(4.6, 0.04, 1.2), new MeshStandardMaterial({ color: '#a9d6ff', roughness: 0.1, metalness: 0.2 }), 0, 0.21, 1.6);
  for (const [x, z] of [[-7.6, -1.6], [7.6, -1.6], [-8.6, -4.8], [8.6, -4.8], [-6.6, 2.2], [6.6, 2.2], [-4.2, -6.4], [3.6, -6.6]]) { add(P, new CylinderGeometry(0.08, 0.62, 4.2, 10), L('#2f5a4a'), x, 2.1, z); add(P, new ConeGeometry(0.2, 0.5, 8), snowM, x, 4.15, z); }
  for (const x of [-3.2, 3.2]) { add(P, new CylinderGeometry(0.05, 0.07, 1.6, 8), L('#2b3556'), x, 0.8, 2.6); add(P, new BoxGeometry(0.3, 0.38, 0.3), new MeshBasicMaterial({ color: '#ffe3a0' }), x, 1.75, 2.6); }
  const sea = add(P, new PlaneGeometry(60, 12), new MeshStandardMaterial({ color: '#c8b8d8', roughness: 0.2, metalness: 0.1 }), 0, 0.03, -13); sea.rotation.x = -Math.PI / 2;
  farShore(P, -21);
  for (let k = 0; k < 14; k++) { const x = -14 + k * 2.1, h = 1.4 + ((k * 31) % 5) * 0.4, y = 1.6 + Math.sin(k * 0.8) * 0.5; for (const wy of [0.5, 1.1]) if ((k + wy * 10) % 3 > 0.5) add(P, new PlaneGeometry(0.3, 0.32), new MeshBasicMaterial({ color: '#ffd27a' }), x - 0.3 + (k % 2) * 0.5, y + wy * h * 0.6, -20.18 - (k % 3) * 0.8); } // lit windows on the far shore
  const clouds = [];
  for (const [x, y, w] of [[-9, 9.5, 7], [-1, 11, 9], [8, 9, 6], [13, 11.5, 5]]) { const c = new Mesh(new PlaneGeometry(w, w * 0.32), new MeshBasicMaterial({ color: '#ffdccf', transparent: true, opacity: 0.85, fog: false, depthWrite: false })); c.position.set(x, y, -24); P.add(c); clouds.push(c); }
  const gulls = []; for (let k = 0; k < 3; k++) { const g = new Group(); for (const sd of [-1, 1]) { const w2 = new Mesh(new PlaneGeometry(0.5, 0.1), new MeshBasicMaterial({ color: '#4a4f6e', side: DoubleSide })); w2.position.x = sd * 0.24; g.add(w2); } g.position.set(-6 + k * 5, 7 + k * 0.6, -9); P.add(g); gulls.push(g); }
  sign(P, 'Aynalıkavak Pavilion', 2.8, 0, 0.42, 2.43);
  const A = actor(s, P, { at: [-3.4, 0, 3.8], face: Math.PI - 0.5 });
  let t = 0; return { tick: dt => { t += dt; K.tick(dt); A?.tick(dt); if (s.reduceMotion) return; gulls.forEach((g, k) => { g.position.x += dt * 0.6; if (g.position.x > 12) g.position.x = -12; g.children.forEach((w2, j) => { w2.rotation.z = (j ? -1 : 1) * Math.sin(t * 6 + k) * 0.4; }); }); clouds.forEach((c, k) => { c.position.x += dt * 0.08 * (k % 2 ? 1 : -1); }); }, K, A, colors: [color, '#ffffff', '#ffd166', '#f3a6c8'] };
}
export function aynalikavakChoice(ctx) {
  const s = ctx.world, st = ctx.step, K = s.set.K, A = s.set.A;
  const T = tall(); frameFor(s, { eye: [0, 3.2, 12.4], look: [0, 2.9, -1.5] }, { eye: [0, 3.4, 13.2], look: [0, 2.7, -1.5] }, { eye: [0, 3.0, 12.4], look: [0, 2.6, -2.0], width: 50 }); // portrait: the whole facade, the Golden Horn and the far shore above it
  s.say(caption(st));
  const els = st.options.map((o, i) => s.label(esc(o), { cls: 'wt-opt', onTap: () => pick(i) }));
  const ws = els.map(el => sized(s, el, 1.5, 0.35)), xs = T ? st.options.map((o, i) => (i % 2 ? 0.95 : -0.95)) : row(ws, 0.3);
  const mirrorM = () => new MeshStandardMaterial({ color: '#f4f8ff', roughness: 0.25, metalness: 0.1, emissive: new Color('#d9e6ff'), emissiveIntensity: 0.55 }); // bright as a mirror catching the sky
  const wins = st.options.map((o, i) => {
    const w = T ? 1.7 : ws[i], g = new Group(); g.position.set(T ? 0 : xs[i], T ? 3.15 - i * 0.92 : 2.4, -2.32); s.step.add(g); // on the tall windows of the main floor // portrait: one above another, straight down the middle
    const frame = new Mesh(new BoxGeometry(w + 0.16, 1.0, 0.08), L('#8a5a3c')); g.add(frame);
    const glass = new Mesh(new PlaneGeometry(w, 0.86), mirrorM()); glass.position.z = 0.05; g.add(glass);
    const bar = new Mesh(new BoxGeometry(0.05, 0.86, 0.04), L('#8a5a3c')); bar.position.z = 0.06; g.add(bar);
    els[i]._pin.obj = g; els[i]._pin.at.set(0, 0, 0.2); // the answer is written on the glass
    return { g, glass };
  });
  const glow = i => { els[i].classList.add('show'); wins[i].glass.material.emissive.set('#ffcf3c'); wins[i].glass.material.emissiveIntensity = 0.6; };
  const hit = i => wins[i].g.position.clone().add(new Vector3(0, 0, 0.1));
  const pick = chooser(ctx, {
    answerText: st.options[st.answer], glow,
    onRight: i => { els[i].classList.add('right'); A?.throw(); K.snowball(hit(i), () => { // the mirror flashes in the sun
      const m = wins[i].glass.material; m.emissive.set('#ffffff'); m.emissiveIntensity = 1.4; let t = 0; s.onTick(dt => { if (t > 1.2) return; t += dt; m.emissiveIntensity = 0.5 + Math.max(0, 1 - t) * 0.9; });
      K.burst(hit(i), ['#ffffff', '#fff3c4', '#ffd166'], 30, 2.2); ctx.sound('superReady'); A?.cheer(); }, A ? A.hand().toArray() : undefined); },
    onWrong: i => { els[i].classList.remove('wrong'); void els[i].offsetWidth; els[i].classList.add('wrong'); A?.throw(); K.snowball(hit(i), () => { // a splat of snow on the glass
      const sp = new Mesh(new CircleGeometry(0.22, 10), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 })); sp.position.z = 0.07; wins[i].g.add(sp); s.wobble(wins[i].g); A?.oops(); }, A ? A.hand().toArray() : undefined); },
  });
}

// ======================= Miniatürk · Matching =======================
// The park of little models: on a snowy lawn, the pairs are little signs on the path; a matched pair
// lights up gold and a golden path runs between them. Round the lawn: a round stone tower, a tower on
// a rock in a pond, a clock tower and a little suspension bridge, the big sign behind.
export function miniaturkStation(s, { color = '#f5b616' } = {}) {
  const K = stage(s, { ground: '#e4e6f2', top: '#5e6bb4', mid: '#c9bfe2', bottom: '#f2e6ef', fog: '#ddd4ea', sun: '#ffd9c4' }), { P, snowM } = K;
  const lawn = add(P, new BoxGeometry(9.6, 0.2, 9.4), snowM, 0, 0.1, -0.4); lawn.receiveShadow = true;
  for (const [x, z, w, d] of [[0, -5.1, 9.6, 0.4], [-4.9, -0.4, 0.4, 9.4], [4.9, -0.4, 0.4, 9.4]]) add(P, new BoxGeometry(w, 0.5, d), L('#3f7a5a'), x, 0.25, z);
  const stone = L('#d9cfc3'), stoneD = L('#9a8f86'), slate = L('#5d5f86'), water = new MeshStandardMaterial({ color: '#9fc8ec', roughness: 0.1 });
  { const g = new Group(); g.position.set(5.2, 0, -6.2); P.add(g); add(g, new CylinderGeometry(0.7, 0.8, 3.6, 16), stone, 0, 1.8, 0); add(g, new CylinderGeometry(0.85, 0.85, 0.3, 16), stoneD, 0, 3.7, 0); add(g, new CylinderGeometry(0.72, 0.72, 0.6, 16), stone, 0, 4.15, 0); add(g, new ConeGeometry(0.85, 1.6, 16), slate, 0, 5.25, 0); add(g, new ConeGeometry(0.7, 0.5, 16), snowM, 0, 4.7, 0); } // the round stone tower
  { const g = new Group(); g.position.set(-5.4, 0, -6.0); P.add(g); add(g, new CylinderGeometry(1.8, 1.8, 0.12, 24), water, 0, 0.06, 0); add(g, new SphereGeometry(0.8, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), stoneD, 0, 0.1, 0); add(g, new BoxGeometry(1.0, 0.7, 0.8), L('#f6f3f8'), -0.2, 0.8, 0); add(g, new CylinderGeometry(0.22, 0.26, 1.5, 12), L('#f6f3f8'), 0.35, 1.4, 0); add(g, new ConeGeometry(0.3, 0.6, 12), slate, 0.35, 2.45, 0); } // the tower on a rock in the sea
  { const g = new Group(); g.position.set(-6.8, 0, -1.2); P.add(g); add(g, new BoxGeometry(0.9, 1.6, 0.9), stone, 0, 0.8, 0); add(g, new BoxGeometry(0.75, 1.3, 0.75), stone, 0, 2.25, 0); add(g, new BoxGeometry(0.6, 0.9, 0.6), stone, 0, 3.35, 0); add(g, new SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), slate, 0, 3.8, 0); add(g, new CircleGeometry(0.22, 16), new MeshBasicMaterial({ color: '#fff8e6' }), 0, 2.45, 0.38); } // the clock tower
  { const g = new Group(); g.position.set(6.8, 0, -1.2); P.add(g); add(g, new BoxGeometry(1.2, 0.06, 4), water, 0, 0.05, 0); for (const z of [-1.2, 1.2]) for (const x of [-0.45, 0.45]) add(g, new BoxGeometry(0.16, 2.0, 0.16), L('#c8443c'), x, 1.0, z); add(g, new BoxGeometry(1.0, 0.12, 4.4), L('#5d6b8f'), 0, 0.7, 0); } // the little suspension bridge
  sign(P, 'Miniatürk', 3.4, 0, 3.0, -5.6); for (const x of [-1.6, 1.6]) add(P, new BoxGeometry(0.16, 3.4, 0.16), L('#6e4a32'), x, 1.7, -5.65);
  pines(P, [[-9.2, -3.6, 1.2], [9.4, -3.8, 1.3], [-10, 1.5, 1.0], [10.2, 1.2, 1.0]], snowM);
  const wave = bunting(P, { x0: -9, x1: -3.6, y: 2.6, sag: 0.3, z: -4.6, n: 9, colors: [color, '#ffffff', '#c8443c', '#7cc4f0'] }), wave2 = bunting(P, { x0: 3.6, x1: 9, y: 2.6, sag: 0.3, z: -4.6, n: 9, colors: [color, '#ffffff', '#c8443c', '#7cc4f0'] }); // either side of the sign
  const A = actor(s, P, { at: [-5.6, 0.2, 3.2], face: Math.PI - 0.9, scale: 0.9 });
  let t = 0; return { tick: dt => { t += dt; K.tick(dt); A?.tick(dt); if (!s.reduceMotion) { wave(t); wave2(t); } }, K, A, colors: [color, '#ffffff', '#ffd166', '#7cc4f0'] };
}
export const miniaturkMatch = ctx => fountainMatch(ctx, { tile: '#fff6e4', matched: ['#ffe6a8', '#f6c7dc', '#c9e8c2', '#cfe0ff'], frame: { desk: { eye: [0, 9.8, 12.2], look: [0, 0.4, -1.2] }, short: { eye: [0, 8.0, 9.6], look: [0, 0.2, -0.4] }, port: { eye: [0, 12.6, 7.4], look: [0, 0.2, -1.4], width: 46 } } });
