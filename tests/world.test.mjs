import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTileArena } from '../src/game/tilemap.mjs';

// Arena 1 (Kasımpaşa) is one purpose-built field (no real map, no real streets): the Kasımpaşa
// outpost, the Kızılay fountain at its centre and the neighbourhood's other four landmarks round
// it, framed by the look of the neighbourhood: a cobbled lane, snowed-in houses, buried roofs,
// lamps, trees, stalls.
const def = JSON.parse(readFileSync(new URL('../public/arenas/arena1.json', import.meta.url), 'utf8'));
const field = () => { const o = def.outposts[0]; return { id: o.id, i: o.i, j: o.j, ...o.arena }; };
const at = (f, d, v) => def.rows[f.j + d][f.i + v].replace(/[hr]/, 'a'); // the home spawn and rival camp marks are open snow; d rows south of the outpost centre, v columns east (cells d and v start at the centre's corner)

test('Arena 1: one outpost, Kasımpaşa, with the home spawn and the rivals\' camp; no real map', () => {
  const a = buildTileArena(def);
  assert.equal(a.world, true);
  const zones = a.places.filter(p => p.kind === 'zone'); assert.equal(zones.length, 1);
  assert.equal(zones[0].id, 'kasimpasa'); assert.equal(zones[0].label, 'Kasımpaşa'); assert.ok(zones[0].battlefield);
  assert.ok(a.places.find(p => p.kind === 'base')); assert.ok(a.places.find(p => p.kind === 'rivalBase'));
  assert.equal(a.schoolyard, null, 'no separate Showdown field: the Showdown is the outpost\'s last fight');
  assert.equal(def.credit, undefined, 'no map data, so no map credit');
  assert.equal(def.sledRuns.length + def.hills.length + def.signposts.length + def.scenery.length, 0);
});

test('the field is 22 × 34, mirrored left–right, with open ground and some cover', () => {
  const f = field();
  assert.equal(f.hw * 2, 22); assert.equal(f.front, 28); assert.equal(f.back, 6);
  for (let d = -f.back; d < f.front; d++) for (let v = 0; v < f.hw; v++) assert.equal(at(f, d, v), at(f, d, -1 - v), `mirrored at ${d},${v}`);
  for (const d of [f.front - 2, f.front - 3, 11]) assert.ok([...def.rows[f.j + d].slice(f.i - f.hw, f.i + f.hw)].filter(c => c === 'a').length >= 14, `row ${d} is open`);
  const cells = []; for (let d = -f.back; d < f.front; d++) for (let v = -f.hw; v < f.hw; v++) cells.push(at(f, d, v));
  const cover = cells.filter(c => '#wzBnb'.includes(c)).length / cells.length;
  assert.ok(cover > 0.06 && cover < 0.3, `cover ${cover.toFixed(2)}`);
});

test('the outpost is the Kızılay fountain, a solid 4×4 centrepiece in a round plaza at the north end; the other four places stand round the field', () => {
  const o = def.outposts[0];
  for (let j = o.j - 2; j < o.j + 2; j++) for (let i = o.i - 2; i < o.i + 2; i++) assert.equal(def.rows[j][i], 'O', 'core');
  assert.ok(def.landmarks.find(l => l.outpost === o.id && l.centre && l.type === 'fountain'));
  assert.equal(def.rows[o.j + 3][o.i], 'P', 'plaza');
  assert.ok(o.arena.back < o.arena.front / 3, 'the outpost is at the rivals\' end');
  const around = def.landmarks.filter(l => !l.centre && ['archers-lodge', 'snow-castle', 'treehouse', 'admiral'].includes(l.type));
  assert.deepEqual(around.map(l => l.outpost).sort(), ['archery', 'boulevard', 'sururi', 'waterfront']);
  const f = field();
  for (const l of around) { // outside the field, inside the frame the stage shows
    for (let j = l.j; j < l.j + l.h; j++) for (let i = l.i; i < l.i + l.w; i++) {
      const d = j + 0.5 - f.j, v = i + 0.5 - f.i;
      assert.ok(d < -f.back || d > f.front || Math.abs(v) > f.hw, `${l.type} is outside the field`);
      assert.ok(d > -f.back - 7 && d < f.front + 7 && Math.abs(v) < f.hw + 7, `${l.type} is in the frame`);
      assert.equal(def.rows[j][i], 'O');
    }
  }
});

test('the neighbourhood round the field: a lane with lamps, snowed-in houses, buried roofs and trees; stalls behind the home spawn', () => {
  const f = field();
  assert.ok('_l'.includes(at(f, -f.back - 3, 0)), 'a lane along the north');
  assert.ok('_l'.includes(at(f, 5, f.hw + 2)), 'a lane along the side');
  let houses = 0, roofs = 0, lamps = 0;
  for (let d = -f.back - 7; d < f.front + 7; d++) for (let v = -f.hw - 7; v < f.hw + 7; v++) { const c = at(f, d, v); if (c === 'H') houses++; if (c === 'R') roofs++; if (c === 'l') lamps++; }
  assert.ok(houses > 60 && roofs > 30 && lamps >= 12, `houses ${houses}, roofs ${roofs}, lamps ${lamps}`);
  const stalls = def.landmarks.filter(l => l.type === 'stall'); assert.ok(stalls.length >= 3);
  assert.ok(stalls.every(l => l.j > f.j + f.front && Math.abs(l.i - f.i) < f.hw + 2), 'stalls on the south lane');
});

test('nothing reaches the field from outside: void round the world', () => {
  assert.ok(def.rows.every(r => r[0] === '~' && r.at(-1) === '~'));
  assert.ok([...def.rows[0]].every(c => c === '~') && [...def.rows.at(-1)].every(c => c === '~'));
});
