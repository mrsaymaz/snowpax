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

test('every stage prepares then fights; every outpost is taken in two halves ending with its own family, each family twice in the arena; opening waves are the rival team', () => {
  const count = {};
  for (const st of STAGES) {
    assert.ok(FIGHT_PLANS[st.fights], `${st.id} has a fight plan`);
    assert.ok(WAVES[st.id][0].kids >= 2, `${st.id}: the rival team opens`);
    if (st.final) continue;
    assert.equal(st.halves.length, 2); assert.equal(st.halves.at(-1), st.family, `${st.id}: its own family comes last`);
    assert.notEqual(st.halves[0], st.halves[1]);
    for (const f of st.halves) { assert.ok(FAMILY_STATION[f], `${f} has its own activity`); count[f] = (count[f] || 0) + 1; }
  }
  assert.deepEqual(Object.values(count).sort(), [2, 2, 2, 2, 2], 'each family twice');
  assert.deepEqual(STAGES.find(s => s.id === 'archery').halves, ['match', 'sort']);
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

test('recruits: camp children join one role each (3 at most); stars buy boosts in the Snow Shop; one-fight boosts are used up', async () => {
  const { Armoury, SHOP, ROLES, KID_NAMES } = await import('../src/game/fights.mjs');
  const P = FIGHT_PLANS.long;
  assert.ok(P.camp.kids.length >= 3 && P.recruits.max >= P.camp.kids.length && P.build >= 20);
  for (const [, , role] of P.camp.kids) assert.ok(ROLES[role], role);
  assert.ok(KID_NAMES.girl.length >= 3 && KID_NAMES.boy.length >= 3);
  const a = new Armoury(P.recruits);
  for (const [, , role] of P.camp.kids) assert.ok(a.join(role));
  assert.equal(a.join('builder'), false, 'the team is full');
  assert.equal(a.buyBoost('gloves'), false, 'no stars, no boost');
  a.earn(5);
  assert.ok(a.buyBoost('gloves')); assert.equal(a.stars, 5 - SHOP.boosts.gloves.cost); assert.equal(a.buyBoost('gloves'), false, 'gloves last the stage');
  assert.ok(a.buyBoost('coat'));
  const f1 = a.takeFight(), f2 = a.takeFight(); assert.ok(f1.has('coat') && !f2.has('coat') && f2.has('gloves'));
  assert.deepEqual(Object.keys(SHOP.boosts).sort(), ['coat', 'gloves', 'quick', 'super']);
});

test('a camp child waits on open ground; answering in reach asks the question; a recruit joins the home team, follows the student and fights; a warm coat takes the first hit', () => {
  const m = createMatch({ arena: buildTileArena(def), myTeam: 'hufflepuff', rivalTeam: 'gryffindor', rng: makeRng(5) });
  const z = m.sim.zones.find(q => q.id === 'archery'), P = FIGHT_PLANS.long, kid = m.player;
  const near = [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.6], [0, -0.6], [1, 0], [-1, 0], [0.8, 0.8], [-0.8, 0.8]];
  for (const f of [...m.sim.zones, { id: 'schoolyard', ...m.arena.schoolyard }]) for (const [v, d] of P.camp.kids) // every field: the planned spot or one close by is open
    assert.ok(near.some(([a, b]) => m.grid.freeCircle(f.x + v + a * Math.sign(v || 1), f.z + d + b, 0.5)), `${f.id}: camp child ${v},${d}`);
  for (const c of m.sim.chars) if (c !== kid) { c.benched = true; c.x = c.z = -999; }
  const [v, d, role] = P.camp.kids[0], spot = m.sim.addRecruitSpot({ id: 'k0', role, name: 'Elif', look: null, x: z.x + v, z: z.z + d });
  kid.x = spot.x; kid.z = spot.z + 0.5;
  let ev = []; for (let k = 0; k < 4; k++) { m.sim.step(0.05, new Map()); ev.push(...m.sim.drainEvents()); }
  assert.ok(ev.some(e => e.type === 'recruitAsk' && e.pickup === 'k0'));
  m.sim.removeRecruitSpot('k0'); assert.ok(!m.sim.pickups.some(p => p.kind === 'recruit'));
  const r = m.addRecruit({ kit: 'lobber', style: 'sniper', name: 'Elif', x: spot.x, z: spot.z });
  assert.equal(r.side, 'home'); assert.equal(r.team, 'hufflepuff'); assert.equal(r.kit, 'lobber'); assert.ok(r.recruit);
  assert.ok(m.bots.has(r.seat), 'a bot drives the recruit (a seat a classmate could take one day)');
  kid.x = z.x; kid.z = z.z + 20; for (let k = 0; k < 80; k++) m.step(0.05, {});
  assert.ok(Math.hypot(r.x - kid.x, r.z - kid.z) < 5, 'the recruit follows the student');
  m.clearRecruits(); assert.ok(!m.sim.chars.includes(r) && !m.bots.has(r.seat), 'recruits leave at the end of the stage');
  kid.coat = 1; const w = kid.warmth; m.sim.hit(kid, { dmg: 30, owner: -1, kind: 'straight', vx: 1, vz: 0, x: kid.x, z: kid.z });
  assert.equal(kid.warmth, w, 'a warm coat takes the first hit'); assert.equal(kid.coat, 0);
});
