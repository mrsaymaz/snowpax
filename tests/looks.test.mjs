import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { teamGenders, assignLooks, playerLook, HAIR_STYLES } from '../src/game/looks.mjs';
import { createMatch } from '../src/game/match.mjs';
import { buildTileArena } from '../src/game/tilemap.mjs';
import { makeRng } from '../src/tasks/subtasks.mjs';

const def = JSON.parse(readFileSync(new URL('../public/arenas/arena1.json', import.meta.url), 'utf8'));
const mixed = list => list.includes('girl') && list.includes('boy');

test('every team of two or more has girls and boys, whatever the player picks', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const rng = makeRng(seed);
    for (const n of [2, 3, 4, 5]) { assert.ok(mixed(teamGenders(n, rng)), `n=${n} seed=${seed}`); for (const g of ['girl', 'boy']) { const t = teamGenders(n, rng, g); assert.equal(t[0], g); assert.ok(mixed(t)); } }
  }
});

test('a match gives both teams girls and boys, and the player keeps their own look', () => {
  for (let seed = 1; seed <= 20; seed++) for (const gender of ['girl', 'boy']) {
    const look = playerLook({ gender }, makeRng(seed));
    const m = createMatch({ arena: buildTileArena(def), myTeam: 'hufflepuff', rivalTeam: 'gryffindor', rng: makeRng(seed), playerLook: look });
    assert.deepEqual(m.player.look, look);
    for (const side of ['home', 'rival']) {
      const team = m.sim.chars.filter(c => c.side === side && c.role !== 'minion');
      assert.equal(team.length, 3); assert.ok(mixed(team.map(c => c.look.gender)), `${side} seed=${seed}`);
      for (const c of team) assert.ok(HAIR_STYLES[c.look.gender].includes(c.look.style));
    }
  }
});

test('saved looks are checked and filled in', () => {
  const l = playerLook({ gender: 'girl', skin: 99, style: 'curly' }, makeRng(3));
  assert.equal(l.gender, 'girl'); assert.ok(l.skin >= 0 && l.skin < 5); assert.ok(HAIR_STYLES.girl.includes(l.style));
  assert.ok(['girl', 'boy'].includes(playerLook(null, makeRng(4)).gender));
  const seats = assignLooks([{ side: 'a', team: 't', role: 'mate' }, { side: 'a', team: 't', role: 'mate', look: { gender: 'boy', skin: 1, hair: 1, style: 'short' } }], makeRng(5));
  assert.equal(seats[0].look.gender, 'girl');
});
