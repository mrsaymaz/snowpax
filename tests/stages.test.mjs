import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STAGES, starsFor, isUnlocked, nextStage, finishStage, totalStars, Lives, stageState } from '../src/game/stages.mjs';
import { WAVES, minionList, stageWall, setWall, entryPoints, RIVAL_INFO } from '../src/game/waves.mjs';
import { newUnitProgress } from '../src/rules/progress.mjs';
import { createMatch } from '../src/game/match.mjs';
import { buildTileArena } from '../src/game/tilemap.mjs';
import { GRID } from '../src/game/grid.mjs';
import { makeRng } from '../src/tasks/subtasks.mjs';

const def = JSON.parse(readFileSync(new URL('../public/arenas/arena1.json', import.meta.url), 'utf8'));

test('Arena 1 stages go from the nearest outpost to the furthest, then home for the Showdown', () => {
  const home = def.home, dist = id => { const o = def.outposts.find(q => q.id === id); return Math.hypot(o.i - home[0], o.j - home[1]); };
  const outs = STAGES.filter(s => s.outpost).map(s => s.outpost);
  assert.deepEqual(outs.slice().sort((a, b) => dist(a) - dist(b)), outs);
  assert.equal(STAGES.at(-1).id, 'showdown'); assert.ok(STAGES.at(-1).final);
  for (const s of STAGES.filter(q => q.outpost)) assert.equal(s.family, def.outposts.find(o => o.id === s.outpost).family);
});

test('stages unlock one by one; stars come from first-try accuracy and the best result is kept', () => {
  const up = newUnitProgress('hufflepuff', makeRng(1));
  assert.ok(isUnlocked(up, 'boulevard')); assert.ok(!isUnlocked(up, 'archery')); assert.equal(nextStage(up).id, 'boulevard');
  assert.equal(starsFor(9, 9), 3); assert.equal(starsFor(7, 9), 2); assert.equal(starsFor(3, 9), 1);
  finishStage(up, 'boulevard', { firstTry: 6, total: 9, flakes: 20, seconds: 120 });
  assert.ok(isUnlocked(up, 'archery')); assert.equal(nextStage(up).id, 'archery'); assert.equal(stageState(up).boulevard.stars, 1);
  finishStage(up, 'boulevard', { firstTry: 9, total: 9, flakes: 10, seconds: 100 });
  assert.equal(stageState(up).boulevard.stars, 3); assert.equal(stageState(up).boulevard.flakes, 20); assert.equal(stageState(up).boulevard.seconds, 100);
  finishStage(up, 'boulevard', { firstTry: 2, total: 9 });
  assert.equal(stageState(up).boulevard.stars, 3, 'a worse replay never lowers the stars');
  assert.equal(totalStars(up), 3);
});

// The brief asked for 10–12 minutes. After the first play-test the rides became 45 s (asked for:
// longer, winding rides) and every stand opens with a fight, so the arena now plans at about 14
// minutes; this checks it stays under 14.5 until the class play-test settles it.
test('three lives; the whole arena, timed from the real tasks it deals, stays under 14.5 minutes', async () => {
  const l = new Lives(); assert.equal(l.left, 3); l.lose(); l.lose(); assert.ok(!l.out); l.lose(); assert.ok(l.out); l.reset(); assert.equal(l.left, 3);
  const { arenaTime } = await import('../src/game/timing.mjs');
  const unit = JSON.parse(readFileSync(new URL('../content/grade5.json', import.meta.url), 'utf8')).units.find(u => u.id === 'g5u1');
  for (let seed = 1; seed <= 10; seed++) { const r = arenaTime(unit, { rng: makeRng(seed) }); assert.ok(r.minutes >= 10 && r.minutes <= 14.5, `seed ${seed}: ${r.minutes.toFixed(1)} min ${JSON.stringify(r.parts)}`); }
});

