// The Snow Castle as a 3D action (Sururi Park · Builder), on the real castle in the arena.
// The camera swoops to the castle's front. A wooden scaffold beam spans it with ghost bricks
// showing where the new course goes. Snow bricks carrying the sentence blocks lie on the snow in
// front: tap them in sentence order and each flies up onto the beam with a rising bell note.
// A wrong brick hops and wobbles back, and the right one glows. The finished sentence raises the
// castle's flag, then the course is lifted onto the castle wall, so the castle grows with every
// sentence of the visit. Spelling lays ice letters the same way.
import { Mesh, MeshLambertMaterial, MeshStandardMaterial, MeshBasicMaterial, BoxGeometry, CylinderGeometry, Shape, ShapeGeometry, LineSegments, EdgesGeometry, LineBasicMaterial, Color, DoubleSide } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { esc, shuffle, blockOrder } from './util.js';

const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1567.98, 1760, 1975.5, 2093];
const BEAM = { y: 2.15, z: 2.55, len: 5.0 }, PILE_Z = [4.1, 4.95], WALL = { y: 0, z: 3.25, span: 3.4, scale: 0.62 }; // WALL: the snow wall the finished courses build
const CAM = { eye: [0, 6.6, 12.6], look: [0, 1.25, 3.0] }, CAM_SHORT = { eye: [0, 7.9, 14.4], look: [0, 1.35, 3.5] }; // short (phone) screens see a little more

// the scaffold beam, its poles and the flag: built once per visit
function scaffold(s, color) {
  if (s.persist.userData.scaffold) return s.persist.userData.scaffold;
  const wood = new MeshLambertMaterial({ color: '#b9845a' }), dark = new MeshLambertMaterial({ color: '#8a5f3e' });
  const beam = new Mesh(new BoxGeometry(BEAM.len, 0.12, 0.34), wood); beam.position.set(0, BEAM.y, BEAM.z); beam.castShadow = true; s.persist.add(beam);
  for (const x of [-BEAM.len / 2 + 0.15, BEAM.len / 2 - 0.15]) { const p = new Mesh(new CylinderGeometry(0.06, 0.07, BEAM.y, 8), dark); p.position.set(x, BEAM.y / 2, BEAM.z); p.castShadow = true; s.persist.add(p); }
  const pole = new Mesh(new CylinderGeometry(0.035, 0.035, 1.5, 6), dark); pole.position.set(BEAM.len / 2 - 0.15, BEAM.y + 0.75, BEAM.z); s.persist.add(pole);
  const sh = new Shape(); sh.moveTo(0, 0); sh.lineTo(0.62, -0.19); sh.lineTo(0, -0.38); sh.closePath();
  const flag = new Mesh(new ShapeGeometry(sh), new MeshLambertMaterial({ color, side: DoubleSide })); flag.position.set(BEAM.len / 2 - 0.12, BEAM.y + 0.5, BEAM.z); s.persist.add(flag);
  s.persist.userData = { scaffold: { flag }, courses: 0 };
  return s.persist.userData.scaffold;
}

