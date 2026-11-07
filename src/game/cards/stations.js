// Task stations for the other four landmarks (staged 3D sets, like Languini's stations):
//   Treehouse (Boulevard) · Answer    – snowball the birdhouse with the right answer
//   Archers' Lodge · Sorting          – shoot each arrow card into its category's target
//   Kızılay Fountain · Matching       – skate a trail across the frozen fountain to the match
//   Admiral's Bell (Waterfront) · Listening – hear the word, toss a simit to the gull that has it
// Each scene scores exactly like its flat card (basic.js): one item per question, pair or card,
// right first time or not; a miss shows the right one glowing and the task goes on.
import {
  Mesh, Group, MeshLambertMaterial, MeshStandardMaterial, MeshBasicMaterial, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, TorusGeometry,
  PlaneGeometry, TubeGeometry, QuadraticBezierCurve3, Vector3, Color, DoubleSide, Shape, ShapeGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { stage, pines, mounds, bunting, row, actor } from './stationkit.js';
import { gullGroup } from '../render/gull.js';
import { esc, shuffle } from './util.js';

const L = (c) => new MeshLambertMaterial({ color: c });
// portrait phones get their own layouts, using the height: answers stack, the camera comes closer
export const tall = () => innerWidth / innerHeight < 0.8;
const frameFor = (s, desk, short, port = null) => {
  if (port && tall()) { s.frame(port.eye, port.look, port.width); return; }
  const c = innerHeight < 430 ? short : desk, d = innerWidth / innerHeight < 1.6 ? 1.12 : 1; s.frame([c.eye[0], c.eye[1], c.eye[2] * d], c.look);
};
const caption = st => `${st.context ? `<span class="ctx">${esc(st.context)}</span>` : ''}<span ${st.promptLang === 'tr' ? 'lang="tr"' : ''}>${esc(st.prompt)}</span>${st.hintTr ? ` <span class="tr">${esc(st.hintTr)}</span>` : ''}`;
const sized = (s, el, min, pad) => Math.max(min, s.measure(el).w / s.pxPerMeter() + pad);

// one-of-n logic shared by the answer and listening stations
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

// ======================= the Treehouse (Boulevard Park) =======================
export function treehouseStation(s, { color = '#f5b616' } = {}) {
  const K = stage(s), { P, snowM } = K;
  const bark = L('#7a5236'), leaf = L('#3f7d5a'), wood = L('#b9845a');
  const trunk = new Mesh(new CylinderGeometry(0.55, 0.75, 6, 12), bark); trunk.position.set(0, 3, -2.6); trunk.castShadow = true; P.add(trunk);
  for (const [x, y, z, r] of [[0, 6.6, -2.6, 2.0], [-1.7, 5.9, -2.4, 1.4], [1.8, 6.0, -2.5, 1.5], [-0.8, 7.6, -2.8, 1.2], [0.9, 7.4, -2.2, 1.2]]) {
    const b = new Mesh(new SphereGeometry(r, 14, 10), leaf); b.position.set(x, y, z); b.castShadow = true; P.add(b);
    const cap = new Mesh(new SphereGeometry(r * 0.92, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), snowM); cap.position.set(x, y + r * 0.18, z); P.add(cap);
  }
  // the long branch the birdhouses hang from, and the treehouse up in the tree
  const branch = new Mesh(new CylinderGeometry(0.16, 0.24, 10, 10), bark); branch.rotation.z = Math.PI / 2; branch.position.set(0, 4.25, -0.9); branch.castShadow = true; P.add(branch);
  const bsnow = new Mesh(new BoxGeometry(9.6, 0.1, 0.32), snowM); bsnow.position.set(0, 4.43, -0.9); P.add(bsnow);
  const deck = new Mesh(new BoxGeometry(3.2, 0.16, 2.0), wood); deck.position.set(0, 5.0, -2.6); P.add(deck);
  const hut = new Mesh(new BoxGeometry(2.0, 1.3, 1.4), L('#c99a6e')); hut.position.set(0.3, 5.75, -2.9); hut.castShadow = true; P.add(hut);
  const roof = new Mesh(new ConeGeometry(1.6, 0.9, 4), L('#c8443c')); roof.rotation.y = Math.PI / 4; roof.position.set(0.3, 6.85, -2.9); P.add(roof);
  const win = new Mesh(new PlaneGeometry(0.5, 0.45), new MeshBasicMaterial({ color: '#ffe3a0' })); win.position.set(0.3, 5.8, -2.19); P.add(win);
  for (let i = 0; i < 7; i++) { const rung = new Mesh(new BoxGeometry(0.7, 0.07, 0.07), wood); rung.position.set(-0.9, 0.5 + i * 0.65, -1.85); P.add(rung); }
  for (const x of [-1.25, -0.55]) { const rail = new Mesh(new BoxGeometry(0.07, 4.8, 0.07), wood); rail.position.set(x, 2.4, -1.85); P.add(rail); }
  pines(P, [[-7.4, -2.6, 1.3], [7.6, -2.4, 1.4], [-8.8, 0.6, 1.0], [8.9, 0.8, 1.1], [-5.6, -5, 1.2], [5.8, -5.2, 1.3]], snowM);
  mounds(P, [[-5.6, 2.6, 1.0], [5.9, 2.9, 1.2], [-4.2, 4.4, 0.7], [4.4, 4.6, 0.8]], snowM);
  const wave = bunting(P, { x0: -4.6, x1: 4.6, y: 4.15, sag: 0.25, z: -0.75, n: 17, colors: [color, '#ffffff', '#7cc4f0', '#f3a6c8'] });
  const A = actor(s, P, { at: [-2.9, 0, 3.6], face: Math.PI - 0.5 });
  let t = 0; return { tick: dt => { t += dt; K.tick(dt); A?.tick(dt); if (!s.reduceMotion) wave(t); }, K, A, colors: [color, '#ffffff', '#ffd166', '#7cc4f0'] };
}
const BIRD_COLS = ['#d9534f', '#3f8ed8', '#f2b705', '#4caf6a', '#9b6ad6'];
export function treehouseChoice(ctx) {
  const s = ctx.world, st = ctx.step, K = s.set.K, A = s.set.A;
  const T = tall(); frameFor(s, { eye: [0, 3.3, 11.5], look: [0, 2.35, 0] }, { eye: [0, 3.6, 12.6], look: [0, 2.2, 0] }, { eye: [0, 3.0, 8.4], look: [0, 3.0, -0.9], width: 34 });
  s.say(caption(st));
  const els = st.options.map((o, i) => s.label(esc(o), { cls: 'wt-opt', onTap: () => pick(i) }));
  const ws = els.map(el => sized(s, el, 1.5, 0.35)), xs = T ? st.options.map((o, i) => (i % 2 ? 0.95 : -0.95)) : row(ws, 0.3);
  const houses = st.options.map((o, i) => {
    const drop = T ? i * 1.2 : 0; // portrait: a zigzag column, each on a longer rope
    const g = new Group(); g.position.set(xs[i], 4.15, -0.9); s.step.add(g); // hangs from the branch
    const rope = new Mesh(new CylinderGeometry(0.015, 0.015, 0.9 + drop, 4), L('#d9c08a')); rope.position.y = -(0.9 + drop) / 2; g.add(rope);
    const house = new Group(); house.position.y = -1.25 - drop; g.add(house);
    const body = new Mesh(new RoundedBoxGeometry(0.62, 0.62, 0.52, 2, 0.05), L(BIRD_COLS[i % BIRD_COLS.length])); body.castShadow = true; house.add(body);
    const roof = new Mesh(new ConeGeometry(0.55, 0.4, 4), L('#7a4b2e')); roof.rotation.y = Math.PI / 4; roof.position.y = 0.5; house.add(roof);
    const cap = new Mesh(new ConeGeometry(0.5, 0.18, 4), K.snowM); cap.rotation.y = Math.PI / 4; cap.position.y = 0.62; house.add(cap);
    const hole = new Mesh(new SphereGeometry(0.1, 12, 8), new MeshBasicMaterial({ color: '#2b2f45' })); hole.scale.z = 0.3; hole.position.set(0, 0.06, 0.27); house.add(hole);
    const perch = new Mesh(new CylinderGeometry(0.02, 0.02, 0.18, 5), L('#7a4b2e')); perch.rotation.x = Math.PI / 2; perch.position.set(0, -0.12, 0.33); house.add(perch);
    els[i]._pin.obj = house; els[i]._pin.at.set(0, -0.72, 0.3);
    const ph = (i * 1.7) % 6; s.onTick(dt => { if (!s.reduceMotion) g.rotation.z = Math.sin(performance.now() / 700 + ph) * 0.05; });
    return { g, house, body };
  });
  const glow = i => { els[i].classList.add('show'); houses[i].body.material = houses[i].body.material.clone(); houses[i].body.material.emissive = new Color('#ffcf3c'); houses[i].body.material.emissiveIntensity = 0.45; };
  const hitPoint = i => houses[i].house.getWorldPosition(new Vector3()).sub(s.group.position);
  const pick = chooser(ctx, {
    answerText: st.options[st.answer], glow,
    onRight: i => { els[i].classList.add('right'); A?.throw(); K.snowball(hitPoint(i), () => { K.burst(hitPoint(i)); s.wobble(houses[i].house); ctx.sound('superReady'); A?.cheer(); }, A ? A.hand().toArray() : undefined); },
    onWrong: i => { els[i].classList.remove('wrong'); void els[i].offsetWidth; els[i].classList.add('wrong'); A?.throw(); K.snowball(hitPoint(i), () => { s.wobble(houses[i].house); A?.oops(); }, A ? A.hand().toArray() : undefined); },
  });
}

// ======================= the Archers' Lodge (Archery Ground) =======================
export function archeryStation(s, { color = '#f5b616' } = {}) {
  const K = stage(s, { ground: '#e8eef6' }), { P, snowM } = K;
  const log = L('#8a5f3e'), logL = L('#a5714f');
  const lodge = new Group(); lodge.position.set(0, 0, -5.4); P.add(lodge);
  for (let r = 0; r < 7; r++) { const lg = new Mesh(new CylinderGeometry(0.17, 0.17, 6.4, 8), r % 2 ? log : logL); lg.rotation.z = Math.PI / 2; lg.position.set(0, 0.2 + r * 0.33, 0); lg.castShadow = true; lodge.add(lg); }
  const roof = new Mesh(new ConeGeometry(4.6, 1.8, 4), L('#5a7a52')); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.45; roof.position.set(0, 3.25, 0); lodge.add(roof);
  const rs = new Mesh(new ConeGeometry(4.5, 0.6, 4), snowM); rs.rotation.y = Math.PI / 4; rs.scale.z = 0.45; rs.position.set(0, 3.95, 0); lodge.add(rs);
  for (const x of [-1.8, 1.8]) { const w = new Mesh(new PlaneGeometry(0.7, 0.6), new MeshBasicMaterial({ color: '#ffe3a0' })); w.position.set(x, 1.3, 0.2); lodge.add(w); }
  const door = new Mesh(new PlaneGeometry(0.9, 1.5), L('#5a3a2a')); door.position.set(0, 0.75, 0.2); lodge.add(door);
  for (let i = 0; i < 9; i++) { const post = new Mesh(new BoxGeometry(0.12, 0.8, 0.12), logL); post.position.set(-8 + i * 2, 0.4, -3.4); P.add(post); }
  const rail = new Mesh(new BoxGeometry(16, 0.1, 0.1), logL); rail.position.set(0, 0.7, -3.4); P.add(rail);
  pines(P, [[-7.6, -6.4, 1.4], [7.8, -6.2, 1.5], [-9, -1, 1.1], [9.1, -0.6, 1.2]], snowM);
  mounds(P, [[-6, 2.8, 1.0], [6.2, 3.0, 1.1]], snowM);
  // the rack the arrows lean on, in the foreground
  const rack = new Mesh(new BoxGeometry(8.6, 0.12, 0.3), logL); rack.position.set(0, 0.62, 2.45); rack.castShadow = true; P.add(rack);
  for (const x of [-4.2, 4.2]) { const leg = new Mesh(new BoxGeometry(0.12, 0.62, 0.12), log); leg.position.set(x, 0.31, 2.45); P.add(leg); }
  const wave = bunting(P, { x0: -3.2, x1: 3.2, y: 3.0, sag: 0.3, z: -5.0, n: 13, colors: [color, '#ffffff', '#e8b84a', '#c8443c'] });
  const A = actor(s, P, { at: [-3.0, 0, 4.4], face: Math.PI - 0.5, scale: 0.75 });
  let t = 0; return { tick: dt => { t += dt; K.tick(dt); A?.tick(dt); if (!s.reduceMotion) wave(t); }, K, A, colors: [color, '#ffffff', '#ffd166', '#7cc4f0'] };
}
const RINGS = ['#ffffff', '#2b2f45', '#3f8ed8', '#d9534f', '#f2c14e'];
function target(s) {
  const g = new Group();
  RINGS.forEach((c, k) => { const r = new Mesh(new CylinderGeometry(0.95 - k * 0.19, 0.95 - k * 0.19, 0.08 + k * 0.012, 28), L(c)); r.rotation.x = Math.PI / 2; g.add(r); });
  const back = new Mesh(new CylinderGeometry(1.0, 1.0, 0.06, 28), L('#d9c08a')); back.rotation.x = Math.PI / 2; back.position.z = -0.05; g.add(back);
  for (const sx of [-0.55, 0.55]) { const leg = new Mesh(new BoxGeometry(0.09, 2.0, 0.09), L('#8a5f3e')); leg.position.set(sx, -0.75, -0.25); leg.rotation.x = -0.18; g.add(leg); }
  return g;
}
function arrow() {
  const g = new Group(); g.scale.setScalar(1.15);
  const shaft = new Mesh(new CylinderGeometry(0.025, 0.025, 1.0, 6), L('#a5714f')); shaft.rotation.x = Math.PI / 2; g.add(shaft);
  const tip = new Mesh(new ConeGeometry(0.06, 0.16, 6), L('#9aa3b5')); tip.rotation.x = -Math.PI / 2; tip.position.z = -0.56; g.add(tip);
  for (const r of [0, Math.PI / 2]) { const f = new Mesh(new PlaneGeometry(0.2, 0.3), new MeshLambertMaterial({ color: '#d9534f', side: DoubleSide })); f.rotation.set(Math.PI / 2, r, 0); f.rotateY(0); f.position.z = 0.4; g.add(f); }
  return g;
}
export function archerySort(ctx) {
  const s = ctx.world, st = ctx.step, K = s.set.K, A = s.set.A;
  const T = tall(); frameFor(s, { eye: [0, 3.4, 11.4], look: [0, 1.5, 0] }, { eye: [0, 3.8, 12.6], look: [0, 1.4, 0] }, { eye: [0, 4.4, 10.0], look: [0, 2.2, 0.9], width: 40 });
  s.say(esc(st.prompt));
  const n = st.categories.length, tx = T ? (n === 2 ? [-1.5, 1.5] : [-2.15, 0, 2.15]) : n === 2 ? [-2.6, 2.6] : [-3.6, 0, 3.6];
  const targets = st.categories.map((c, i) => {
    const g = target(s); g.position.set(tx[i], 2.0, -1.2); if (T && n > 2) g.scale.setScalar(0.8); s.step.add(g);
    const title = s.label(`<b>${esc(c.title)}</b>${c.titleTr ? `<small>${esc(c.titleTr)}</small>` : ''}`, { cls: 'wt-target', obj: g, at: [0, 1.35, 0], onTap: () => shoot(i) });
    const tapRing = s.label('', { cls: 'wt-hit', obj: g, at: [0, 0, 0.1], onTap: () => shoot(i) });
    return { g, title, tapRing, stuck: 0, spot: 0, list: [] };
  });
  let sel = null, left = st.cards.length; const missed = new Set();
  const cards = shuffle(st.cards, ctx.rng).map(c => {
    const el = s.label(esc(c.text), { cls: 'wt-card', onTap: () => select(card) });
    const w = sized(s, el, 1.1, 0.3);
    const plank = new Mesh(new RoundedBoxGeometry(w, 0.36, 0.08, 2, 0.03), L('#f2e3c6')); plank.castShadow = true; s.step.add(plank);
    el._pin.obj = plank; el._pin.at.set(0, 0, 0.06);
    const card = { c, el, plank, w, placed: false }; return card;
  });
  const per = T ? 2 : cards.length; // portrait: two cards on the rack, the rest on the snow in front
  for (let r = 0; r * per < cards.length; r++) { const rowCards = cards.slice(r * per, r * per + per), xs = row(rowCards.map(k => k.w), 0.25); rowCards.forEach((k, i) => { k.plank.position.set(xs[i], r ? 0.3 : 0.92, r ? 2.5 + r * 0.95 : 2.5); k.plank.rotation.x = -0.25; k.y0 = k.plank.position.y; }); }
  const select = k => { if (ctx.busy || k.placed || k.locked) return; if (sel) { sel.el.classList.remove('sel'); sel.plank.position.y = sel.y0; } sel = k; k.el.classList.add('sel'); k.plank.position.y = k.y0 + 0.16; ctx.sound('tap'); };
  const place = (k, ok) => {
    k.placed = true; left--; k.el.classList.remove('sel'); const T = targets[k.c.cat];
    s.unlabel(k.el); k.plank.visible = false;
    T.list.push(s.label(esc(k.c.text), { cls: 'wt-placed' + (ok ? '' : ' fixed'), obj: T.g, at: [0, -1.35 - (T.list.length) * 0.36, 0.3] }));
    if (!left) ctx.finish(900);
  };
  // an arrow flies nose first along its arc and sticks straight into the target face, at its own
  // spot (no two in the same place), then quivers; a bounce hits the rim and drops
  const SPOTS = [[0, 0.03], [0.24, 0.15], [-0.25, -0.1], [0.1, -0.28], [-0.18, 0.27], [0.34, -0.08], [-0.36, 0.08]];
  const fire = (k, i, then, stick = true) => {
    const T = targets[i], sc = T.g.scale.x, face = T.g.position.z + 0.075 * sc, n = T.spot++ % SPOTS.length;
    const [ox, oy] = stick ? SPOTS[n] : [0.85, 0.55 * (ctx.rng() < 0.5 ? 1 : -1)];
    const a = arrow(), from = (A ? A.hand() : k.plank.position.clone()); a.position.copy(from); A?.throw(); s.step.add(a);
    // stuck, the shaft points back toward the shooter a little (as real arrows sit), so it shows
    const tipAt = new Vector3(T.g.position.x + ox * sc, T.g.position.y + oy * sc, face - 0.1), tail = from.clone().sub(tipAt).normalize().multiplyScalar(0.5).add(new Vector3(0, 0, 1)).normalize();
    const to = tipAt.clone().addScaledVector(tail, 0.64 * 1.15); // the tip is 0.64 ahead of the middle (×1.15 scale)
    const land = () => { a.position.copy(to); a.lookAt(to.clone().add(tail)); then(a); };
    if (s.reduceMotion) { a.position.copy(to); land(); return; }
    let t = 0, live = true; const Tf = 0.38, prev = new Vector3(), back = new Vector3();
    s.onTick(dt => {
      if (!live) return; t += dt; const q = Math.min(1, t / Tf);
      prev.copy(a.position); a.position.lerpVectors(from, to, q); a.position.y += Math.sin(Math.PI * q) * 0.45;
      if (q < 1 && a.position.distanceToSquared(prev) > 1e-8) a.lookAt(back.copy(prev).sub(a.position).normalize().add(a.position)); // +z (the tail) points back along the path
      if (q >= 1) { live = false; land(); }
    });
  };
  const quiver = a => { const q0 = a.quaternion.clone(); let t = 0; s.onTick(dt => { if (t > 0.6) return; t += dt; a.quaternion.copy(q0); a.rotateX(Math.sin(t * 45) * 0.06 * Math.exp(-t * 7)); }); };
  const shoot = i => {
    if (ctx.busy) return;
    if (!sel) { ctx.coach('Pick an arrow card first, then its target!'); return; }
    const k = sel; sel = null; k.plank.position.y = k.y0;
    if (k.c.cat === i) {
      ctx.item(k.c.id, !missed.has(k.c.id)); ctx.sound('note', { freq: 659 + targets[i].stuck * 90 }); targets[i].stuck++;
      fire(k, i, a => { ctx.sound('thunk'); quiver(a); K.burst(targets[i].g.position.clone().setZ(targets[i].g.position.z + 0.2), undefined, 14, 1.6); A?.cheer(); }); place(k, true);
    } else {
      k.el.classList.remove('wrong'); void k.el.offsetWidth; k.el.classList.add('wrong'); targets[i].title.classList.add('no'); ctx.later(() => targets[i].title.classList.remove('no'), 500);
      fire(k, i, a => { ctx.sound('thunk'); s.fly(a, [a.position.x + 0.6, 0.05, a.position.z + 1.2], { T: 0.4, lift: 0.4, spin: 2 }); A?.oops(); }, false); // hits the rim and bounces off
      if (!missed.has(k.c.id)) { missed.add(k.c.id); k.locked = true; ctx.item(k.c.id, false); ctx.coach(`"${k.c.text}" goes in "${st.categories[k.c.cat].title}".`); targets[k.c.cat].title.classList.add('show'); ctx.later(() => { targets[k.c.cat].title.classList.remove('show'); if (!k.placed) { fire(k, k.c.cat, () => {}); place(k, false); } }, 1000); }
    }
  };
  ctx.onTimeUp(() => { for (const k of cards) if (!k.placed) { if (!missed.has(k.c.id)) ctx.item(k.c.id, false); missed.add(k.c.id); place(k, false); } ctx.coach("Time's up! Look where they go."); });
}

// ======================= the Kızılay Fountain =======================
export function fountainStation(s, { color = '#f5b616' } = {}) {
  const K = stage(s, { ground: '#e6ecf6' }), { P, snowM } = K;
  const ice = new Mesh(new CylinderGeometry(4.3, 4.3, 0.14, 48), new MeshStandardMaterial({ color: '#cfeaf8', roughness: 0.12, metalness: 0.05 })); ice.position.y = 0.2; ice.receiveShadow = true; P.add(ice);
  const TILE = ['#35b0b0', '#2d6fb5', '#f4f7fb'];
  for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2, t = new Mesh(new BoxGeometry(0.78, 0.42, 0.38), L(TILE[k % 3])); t.position.set(Math.sin(a) * 4.5, 0.21, Math.cos(a) * 4.5); t.rotation.y = a; t.castShadow = true; P.add(t); }
  const rimSnow = new Mesh(new TorusGeometry(4.5, 0.2, 6, 48), snowM); rimSnow.rotation.x = Math.PI / 2; rimSnow.position.y = 0.45; P.add(rimSnow);
  // the kiosk at the back, with its dome
  const kiosk = new Group(); kiosk.position.set(0, 0, -6.2); P.add(kiosk);
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, c = new Mesh(new CylinderGeometry(0.1, 0.1, 2.4, 8), L('#f4f7fb')); c.position.set(Math.sin(a) * 1.4, 1.2, Math.cos(a) * 1.4); kiosk.add(c); }
  const drum = new Mesh(new CylinderGeometry(1.7, 1.7, 0.4, 24), L('#2d6fb5')); drum.position.y = 2.6; kiosk.add(drum);
  const dome = new Mesh(new SphereGeometry(1.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), L('#8a96b8')); dome.position.y = 2.8; kiosk.add(dome);
  const dsnow = new Mesh(new SphereGeometry(1.62, 24, 8, 0, Math.PI * 2, 0, Math.PI / 4), snowM); dsnow.position.y = 2.8; kiosk.add(dsnow);
  const bowl = new Mesh(new CylinderGeometry(0.9, 0.6, 0.5, 20), L('#35b0b0')); bowl.position.y = 0.6; kiosk.add(bowl);
  pines(P, [[-7.8, -4.4, 1.3], [7.9, -4.2, 1.4], [-9.2, 0.8, 1.0], [9.3, 1.0, 1.1]], snowM);
  const wave = bunting(P, { x0: -5.6, x1: 5.6, y: 3.6, sag: 0.4, z: -5.2, n: 19, colors: [color, '#ffffff', '#35b0b0', '#2d6fb5'] });
  const A = actor(s, P, { at: [-5.0, 0, 2.6], face: Math.PI - 0.9, scale: 0.9 });
  let t = 0; return { tick: dt => { t += dt; K.tick(dt); A?.tick(dt); if (!s.reduceMotion) wave(t); }, K, A, colors: [color, '#ffffff', '#ffd166', '#7cc4f0'] };
}
// opts (another set using the same matching): tile colour, the colours tiles turn when matched
export function fountainMatch(ctx, opts = {}) {
  const s = ctx.world, st = ctx.step, K = s.set.K, A = s.set.A;
  const T = tall(), F = opts.frame; frameFor(s, F?.desk || { eye: [0, 9.2, 10.6], look: [0, 0.1, -0.5] }, F?.short || { eye: [0, 7.4, 8.2], look: [0, 0.1, 0.25] }, F?.port || { eye: [0, 11.5, 5.6], look: [0, 0.1, -0.7], width: 42 });
  s.say(esc(st.prompt));
  const right = shuffle(st.right, ctx.rng), n = st.left.length, zs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * (T ? 1.75 : 1.25));
  const tileHTML = t => (t.pic ? `<img src="${esc(t.pic)}" alt="${esc(t.alt || '')}">` : `<span ${t.lang === 'tr' ? 'lang="tr"' : ''}>${esc(t.text)}</span>`);
  const tileM = new MeshStandardMaterial({ color: opts.tile || '#f2fbff', roughness: opts.tile ? 0.6 : 0.2, transparent: true, opacity: 0.95 });
  const els = new Map(), tiles = new Map();
  const mk = (t, side, i) => {
    const m = new Mesh(new RoundedBoxGeometry(T ? 1.9 : 2.3, 0.14, 0.95, 2, 0.05), tileM.clone()); m.position.set((side === 'L' ? -1 : 1) * (T ? 1.5 : 2.15), 0.34, zs[i]); m.castShadow = true; s.step.add(m);
    const el = s.label(tileHTML(t), { cls: 'wt-tile', obj: m, at: [0, 0.1, 0], onTap: () => pick(t.id, side) }); el.dataset.id = t.id; els.set(t.id, el); tiles.set(t.id, m);
  };
  st.left.forEach((t, i) => mk(t, 'L', i)); right.forEach((t, i) => mk(t, 'R', i));
  const missed = new Set(), done = new Set(); let sel = null;
  const partnerOf = id => (id.startsWith('L') ? st.pairs[id] : Object.keys(st.pairs).find(k => st.pairs[k] === id));
  const srcOf = lid => st.sourceIds?.[st.left.findIndex(l => l.id === lid)];
  const trail = (a, b, col, keep) => { // a skate trail carved across the ice
    const pa = tiles.get(a).position, pb = tiles.get(b).position, mid = pa.clone().lerp(pb, 0.5); mid.z += (pa.z === pb.z ? 0.9 : 0); mid.y = 0.3;
    const e = T ? 0.9 : 1.1, curve = new QuadraticBezierCurve3(new Vector3(pa.x + (pa.x < 0 ? e : -e), 0.3, pa.z), mid, new Vector3(pb.x + (pb.x < 0 ? e : -e), 0.3, pb.z));
    const geo = new TubeGeometry(curve, 40, 0.05, 6), m = new Mesh(geo, new MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95 })); s.step.add(m);
    const total = geo.index.count; geo.setDrawRange(0, 0); let t = 0;
    s.onTick(dt => { if (t > 1.5) return; t += dt; geo.setDrawRange(0, Math.floor(total * Math.min(1, t / 0.35))); if (!keep && t > 0.6) { m.material.opacity = Math.max(0, 1 - (t - 0.6) * 2.5); if (t > 1.0) m.visible = false; } });
  };
  const pick = (id, side) => {
    if (ctx.busy || done.has(id.startsWith('L') ? id : partnerOf(id))) return;
    if (!sel || sel.side === side) { if (sel) els.get(sel.id).classList.remove('sel'); sel = { id, side }; els.get(id).classList.add('sel'); ctx.sound('tap'); return; }
    const lid = side === 'L' ? id : sel.id, rid = side === 'R' ? id : sel.id;
    els.get(sel.id).classList.remove('sel'); sel = null;
    if (st.pairs[lid] === rid) {
      done.add(lid); trail(lid, rid, '#ffcf3c', true);
      for (const x of [lid, rid]) { els.get(x).classList.add('right'); els.get(x).classList.remove('show'); tiles.get(x).material.color.set((opts.matched || ['#9be0d8', '#a9c8f0', '#ffe6a8', '#f6c7dc'])[done.size % 4]); }
      ctx.item(srcOf(lid), !missed.has(lid)); A?.cheer(); ctx.sound('note', { freq: 523 + done.size * 110 }); K.burst(tiles.get(rid).position.clone().setY(0.6), undefined, 12, 1.4);
      if (done.size === st.left.length) { ctx.sound('capture'); ctx.finish(900); }
    } else {
      trail(lid, rid, '#e0707a', false); A?.oops();
      for (const x of [lid, rid]) { const el = els.get(x); el.classList.remove('wrong'); void el.offsetWidth; el.classList.add('wrong'); }
      if (!missed.has(lid)) { missed.add(lid); ctx.coach('Not that one. Look for the glowing match!'); }
      els.get(st.pairs[lid]).classList.add('show');
    }
  };
  ctx.onTimeUp(() => { for (const l of st.left) if (!done.has(l.id)) { done.add(l.id); ctx.item(srcOf(l.id), false); trail(l.id, st.pairs[l.id], '#9fb8d6', true); els.get(l.id).classList.add('right'); els.get(st.pairs[l.id]).classList.add('right'); } ctx.coach("Time's up! Here are the matches."); ctx.finish(1600); });
}

