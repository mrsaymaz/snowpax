// Task stations for Arena 3, Downtown (an evening loop through Beyoğlu), staged 3D sets like the
// other arenas':
//   Galata Tower · Sorting     – two (or three) queues at the tower's door: send each word to its line
//   İstiklal Avenue · Builder  – couple the tram's cars in order along the rails; the finished tram
//                                rides off up the avenue
//   Taksim Square · Listening  – city buses at the stop, each with its route sign: hear the word, wave
//                                down the right bus
//   Cihangir · Matching        – the neighbourhood's cats: bring each cat to its partner
//   Tophane · Answer           – the clock faces on the promenade: snowball the right one, the tower chimes
// Each scene scores exactly like its flat card (basic.js): one item per question, pair or card,
// right first time or not; a miss shows the right one glowing and the task goes on.
import {
  Mesh, Group, MeshLambertMaterial, MeshStandardMaterial, MeshBasicMaterial, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, TorusGeometry,
  PlaneGeometry, CircleGeometry, Vector3, Color, CanvasTexture, SRGBColorSpace,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { stage, mounds, bunting, row, actor } from './stationkit.js';
import { tall } from './stations.js';
import { castleWorldOrder, castleWorldSpell } from './castle3d.js';
import { sceneKit } from './golden.js';
import { esc, shuffle } from './util.js';

const { L, frameFor, caption, sized, add, sign, chooser } = sceneKit;
const B = c => new MeshBasicMaterial({ color: c });
// a string of warm bulbs across the set, twinkling
function bulbs(P, { x0, x1, y, z, sag = 0.45, n = 18, z1 = z }) {
  const list = [], cols = ['#ffd27a', '#ffffff', '#ffb36a'];
  for (let k = 0; k <= n; k++) { const t = k / n, m = new Mesh(new SphereGeometry(0.07, 8, 6), B(cols[k % 3])); m.position.set(x0 + (x1 - x0) * t, y - Math.sin(t * Math.PI) * sag, z + (z1 - z) * t); P.add(m); list.push(m); }
  return t => list.forEach((m, k) => m.scale.setScalar(0.8 + 0.35 * Math.max(0, Math.sin(t * 3 + k * 1.7))));
}
const lamp = (P, x, z, h = 3.0) => { add(P, new CylinderGeometry(0.06, 0.08, h, 8), L('#2b3556'), x, h / 2, z); add(P, new BoxGeometry(0.34, 0.44, 0.34), B('#ffe3a0'), x, h + 0.2, z); add(P, new ConeGeometry(0.3, 0.22, 4), L('#2b3556'), x, h + 0.53, z, Math.PI / 4); };
// a row of tall old apartment buildings, shoulder to shoulder: painted fronts with tall windows (lit in
// the evening), shopfronts with awnings on the street, cornices under snow
const fronts = new Map();
function frontTex(col, floors, bays, seed) {
  const key = `${col}|${floors}|${bays}|${seed % 5}`; if (fronts.has(key)) return fronts.get(key);
  const c = document.createElement('canvas'), W2 = bays * 40, H2 = 70 + floors * 52; c.width = W2; c.height = H2; const g = c.getContext('2d'), base = new Color(col);
  let k = seed * 9973 + floors * 31 + bays; const R = () => (k = (k * 16807) % 2147483647) / 2147483647;
  g.fillStyle = base.getStyle(); g.fillRect(0, 0, W2, H2); g.fillStyle = base.clone().multiplyScalar(0.82).getStyle(); g.fillRect(0, H2 - 70, W2, 70);
  for (let f = 0; f < floors; f++) { g.fillStyle = base.clone().multiplyScalar(0.9).getStyle(); g.fillRect(0, H2 - 70 - f * 52 - 4, W2, 3); for (let b = 0; b < bays; b++) { const x = b * 40 + 11, y = H2 - 70 - (f + 1) * 52 + 10; g.fillStyle = base.clone().multiplyScalar(0.72).getStyle(); g.fillRect(x - 3, y - 3, 24, 40); g.fillStyle = R() < 0.65 ? '#ffd98a' : '#4f5672'; g.fillRect(x, y, 18, 34); g.fillStyle = base.clone().multiplyScalar(0.68).getStyle(); g.fillRect(x + 8, y, 2, 34); } }
  for (let x = 8; x < W2 - 30; x += 80) { const w = Math.min(64, W2 - x - 8), cc = ['#c8443c', '#2d6fb5', '#3f9b5a', '#e8a10a'][Math.floor(R() * 4)]; g.fillStyle = '#ffd98a'; g.fillRect(x, H2 - 52, w, 40); for (let s2 = 0; s2 < w; s2 += 12) { g.fillStyle = (s2 / 12) % 2 ? '#fff6ea' : cc; g.fillRect(x + s2, H2 - 64, 12, 12); } }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; fronts.set(key, t); return t;
}
function facades(P, x0, x1, z, { h = [5.5, 7.5], d = 3, ry = 0, seed = 1, cols = ['#e9dcc4', '#e3c9a8', '#d9cfc2', '#efd9c2', '#e8cfc4', '#dcd2e2', '#f1e4cc'] } = {}) {
  const grp = new Group(); grp.rotation.y = ry; P.add(grp); let x = x0, k = seed;
  while (x < x1 - 1) {
    const w = Math.min(x1 - x, 3.2 + ((k * 37) % 5) * 0.5), hh = h[0] + ((k * 53) % 7) / 6 * (h[1] - h[0]), col = cols[k % cols.length], floors = Math.max(3, Math.round((hh - 1.3) / 1.05)), bays = Math.max(2, Math.round(w / 1.0));
    const body = new Mesh(new BoxGeometry(w - 0.05, hh, d), L(col)); body.position.set(x + w / 2, hh / 2, z - d / 2); body.castShadow = body.receiveShadow = true; grp.add(body);
    const f = new Mesh(new PlaneGeometry(w - 0.05, hh), new MeshBasicMaterial({ map: frontTex(col, floors, bays, k) })); f.position.set(x + w / 2, hh / 2, z + 0.01); grp.add(f);
    const cor = new Mesh(new BoxGeometry(w + 0.1, 0.22, d + 0.2), L('#f6f8ff')); cor.position.set(x + w / 2, hh + 0.1, z - d / 2); grp.add(cor);
    x += w; k++;
  }
  return grp;
}
// a little shopfront: pastel wall, a lit window full of goods, a striped awning under snow
function shop(P, x, z, { wall, aw, goods, w = 3.2 }) {
  add(P, new BoxGeometry(w, 3.0, 2.0), L(wall), x, 1.5, z); add(P, new BoxGeometry(w + 0.2, 0.25, 2.2), L('#f6f8ff'), x, 3.1, z);
  add(P, new PlaneGeometry(w - 0.9, 1.1), B('#ffd98a'), x, 1.3, z + 1.01);
  for (let k = 0; k < 12; k++) add(P, new SphereGeometry(0.1, 8, 6), B(goods[k % goods.length]), x - (w - 1.3) / 2 + (k % 6) * (w - 1.3) / 5, 0.95 + Math.floor(k / 6) * 0.32, z + 1.05);
  for (let k = 0; k < 8; k++) { const m = add(P, new BoxGeometry(w / 8, 0.06, 0.9), L(aw[k % 2]), x - w / 2 + (k + 0.5) * w / 8, 2.25, z + 1.4); m.rotation.x = 0.4; }
}

// ======================= Galata Tower · Sorting =======================
// The tower rises over the rooftops at golden hour, a bakery and a dessert shop at its foot. At its
// door the queues wait behind brass posts and red ropes, a sign over each line. Pick a word, then
// its line: a visitor carrying it walks up and joins the queue.
export function galataStation(s, { color = '#f5b616' } = {}) {
  const K = stage(s, { backdrop: 'city', ground: '#e8e2ec', top: '#7f8fd6', mid: '#f6d8c0', bottom: '#ffe6cf', fog: '#f0dccf', sun: '#ffd2a0' }), { P, snowM } = K;
  const stone = L('#d9cfc3'), stoneD = L('#b8ab9c'), slate = L('#5d5f86'), glow = B('#ffd27a'), dark = B('#3d4363');
  const tz = -7.5;
  add(P, new CylinderGeometry(2.3, 2.5, 1.0, 28), stoneD, 0, 0.5, tz); add(P, new CylinderGeometry(1.85, 2.05, 8.6, 28), stone, 0, 5.3, tz);
  for (const y of [2.6, 4.6, 6.6]) for (let k = 0; k < 6; k++) { const a = (k / 5 - 0.5) * 2.2; add(P, new PlaneGeometry(0.32, 0.6), (k + y) % 3 > 1 ? glow : dark, Math.sin(a) * 1.98, y, tz + Math.cos(a) * 1.98, a); }
  add(P, new CylinderGeometry(2.4, 2.2, 0.36, 28), stoneD, 0, 9.75, tz); add(P, new TorusGeometry(2.4, 0.06, 6, 32), L('#2b3556'), 0, 10.3, tz).rotation.x = Math.PI / 2;
  add(P, new CylinderGeometry(1.9, 1.9, 1.4, 28), stone, 0, 10.6, tz); for (let k = 0; k < 9; k++) { const a = (k / 8 - 0.5) * 2.6; add(P, new PlaneGeometry(0.38, 0.8), glow, Math.sin(a) * 1.92, 10.6, tz + Math.cos(a) * 1.92, a); }
  add(P, new ConeGeometry(2.15, 3.6, 28), slate, 0, 13.1, tz); add(P, new ConeGeometry(1.9, 1.0, 28), snowM, 0, 11.75, tz);
  add(P, new PlaneGeometry(1.0, 1.6), B('#ffcf7a'), 0, 1.6, tz + 2.07); add(P, new TorusGeometry(0.52, 0.1, 6, 14, Math.PI), stoneD, 0, 2.4, tz + 2.08); // the door, warm inside
  shop(P, -6.2, -4.6, { wall: '#f1d9b5', aw: ['#c8443c', '#fff6ea'], goods: ['#d99a4a', '#e8b86a', '#c98a3a'] }); // the bakery
  shop(P, 6.2, -4.6, { wall: '#f2c9d2', aw: ['#3f9b5a', '#fff6ea'], goods: ['#e8c24a', '#7a4a2a', '#f6f0e4', '#e2406a'] }); // the dessert shop
  sign(P, 'Galata Tower', 3.0, 0, 3.3, tz + 2.2);
  facades(P, -24, -2.6, -9.6, { h: [6, 8], seed: 3 }); facades(P, 2.6, 24, -9.6, { h: [6, 8], seed: 7 }); // the tall old buildings round the little square
  facades(P, -24, -8.2, -3.5, { h: [5, 7], seed: 11 }); facades(P, 8.2, 24, -3.5, { h: [5, 7], seed: 13 });
  for (const x of [-3.6, 3.6]) lamp(P, x, -3.2);
  mounds(P, [[-8.5, 1.5, 1.1], [8.6, 1.8, 1.2]], snowM);
  const tw = bulbs(P, { x0: -7.8, x1: 7.8, y: 4.0, z: -3.0, n: 24 });
  add(P, new BoxGeometry(8.6, 0.12, 0.5), L('#6e4a32'), 0, 0.62, 2.45); for (const x of [-4.2, 4.2]) add(P, new BoxGeometry(0.14, 0.62, 0.4), L('#4e3426'), x, 0.31, 2.45); // the counter the tickets lie on
  const A = actor(s, P, { at: [-3.2, 0, 4.4], face: Math.PI - 0.5, scale: 0.75 });
  let t = 0; return { tick: dt => { t += dt; K.tick(dt); A?.tick(dt); if (!s.reduceMotion) tw(t); }, K, A, colors: [color, '#ffffff', '#ffd166', '#c8443c'] };
}
// a visitor in a puffy coat and a bobble hat, about to join a queue
function visitor(col) {
  const g = new Group(), coat = L(col);
  const body = new Mesh(new CylinderGeometry(0.2, 0.26, 0.62, 12), coat); body.position.y = 0.42; body.castShadow = true; g.add(body);
  const head = new Mesh(new SphereGeometry(0.17, 12, 10), L('#f2d2b6')); head.position.y = 0.86; g.add(head);
  const hat = new Mesh(new SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), coat); hat.position.y = 0.9; g.add(hat);
  const bob = new Mesh(new SphereGeometry(0.06, 8, 6), L('#ffffff')); bob.position.y = 1.08; g.add(bob);
  for (const sx of [-0.09, 0.09]) { const leg = new Mesh(new CylinderGeometry(0.06, 0.06, 0.2, 6), L('#3d4363')); leg.position.set(sx, 0.1, 0); g.add(leg); }
  return g;
}
export function galataSort(ctx) {
  const s = ctx.world, st = ctx.step, K = s.set.K, A = s.set.A;
  const T = tall(); frameFor(s, { eye: [0, 4.6, 11.2], look: [0, 1.6, -1.4] }, { eye: [0, 5.0, 12.2], look: [0, 1.5, -1.2] }, { eye: [0, 6.2, 10.4], look: [0, 1.8, -0.6], width: 40 });
  s.say(esc(st.prompt));
  const n = st.categories.length, tx = T ? (n === 2 ? [-1.25, 1.25] : [-2.0, 0, 2.0]) : n === 2 ? [-1.9, 1.9] : [-3.1, 0, 3.1];
  const brass = new MeshStandardMaterial({ color: '#d9a640', roughness: 0.35, metalness: 0.6 }), rope = L('#b8323a');
  const lanes = st.categories.map((c, i) => {
    const g = new Group(); g.position.set(tx[i], 0, -2.2); s.step.add(g);
    for (const sx of [-0.5, 0.5]) for (let k = 0; k < 5; k++) { const post = new Mesh(new CylinderGeometry(0.04, 0.05, 0.9, 8), brass); post.position.set(sx, 0.45, 1.2 - k * 0.8); post.castShadow = true; g.add(post); const top = new Mesh(new SphereGeometry(0.06, 8, 6), brass); top.position.set(sx, 0.92, 1.2 - k * 0.8); g.add(top); if (k < 4) { const r2 = new Mesh(new BoxGeometry(0.03, 0.03, 0.8), rope); r2.position.set(sx, 0.78, 0.8 - k * 0.8); g.add(r2); } }
    const board = new Mesh(new BoxGeometry(1.3, 0.5, 0.06), L('#2b3556')); board.position.set(0, 1.9, -2.2); g.add(board); const pole = new Mesh(new CylinderGeometry(0.03, 0.03, 1.7, 6), L('#2b3556')); pole.position.set(0, 0.85, -2.2); g.add(pole);
    const title = s.label(`<b>${esc(c.title)}</b>${c.titleTr ? `<small>${esc(c.titleTr)}</small>` : ''}`, { cls: 'wt-target', obj: g, at: [0, 2.2, -2.2], onTap: () => drop(i) });
    s.label('', { cls: 'wt-hit', obj: g, at: [0, 0.6, -0.4], onTap: () => drop(i) });
    return { g, title, list: [] };
  });
  let sel = null, left = st.cards.length; const missed = new Set();
  const cols = ['#c8443c', '#2d6fb5', '#3f9b5a', '#e8a10a', '#9a5ad6', '#e2406a'];
  const cards = shuffle(st.cards, ctx.rng).map((c, k) => {
    const el = s.label(esc(c.text), { cls: 'wt-card', onTap: () => select(card) });
    const w = sized(s, el, 1.1, 0.3);
    const plank = new Mesh(new RoundedBoxGeometry(w, 0.36, 0.08, 2, 0.03), L('#fff3d6')); plank.castShadow = true; s.step.add(plank); // a ticket under each word
    el._pin.obj = plank; el._pin.at.set(0, 0, 0.06);
    const card = { c, el, plank, w, placed: false, col: cols[k % cols.length] }; return card;
  });
  const per = T ? 2 : cards.length;
  for (let r = 0; r * per < cards.length; r++) { const rc = cards.slice(r * per, r * per + per), xs = row(rc.map(k => k.w), 0.25); rc.forEach((k, i) => { k.plank.position.set(xs[i], r ? 0.3 : 0.92, r ? 2.5 + r * 0.95 : 2.5); k.plank.rotation.x = -0.25; k.y0 = k.plank.position.y; }); }
  const select = k => { if (ctx.busy || k.placed || k.locked) return; if (sel) { sel.el.classList.remove('sel'); sel.plank.position.y = sel.y0; } sel = k; k.el.classList.add('sel'); k.plank.position.y = k.y0 + 0.16; ctx.sound('tap'); };
  // a visitor walks from the counter to the back of the line (or to the wrong line, then across)
  const walk = (k, i, ok, then) => {
    const D = lanes[i], v = visitor(k.col), spot = D.list.length; v.position.set(k.plank.position.x, 0, 2.0); s.step.add(v);
    const to = [D.g.position.x, 0, D.g.position.z - 1.6 + spot * 0.62];
    s.fly(v, ok ? to : [D.g.position.x, 0, D.g.position.z + 1.8], { T: 0.6, lift: 0.35, done: () => then(v) });
  };
  const place = (k, ok, v, i) => {
    k.placed = true; left--; k.el.classList.remove('sel'); const D = lanes[i];
    s.unlabel(k.el); k.plank.visible = false;
    D.list.push(v); s.label(esc(k.c.text), { cls: 'wt-placed' + (ok ? '' : ' fixed'), obj: v, at: [0, 1.35, 0] });
    if (!left) ctx.finish(900);
  };
  const drop = i => {
    if (ctx.busy) return;
    if (!sel) { ctx.coach('Pick a word first, then its queue!'); return; }
    const k = sel; sel = null; k.plank.position.y = k.y0;
    if (k.c.cat === i) {
      ctx.item(k.c.id, !missed.has(k.c.id)); ctx.sound('note', { freq: 659 + lanes[i].list.length * 90 }); A?.cheer();
      k.placed = true; walk(k, i, true, v => { place(k, true, v, i); K.burst(v.position.clone().setY(1.2), ['#ffd166', '#ffffff', '#c8443c'], 12, 1.3); });
    } else {
      k.el.classList.remove('wrong'); void k.el.offsetWidth; k.el.classList.add('wrong'); lanes[i].title.classList.add('no'); ctx.later(() => lanes[i].title.classList.remove('no'), 500); A?.oops(); ctx.sound('tap');
      if (!missed.has(k.c.id)) {
        missed.add(k.c.id); k.locked = true; ctx.item(k.c.id, false); ctx.coach(`"${k.c.text}" goes in the "${st.categories[k.c.cat].title}" queue.`); lanes[k.c.cat].title.classList.add('show');
        k.placed = true; walk(k, i, false, v => { s.wobble(v); ctx.later(() => { lanes[k.c.cat].title.classList.remove('show'); const D = lanes[k.c.cat]; s.fly(v, [D.g.position.x, 0, D.g.position.z - 1.6 + D.list.length * 0.62], { T: 0.7, lift: 0.4, done: () => place(k, false, v, k.c.cat) }); }, 700); });
      }
    }
  };
  ctx.onTimeUp(() => { for (const k of cards) if (!k.placed) { if (!missed.has(k.c.id)) ctx.item(k.c.id, false); missed.add(k.c.id); k.placed = true; const v = visitor(k.col), D = lanes[k.c.cat]; v.position.set(D.g.position.x, 0, D.g.position.z - 1.6 + D.list.length * 0.62); s.step.add(v); place(k, false, v, k.c.cat); } ctx.coach("Time's up! Look which queue each one joins."); });
}

