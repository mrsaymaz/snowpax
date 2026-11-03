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
  const cells = def.rows.join('');
  const count = s => [...cells].filter(c => s.includes(c)).length;
  const land = cells.length - count('W');
  assert.ok(count('H') < 200, `visible house cells: ${count('H')}`);
  assert.ok(count('R') < 300, `buried roofs: ${count('R')}`);
  assert.ok(count('._=+dcq') / land > 0.75, 'open snow and paths cover most of the land');
});

test('places of worship and the cemetery are quiet scenery: no outpost near them', () => {
  const a = buildTileArena(def);
  for (const z of a.places.filter(p => p.kind === 'zone')) {
    const i = Math.floor(z.x - a.x0), j = Math.floor(z.z - a.z0);
    for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) assert.ok(!'QCq+'.includes(def.rows[j + dj]?.[i + di] ?? '.'), `${z.id} is clear of quiet zones`);
  }
});
