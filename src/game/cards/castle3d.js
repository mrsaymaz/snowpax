// The Snow Castle station (Sururi Park · Builder): the castle wall up close between two towers.
// Snow bricks carrying the sentence blocks lie on the snow: tap them in sentence order and each
// flies up onto the top of the wall with a rising bell note. A wrong brick hops and wobbles, and the
// right one glows. The finished sentence raises the castle's flag and stays on as a new course, so
// the castle grows taller with every sentence of the visit, and the camera rises with it.
// Spelling lays ice letters the same way.
import { Mesh, MeshLambertMaterial, MeshStandardMaterial, MeshBasicMaterial, BoxGeometry, CylinderGeometry, ConeGeometry, PlaneGeometry, SphereGeometry, TorusGeometry, Shape, ShapeGeometry, LineSegments, EdgesGeometry, LineBasicMaterial, Color, DoubleSide, HemisphereLight, DirectionalLight, CanvasTexture, SRGBColorSpace, RepeatWrapping, Fog, Points, PointsMaterial, BufferGeometry, Float32BufferAttribute, Group } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { stage, actor } from './stationkit.js';
import { esc, shuffle, blockOrder } from './util.js';

const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1567.98, 1760, 1975.5, 2093];
// the station layout: courses on top of the castle wall, which grows; the camera rises with it
const STATION = {
  prepare(s, ctx, H) {
    const set = s.set, k = set.courses, up = set.top - set.base;
    const a = innerWidth / innerHeight, d = a < 1.6 ? 1.12 : 1, cam = innerHeight < 430 ? { eye: [0, 5.0 + up * 0.7, 12.6 * d], look: [0, 1.45 + up * 0.7, 0.9] } : { eye: [0, 4.6 + up * 0.7, 12.2 * d], look: [0, 1.6 + up * 0.7, 0.9] };
    s.frame(cam.eye, cam.look);
    set.flag.position.y = set.flagLow + up;
    return { flag: set.flag, flagUp: set.flagTop + up, slotY: set.top, slotZ: -0.42, pileZ: [1.55, 2.75], rowMax: 9.2,
      keep(used, mat) { // the finished course stays: the wall is one course taller
        for (const it of used) { s.unlabel(it.el); it.mesh.material = mat; s.step.remove(it.mesh); s.persist.add(it.mesh); }
        set.courses = k + 1; set.top += H; set.raise(set.top);
      } };
  },
};