// ======================= İstiklal Avenue · Builder =======================
// The avenue at dusk under its strings of lights: the Flower Passage's grand front on the left, the
// old school gate on the right. The red tram waits at the end of the rails; couple its cars in
// order. A finished tram rides off up the avenue with a ding, and the next one is built.
export function istiklalStation(s, { color = '#f5b616' } = {}) {
  const K = stage(s, { backdrop: 'city', ground: '#e4e0ec', top: '#5f62b8', mid: '#e8c0d0', bottom: '#f7d6c8', fog: '#e9cfd4', sun: '#ffc09a' }), { P, snowM } = K;
  const cream = L('#efe2c8'), creamD = L('#cdbd9e'), glass = B('#ffd98a'), iron = L('#2b2f45'), red = L('#c8302e');
  // the Flower Passage: three storeys of cream stone, the tall arched glass entrance
  add(P, new BoxGeometry(8, 6.4, 2), cream, -5.2, 3.2, -6.5); add(P, new BoxGeometry(8.3, 0.35, 2.3), creamD, -5.2, 6.5, -6.4); add(P, new BoxGeometry(8.2, 0.24, 2.2), snowM, -5.2, 6.8, -6.4);
  add(P, new PlaneGeometry(1.8, 2.6), glass, -5.2, 1.4, -5.49); add(P, new CircleGeometry(0.9, 18, 0, Math.PI), glass, -5.2, 2.7, -5.48); add(P, new TorusGeometry(0.95, 0.12, 6, 18, Math.PI), creamD, -5.2, 2.7, -5.45);
  for (const wx of [-7.9, -6.6, -3.8, -2.5]) for (const wy of [1.6, 3.6, 5.3]) add(P, new PlaneGeometry(0.7, 1.0), glass, wx, wy, -5.49);
  for (const wy of [4.0, 5.3]) add(P, new PlaneGeometry(0.9, 1.0), glass, -5.2, wy, -5.49);
  sign(P, 'İstiklal Avenue', 3.2, -5.2, 0.55, -5.4);
  facades(P, -26, -9.2, -5.5, { h: [6.2, 7.8], seed: 2 }); facades(P, 8.8, 26, -5.5, { h: [6.2, 7.8], seed: 5 }); // the avenue's grand fronts on and on
  facades(P, -1.2, 1.7, -6.2, { h: [6.6, 6.6], seed: 9 });
  // the old school gate: stone piers, an iron gate with gilded tips, the school behind its railings (no crest, no name)
  add(P, new BoxGeometry(7, 3.4, 2.4), L('#e9dfcc'), 5.2, 1.7, -8.2); add(P, new BoxGeometry(7.2, 0.3, 2.6), snowM, 5.2, 3.5, -8.2); for (let k = 0; k < 6; k++) add(P, new PlaneGeometry(0.6, 0.9), glass, 2.6 + k * 1.05, 2.0, -6.99);
  for (const sx of [3.6, 6.8]) { add(P, new BoxGeometry(0.7, 3.2, 0.7), creamD, sx, 1.6, -5.4); add(P, new SphereGeometry(0.34, 12, 10), creamD, sx, 3.5, -5.4); }
  for (let k = 0; k < 15; k++) { const bx = 4.1 + k * 0.155; add(P, new CylinderGeometry(0.025, 0.025, 2.4, 5), iron, bx, 1.2, -5.4); add(P, new ConeGeometry(0.05, 0.14, 4), B('#e8c24a'), bx, 2.47, -5.4); }
  add(P, new TorusGeometry(1.15, 0.06, 5, 18, Math.PI), iron, 5.2, 2.3, -5.4);
  // the rails, the overhead wire on its poles, the motor car waiting at the end
  for (const o of [-0.62, -0.22]) add(P, new BoxGeometry(20, 0.06, 0.08), iron, 0, 0.05, o);
  add(P, new BoxGeometry(20, 0.03, 0.03), iron, 0, 2.9, -0.42); for (const x of [-7, 7]) add(P, new CylinderGeometry(0.06, 0.08, 3.2, 8), iron, x, 1.6, -1.6);
  const motor = new Group(); motor.position.set(tall() ? -4.0 : -5.2, 0, -0.42); motor.scale.setScalar(tall() ? 0.8 : 1); P.add(motor); // just before the first car's place
  { const m = (geo, mat, x, y, z) => { const o = new Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; motor.add(o); return o; };
    m(new RoundedBoxGeometry(2.2, 1.3, 1.25, 3, 0.12), red, 0, 0.95, 0); m(new BoxGeometry(2.22, 0.24, 1.27), cream, 0, 0.82, 0); m(new BoxGeometry(2.3, 0.14, 1.35), L('#7a1f1f'), 0, 1.66, 0); m(new BoxGeometry(2.1, 0.1, 1.2), snowM, 0, 1.76, 0);
    for (let k = 0; k < 3; k++) m(new PlaneGeometry(0.42, 0.36), glass, -0.6 + k * 0.6, 1.25, 0.64);
    m(new CircleGeometry(0.1, 12), B('#fff2c4'), 1.11, 0.75, 0).rotation.y = Math.PI / 2; const pole = m(new CylinderGeometry(0.02, 0.02, 1.4, 5), iron, 0.3, 2.3, 0); pole.rotation.z = -0.5;
    for (const sx of [-0.65, 0.65]) m(new CylinderGeometry(0.16, 0.16, 0.08, 12), iron, sx, 0.2, 0.64).rotation.x = Math.PI / 2; }
  const fl = new Group(); { const pole = new Mesh(new CylinderGeometry(0.025, 0.025, 1.0, 6), iron); pole.position.y = 0.5; fl.add(pole); const flag = new Mesh(new PlaneGeometry(0.5, 0.32), L(color)); flag.position.set(0.25, 0.84, 0); fl.add(flag); } fl.position.set(motor.position.x - 0.6, 2.2, -0.42); P.add(fl);
  for (const x of [-8.2, 8.2]) lamp(P, x, 1.4);
  const tw = [bulbs(P, { x0: -9, x1: 9, y: 5.0, z: -3.2, n: 26 }), bulbs(P, { x0: -9, x1: 9, y: 5.4, z: -1.0, n: 26 }), bulbs(P, { x0: -9, x1: 9, y: 5.6, z: 1.4, n: 26, sag: 0.35 })];
  mounds(P, [[-8.6, 3.4, 1.0], [8.7, 3.2, 1.1]], snowM);
  const A = actor(s, P, { at: [-3.6, 0, 4.4], face: Math.PI - 0.5, scale: 0.75 });
  const known = new Set(s.persist.children), leaving = []; let t = 0;
  const set = {
    base: 0.32, top: 0.32, courses: 0, flag: fl, flagLow: 2.2, flagTop: 2.6, brickColor: '#c8302e', pieceName: 'tram car',
    raise() { // the coupled cars ride off up the avenue with a ding; the next tram is built on the same rails
      const cars = s.persist.children.filter(o => !known.has(o)); for (const c of cars) { known.add(c); leaving.push({ m: c, t: 0, x0: c.position.x }); }
      set.top = set.base; s.sound?.('chime');
    },
    tick: dt => { t += dt; K.tick(dt); A?.tick(dt); if (!s.reduceMotion) tw.forEach(f => f(t)); for (const q of [...leaving]) { q.t += dt; q.m.position.x = q.x0 + q.t * 5 + q.t * q.t * 10; if (q.t > 1.1) { s.persist.remove(q.m); leaving.splice(leaving.indexOf(q), 1); } } },
    K, A, colors: [color, '#ffffff', '#ffd166', '#c8302e'],
  };
  return set;
}
export const istiklalOrder = castleWorldOrder, istiklalSpell = castleWorldSpell;