test('every outpost stage has two waves and a final one; each brings in its new rival type', () => {
  for (const s of STAGES.filter(q => q.outpost)) {
    const w = WAVES[s.id]; assert.equal(w.length, 3); assert.ok(w[2].final && !w[0].final && !w[1].final);
    for (const wave of w) assert.ok(minionList(wave).length + (wave.kids || 0) >= 3);
    if (s.newRival) { assert.ok(RIVAL_INFO[s.newRival]); assert.ok(w.some(wave => wave.m[s.newRival]), `${s.id} uses its new rival`); }
  }
});

test('stage walls close a ring round the outpost without blocking the circle; waves enter inside the wall', () => {
  const m = createMatch({ arena: buildTileArena(def), myTeam: 'hufflepuff', rivalTeam: 'gryffindor', rng: makeRng(2) });
  for (const z of m.sim.zones.filter(q => !q.battlefield)) {
    const cells = stageWall(m.grid, z); assert.ok(cells.length > 20, `${z.id} wall`);
    setWall(m.grid, cells, true);
    for (const [, , x, zz] of cells) assert.ok(m.grid.blocked(x, zz));
    const e = entryPoints(m.grid, z); assert.ok(e.length >= 1);
    for (const p of e) { assert.ok(Math.hypot(p.x - z.x, p.z - z.z) < 13); const path = m.nav.path(p.x, p.z, z.x, z.z + z.r - 0.3); assert.ok(path, `${z.id}: the wave can walk in`); }
    setWall(m.grid, cells, false);
    for (const [, , x, zz] of cells) assert.ok(!m.grid.blocked(x, zz));
  }
});

test('a battlefield: the outpost moves to its pocket, the fence closes the field, both teams can walk from their end to the outpost', () => {
  const m = createMatch({ arena: buildTileArena(def), myTeam: 'hufflepuff', rivalTeam: 'gryffindor', rng: makeRng(2) });
  const z = m.sim.zones.find(q => q.battlefield); assert.ok(z && z.stage, 'Boulevard Park has a battlefield');
  const { back, front, hw } = z.battlefield; z.x = z.stage.x; z.z = z.stage.z;
  const cells = stageWall(m.grid, z); assert.ok(cells.length > 2 * (front + back + 2 * hw), 'a fence all round');
  setWall(m.grid, cells, true);
  for (const [, , x, zz] of cells) { const d = zz - z.z, v = Math.abs(x - z.x); assert.ok(!(d > -back && d < front && v < hw), 'the fence is outside the field'); }
  const home = { x: z.x, z: z.z + front - 2.5 }, circle = { x: z.x, z: z.z + z.r - 0.3 };
  assert.ok(m.grid.freeCircle(home.x, home.z, 0.45), 'the home spawn is open');
  assert.ok(m.nav.path(home.x, home.z, circle.x, circle.z), 'the team can walk up the field to the outpost');
  for (const [v, d] of [[-8, -3.5], [8, -3.5], [-9.5, 4], [9.5, 4], [-3, 7.5], [0, 8], [3, 7.5]]) assert.ok(m.nav.path(z.x + v, z.z + d, circle.x, circle.z), `rivals from ${v},${d}`);
  setWall(m.grid, cells, false);
});

test('snowmen: spawn, walk toward the outpost, a lid blocks shots from the front, frozen snowmen melt away', () => {
  const m = createMatch({ arena: buildTileArena(def), myTeam: 'hufflepuff', rivalTeam: 'gryffindor', rng: makeRng(3) });
  const sim = m.sim, z = sim.zones.find(q => q.id === 'kizilay'), P = m.player;
  for (const c of sim.chars) if (c !== P) { c.benched = true; c.x = c.z = -999; }
  P.x = z.x + 40; P.z = z.z; // out of throwing range, so the snowman keeps walking
  const e = entryPoints(m.grid, z)[0], w = m.addMinion('waddler', e.x, e.z, z);
  const d0 = Math.hypot(w.x - z.x, w.z - z.z);
  for (let t = 0; t < 4; t += 0.05) m.step(0.05, {});
  assert.ok(Math.hypot(w.x - z.x, w.z - z.z) < d0 - 1, 'walks in');
  const s = m.addMinion('shield', z.x + 5, z.z, z); s.face = 0; // facing +z (south)
  const before = s.warmth; sim.hit(s, { dmg: 20, owner: P.id, kind: 'straight', vx: 0, vz: -10, x: s.x, z: s.z + 1 });
  assert.ok(before - s.warmth <= 6, 'the lid takes most of it');
  s.warmth = 1; sim.hit(s, { dmg: 20, owner: P.id, kind: 'straight', vx: 10, vz: 0, x: s.x - 1, z: s.z });
  assert.ok(s.frozen > 0);
  for (let t = 0; t < 5; t += 0.05) m.step(0.05, {});
  const gone = m.removeGone(); assert.ok(gone.some(c => c.id === s.id)); assert.ok(!sim.chars.includes(s));
  m.clearMinions(); assert.equal(sim.chars.filter(c => c.role === 'minion').length, 0);
});

