import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTileArena } from '../src/game/tilemap.mjs';

// One purpose-built field per arena (no real map, no real streets): Arena 1 Kasımpaşa (a carousel
// with its five places riding round a ship's mast), Arena 2 the Golden Horn (a model of the Golden
// Horn with the great chain, its five places along the shores), each framed by the look of the
// neighbourhood: a cobbled lane, snowed-in houses, buried roofs, lamps, trees, stalls.
const def = JSON.parse(readFileSync(new URL('../public/arenas/arena1.json', import.meta.url), 'utf8'));
const fields = () => def.outposts.map(o => ({ id: o.id, i: o.i, j: o.j, ...o.arena }));
const at = (f, d, v) => def.rows[f.j + d][f.i + v].replace(/[hr]/, 'a'); // the home spawn and rival camp marks are open snow; d rows south of the outpost centre, v columns east (cells d and v start at the centre's corner)

test('one outpost per arena: Kasımpaşa, the Golden Horn and Downtown, with the home spawn and the rivals\' camp; no real map', () => {
  const a = buildTileArena(def);
  assert.equal(a.world, true);
  const zones = a.places.filter(p => p.kind === 'zone');
  assert.deepEqual(zones.map(z => [z.id, z.label]), [['kasimpasa', 'Kasımpaşa'], ['golden-horn', 'The Golden Horn'], ['downtown', 'Downtown']]); assert.ok(zones.every(z => z.battlefield));
  assert.ok(a.places.find(p => p.kind === 'base')); assert.ok(a.places.find(p => p.kind === 'rivalBase'));
  assert.equal(a.schoolyard, null, 'no separate Showdown field: the Showdown is the outpost\'s last fight');
  assert.equal(def.credit, undefined, 'no map data, so no map credit');
  assert.equal(def.sledRuns.length + def.hills.length + def.signposts.length + def.scenery.length, 0);
});

test('each field is 22 × 34, mirrored left–right, with open ground and some cover, its own layout', () => {
  const sig = [];
  for (const f of fields()) {
  assert.equal(f.hw * 2, 22); assert.equal(f.front, 28); assert.equal(f.back, 6);
  for (let d = -f.back; d < f.front; d++) for (let v = 0; v < f.hw; v++) assert.equal(at(f, d, v), at(f, d, -1 - v), `mirrored at ${d},${v}`);
  for (const d of [f.front - 2, f.front - 3, 11]) assert.ok([...def.rows[f.j + d].slice(f.i - f.hw, f.i + f.hw)].filter(c => c === 'a').length >= 14, `row ${d} is open`);
  const cells = []; for (let d = -f.back; d < f.front; d++) for (let v = -f.hw; v < f.hw; v++) cells.push(at(f, d, v));
  const cover = cells.filter(c => '#wzBnb'.includes(c)).length / cells.length;
  assert.ok(cover > 0.06 && cover < 0.3, `cover ${cover.toFixed(2)}`); sig.push(cells.join(''));
  }
  assert.equal(new Set(sig).size, sig.length, 'every field has its own layout');
});

test('each outpost is a round solid core in a plaza at the north end, the five places\' landmarks on it in the order their tasks are played', () => {
  const want = { kasimpasa: ['carousel', ['treehouse', 'archers-lodge', 'fountain', 'snow-castle', 'admiral']], 'golden-horn': ['golden-horn', ['karakoy', 'bankalar', 'tersane', 'aynalikavak', 'miniaturk']], downtown: ['tram', ['galata-tower', 'istiklal', 'taksim', 'cihangir', 'tophane']] };
  for (const o of def.outposts) {
  const f = fields().find(q => q.id === o.id);
  const lm = def.landmarks.find(l => l.outpost === o.id && l.centre); assert.equal(lm.type, want[o.id][0]);
  assert.deepEqual(lm.seats, want[o.id][1]);
  for (let dj = -3; dj < 3; dj++) for (let di = -3; di < 3; di++) { const r = Math.hypot(dj + 0.5, di + 0.5), c = def.rows[o.j + dj][o.i + di]; if (r <= 3.1) assert.equal(c, 'O', `core ${di},${dj}`); else assert.notEqual(c, 'O'); }
  assert.equal(def.rows[o.j + 3][o.i], 'P', 'plaza'); assert.ok(o.r > 4, 'the circle goes round the carousel');
  assert.ok(o.arena.back < o.arena.front / 3, 'the outpost is at the rivals\' end');
  assert.ok(f.back >= 6);
  }
  assert.ok(def.landmarks.filter(l => !l.centre).every(l => ['stall', 'ferry', 'pier'].includes(l.type)), 'round the fields only stalls (and the ferry and pier on the Golden Horn\'s ice)');
});

test('the neighbourhood round each field: a lane with lamps, snowed-in houses, buried roofs and trees; stalls behind the home spawn', () => {
  for (const f of fields()) {
  assert.ok('_l'.includes(at(f, -f.back - 3, 0)) || f.id === 'golden-horn', 'a lane along the north (the Golden Horn has its frozen water there)');
  assert.ok('_l'.includes(at(f, 5, f.hw + 2)), 'a lane along the side');
  let houses = 0, roofs = 0, lamps = 0;
  for (let d = -f.back - 7; d < f.front + 7; d++) for (let v = -f.hw - 7; v < f.hw + 7; v++) { const c = at(f, d, v); if (c === 'H') houses++; if (c === 'R') roofs++; if (c === 'l') lamps++; }
  assert.ok(houses > 60 && roofs > 30 && lamps >= 12, `houses ${houses}, roofs ${roofs}, lamps ${lamps}`);
  const stalls = def.landmarks.filter(l => l.type === 'stall' && Math.abs(l.i - f.i) < f.hw + 2 && Math.abs(l.j - f.j) < 40); assert.ok(stalls.length >= 3);
  assert.ok(stalls.every(l => l.j > f.j + f.front), 'stalls on the south lane');
  }
});

test('nothing reaches the field from outside: void round the world', () => {
  assert.ok(def.rows.every(r => r[0] === '~' && r.at(-1) === '~'));
  assert.ok([...def.rows[0]].every(c => c === '~') && [...def.rows.at(-1)].every(c => c === '~'));
});