// ======================= Taksim Square · Listening =======================
// Blue hour on the square: the opera house's long glass front with its red sphere glowing, the tall
// hotel tower, the park's snowy trees. City buses wait at the stop, each with its route sign lit:
// hear the word, wave down the bus that shows it. It flashes its lights, honks and pulls away.
export function taksimStation(s, { color = '#f5b616' } = {}) {
  const K = stage(s, { backdrop: 'city', ground: '#dedcec', top: '#3f4aa0', mid: '#a9a6dc', bottom: '#d9c8e6', fog: '#c8bedc', sun: '#c8b8ff' }), { P, snowM } = K;
  const frame = L('#e8ecf4'), glassF = B('#9fb8dc');
  // the opera house: glass and steel, the red sphere of the hall behind the glass
  add(P, new BoxGeometry(14, 3.6, 3), L('#d6d9e2'), -1, 1.8, -8.5); add(P, new BoxGeometry(14.4, 0.4, 3.4), frame, -1, 3.8, -8.5); add(P, new BoxGeometry(14.2, 0.24, 3.2), snowM, -1, 4.1, -8.5);
  add(P, new PlaneGeometry(13.4, 3.2), glassF, -1, 1.8, -6.99); for (let k = 0; k < 18; k++) add(P, new BoxGeometry(0.06, 3.3, 0.06), frame, -7.6 + k * 0.78, 1.8, -6.96); for (const y of [0.9, 1.9, 2.9]) add(P, new BoxGeometry(13.4, 0.05, 0.05), frame, -1, y, -6.96);
  add(P, new SphereGeometry(1.4, 24, 16), B('#d8343a'), -1, 1.9, -7.9);
  // the hotel tower on the right, rows of lit windows; no name
  add(P, new BoxGeometry(3.4, 14, 2.4), L('#e2e0e6'), 7.4, 7, -10.5); add(P, new BoxGeometry(3.6, 0.3, 2.6), snowM, 7.4, 14.15, -10.5);
  for (let r = 0; r < 20; r++) for (let c = 0; c < 5; c++) if ((r * 5 + c * 3) % 7) add(P, new PlaneGeometry(0.4, 0.42), (r + c) % 4 ? B('#ffd98a') : B('#5d6a8a'), 6.0 + c * 0.7, 1.2 + r * 0.66, -9.29);
  // the park's snowy trees on the left
  for (const [x, z, r] of [[-8.4, -4.2, 1.6], [-9.6, -1.6, 1.3], [-7.0, -6.8, 1.4]]) { add(P, new CylinderGeometry(0.22, 0.32, 3, 8), L('#7a5236'), x, 1.5, z); add(P, new SphereGeometry(r, 12, 10), L('#e9eef8'), x, 3.6, z); }
  // the bus stop: a glass shelter with its sign
  add(P, new BoxGeometry(3.4, 0.1, 1.2), L('#2b3556'), 6.2, 2.4, -3.6); add(P, new PlaneGeometry(3.2, 2.2), new MeshBasicMaterial({ color: '#cfe0f6', transparent: true, opacity: 0.35 }), 6.2, 1.2, -4.15); for (const sx of [4.6, 7.8]) add(P, new BoxGeometry(0.08, 2.4, 0.08), L('#2b3556'), sx, 1.2, -3.1);
  add(P, new CylinderGeometry(0.05, 0.05, 2.8, 6), L('#2b3556'), 4.0, 1.4, -2.8); add(P, new CircleGeometry(0.34, 18), B('#2d6fb5'), 4.0, 2.9, -2.77);
  sign(P, 'Taksim Square', 3.0, -1, 4.6, -6.9);
  facades(P, -28, -12, -9.5, { h: [5.5, 8], seed: 4 }); facades(P, 10, 28, -13, { h: [6, 9], seed: 8 }); // city blocks round the square
  for (const x of [-4.2, 2.6]) lamp(P, x, -3.4);
  mounds(P, [[-8.8, 2.6, 1.0], [9.0, 2.4, 1.1]], snowM);
  const A = actor(s, P, { at: [-3.6, 0, 4.6], face: Math.PI - 0.5, scale: 0.75 });
  let t = 0; return { tick: dt => { t += dt; K.tick(dt); A?.tick(dt); }, K, A, colors: [color, '#ffffff', '#ffd166', '#c8302e'] };
}
// a city bus seen from the front: red below, white above, the big windscreen, the route sign lit
function bus() {
  const g = new Group(), red = L('#c8302e'), white = L('#f4f2ee');
  const lo = new Mesh(new RoundedBoxGeometry(1.5, 0.8, 2.6, 3, 0.1), red); lo.position.y = 0.6; lo.castShadow = true; g.add(lo);
  const hi = new Mesh(new RoundedBoxGeometry(1.5, 1.0, 2.6, 3, 0.1), white); hi.position.y = 1.45; hi.castShadow = true; g.add(hi);
  const roof = new Mesh(new BoxGeometry(1.4, 0.1, 2.5), L('#f6f8ff')); roof.position.y = 2.0; g.add(roof);
  const scr = new Mesh(new PlaneGeometry(1.3, 0.75), B('#bcd4f2')); scr.position.set(0, 1.4, 1.31); g.add(scr);
  const sgn = new Mesh(new PlaneGeometry(1.25, 0.26), B('#ffb02a')); sgn.position.set(0, 1.86, 1.311); g.add(sgn);
  const lights = [-0.55, 0.55].map(x => { const l = new Mesh(new CircleGeometry(0.1, 12), B('#fff2c4')); l.position.set(x, 0.55, 1.31); g.add(l); return l; });
  const hazard = [-0.66, 0.66].map(x => { const l = new Mesh(new CircleGeometry(0.06, 10), B('#7a4a1a')); l.position.set(x, 0.85, 1.31); g.add(l); return l; });
  for (const sx of [-0.62, 0.62]) for (const sz of [-0.85, 0.85]) { const w = new Mesh(new CylinderGeometry(0.26, 0.26, 0.14, 14), L('#2b2f45')); w.rotation.z = Math.PI / 2; w.position.set(sx * 1.1, 0.26, sz); g.add(w); }
  g.userData = { lights, hazard, sgn }; return g;
}
export function taksimListen(ctx) {
  const s = ctx.world, st = ctx.step, K = s.set.K, A = s.set.A, voice = ctx.speech.available;
  const T = tall(); frameFor(s, { eye: [0, 3.6, 11.2], look: [0, 1.4, -1.0] }, { eye: [0, 4.0, 12.2], look: [0, 1.3, -1.0] }, { eye: [0, 4.4, 8.6], look: [0, 1.4, -1.4], width: 42 }); // portrait: closer, the buses in two staggered rows
  s.say(`${esc(st.prompt)} <span class="tr">Wave down the bus with that word!</span>${voice ? '' : ` <span class="tr">${esc(st.fallbackText || st.speak)}</span>`}`);
  const play = () => { ctx.sound('tap'); ctx.later(() => ctx.speech.say(st.speak), 150); };
  s.label('🔊 Hear it again', { cls: 'wt-bell', at: innerHeight < 430 ? [3.4, 3.0, -2] : T ? [0, 4.6, -3.0] : [0, 4.3, -3.0], onTap: play });
  if (voice) ctx.later(play, 450); else ctx.note('No English voice on this device: read the word instead.');
  const els = st.options.map((o, i) => s.label(st.pics?.[i] ? `<img src="${esc(st.pics[i])}" alt=""><span>${esc(o)}</span>` : esc(o), { cls: 'wt-opt', onTap: () => pick(i) }));
  const n = st.options.length, gap = T ? 1.55 : 2.2, xs = st.options.map((o, i) => (i - (n - 1) / 2) * gap);
  const buses = st.options.map((o, i) => {
    const g = bus(); g.position.set(xs[i], 0, T ? -0.6 - (i % 2) * 2.0 : -1.6); if (T) g.scale.setScalar(0.85); s.step.add(g);
    els[i]._pin.obj = g; els[i]._pin.at.set(0, 1.86, 1.4); // the word on the bus's route sign
    return g;
  });
  const glow = i => els[i].classList.add('show');
  const flash = (g, col, times, then) => { let k = 0; const tick = () => { const on = k % 2 === 0; for (const l of g.userData.hazard) l.material.color.set(on ? col : '#7a4a1a'); if (++k < times * 2) ctx.later(tick, 140); else then?.(); }; tick(); };
  const pick = chooser(ctx, {
    answerText: st.options[st.answer], glow,
    onRight: i => { els[i].classList.add('right'); s.hush(els.filter((e, k) => k !== i)); ctx.later(() => s.hush([els[i]]), 650); A?.throw(); const g = buses[i]; ctx.sound('superReady'); for (const l of g.userData.lights) l.material.color.set('#ffffff');
      flash(g, '#ffb02a', 2, () => { K.burst(g.position.clone().setY(2.2), ['#ffd166', '#ffffff', '#c8302e'], 22, 1.8); A?.cheer(); s.fly(g, [g.position.x, 0, g.position.z + 0.9], { T: 0.5, lift: 0 }); }); },
    onWrong: i => { els[i].classList.remove('wrong'); void els[i].offsetWidth; els[i].classList.add('wrong'); A?.oops(); s.wobble(buses[i]); flash(buses[i], '#ff7a3a', 3); },
  });
}