// one builder step in 3D: pieces (shuffled on the snow) go onto the beam in the expected order
function build3d(ctx, { kind, pieces, expected, sayAtEnd, revealText, revealTr, wrongCoach, caption }) {
  const s = ctx.world, ice = kind === 'spell', H = ice ? 0.44 : 0.42, D = ice ? 0.44 : 0.36;
  const L = STATION.prepare(s, ctx, H), { flag } = L;
  s.say(caption);
  // labels first, to size the bricks to their words
  const ppm = s.pxPerMeter();
  const mat = ice ? new MeshStandardMaterial({ color: '#c4ecff', roughness: 0.15, metalness: 0, transparent: true, opacity: 0.9, emissive: new Color('#2a6c9a'), emissiveIntensity: 0.12 })
    : new MeshLambertMaterial({ color: '#f7fbff', emissive: new Color('#000000') });
  const glowM = mat.clone(); glowM.emissive = new Color('#ffcf3c'); glowM.emissiveIntensity = 0.55;
  const items = shuffle(pieces, ctx.rng).map(p => {
    const el = s.label(esc(p.text), { cls: 'wt-brick ' + (ice ? 'ice' : 'snow'), onTap: () => tap(item) });
    const w = ice ? 0.44 : Math.max(0.55, s.measure(el).w / ppm + 0.16);
    const mesh = new Mesh(new RoundedBoxGeometry(w, H, D, 2, 0.06), mat); mesh.castShadow = true; s.step.add(mesh);
    el._pin.obj = mesh; el._pin.at.set(0, 0, D / 2 + 0.02);
    const item = { p, el, mesh, w, used: false }; return item;
  });
  // the course on the beam: ghost bricks, widths of the expected pieces
  const widthOf = e => (ice ? 0.44 : Math.max(0.55, items.find(it => it.p.key === e.key)?.w || 0.6));
  const ws = expected.map(widthOf), gap = 0.06, total = ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1);
  let x = -total / 2; const slots = expected.map((e, i) => { const cx = x + ws[i] / 2; x += ws[i] + gap; return { x: cx, y: L.slotY + H / 2, z: L.slotZ, w: ws[i] }; });
  const ghostMat = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, depthWrite: false }), edgeMat = new LineBasicMaterial({ color: '#7fb2db' });
  const ghosts = slots.map((sl, i) => {
    const g = new Mesh(new BoxGeometry(sl.w, H, D), ghostMat); g.position.set(sl.x, sl.y, sl.z); g.add(new LineSegments(new EdgesGeometry(g.geometry), edgeMat)); s.step.add(g);
    if (expected[i].given) { g.material = mat; s.label(esc(expected[i].text), { cls: 'wt-brick given ' + (ice ? 'ice' : 'snow'), obj: g, at: [0, 0, D / 2 + 0.02] }); }
    return g;
  });
  // the pile on the snow, in up to two rows
  const rows = [[], []]; let rw = 0;
  const pg = ice ? 0.16 : 0.3;
  for (const it of items) { const r = rw + it.w > L.rowMax && rows[0].length ? 1 : 0; rows[r].push(it); if (!r) rw += it.w + pg; }
  rows.forEach((row, r) => { const tw = row.reduce((a, it) => a + it.w + pg, -pg); let px = -tw / 2; for (const it of row) { it.mesh.position.set(px + it.w / 2, H / 2 + 0.02, L.pileZ[r]); it.mesh.rotation.y = (ctx.rng() - 0.5) * 0.12; px += it.w + pg; } });

  let next = expected.findIndex(e => !e.given), tried = false, done = false;
  if (next < 0) next = expected.length;
  const glowNext = () => { const target = items.find(it => !it.used && it.p.key === expected[next]?.key); for (const it of items) { if (it.used) continue; const on = it === target; it.el.classList.toggle('show', on); it.mesh.material = on ? glowM : mat; } };
  const lay = (it, i) => {
    it.used = true; it.mesh.material = mat; it.el.classList.remove('show'); it.el.classList.add('placed'); it.el.disabled = true;
    it.mesh.rotation.y = 0;
    s.fly(it.mesh, [slots[i].x, slots[i].y, slots[i].z], { T: 0.5, lift: 1.3, spin: ice ? 0.6 : 0.15, done: () => { ghosts[i].visible = false; s.puff(it.mesh, 8); } });
  };
  const complete = right => {
    done = true; ctx.sound('capture'); s.set?.A?.cheer();
    ctx.item(ctx.step.sourceIds?.[0], right);
    ctx.reveal(revealText, revealTr); if (sayAtEnd) ctx.speech.say(sayAtEnd);
    s.fly(flag, [flag.position.x, L.flagUp, flag.position.z], { T: 0.7, lift: 0 });
    for (const it of items) if (it.used) { it.mesh.material = glowM; s.puff(it.mesh, 6, '#ffe7a0'); }
    ctx.later(() => L.keep(items.filter(it => it.used), mat), right ? 900 : 1300); // the course stays on the wall
    ctx.finish(right ? 1800 : 2300);
  };
  const tap = it => {
    if (ctx.busy || done || it.used) return;
    if (it.p.key === expected[next].key) {
      ctx.sound('note', { freq: NOTES[Math.min(next, NOTES.length - 1)] }); s.set?.A?.throw();
      lay(it, next); next++;
      while (next < expected.length && expected[next].given) next++;
      if (tried) glowNext();
      if (next >= expected.length) ctx.later(() => complete(!tried), ctx.reduceMotion ? 50 : 560);
    } else {
      s.wobble(it.mesh); s.set?.A?.oops(); it.el.classList.remove('wrong'); void it.el.offsetWidth; it.el.classList.add('wrong'); ctx.sound('tap');
      if (!tried) { tried = true; ctx.coach(wrongCoach); }
      glowNext();
    }
  };
  ctx.onTimeUp(() => {
    if (done) return; tried = true;
    for (let i = next; i < expected.length; i++) { if (expected[i].given) continue; const it = items.find(o => !o.used && o.p.key === expected[i].key); if (it) lay(it, i); }
    next = expected.length; ctx.coach("Time's up! Here it is."); ctx.later(() => complete(false), 600);
  });
}