// one builder step in 3D: pieces (shuffled on the snow) go onto the beam in the expected order
function build3d(ctx, { kind, pieces, expected, sayAtEnd, revealText, revealTr, wrongCoach, caption }) {
  const s = ctx.world, ice = kind === 'spell';
  const { flag } = scaffold(s, ctx.worldColor || '#f3a6c8');
  const cam = innerHeight < 430 ? CAM_SHORT : CAM; s.frame(cam.eye, cam.look);
  flag.position.y = BEAM.y + 0.5; flag.rotation.y = 0;
  s.say(caption);
  // labels first, to size the bricks to their words
  const ppm = s.pxPerMeter(), H = ice ? 0.44 : 0.42, D = ice ? 0.44 : 0.36;
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
  let x = -total / 2; const slots = expected.map((e, i) => { const cx = x + ws[i] / 2; x += ws[i] + gap; return { x: cx, y: BEAM.y + 0.06 + H / 2, z: BEAM.z, w: ws[i] }; });
  const ghostMat = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, depthWrite: false }), edgeMat = new LineBasicMaterial({ color: '#7fb2db' });
  const ghosts = slots.map((sl, i) => {
    const g = new Mesh(new BoxGeometry(sl.w, H, D), ghostMat); g.position.set(sl.x, sl.y, sl.z); g.add(new LineSegments(new EdgesGeometry(g.geometry), edgeMat)); s.step.add(g);
    if (expected[i].given) { g.material = mat; s.label(esc(expected[i].text), { cls: 'wt-brick given ' + (ice ? 'ice' : 'snow'), obj: g, at: [0, 0, D / 2 + 0.02] }); }
    return g;
  });
  // the pile on the snow, in up to two rows
  const rows = [[], []]; let rw = 0;
  const pg = ice ? 0.16 : 0.3;
  for (const it of items) { const r = rw + it.w > 5.6 && rows[0].length ? 1 : 0; rows[r].push(it); if (!r) rw += it.w + pg; }
  rows.forEach((row, r) => { const tw = row.reduce((a, it) => a + it.w + pg, -pg); let px = -tw / 2; for (const it of row) { it.mesh.position.set(px + it.w / 2, H / 2 + 0.02, PILE_Z[r]); it.mesh.rotation.y = (ctx.rng() - 0.5) * 0.12; px += it.w + pg; } });

  let next = expected.findIndex(e => !e.given), tried = false, done = false;
  if (next < 0) next = expected.length;
  const glowNext = () => { const target = items.find(it => !it.used && it.p.key === expected[next]?.key); for (const it of items) { if (it.used) continue; const on = it === target; it.el.classList.toggle('show', on); it.mesh.material = on ? glowM : mat; } };
  const lay = (it, i) => {
    it.used = true; it.mesh.material = mat; it.el.classList.remove('show'); it.el.classList.add('placed'); it.el.disabled = true;
    it.mesh.rotation.y = 0;
    s.fly(it.mesh, [slots[i].x, slots[i].y, slots[i].z], { T: 0.5, lift: 1.3, spin: ice ? 0.6 : 0.15, done: () => { ghosts[i].visible = false; s.puff(it.mesh, 8); } });
  };
  const complete = right => {
    done = true; ctx.sound('capture');
    ctx.item(ctx.step.sourceIds?.[0], right);
    ctx.reveal(revealText, revealTr); if (sayAtEnd) ctx.speech.say(sayAtEnd);
    s.fly(flag, [flag.position.x, BEAM.y + 1.15, flag.position.z], { T: 0.7, lift: 0 });
    for (const it of items) if (it.used) { it.mesh.material = glowM; s.puff(it.mesh, 6, '#ffe7a0'); }
    // then the course goes down into a snow wall in front of the castle: it grows with every sentence
    ctx.later(() => {
      const k = s.persist.userData.courses++, sc = Math.min(WALL.scale, WALL.span / total);
      for (const it of items) { if (!it.used) continue; s.unlabel(it.el); it.mesh.material = mat; s.step.remove(it.mesh); s.persist.add(it.mesh); }
      const used = expected.map(e => items.find(it => it.used && it.p.key === e.key && !it.lifted)).filter(Boolean);
      let lx = -total * sc / 2;
      used.forEach(it => { it.lifted = true; const cx = lx + it.w * sc / 2; lx += (it.w + gap) * sc; it.mesh.scale.setScalar(sc); s.fly(it.mesh, [cx + (k % 2 ? 0.12 : 0), WALL.y + H * sc * (k + 0.5), WALL.z], { T: 0.55, lift: 0.5 }); });
    }, right ? 900 : 1300);
    ctx.finish(right ? 1800 : 2300);
  };
  const tap = it => {
    if (ctx.busy || done || it.used) return;
    if (it.p.key === expected[next].key) {
      ctx.sound('note', { freq: NOTES[Math.min(next, NOTES.length - 1)] });
      lay(it, next); next++;
      while (next < expected.length && expected[next].given) next++;
      if (tried) glowNext();
      if (next >= expected.length) ctx.later(() => complete(!tried), ctx.reduceMotion ? 50 : 560);
    } else {
      s.wobble(it.mesh); it.el.classList.remove('wrong'); void it.el.offsetWidth; it.el.classList.add('wrong'); ctx.sound('tap');
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