// ======================= Cihangir · Matching =======================
// The little square at evening: pastel houses with bay windows up the steep slope, café tables under
// the big plane tree, the antique shop's lit window. The neighbourhood's cats sit about, each with a
// word on its collar tag: tap a cat, then its partner; the two pad over and curl up together.
export function cihangirStation(s, { color = '#f5b616' } = {}) {
  const K = stage(s, { backdrop: 'city', ground: '#e0dcea', top: '#363f92', mid: '#a49ad0', bottom: '#d6c2dc', fog: '#bfb2d4', sun: '#d8b8f0' }), { P, snowM } = K;
  const glass = B('#ffd98a'), cols = ['#e7b9a6', '#f2d48a', '#a9c6dd', '#c9b3d9', '#bfe0c6'];
  [[-8.2, -7.4, 6.4], [-4.4, -8.0, 7.6], [-0.4, -8.6, 8.4], [3.6, -8.0, 7.2], [7.6, -7.2, 6.0]].forEach(([x, z, h], k) => {
    const wall = L(cols[k]); add(P, new BoxGeometry(3.6, h, 2.4), wall, x, h / 2, z); add(P, new BoxGeometry(3.8, 0.3, 2.6), snowM, x, h + 0.15, z);
    add(P, new BoxGeometry(2.0, 1.4, 0.8), wall, x, h * 0.55, z + 1.5); add(P, new PlaneGeometry(1.6, 0.9), glass, x, h * 0.55 + 0.05, z + 1.91); // the bay window
    for (const wx of [-1.0, 1.0]) { add(P, new PlaneGeometry(0.6, 0.9), (k + wx) % 2 ? glass : B('#5d5468'), x + wx, 1.4, z + 1.21); add(P, new PlaneGeometry(0.6, 0.9), glass, x + wx, h - 1.2, z + 1.21); }
  });
  add(P, new CylinderGeometry(0.36, 0.5, 4.2, 9), L('#9a8c84'), -5.6, 2.1, -3.4); for (const [ox, oy, oz, r] of [[0, 4.9, 0, 1.7], [1.2, 4.5, 0.4, 1.2], [-1.1, 4.6, -0.2, 1.3]]) add(P, new SphereGeometry(r, 12, 10), L('#eef2fb'), -5.6 + ox, oy, -3.4 + oz); // the plane tree
  for (const [x, z, c] of [[-7.6, -1.4, '#c8443c'], [6.8, -2.2, '#3f9b5a']]) { add(P, new CylinderGeometry(0.5, 0.5, 0.06, 14), L('#f2ece2'), x, 0.8, z); add(P, new CylinderGeometry(0.04, 0.05, 0.8, 6), L('#2b2f45'), x, 0.4, z); add(P, new CylinderGeometry(0.03, 0.03, 2.2, 6), L('#2b2f45'), x, 1.6, z); add(P, new ConeGeometry(1.3, 0.6, 8), L(c), x, 2.6, z); add(P, new ConeGeometry(1.2, 0.42, 8), snowM, x, 2.8, z); }
  add(P, new PlaneGeometry(2.2, 1.3), glass, 4.6, 1.1, -4.39); sign(P, 'Cihangir', 2.6, 0.2, 0.6, -6.6);
  facades(P, -26, -10.2, -6.5, { h: [6, 8], seed: 6, cols: ['#e7b9a6', '#f2d48a', '#a9c6dd', '#c9b3d9', '#bfe0c6', '#f1e4cc'] }); facades(P, 9.6, 26, -6.5, { h: [6, 8], seed: 12, cols: ['#e7b9a6', '#f2d48a', '#a9c6dd', '#c9b3d9', '#bfe0c6', '#f1e4cc'] });
  for (const x of [-3.0, 2.8]) lamp(P, x, -4.6);
  const tw = bulbs(P, { x0: -9, x1: 9, y: 4.4, z: -4.2, n: 26 });
  mounds(P, [[-8.8, 2.8, 1.0], [8.8, 2.6, 1.1]], snowM);
  const A = actor(s, P, { at: [-4.4, 0, 4.2], face: Math.PI - 0.6, scale: 0.72 });
  let t = 0; return { tick: dt => { t += dt; K.tick(dt); A?.tick(dt); if (!s.reduceMotion) tw(t); }, K, A, colors: [color, '#ffffff', '#ffd166', '#e09a4a'] };
}
// a street cat sitting up, its tail curled round
function cat(col) {
  const g = new Group(), fur = L(col), w = L('#f7f2ea');
  const body = new Mesh(new SphereGeometry(0.3, 14, 10), fur); body.scale.set(0.85, 1.15, 1.05); body.position.y = 0.32; body.castShadow = true; g.add(body);
  const chest = new Mesh(new SphereGeometry(0.15, 10, 8), w); chest.position.set(0, 0.38, 0.22); g.add(chest);
  const head = new Mesh(new SphereGeometry(0.21, 14, 10), fur); head.position.set(0, 0.72, 0.08); g.add(head);
  for (const sx of [-1, 1]) { const e = new Mesh(new ConeGeometry(0.08, 0.16, 4), fur); e.position.set(sx * 0.11, 0.92, 0.08); e.rotation.z = -sx * 0.25; g.add(e); const eye = new Mesh(new SphereGeometry(0.03, 8, 6), B('#2a2a2a')); eye.position.set(sx * 0.075, 0.75, 0.27); g.add(eye); }
  const nose = new Mesh(new SphereGeometry(0.022, 6, 4), B('#e88a9a')); nose.position.set(0, 0.69, 0.29); g.add(nose);
  const collar = new Mesh(new TorusGeometry(0.14, 0.025, 6, 16), L('#c8443c')); collar.rotation.x = Math.PI / 2; collar.position.set(0, 0.56, 0.06); g.add(collar);
  const tag = new Mesh(new CircleGeometry(0.05, 10), B('#e8c24a')); tag.position.set(0, 0.5, 0.21); g.add(tag);
  const tail = new Mesh(new TorusGeometry(0.22, 0.04, 6, 14, Math.PI * 1.2), fur); tail.rotation.set(Math.PI / 2, 0, 0.6); tail.position.set(0.08, 0.06, -0.05); g.add(tail);
  g.userData.tail = tail; return g;
}
export function cihangirMatch(ctx) {
  const s = ctx.world, st = ctx.step, K = s.set.K, A = s.set.A;
  const T = tall(); frameFor(s, { eye: [0, 8.2, 9.6], look: [0, 0.5, -0.8] }, { eye: [0, 7.6, 10.4], look: [0, 0.4, -0.6] }, { eye: [0, 6.0, 9.4], look: [0, 0.6, -1.0], width: 44 }); // portrait: lower, so the cats are seen sitting up
  s.say(esc(st.prompt));
  const right = shuffle(st.right, ctx.rng), n = st.left.length, zs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * (T ? 1.7 : 1.5) - 0.3);
  const FUR = ['#e09a4a', '#3b3b44', '#f2ede4', '#9a9aa6', '#e8c9a0', '#6b5a4a'];
  const html = t => (t.pic ? `<img src="${esc(t.pic)}" alt="${esc(t.alt || '')}">` : `<span ${t.lang === 'tr' ? 'lang="tr"' : ''}>${esc(t.text)}</span>`);
  const els = new Map(), cats = new Map();
  const mk = (t, side, i) => {
    const g = new Group(), x = (side === 'L' ? -1 : 1) * (T ? 1.55 : 2.4); g.position.set(x, 0, zs[i]); s.step.add(g);
    const step2 = new Mesh(new RoundedBoxGeometry(1.0, 0.24, 0.8, 2, 0.05), L('#cfc6d8')); step2.position.y = 0.12; step2.receiveShadow = true; g.add(step2); // a doorstep for each cat
    const c = cat(FUR[(i * 2 + (side === 'L' ? 0 : 1)) % FUR.length]); c.position.y = 0.24; c.scale.setScalar(1.35); c.rotation.y = side === 'L' ? 0.5 : -0.5; g.add(c);
    const el = s.label(html(t), { cls: 'wt-tile', obj: g, at: [0, 1.9, 0], onTap: () => pick(t.id, side) }); el.dataset.id = t.id; els.set(t.id, el); cats.set(t.id, { g, c }); s.keepClear(c); // the word over its cat's head, never on a cat
    const ph = i * 1.3 + (side === 'L' ? 0 : 0.7); s.onTick(() => { if (s.reduceMotion) return; const tt = performance.now() / 1000; c.userData.tail.rotation.z = 0.6 + Math.sin(tt * 1.8 + ph) * 0.35; });
  };
  st.left.forEach((t, i) => mk(t, 'L', i)); right.forEach((t, i) => mk(t, 'R', i));
  const missed = new Set(), done = new Set(); let sel = null;
  const partnerOf = id => (id.startsWith('L') ? st.pairs[id] : Object.keys(st.pairs).find(k => st.pairs[k] === id));
  const srcOf = lid => st.sourceIds?.[st.left.findIndex(l => l.id === lid)];
  const heart = at => { const h = new Group(); for (const sx of [-1, 1]) { const b = new Mesh(new SphereGeometry(0.1, 10, 8), B('#ff6a8a')); b.position.set(sx * 0.07, 0, 0); h.add(b); } const tip = new Mesh(new ConeGeometry(0.13, 0.18, 10), B('#ff6a8a')); tip.rotation.z = Math.PI; tip.position.y = -0.1; h.add(tip); h.position.copy(at); s.step.add(h); s.fly(h, [at.x, at.y + 1.0, at.z], { T: 0.9, lift: 0, done: () => s.step.remove(h) }); };
  const meet = (lid, rid) => { // the right cat pads over and curls up beside its partner
    const a = cats.get(lid), b = cats.get(rid), to = a.g.position.clone().add(new Vector3(T ? 1.05 : 1.3, 0, 0));
    s.fly(b.g, [to.x, 0, to.z], { T: 0.55, lift: 0.5, done: () => { b.c.rotation.y = -1.2; a.c.rotation.y = 1.2; heart(to.clone().lerp(a.g.position, 0.5).setY(1.2)); } });
  };
  const pick = (id, side) => {
    if (ctx.busy || done.has(id.startsWith('L') ? id : partnerOf(id))) return;
    if (!sel || sel.side === side) { if (sel) els.get(sel.id).classList.remove('sel'); sel = { id, side }; els.get(id).classList.add('sel'); ctx.sound('tap'); s.wobble(cats.get(id).c); return; }
    const lid = side === 'L' ? id : sel.id, rid = side === 'R' ? id : sel.id;
    els.get(sel.id).classList.remove('sel'); sel = null;
    if (st.pairs[lid] === rid) {
      done.add(lid); meet(lid, rid);
      for (const x of [lid, rid]) { els.get(x).classList.add('right'); els.get(x).classList.remove('show'); }
      ctx.later(() => s.hush([els.get(lid), els.get(rid)]), 350); // the pair's words fade: watch the cats curl up together
      ctx.item(srcOf(lid), !missed.has(lid)); A?.cheer(); ctx.sound('note', { freq: 523 + done.size * 110 }); K.burst(cats.get(lid).g.position.clone().setY(1.0), ['#ffd166', '#ff6a8a', '#ffffff'], 12, 1.3);
      if (done.size === st.left.length) { ctx.sound('capture'); ctx.finish(1100); }
    } else {
      A?.oops(); ctx.sound('tap');
      for (const x of [lid, rid]) { const el = els.get(x); el.classList.remove('wrong'); void el.offsetWidth; el.classList.add('wrong'); s.wobble(cats.get(x).c); }
      if (!missed.has(lid)) { missed.add(lid); ctx.coach('Not that cat. Look for the glowing one!'); }
      els.get(st.pairs[lid]).classList.add('show');
    }
  };
  ctx.onTimeUp(() => { for (const l of st.left) if (!done.has(l.id)) { done.add(l.id); ctx.item(srcOf(l.id), false); meet(l.id, st.pairs[l.id]); els.get(l.id).classList.add('right'); els.get(st.pairs[l.id]).classList.add('right'); } ctx.coach("Time's up! Here are the pairs."); ctx.finish(1600); });
}