export function castleWorldOrder(ctx) {
  const st = ctx.step, key = b => b.text.trim().toLowerCase();
  build3d(ctx, {
    kind: 'order', pieces: st.blocks.map(b => ({ text: b.text, key: key(b) })), expected: blockOrder(st.blocks).map(b => ({ text: b.text, key: key(b) })),
    caption: `${esc(st.prompt || 'Build the sentence.')}${st.hintTr ? ` <span class="tr">${esc(st.hintTr)}</span>` : ''}`,
    sayAtEnd: st.text, revealText: st.text, revealTr: st.meaningTr,
    wrongCoach: 'Not that brick yet. Which block comes next? Look for the glowing one!',
  });
}
export function castleWorldSpell(ctx) {
  const st = ctx.step, ans = st.answerText, given = st.given || '';
  build3d(ctx, {
    kind: 'spell', pieces: st.tiles.map(t => ({ text: t, key: t.toLowerCase() })), expected: [...ans].map((ch, i) => ({ text: ch, key: ch.toLowerCase(), given: i < given.length })),
    caption: `Spell: <b ${st.promptLang === 'tr' ? 'lang="tr"' : ''}>${esc(st.prompt)}</b>`,
    sayAtEnd: ans, revealText: ans, revealTr: null,
    wrongCoach: 'Not that letter yet. The glowing ice block is next!',
  });
}

// ---------- the Snow Castle workshop: the staged set of the station ----------
function canvasTex(w, h, draw, repeat = null) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; if (repeat) { t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(...repeat); } return t; }

