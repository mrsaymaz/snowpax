import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FIGHT_PLANS, WordHunt, huntWords, supplySpot, FAMILY_STATION } from '../src/game/fights.mjs';
import { Visit } from '../src/game/visit.mjs';
import { STAGES } from '../src/game/stages.mjs';
import { WAVES } from '../src/game/waves.mjs';
import { createMatch } from '../src/game/match.mjs';
import { buildTileArena } from '../src/game/tilemap.mjs';
import { makeRng } from '../src/tasks/subtasks.mjs';
import { CONFIG } from '../src/config.js';

const unit = JSON.parse(readFileSync(new URL('../content/grade5.json', import.meta.url), 'utf8')).units.find(u => u.id === 'g5u1');
const def = JSON.parse(readFileSync(new URL('../public/arenas/arena1.json', import.meta.url), 'utf8'));

test('Archery Ground is taken in two halves (Matching, then Sorting) with the long fights; its opening wave is the rival team', () => {
  const st = STAGES.find(s => s.id === 'archery');
  assert.deepEqual(st.halves, ['match', 'sort']); assert.ok(FIGHT_PLANS[st.fights]);
  assert.equal(st.halves.at(-1), st.family, 'the outpost\'s own family comes last');
  assert.ok(WAVES.archery[0].kids >= 2);
  for (const f of st.halves) assert.ok(FAMILY_STATION[f], `${f} has its own activity`);
  const P = FIGHT_PLANS.long;
  assert.ok(P.open.goal >= 10 && P.open.max >= 60 && P.strike.seconds >= 40 && P.final >= 20, 'fights last a while');
});

test('a two-half visit: one round of each family; the bar is at half after the first', () => {
  const v = new Visit({ unit, family: 'sort', rng: makeRng(4), families: ['match', 'sort'], perFamily: CONFIG.demand.itemsPerRound });
  const seen = [];
  let halfAt = null;
  for (let k = 0; k < 40 && !v.finished; k++) {
    const st = v.next(); if (!st) break; seen.push(v.family);
    const n = st.kind === 'match' ? st.left.length : st.kind === 'sort' ? st.cards.length : 1;
    for (let i = 0; i < n; i++) v.answer(true);
    if (halfAt === null && v.famIdx === 0 && v.famDone >= v.perFamily) halfAt = v.progress;
  }
  assert.ok(v.finished); assert.equal(halfAt, 0.5);
  assert.deepEqual([...new Set(seen)], ['match', 'sort']);
});

test('word snowmen: a target with distractors, right and wrong freezes, missed words come back', () => {
  const words = huntWords(unit); assert.ok(words.length >= 10);
  for (const w of words) assert.ok(w.en.length <= 12 && w.tr);
  const h = new WordHunt(unit, makeRng(2), 3);
  const a = h.next(); assert.equal(a.words.length, 3); assert.ok(a.words.includes(a.target));
  assert.equal(new Set(a.words.map(w => w.tr)).size, 3, 'no two words mean the same');
  const wrong = a.words.find(w => w !== a.target);
  assert.equal(h.frozen(wrong), 'wrong'); assert.equal(h.frozen(a.target), 'right'); assert.equal(h.frozen(a.target), null, 'a won hunt is over');
  assert.equal(h.right, 0, 'right only on the first try');
  const b = h.next(); assert.notEqual(b.target.id, a.target.id, 'not the same word straight away');
  assert.equal(h.timeout().id, b.target.id);
  assert.ok(h.missed.get(a.target.id) >= 1 && h.missed.get(b.target.id) >= 1);
  const c = h.next(); assert.equal(h.frozen(c.target), 'right'); assert.equal(h.right, 1);
});

test('supply crates land on open ground in the field; walking onto one asks a question; a right answer refills the team', () => {
  const m = createMatch({ arena: buildTileArena(def), myTeam: 'hufflepuff', rivalTeam: 'gryffindor', rng: makeRng(5) });
  const z = m.sim.zones.find(q => q.id === 'archery'), rng = makeRng(9);
  for (let k = 0; k < 20; k++) {
    const s = supplySpot(m.grid, z, rng); assert.ok(s);
    assert.ok(m.grid.freeCircle(s.x, s.z, 0.6)); assert.ok(Math.abs(s.x - z.x) < z.battlefield.hw && s.z > z.z + 5 && s.z < z.z + z.battlefield.front);
  }
  const P = m.player, s = supplySpot(m.grid, z, rng);
  for (const c of m.sim.chars) if (c !== P) { c.x = c.z = -999; c.benched = true; }
  const p = m.sim.dropSupply(s.x, s.z); P.x = s.x; P.z = s.z;
  let ev = []; for (let k = 0; k < 4; k++) { m.sim.step(0.05, new Map()); ev.push(...m.sim.drainEvents()); }
  assert.ok(ev.some(e => e.type === 'supplyAsk' && e.pickup === p.id));
  P.ammo = 0; P.super = 0; m.sim.supplyResult(p.id, P, true);
  assert.equal(P.ammo, CONFIG.fight.ammoMax); assert.ok(P.super > 0.4);
  assert.ok(!m.sim.pickups.some(q => q.id === p.id), 'the crate is used up');
  const q = m.sim.dropSupply(s.x, s.z); P.ammo = 0; m.sim.supplyResult(q.id, P, false); assert.equal(P.ammo, 1, 'a wrong answer still gives a snowball');
});