// ======================= the Admiral's Bell (Waterfront Park) =======================
export function bellStation(s, { color = '#f5b616' } = {}) {
  const K = stage(s, { ground: '#cfe3f3', top: '#86b4e0', mid: '#d6e7f7', fog: '#dbe9f6' }), { P, snowM } = K;
  const plank = L('#a5714f'), post = L('#6b4a32');
  // the pier, out onto the frozen Golden Horn
  for (let i = 0; i < 12; i++) { const b = new Mesh(new BoxGeometry(3.2, 0.12, 0.42), i % 2 ? plank : L('#b9845a')); b.position.set(0, 0.32, 4 - i * 0.48); b.receiveShadow = true; P.add(b); }
  for (const z of [3.8, 1.4, -1.0]) for (const x of [-1.65, 1.65]) { const p = new Mesh(new CylinderGeometry(0.1, 0.1, 1.2, 8), post); p.position.set(x, 0.5, z); P.add(p); const c = new Mesh(new SphereGeometry(0.11, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), snowM); c.position.set(x, 1.1, z); P.add(c); }
  // the bell on its frame at the end of the pier
  const frame = new Group(); frame.position.set(0, 0.38, -1.6); P.add(frame);
  for (const x of [-0.9, 0.9]) { const p = new Mesh(new BoxGeometry(0.2, 2.8, 0.2), post); p.position.set(x, 1.4, 0); p.castShadow = true; frame.add(p); }
  const beam = new Mesh(new BoxGeometry(2.2, 0.24, 0.3), post); beam.position.y = 2.8; frame.add(beam);
  const bsn = new Mesh(new BoxGeometry(2.3, 0.1, 0.36), snowM); bsn.position.y = 2.97; frame.add(bsn);
  const swing = new Group(); swing.position.y = 2.68; frame.add(swing);
  const gold = new MeshStandardMaterial({ color: '#f2c14e', roughness: 0.3, metalness: 0.45, side: DoubleSide });
  const cup = new Mesh(new CylinderGeometry(0.24, 0.55, 0.72, 20, 1, true), gold); cup.position.y = -0.45; cup.castShadow = true; swing.add(cup);
  const top = new Mesh(new SphereGeometry(0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), gold); top.position.y = -0.1; swing.add(top);
  const lip = new Mesh(new TorusGeometry(0.55, 0.05, 6, 20), gold); lip.rotation.x = Math.PI / 2; lip.position.y = -0.81; swing.add(lip);
  // a ferry and the far shore with a round tower
  const ferry = new Group(); ferry.position.set(-6.5, 0, -9); P.add(ferry);
  const hull = new Mesh(new BoxGeometry(4.2, 0.8, 1.4), L('#f4f7fb')); hull.position.y = 0.4; ferry.add(hull);
  const band = new Mesh(new BoxGeometry(4.25, 0.18, 1.45), L('#2d6fb5')); band.position.y = 0.55; ferry.add(band);
  const cabin = new Mesh(new BoxGeometry(2.4, 0.7, 1.1), L('#ffffff')); cabin.position.y = 1.15; ferry.add(cabin);
  const funnel = new Mesh(new CylinderGeometry(0.2, 0.24, 0.7, 10), L('#d9534f')); funnel.position.set(0.5, 1.85, 0); ferry.add(funnel);
  const tower = new Mesh(new CylinderGeometry(0.9, 1.0, 5, 16), L('#c9cfdf')); tower.position.set(6, 2.5, -16); P.add(tower);
  const tcone = new Mesh(new ConeGeometry(1.1, 1.8, 16), L('#7a86a8')); tcone.position.set(6, 5.9, -16); P.add(tcone);
  for (const [x, w, h] of [[-12, 4, 2], [-7, 3, 2.6], [0, 5, 1.8], [10, 4, 2.4], [13.5, 3, 1.6]]) { const hs = new Mesh(new BoxGeometry(w, h, 2), L('#b7c2da')); hs.position.set(x, h / 2, -17); P.add(hs); }
  const wave = bunting(P, { x0: -0.95, x1: 0.95, y: 2.9, sag: 0.0, z: -1.45, n: 7, colors: [color, '#ffffff', '#2d6fb5'] });
  const A = actor(s, P, { at: [-1.0, 0.38, 2.4], face: Math.PI - 0.35, scale: 0.7 });
  let t = 0, ringT = 0, gullT = 2.5;
  return {
    K, A, colors: [color, '#ffffff', '#ffd166', '#7cc4f0'], ring() { ringT = 1.6; },
    bellPos: () => new Vector3(0, 2.4, -1.6),
    tick: dt => { t += dt; K.tick(dt); A?.tick(dt); if ((gullT -= dt) <= 0) { gullT = 5 + Math.random() * 6; s.sound?.('gull'); } if (s.reduceMotion) return; wave(t); ferry.position.x = -6.5 + Math.sin(t * 0.15) * 0.6; if (ringT > 0) { ringT -= dt; swing.rotation.z = Math.sin(t * 10) * 0.5 * Math.min(1, ringT); } else swing.rotation.z *= 0.9; },
  };
}
// a simit: a sesame ring, golden brown
function simit() {
  const g = new Group();
  const ring = new Mesh(new TorusGeometry(0.13, 0.05, 10, 22), L('#c27a35')); ring.castShadow = true; g.add(ring);
  const top = new Mesh(new TorusGeometry(0.13, 0.042, 6, 22, Math.PI * 2), L('#a9622a')); top.position.z = 0.012; top.scale.set(1, 1, 0.6); g.add(top);
  for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, sd = new Mesh(new SphereGeometry(0.011, 4, 3), L('#f3e2b8')); sd.position.set(Math.cos(a) * (0.13 + (k % 2 ? 0.02 : -0.02)), Math.sin(a) * (0.13 + (k % 2 ? 0.02 : -0.02)), 0.05); g.add(sd); }
  return g;
}
export function bellListen(ctx) {
  const s = ctx.world, st = ctx.step, set = s.set, K = set.K, voice = ctx.speech.available, A = set.A;
  const T = tall(); frameFor(s, { eye: [0, 3.0, 10.6], look: [0, 1.9, 0] }, { eye: [0, 3.2, 11.6], look: [0, 1.8, 0] }, { eye: [0, 2.8, 9.6], look: [0, 2.6, 0.6], width: 38 });
  s.say(`${esc(st.prompt)} <span class="tr">Toss the simit to that gull!</span>${voice ? '' : ` <span class="tr">${esc(st.fallbackText || st.speak)}</span>`}`);
  const play = () => { set.ring(); ctx.sound('bell'); ctx.later(() => ctx.speech.say(st.speak), 250); };
  s.label('🔔 Hear it again', { cls: 'wt-bell', at: innerHeight < 430 ? [1.75, 2.55, -1.6] : T ? [0, 5.0, -1.6] : [0, 4.3, -1.6], onTap: play }); // high above the bell, clear of the gulls
  if (voice) ctx.later(play, 450); else ctx.note('No English voice on this device: read the word instead.');
  // the gulls hover over the pier, each with a word; you toss a simit to the right one
  const els = st.options.map((o, i) => s.label(st.pics?.[i] ? `<img src="${esc(st.pics[i])}" alt=""><span>${esc(o)}</span>` : esc(o), { cls: 'wt-opt gullsign', onTap: () => pick(i) }));
  const ws = els.map(el => sized(s, el, 1.7, 0.4)), xs = T ? st.options.map((o, i) => (i % 2 ? -0.95 : 0.95)) : row(ws, 0.7); // portrait: a zigzag from the right, clear of the kid
  const gulls = st.options.map((o, i) => {
    const g = gullGroup(1.9); g.position.set(xs[i], T ? 3.35 - i * 0.8 : 2.1 + (i % 2) * 0.25, 1.3); g.rotation.set(0.1, xs[i] > 0.1 ? -0.55 : xs[i] < -0.1 ? 0.55 : 0, 0); s.step.add(g);
    els[i]._pin.obj = g; els[i]._pin.at.set(0, -0.62, 0); s.keepClear(g.userData.body || g); // the word under its gull, never over it
    const ph = i * 1.3; g.userData.y0 = g.position.y;
    s.onTick(() => { if (g.userData.flying) return; const t = performance.now() / 1000; if (!s.reduceMotion) g.position.y = g.userData.y0 + Math.sin(t * 2 + ph) * 0.1; g.userData.flap(t * 9 + ph, s.reduceMotion ? 0.2 : 1); });
    return g;
  });
  const beakOf = g => g.userData.body.localToWorld(new Vector3(0, 0.1, 0.4)).sub(s.group.position);
  const toss = (i, done) => { // the kid throws a simit to gull i
    const sm = simit(), from = A ? A.hand() : new Vector3(0, 0.8, 3.4); sm.position.copy(from); s.step.add(sm); A?.throw();
    const to = beakOf(gulls[i]); s.fly(sm, [to.x, to.y, to.z], { T: 0.5, lift: 0.9, spin: 6, done: () => done(sm, to) });
  };
  const glow = i => els[i].classList.add('show');
  const pick = chooser(ctx, {
    answerText: st.options[st.answer], glow,
    onRight: i => {
      els[i].classList.add('right'); s.hush(els.filter((e, k) => k !== i)); ctx.later(() => s.hush([els[i]]), 450); // the words fade: watch the gull catch it and fly off
      toss(i, sm => { // caught! it flies up with the simit in its beak and gobbles it, then rings the bell
        const g = gulls[i]; g.userData.flying = true; ctx.sound('gull');
        s.step.remove(sm); g.userData.body.add(sm); sm.position.set(0, 0.09, 0.42); sm.rotation.set(Math.PI / 2, 0, 0); sm.scale.setScalar(0.55);
        const b = set.bellPos(); let t0 = 0;
        s.onTick(dt => { t0 += dt; g.userData.flap(t0 * 16, 1); if (t0 > 0.35) sm.scale.setScalar(Math.max(0.001, 0.55 * (1 - (t0 - 0.35) / 0.4))); });
        s.fly(g, [b.x + 0.55, b.y + 0.75, b.z + 0.4], { T: 0.8, lift: 0.9, done: () => { set.ring(); ctx.sound('bell'); K.burst(b); A?.cheer(); } });
        ctx.later(() => ctx.sound('pickup'), 500); // gulp
      });
    },
    onWrong: i => {
      els[i].classList.remove('wrong'); void els[i].offsetWidth; els[i].classList.add('wrong');
      toss(i, sm => { // it ducks; the simit bounces off and drops onto the pier
        s.wobble(gulls[i]); ctx.sound('gull'); A?.oops();
        s.fly(sm, [sm.position.x + 0.4, 0.47, Math.min(3.2, sm.position.z + 1.2)], { T: 0.45, lift: 0.3, spin: 3, done: () => { sm.rotation.set(-Math.PI / 2, 0, 0); } });
      });
    },
  });
}