// ======================= Tophane · Answer =======================
// Night on the waterfront: the old clock tower lit up, the marble fountain, the art museum, a cruise
// ship's lit portholes at the quay, the far shore across the water. The answers are on round clock
// faces along the promenade railing: snowball the right one and it glows, while the tower's clock
// hands spin round and its bell chimes; a wrong one gets a splat of snow.
export function tophaneStation(s, { color = '#f5b616' } = {}) {
  const K = stage(s, { backdrop: 'city', ground: '#d6d4e6', top: '#262c74', mid: '#6f6aac', bottom: '#a99ac4', fog: '#8f88bc', sun: '#b8c4ff' }), { P, snowM } = K;
  const stone = L('#e6ddcf'), stoneD = L('#c2b6a2'), marble = L('#f4f1ea'), lead = L('#7d8296'), glass = B('#ffd98a');
  // the water and the far shore's lights
  const sea = add(P, new PlaneGeometry(60, 14), new MeshStandardMaterial({ color: '#4a4f86', roughness: 0.15, metalness: 0.3 }), 0, 0.02, -15); sea.rotation.x = -Math.PI / 2;
  for (let k = 0; k < 60; k++) add(P, new PlaneGeometry(0.22, 0.26), B(k % 5 ? '#ffd27a' : '#bfe0ff'), -26 + k * 0.9 + ((k * 37) % 7) * 0.1, 1.2 + ((k * 31) % 9) * 0.35, -23);
  add(P, new BoxGeometry(60, 1.6, 4), L('#3d3f6e'), 0, 0.6, -25);
  // the cruise ship at the quay, rows of lit portholes
  add(P, new BoxGeometry(22, 2.6, 3), L('#f6f6f8'), 6, 1.3, -10.5); add(P, new BoxGeometry(16, 1.6, 2.6), L('#eef0f4'), 7, 3.4, -10.6); add(P, new BoxGeometry(2, 1.6, 2), L('#2d6fb5'), 11, 5.0, -10.6);
  for (const [y, n, x0] of [[0.9, 30, -4.4], [1.8, 30, -4.4], [3.4, 22, -0.8]]) for (let k = 0; k < n; k++) add(P, new CircleGeometry(0.12, 10), glass, x0 + k * 0.72, y, -8.99 + (y > 3 ? -0.3 : 0));
  // the art museum on the left: a long low box, its overhanging roof, glass below
  add(P, new BoxGeometry(7, 2.6, 3), L('#c9ced8'), -8, 1.3, -8.5); add(P, new BoxGeometry(8, 0.3, 4), L('#dfe3ea'), -8, 2.75, -8.3); add(P, new BoxGeometry(7.8, 0.2, 3.8), snowM, -8, 2.98, -8.3); add(P, new PlaneGeometry(6.4, 1.6), B('#bcd4f2'), -8, 0.95, -6.99);
  // the clock tower: three tiers, a clock face on every side, the lantern on top
  const ct = new Group(); ct.position.set(-2.4, 0, -5.4); ct.scale.setScalar(0.8); P.add(ct);
  const part = (geo, mat, x, y, z, ry = 0) => { const m = new Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; ct.add(m); return m; };
  part(new BoxGeometry(2.0, 3.6, 2.0), stone, 0, 1.8, 0); part(new BoxGeometry(2.2, 0.25, 2.2), stoneD, 0, 3.7, 0); part(new BoxGeometry(1.7, 2.8, 1.7), stone, 0, 5.2, 0); part(new BoxGeometry(1.9, 0.25, 1.9), stoneD, 0, 6.7, 0); part(new BoxGeometry(1.45, 1.8, 1.45), stone, 0, 7.7, 0);
  const hands = [];
  for (const [fx, fz, ry] of [[0, 0.73, 0], [0.73, 0, Math.PI / 2], [-0.73, 0, -Math.PI / 2]]) { part(new CircleGeometry(0.5, 24), B('#fff8e6'), fx * 1.01, 7.8, fz * 1.01, ry); part(new TorusGeometry(0.5, 0.06, 6, 24), stoneD, fx * 1.02, 7.8, fz * 1.02, ry); const h = new Group(); h.position.set(fx * 1.05, 7.8, fz * 1.05); h.rotation.y = ry; ct.add(h); const hh = new Mesh(new BoxGeometry(0.05, 0.36, 0.02), L('#2b2f45')); hh.position.y = 0.16; h.add(hh); const mh = new Mesh(new BoxGeometry(0.035, 0.46, 0.02), L('#2b2f45')); mh.position.y = 0.21; mh.rotation.z = 1.9; h.add(mh); hands.push(h); }
  for (const [fx, fz, ry] of [[0, 1.01, 0], [1.01, 0, Math.PI / 2]]) { part(new PlaneGeometry(0.5, 0.9), glass, fx, 5.2, fz * 0.86, ry); part(new PlaneGeometry(0.5, 0.9), B('#3d4363'), fx, 1.6, fz, ry); }
  part(new BoxGeometry(1.7, 0.2, 1.7), stoneD, 0, 8.7, 0); part(new CylinderGeometry(0.45, 0.5, 0.9, 12), stone, 0, 9.25, 0); part(new SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), lead, 0, 9.7, 0); part(new CylinderGeometry(0.03, 0.03, 0.7, 5), B('#e8c24a'), 0, 10.5, 0);
  // the fountain: a marble kiosk with wide eaves and a low dome
  add(P, new BoxGeometry(2.4, 2.2, 2.4), marble, 5.2, 1.1, -5.4); add(P, new BoxGeometry(3.6, 0.2, 3.6), lead, 5.2, 2.3, -5.4); add(P, new BoxGeometry(3.5, 0.16, 3.5), snowM, 5.2, 2.45, -5.4);
  { const d = add(P, new SphereGeometry(1.0, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), lead, 5.2, 2.5, -5.4); d.scale.y = 0.6; } add(P, new PlaneGeometry(1.6, 1.2), L('#e6dccb'), 5.2, 1.2, -4.19); add(P, new CircleGeometry(0.3, 14), L('#cfc2ac'), 5.2, 1.3, -4.18);
  // the quay railing the clock faces hang on
  add(P, new BoxGeometry(20, 0.08, 0.08), L('#2b2f45'), 0, 1.0, -2.4); for (let k = 0; k <= 20; k++) add(P, new BoxGeometry(0.06, 1.0, 0.06), L('#2b2f45'), -10 + k, 0.5, -2.4);
  sign(P, 'Tophane', 2.4, -2.4, 0.5, -4.3);
  { const tm = new Group(); tm.position.set(13, 0, -6.2); P.add(tm); const b2 = new Mesh(new BoxGeometry(12, 2.0, 3), L('#d9dde6')); b2.position.y = 1.0; tm.add(b2); const gl = new Mesh(new PlaneGeometry(11.4, 1.4), B('#ffe2a8')); gl.position.set(0, 0.9, 1.51); tm.add(gl); const rf = new Mesh(new BoxGeometry(12.4, 0.16, 3.4), L('#e6efe8')); rf.position.y = 2.08; tm.add(rf); } // the cruise port's terminal with its planted roof
  for (const x of [-7, 8.6]) lamp(P, x, -1.6);
  const tw = bulbs(P, { x0: -10, x1: 10, y: 3.6, z: -2.6, n: 28, sag: 0.3 });
  const A = actor(s, P, { at: [-3.4, 0, 3.8], face: Math.PI - 0.5, scale: 0.75 });
  let t = 0, spin = 0;
  return { tick: dt => { t += dt; K.tick(dt); A?.tick(dt); if (!s.reduceMotion) tw(t); if (spin > 0) { spin = Math.max(0, spin - dt); for (const h of hands) h.children[1].rotation.z += dt * 14 * spin; } }, chime: () => { spin = 1.4; }, K, A, colors: [color, '#ffffff', '#ffd166', '#2d6fb5'] };
}
export function tophaneChoice(ctx) {
  const s = ctx.world, st = ctx.step, set = s.set, K = set.K, A = set.A;
  const T = tall(); frameFor(s, { eye: [0, 5.0, 14.6], look: [0, 3.9, -4.0] }, { eye: [0, 4.8, 15.4], look: [0, 3.5, -4.0] }, { eye: [0, 3.6, 12.0], look: [0, 2.4, -2.0], width: 48 }); // the lit clock tower above the dials
  s.say(caption(st));
  const els = st.options.map((o, i) => s.label(esc(o), { cls: 'wt-opt', onTap: () => pick(i) }));
  // each word sits beside its clock face, never on it: portrait, a column of faces with the words to
  // their right; landscape, a row of faces on posts with the words under them
  const r = T ? 0.47 : 0.55, gap = 0.16, lw = els.map(el => s.measure(el).w / s.pxPerMeter() + 0.12);
  const ws = els.map(el => sized(s, el, 1.4, 0.3)), colW = 2 * r + gap + Math.max(...lw), xs = T ? st.options.map(() => -colW / 2 + r + 0.6) : row(ws.map(w => Math.max(w, 1.5)), 0.4);
  const dials = st.options.map((o, i) => { // a round clock face on an iron post by the railing
    const g = new Group(); g.position.set(xs[i], T ? 3.45 - i * 1.06 : 2.1, -2.0); s.step.add(g);
    const face = new Mesh(new CircleGeometry(r, 28), new MeshStandardMaterial({ color: '#fff8e6', emissive: new Color('#ffe6b0'), emissiveIntensity: 0.45 })); g.add(face);
    const rim = new Mesh(new TorusGeometry(r, 0.06, 6, 28), new MeshStandardMaterial({ color: '#d9a640', roughness: 0.35, metalness: 0.6 })); g.add(rim);
    if (!T) { const post = new Mesh(new CylinderGeometry(0.04, 0.05, 2.1 - r, 6), L('#2b2f45')); post.position.y = -(2.1 - r) / 2 - r; g.add(post); }
    els[i]._pin.obj = g; els[i]._pin.at.set(T ? r + gap + lw[i] / 2 : 0, T ? 0 : -(r + 0.36), 0.12); s.keepClear(rim);
    return { g, face };
  });
  const glow = i => { els[i].classList.add('show'); dials[i].face.material.emissive.set('#ffcf3c'); dials[i].face.material.emissiveIntensity = 0.7; };
  const hit = i => dials[i].g.position.clone().add(new Vector3(0, 0, 0.1));
  const pick = chooser(ctx, {
    answerText: st.options[st.answer], glow,
    onRight: i => { els[i].classList.add('right'); s.hush(els.filter((e, k) => k !== i)); ctx.later(() => s.hush([els[i]]), 650); A?.throw(); K.snowball(hit(i), () => { const m = dials[i].face.material; m.emissive.set('#ffffff'); m.emissiveIntensity = 1.3; set.chime?.(); ctx.sound('chime'); K.burst(hit(i), ['#ffffff', '#fff3c4', '#ffd166'], 26, 2.0); A?.cheer(); }, A ? A.hand().toArray() : undefined); },
    onWrong: i => { els[i].classList.remove('wrong'); void els[i].offsetWidth; els[i].classList.add('wrong'); A?.throw(); K.snowball(hit(i), () => { const sp = new Mesh(new CircleGeometry(0.2, 10), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 })); sp.position.z = 0.05; dials[i].g.add(sp); s.wobble(dials[i].g); A?.oops(); }, A ? A.hand().toArray() : undefined); },
  });
}
