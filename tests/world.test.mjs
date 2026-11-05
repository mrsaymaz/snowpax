import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTileArena } from '../src/game/tilemap.mjs';

// Arena 1 is six purpose-built stage fields (no real map, no real streets), each framed by the
// look of the neighbourhood: a cobbled lane, snowed-in houses, buried roofs, lamps, trees, stalls.
const def = JSON.parse(readFileSync(new URL('../public/arenas/arena1.json', import.meta.url), 'utf8'));
const OUTPOSTS = { boulevard: 'answer', archery: 'sort', kizilay: 'match', sururi: 'build', waterfront: 'listen' };
const fields = () => [...def.outposts.map(o => ({ id: o.id, i: o.i, j: o.j, ...o.arena })), { id: 'schoolyard', i: def.schoolyard.i, j: def.schoolyard.j, ...def.schoolyard.arena }];
const at = (f, d, v) => def.rows[f.j + d][f.i + v].replace(/[hr]/, 'a'); // the home spawn and rival camp marks are open snow; d rows south of the outpost centre, v columns east (cells d and v start at the centre's corner)

test('Arena 1: five outposts (one per task family), Our School and the rivals\' camp; no real map', () => {
  const a = buildTileArena(def);
  assert.equal(a.world, true);
  assert.deepEqual(Object.fromEntries(a.places.filter(p => p.kind === 'zone').map(z => [z.id, z.family])), OUTPOSTS);
  assert.ok(a.places.find(p => p.kind === 'base' && p.label === 'Our School'));
  assert.ok(a.places.find(p => p.kind === 'rivalBase'));
  assert.ok(a.schoolyard && a.schoolyard.battlefield, 'the Showdown has its field');
  assert.equal(def.credit, undefined, 'no map data, so no map credit');
  assert.equal(def.sledRuns.length + def.hills.length + def.signposts.length + def.scenery.length, 0);
});

test('six fields of 22 × 34 (the schoolyard 37, Our School behind its circle), mirrored left–right, with open ground and some cover', () => {
  const fs = fields(); assert.equal(fs.length, 6);
  for (const f of fs) {
    assert.equal(f.hw * 2, 22); assert.equal(f.front, 28); assert.ok(f.back === 6 || (f.id === 'schoolyard' && f.back === 9));
    for (let d = -f.back; d < f.front; d++) for (let v = 0; v < f.hw; v++) assert.equal(at(f, d, v), at(f, d, -1 - v), `${f.id}: mirrored at ${d},${v}`);
    for (const d of [f.front - 2, f.front - 3, 11]) assert.ok([...def.rows[f.j + d].slice(f.i - f.hw, f.i + f.hw)].filter(c => c === 'a').length >= 14, `${f.id}: row ${d} is open`);
    const cells = []; for (let d = -f.back; d < f.front; d++) for (let v = -f.hw; v < f.hw; v++) cells.push(at(f, d, v));
    const cover = cells.filter(c => '#wzBnb'.includes(c)).length / cells.length;
    assert.ok(cover > 0.06 && cover < 0.3, `${f.id}: cover ${cover.toFixed(2)}`);
  }
  // each field has its own layout
  const sig = fs.map(f => { let s = ''; for (let d = 0; d < f.front; d++) for (let v = 0; v < f.hw; v++) s += at(f, d, v); return s; });
  assert.equal(new Set(sig).size, 6);
});

test('each outpost is its landmark: a solid 4×4 centrepiece in a round plaza, at the north end of its field', () => {
  for (const o of def.outposts) {
    for (let j = o.j - 2; j < o.j + 2; j++) for (let i = o.i - 2; i < o.i + 2; i++) assert.equal(def.rows[j][i], 'O', `${o.id} core`);
    assert.ok(def.landmarks.find(l => l.outpost === o.id && l.centre && l.type === o.landmark));
    assert.equal(def.rows[o.j + 3][o.i], 'P', `${o.id}: plaza`);
    assert.ok(o.arena.back < o.arena.front / 3, `${o.id}: the outpost is at the rivals' end`);
  }
  assert.ok(def.rows[def.schoolyard.j - 7].includes('S'), 'Our School behind the Showdown circle');
});

test('the neighbourhood round each field: a lane with lamps, snowed-in houses, buried roofs and trees; stalls behind the home spawn; the frozen sea by the waterfront', () => {
  for (const f of fields()) {
    const lane = at(f, -f.back - 3, 0), side = at(f, 5, f.hw + 2);
    assert.ok('_l'.includes(lane) || f.id === 'waterfront', `${f.id}: a lane along the north`);
    assert.ok('_l'.includes(side), `${f.id}: a lane along the side`);
    assert.ok(['H', '.', 'T', 'v', 'y', 'x'].includes(at(f, 5, f.hw + 3)));
    let houses = 0, roofs = 0, lamps = 0;
    for (let d = -f.back - 7; d < f.front + 7; d++) for (let v = -f.hw - 7; v < f.hw + 7; v++) { const c = at(f, d, v); if (c === 'H') houses++; if (c === 'R') roofs++; if (c === 'l') lamps++; }
    assert.ok(houses > 60 && roofs > 30 && lamps >= 12, `${f.id}: houses ${houses}, roofs ${roofs}, lamps ${lamps}`);
    assert.ok(def.landmarks.filter(l => l.type === 'stall' && l.outpost === f.id).every(l => l.j > f.j + f.front), `${f.id}: stalls on the south lane`);
  }
  const wf = def.outposts.find(o => o.id === 'waterfront');
  assert.equal(def.rows[wf.j - wf.arena.back - 5][wf.i], 'W', 'the frozen Golden Horn north of the waterfront');
  assert.ok(def.landmarks.some(l => l.type === 'ferry') && def.landmarks.some(l => l.type === 'pier'));
});

test('nothing reaches a field from outside: the fields are apart, with nothing between them', () => {
  for (const f of fields()) {
    for (let d = -f.back - 7; d < f.front + 7; d++) for (const v of [-f.hw - 8, f.hw + 7]) assert.equal(at(f, d, v), '~', `${f.id}: a gap at ${d},${v}`);
  }
});