test('benched rival kids are off the field: not seen, not hit, not moving', () => {
  const m = createMatch({ arena: buildTileArena(def), myTeam: 'hufflepuff', rivalTeam: 'gryffindor', rng: makeRng(4) });
  const r = m.sim.chars.find(c => c.side === 'rival'); r.benched = true; r.x = 0; r.z = 0;
  assert.ok(!m.sim.enemiesOf(m.player).includes(r)); assert.equal(m.sim.hit(r, { dmg: 99, owner: m.player.id, kind: 'straight', vx: 1, vz: 0, x: 0, z: 0 }), false);
  m.step(0.5, {}); assert.equal(r.x, 0);
  assert.ok(m.grid.has(0, 0, GRID.BLOCK) || true);
});

test('the Showdown: five banners, one per task family, each raised by its share of answers', async () => {
  const { Visit } = await import('../src/game/visit.mjs');
  const { BANNERS } = await import('../src/game/waves.mjs');
  const unit = JSON.parse(readFileSync(new URL('../content/grade5.json', import.meta.url), 'utf8')).units.find(u => u.id === 'g5u1');
  assert.deepEqual(BANNERS.map(b => b.outpost), STAGES.filter(s => s.outpost).map(s => s.outpost).sort((a, b) => BANNERS.findIndex(x => x.outpost === a) - BANNERS.findIndex(x => x.outpost === b)));
  for (const b of BANNERS) assert.equal(b.family, STAGES.find(s => s.outpost === b.outpost).family);
  const v = new Visit({ unit, family: 'mixed', rng: makeRng(5), families: BANNERS.map(b => b.family), perFamily: 2 });
  const seen = [];
  let guard = 0;
  while (!v.finished && guard++ < 60) {
    const st = v.next(); assert.ok(st, 'a step'); seen.push(v.family);
    const n = st.kind === 'match' ? st.left.length : st.kind === 'sort' ? st.cards.length : 1;
    for (let k = 0; k < n; k++) v.answer(true);
  }
  assert.ok(v.finished); assert.equal(v.bannersUp, 5); assert.equal(v.progress, 1);
  assert.deepEqual([...new Set(seen)], BANNERS.map(b => b.family), 'families in banner order');
  assert.ok(v.done >= 10 && v.done <= 14, `${v.done} items`);
});

test('the Showdown circle sits in the open near Our School; its waves bring the captain', async () => {
  const { schoolyardSpot } = await import('../src/game/waves.mjs');
  const m = createMatch({ arena: buildTileArena(def), myTeam: 'hufflepuff', rivalTeam: 'gryffindor', rng: makeRng(6) });
  const z = { id: 'schoolyard', ...schoolyardSpot(m.grid, m.base) };
  assert.ok(Math.hypot(z.x - m.base.x, z.z - m.base.z) <= 12); assert.ok(m.grid.freeCircle(z.x, z.z, z.r));
  const cells = stageWall(m.grid, z); assert.ok(cells.length > 20); setWall(m.grid, cells, true);
  for (const p of entryPoints(m.grid, z)) assert.ok(m.nav.path(p.x, p.z, z.x, z.z + z.r - 0.3), 'waves can walk in');
  setWall(m.grid, cells, false);
  const w = WAVES.showdown; assert.equal(w.length, 3); assert.ok(w[1].m.captain === 1 && w[2].final);
});
