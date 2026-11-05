import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTileArena } from '../src/game/tilemap.mjs';
import { createMatch } from '../src/game/match.mjs';
import { makeRng } from '../src/tasks/subtasks.mjs';

const def = JSON.parse(readFileSync(new URL('../public/arenas/arena1.json', import.meta.url), 'utf8'));
const OUTPOSTS = { boulevard: 'answer', archery: 'sort', kizilay: 'match', waterfront: 'listen', sururi: 'build' };

test('Arena 1 world: five outposts (one per task family), Our School and the rivals\' camp', () => {
  const a = buildTileArena(def);
  assert.equal(a.world, true);
  const zones = a.places.filter(p => p.kind === 'zone');
  assert.deepEqual(Object.fromEntries(zones.map(z => [z.id, z.family])), OUTPOSTS);
  assert.ok(a.places.find(p => p.kind === 'base' && p.label === 'Our School'));
  assert.ok(a.places.find(p => p.kind === 'rivalBase'));
  assert.equal(def.credit, '© OpenStreetMap contributors');
});

test('every outpost has its landmark next to it', () => {
  for (const o of def.outposts) {
    const lm = def.landmarks.find(l => l.type === o.landmark && l.outpost === o.id);
    assert.ok(lm, `${o.id} has a ${o.landmark}`);
  }
});

test('every outpost and the rivals\' camp can be walked to from Our School', () => {
  const m = createMatch({ arena: buildTileArena(def), myTeam: 'hufflepuff', rivalTeam: 'gryffindor', pace: 'relaxed', rng: makeRng(1) });
  const home = m.base;
  for (const p of m.sim.zones.concat([m.rivalBase])) {
    const path = m.nav.path(home.x, home.z, p.x, p.z + 4);
    assert.ok(path && path.length, `path to ${p.id || 'rival camp'}`);
  }
});

test('the town is mostly under the snow: open snow and paths, only a few houses and roofs showing', () => {
  const cells = def.rows.slice(0, def.town?.h ?? def.h).join(''); // the town (the battlefield pockets below it are not town)
  const count = s => [...cells].filter(c => s.includes(c)).length;
  const land = cells.length - count('W');
  assert.ok(count('H') < 200, `visible house cells: ${count('H')}`);
  assert.ok(count('R') < 300, `buried roofs: ${count('R')}`);
  assert.ok(count('._=+dcqusBPa') / land > 0.75, 'open snow, paths and squares cover most of the land');
});

test('places of worship and the cemetery are quiet scenery: no outpost near them', () => {
  const a = buildTileArena(def);
  for (const z of a.places.filter(p => p.kind === 'zone')) {
    const i = Math.floor(z.x - a.x0), j = Math.floor(z.z - a.z0);
    for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) assert.ok(!'QCq+'.includes(def.rows[j + dj]?.[i + di] ?? '.'), `${z.id} is clear of quiet zones`);
  }
});

test('street lamps line the paths, a simit cart stands at Kızılay Square, the pier reaches the ice', () => {
  const cells = def.rows.join('');
  const lamps = [...cells].filter(c => c === 'l').length;
  assert.ok(lamps >= 30 && lamps <= 120, `street lamps: ${lamps}`);
  assert.ok(def.landmarks.find(l => l.type === 'simit-cart' && l.outpost === 'kizilay'));
  const pier = def.landmarks.find(l => l.type === 'pier');
  const at = (i, j) => def.rows[j]?.[i] ?? 'X';
  let touchesPlaza = false, overIce = false;
  for (let j = pier.j - 1; j <= pier.j + pier.h; j++) for (let i = pier.i - 1; i <= pier.i + pier.w; i++) { if (at(i, j) === 'P') touchesPlaza = true; if (at(i, j) === 'W') overIce = true; }
  assert.ok(touchesPlaza && overIce, 'the pier runs from the plaza out over the frozen sea');
});

test('each outpost is its landmark: a solid 4×4 centrepiece in a round plaza; fingerposts point the way', () => {
  for (const o of def.outposts) {
    for (let j = o.j - 2; j < o.j + 2; j++) for (let i = o.i - 2; i < o.i + 2; i++) assert.equal(def.rows[j][i], 'O', `${o.id} core`);
    assert.ok(def.landmarks.find(l => l.outpost === o.id && l.centre && l.type === o.landmark));
  }
  assert.ok(def.signposts.length >= 8);
  for (const sp of def.signposts) { assert.equal(def.rows[sp.j][sp.i], 'k'); assert.ok(sp.arrows.length >= 1 && sp.arrows.every(a => typeof a.label === 'string' && Number.isFinite(a.ang))); }
  const trees = [...def.rows.join('')].filter(c => 'tTvyx'.includes(c)).length;
  assert.ok(trees > 100, `trees: ${trees}`);
});

test('battlefields: a 22 × 34 field in its own pocket, the rivals\' outpost at the north end, the home spawn at the south end, mirrored left–right', () => {
  const ops = def.outposts.filter(o => o.arena);
  assert.ok(ops.length >= 1);
  for (const o of ops) {
    const { back, front, hw } = o.arena, { i: pi, j: pj } = o.stage;
    assert.equal(hw * 2, 22); assert.equal(back + front, 34);
    assert.ok(pj - back >= def.town.h, `${o.id}: the pocket is below the town`);
    const at = (d, v) => def.rows[pj + d][pi + v];
    for (let d = -back; d < front; d++) for (let v = 0; v < hw; v++) assert.equal(at(d, v), at(d, -1 - v), `${o.id}: mirrored at ${d},${v}`);
    assert.equal(at(-1, -1), 'O', `${o.id}: the outpost core at the centre`);
    assert.ok(def.landmarks.some(l => l.stage === o.id && l.centre), `${o.id}: the landmark is copied into the pocket`);
    // open ground: the spawn rows and a row of the middle are free across most of the width
    for (const d of [front - 2, front - 3, 11]) assert.ok([...def.rows[pj + d].slice(pi - hw, pi + hw)].filter(c => c === 'a').length >= 16, `${o.id}: row ${d} is open`);
    const cells = []; for (let d = -back; d < front; d++) for (let v = -hw; v < hw; v++) cells.push(at(d, v));
    const cover = cells.filter(c => '#wzB'.includes(c)).length / cells.length;
    assert.ok(cover > 0.08 && cover < 0.3, `${o.id}: cover ${cover.toFixed(2)}`);
    for (const c of cells) assert.ok(!'QqCM'.includes(c), 'no place of worship or cemetery in a field');
  }
});