export function castleStation(s, { color = '#f5b616' } = {}) {
  const P = s.persist, scene = s.scene, base = 2.0;
  const K = stage(s), snowM = K.snowM; // sky, painted distance, light, sparkly snow, falling snow
  // the wall up close: snow bricks with soft blue mortar
  const brick = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#f4f8fe'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c9d9ee'; g.lineWidth = 4; for (let r = 0; r < 4; r++) { const y = r * h / 4; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let c = 0; c < 4; c++) { const x = c * w / 4 + (r % 2 ? w / 8 : 0); g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + h / 4); g.stroke(); } } }, [3.5, 2]);
  const wallM = new MeshLambertMaterial({ map: brick });
  const wall = new Mesh(new BoxGeometry(7.6, base, 1.2), [snowM, snowM, snowM, snowM, wallM, wallM]); wall.position.set(0, base / 2, -0.6); wall.castShadow = wall.receiveShadow = true; P.add(wall);
  const gs = new Shape(); gs.moveTo(-0.62, 0); gs.lineTo(-0.62, 0.95); gs.absarc(0, 0.95, 0.62, Math.PI, 0, true); gs.lineTo(0.62, 0); gs.closePath();
  const door = new Mesh(new ShapeGeometry(gs, 16), new MeshLambertMaterial({ color: '#34507a' })); door.position.set(0, 0, 0.02); P.add(door); // the gate
  const arch = new Mesh(new TorusGeometry(0.66, 0.1, 8, 20, Math.PI), new MeshStandardMaterial({ color: '#bfeeff', roughness: 0.2, emissive: new Color('#6fbfe8'), emissiveIntensity: 0.35 })); arch.position.set(0, 0.95, 0.06); P.add(arch);
  // two towers with bright roofs and glowing ice windows
  const ROOF = ['#7cc4f0', '#f3a6c8'];
  [-4.5, 4.5].forEach((x, k) => {
    const t = new Mesh(new CylinderGeometry(1.0, 1.08, 4.6, 20), wallM); t.position.set(x, 2.3, -0.5); t.castShadow = t.receiveShadow = true; P.add(t);
    const rim = new Mesh(new CylinderGeometry(1.16, 1.16, 0.28, 20), snowM); rim.position.set(x, 4.66, -0.5); P.add(rim);
    for (let m = 0; m < 10; m++) { const a = m / 10 * Math.PI * 2, mer = new Mesh(new BoxGeometry(0.3, 0.32, 0.3), snowM); mer.position.set(x + Math.sin(a) * 1.04, 4.95, -0.5 + Math.cos(a) * 1.04); mer.rotation.y = a; P.add(mer); }
    const roof = new Mesh(new ConeGeometry(1.25, 1.7, 20), new MeshLambertMaterial({ color: ROOF[k] })); roof.position.set(x, 5.95, -0.5); roof.castShadow = true; P.add(roof);
    const cap = new Mesh(new ConeGeometry(0.6, 0.6, 16), snowM); cap.position.set(x, 6.55, -0.5); P.add(cap);
    for (const y of [1.4, 3.2]) { const w = new Mesh(new PlaneGeometry(0.34, 0.5), new MeshBasicMaterial({ color: '#ffe3a0' })); w.position.set(x + (k ? -0.5 : 0.5), y, 0.36); w.rotation.y = k ? -0.5 : 0.5; P.add(w); }
  });
  // the flag on the right tower, in the team's colour
  const pole = new Mesh(new CylinderGeometry(0.04, 0.04, 2.2, 6), new MeshLambertMaterial({ color: '#6b4a32' })); pole.position.set(4.5, 7.6, -0.5); P.add(pole);
  const sh = new Shape(); sh.moveTo(0, 0); sh.lineTo(0.95, -0.28); sh.lineTo(0, -0.56); sh.closePath();
  const flag = new Mesh(new ShapeGeometry(sh), new MeshLambertMaterial({ color, side: DoubleSide })); flag.position.set(4.53, 7.4, -0.5); P.add(flag);
  // bunting between the towers
  const flagsG = new Group(); P.add(flagsG); const COLS = [color, '#ffffff', '#7cc4f0', '#f3a6c8'];
  for (let i = 0; i < 15; i++) { const u = i / 14, x = -3.6 + u * 7.2, y = 4.6 - Math.sin(u * Math.PI) * 0.55; const tri = new Shape(); tri.moveTo(-0.14, 0); tri.lineTo(0.14, 0); tri.lineTo(0, -0.3); tri.closePath(); const f = new Mesh(new ShapeGeometry(tri), new MeshLambertMaterial({ color: COLS[i % 4], side: DoubleSide })); f.position.set(x, y, 0.2); flagsG.add(f); }
  // snowy pines, mounds and a sled to frame it
  const pineM = new MeshLambertMaterial({ color: '#2f6f6a' });
  for (const [x, z, sc] of [[-7.2, -2.2, 1.3], [7.4, -2.6, 1.4], [-8.6, 0.8, 1.0], [8.8, 0.4, 1.1], [-5.8, -4.5, 1.2], [6.2, -5, 1.3], [0, -6, 1.5], [-2.8, -5.4, 1.1], [3.2, -5.8, 1.2]]) {
    for (let l = 0; l < 3; l++) { const c = new Mesh(new ConeGeometry((1.0 - l * 0.25) * sc, 1.3 * sc, 9), l === 2 ? snowM : pineM); c.position.set(x, (0.9 + l * 0.75) * sc, z); c.castShadow = true; P.add(c); }
  }
  for (const [x, z, r] of [[-5.6, 2.6, 1.0], [5.9, 2.9, 1.2], [-3.9, 4.4, 0.7], [4.4, 4.6, 0.8]]) { const m = new Mesh(new SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), snowM); m.position.set(x, 0, z); m.scale.y = 0.55; m.receiveShadow = true; P.add(m); }
  const sledW = new MeshLambertMaterial({ color: '#b9784a' }), sledR = new MeshLambertMaterial({ color: '#c8443c' });
  const sled = new Group(); sled.position.set(-5.3, 0, 1.4); sled.rotation.y = 0.5; P.add(sled);
  const plank = new Mesh(new BoxGeometry(0.9, 0.08, 1.6), sledW); plank.position.y = 0.26; plank.castShadow = true; sled.add(plank);
  for (const x of [-0.38, 0.38]) { const r = new Mesh(new BoxGeometry(0.06, 0.08, 1.8), sledR); r.position.set(x, 0.1, 0); sled.add(r); }
  for (const [x, z] of [[-0.2, -0.4], [0.2, -0.35], [0, 0.25]]) { const b = new Mesh(new RoundedBoxGeometry(0.42, 0.28, 0.3, 2, 0.05), snowM); b.position.set(x, 0.45, z); b.castShadow = true; sled.add(b); }
  const shovel = new Mesh(new BoxGeometry(0.34, 0.04, 0.42), new MeshLambertMaterial({ color: '#d9534f' })); shovel.position.set(5.2, 0.6, 1.6); shovel.rotation.set(-1.2, 0.4, 0); P.add(shovel);
  const A = actor(s, P, { at: [-3.1, 0, 3.5], face: Math.PI - 0.5 });
  let t = 0;
  const set = {
    base, top: base, courses: 0, flag, flagLow: 7.4, flagTop: 8.45,
    // the wall is taller: the towers stay, the wall's top course shows a fresh snow line
    raise() {},
    A, K, colors: [color, '#ffffff', '#ffd166', '#7cc4f0'],
    tick(dt) {
      t += dt; K.tick(dt); A?.tick(dt); if (s.reduceMotion) return;
      flagsG.children.forEach((f, i) => { f.rotation.x = Math.sin(t * 2.2 + i) * 0.25; });
      flag.rotation.y = Math.sin(t * 3) * 0.12;
    },
  };
  return set;
}
