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

test('the outpost prepares then fights; its opening wave is the rival team; the fights last a while', () => {
  for (const st of STAGES) {
    assert.ok(FIGHT_PLANS[st.fights], `${st.id} has a fight plan`);
    assert.ok(WAVES[st.id][0].kids >= 2, `${st.id}: the rival team opens`);
  }
  const P = FIGHT_PLANS.long;
  assert.ok(P.open.goal >= 10 && P.open.max >= 60 && P.strike.seconds >= 40, 'fights last a while');
  assert.ok(P.showdown.seconds >= 60 && P.showdown.captainWarmth > 1 && P.showdown.retryItems >= 3, 'the Final Showdown is the hardest fight, and can be tried again');
});

test('the two parts: Part 1 is two places\' tasks, Part 2 three; the bar is at two fifths after Part 1', () => {
  const parts = STAGES[0].parts, P = FIGHT_PLANS.long;
  const v = new Visit({ unit, family: 'match', rng: makeRng(4), families: parts.flat(), perFamily: P.perFamily });
  const seen = []; let partAt = null, part1 = 0;
  for (let k = 0; k < 80 && !v.finished; k++) {
    const st = v.next(); if (!st) break; seen.push(v.family);
    const n = st.kind === 'match' ? st.left.length : st.kind === 'sort' ? st.cards.length : 1;
    for (let i = 0; i < n; i++) v.answer(true);
    if (partAt === null && v.famIdx === parts[0].length - 1 && v.famDone >= v.perFamily) { partAt = v.progress; part1 = v.done; }
  }
  assert.ok(v.finished); assert.equal(partAt, 0.4);
  assert.deepEqual([...new Set(seen)], parts.flat());
  assert.ok(part1 >= 2 * P.perFamily && v.done - part1 >= 3 * P.perFamily, `Part 1 ${part1} items, Part 2 ${v.done - part1}`);
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

test('word snowmen: the targets go round the whole unit before any comes again; a missed word comes back once', () => {
  const words = huntWords(unit), h = new WordHunt(unit, makeRng(4), 3), seen = [];
  for (let k = 0; k < words.length; k++) { const x = h.next(); seen.push(x.target.id); h.frozen(x.target); }
  assert.equal(new Set(seen).size, words.length, 'every word once before any repeats');
  const m = h.next(); h.timeout(); const later = []; for (let k = 0; k < 8; k++) { const x = h.next(); later.push(x.target.id); h.frozen(x.target); }
  assert.equal(later.filter(id => id === m.target.id).length, 1, 'the missed word comes back once, not again and again');
  assert.ok(later.indexOf(m.target.id) >= 2, 'a few hunts later');
});

test('supply crates land on open ground in the field; walking onto one asks a question; a right answer refills the team', () => {
  const m = createMatch({ arena: buildTileArena(def), myTeam: 'hufflepuff', rivalTeam: 'gryffindor', rng: makeRng(5) });
  const z = m.sim.zones[0], rng = makeRng(9);
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

// The economy: the sled ride (rare word snowflakes) and the camp pay for one boost at the first
// shop, Part 1 for one more if it went well, Part 2 for two more: the English decides the
// Final Showdown.
test('recruits: camp children join one role each (3 at most); ❄ buy boosts (5 each, kept for the outpost); the sled and camp pay for one, Part 1 one more, Part 2 two more', async () => {
  const { Armoury, SHOP, ROLES, KID_NAMES } = await import('../src/game/fights.mjs');
  const P = FIGHT_PLANS.long;
  assert.ok(P.camp.kids.length >= 3 && P.recruits.max >= P.camp.kids.length && P.build >= 20);
  for (const [, , role] of P.camp.kids) assert.ok(ROLES[role], role);
  assert.ok(KID_NAMES.girl.length >= 3 && KID_NAMES.boy.length >= 3);
  const a = new Armoury(P.recruits);
  for (const [, , role] of P.camp.kids) assert.ok(a.join(role));
  assert.equal(a.join('builder'), false, 'the team is full');
  assert.equal(a.buyBoost('gloves'), false, 'no snowflakes, no boost');
  a.earn(5);
  assert.ok(a.buyBoost('gloves')); assert.equal(a.flakes, 0); assert.equal(a.buyBoost('gloves'), false, 'gloves last the outpost');
  a.earn(5); assert.ok(a.buyBoost('coat'));
  const f1 = a.takeFight(), f2 = a.takeFight(); assert.ok(f1.has('coat') && f2.has('coat') && f2.has('gloves'), 'every boost lasts every fight');
  assert.deepEqual(Object.keys(SHOP.boosts).sort(), ['coat', 'gloves', 'quick', 'super']);
  const costs = Object.values(SHOP.boosts).map(b => b.cost); assert.ok(costs.every(c => c === costs[0]), 'every boost costs the same');
  assert.ok(Object.values(SHOP.boosts).every(b => b.keep && !/⭐|★/.test(b.icon)), 'all kept; no star icons (★ is only the stage rating)');
  // the economy, from the stage's numbers
  const st = STAGES[0], price = costs[0], start = st.ride.flakes + (st.ride.spell ? 1 : 0) + P.camp.kids.length;
  assert.ok(start >= price && start < 2 * price, `sled + camp at most ${start} ❄: one boost at the first shop`);
  const part1 = st.parts[0].length * P.perFamily, part2 = st.parts[1].length * P.perFamily;
  assert.ok(Math.round(part1 * 0.8) >= price - 1 && part1 < 2 * price, `Part 1 (${part1} items) at 80% pays about one boost`);
  assert.ok(Math.round(part2 * 0.8) + 1 >= 2 * price - 1 && part2 < 3 * price, `Part 2 (${part2} items) at 80% pays about two`);
});

test('a camp child waits on open ground; answering in reach asks the question; a recruit joins the home team, follows the student and fights; a warm coat takes the first hit', () => {
  const m = createMatch({ arena: buildTileArena(def), myTeam: 'hufflepuff', rivalTeam: 'gryffindor', rng: makeRng(5) });
  const z = m.sim.zones[0], P = FIGHT_PLANS.long, kid = m.player;
  const near = [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.6], [0, -0.6], [1, 0], [-1, 0], [0.8, 0.8], [-0.8, 0.8]];
  for (const f of m.sim.zones) for (const [v, d] of P.camp.kids) // the field: the planned spot or one close by is open
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
