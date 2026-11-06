import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Visit, stepItems, stepSeconds, cocoaQuestion, flakeWords, flatten } from '../src/game/visit.mjs';
import { makeRng } from '../src/tasks/subtasks.mjs';
import { createMatch } from '../src/game/match.mjs';
import { buildTileArena } from '../src/game/tilemap.mjs';
import { CONFIG } from '../src/config.js';

const unit = JSON.parse(readFileSync(new URL('../content/grade5.json', import.meta.url), 'utf8')).units.find(u => u.id === 'g5u1');
const def = JSON.parse(readFileSync(new URL('../public/arenas/arena1.json', import.meta.url), 'utf8'));
const FAMS = ['match', 'answer', 'sort', 'build', 'listen'];

test('a seize visit at every outpost asks two rounds of three items from the unit, then a one-round defend', () => {
  for (const family of FAMS) {
    const v = new Visit({ unit, family, rng: makeRng(4) });
    assert.equal(v.total, CONFIG.demand.itemsPerRound * CONFIG.demand.seizeRounds[0]);
    let steps = 0;
    while (!v.finished) { const st = v.next(); assert.ok(st, `${family} keeps giving steps`); assert.notEqual(st.kind, 'order-pair'); for (let k = 0; k < stepItems(st); k++) v.answer(k !== 0); steps++; assert.ok(steps < 20); }
    assert.equal(v.progress, 1); assert.ok(v.firstTry < v.done, 'misses are counted');
    v.setPhase('defend'); assert.equal(v.total, CONFIG.demand.itemsPerRound * CONFIG.demand.defendRounds[0]); assert.ok(v.next());
  }
});

test('rounds rotate sub-tasks so a family does not repeat itself', () => {
  const history = [], v = new Visit({ unit, family: 'build', rng: makeRng(9), history });
  while (!v.finished) { const st = v.next(); for (let k = 0; k < stepItems(st); k++) v.answer(true); }
  assert.equal(history.length, 2); assert.notEqual(history[0], history[1]);
});

test('Challenge timers scale with the step; order-pairs split into single sentences', () => {
  assert.ok(stepSeconds({ kind: 'match', left: [1, 2, 3] }) > stepSeconds({ kind: 'choice' }));
  assert.ok(stepSeconds({ kind: 'choice' }, 'relaxed') > stepSeconds({ kind: 'choice' }, 'challenge'));
  assert.equal(flatten([{ kind: 'order-pair', steps: [{ kind: 'order' }, { kind: 'order' }] }, { kind: 'choice' }]).length, 3);
});

test('a cocoa question is one choice from this unit; snowflake words come from the unit, missed words first', () => {
  const q = cocoaQuestion(unit, makeRng(2));
  assert.equal(q.kind, 'choice'); assert.ok(q.options.length >= 3 && q.answer >= 0 && q.answer < q.options.length);
  const missedId = unit.words[30].id, words = flakeWords(unit, 10, { [missedId]: 3 }, makeRng(1));
  assert.equal(words.length, 10); assert.equal(words[0].id, missedId);
  for (const w of words) assert.ok(unit.words.some(u => u.id === w.id && u.en === w.en && u.tr === w.tr));
});

test('the world has five cocoa cups at most, and plenty of snowflakes', () => {
  const kinds = def.pickups.map(p => p.kind);
  assert.ok(kinds.filter(k => k === 'cocoa').length <= 5 && kinds.filter(k => k === 'cocoa').length >= 3);
  assert.ok(kinds.filter(k => k === 'flake').length >= 25);
});

test('seizing by answers: a planted student is never frozen, rivals cannot take the circle meanwhile, a full bar captures', () => {
  const m = createMatch({ arena: buildTileArena(def), myTeam: 'hufflepuff', rivalTeam: 'gryffindor', rng: makeRng(3) });
  const sim = m.sim, P = m.player, z = sim.zones.find(q => q.id === 'kizilay'), rival = sim.chars.find(c => c.side === 'rival');
  P.x = z.x; P.z = z.z + z.r - 0.5; P.planted = true; z.seizing = true;
  rival.x = z.x + 1; rival.z = z.z + z.r - 0.6;
  for (let k = 0; k < 10; k++) sim.hit(P, { dmg: 30, owner: rival.id, kind: 'straight', vx: 1, vz: 0, x: P.x, z: P.z });
  assert.equal(P.frozen, 0); assert.ok(P.warmth >= 1);
  assert.ok(sim.drainEvents().some(e => e.type === 'plantedHit'));
  for (let t = 0; t < 12; t += 0.05) sim.step(0.05, new Map([['p1', { mx: 1 }]]));
  assert.equal(z.owner, null, 'rivals cannot seize while the student is answering');
  assert.ok(Math.abs(P.x - z.x) < 0.01, 'planted: the student stays put');
  sim.seizeProgress(z, 0.5); assert.equal(z.progress, 0.5);
  sim.capture(z, 'home'); assert.equal(z.owner, 'home'); assert.ok(sim.drainEvents().some(e => e.type === 'zoneCaptured' && e.side === 'home'));
  rival.x = z.x + 2; rival.z = z.z + 6; const n = sim.volley(P, z, 3); assert.equal(n, 3); assert.ok(sim.balls.length >= 3);
});

test('a camp child asks one of the unit\'s questions face to face: the model answer and two others as replies, never the same question twice in a camp', async () => {
  const { talkQuestion } = await import('../src/game/visit.mjs');
  const used = new Set(), rng = makeRng(8), seen = new Set();
  for (let k = 0; k < 6; k++) {
    const st = talkQuestion(unit, rng, used);
    assert.equal(st.kind, 'choice'); assert.ok(st.talk, 'a question from a person');
    assert.ok(st.options.length >= 2 && st.options.length <= 3); assert.equal(st.options[st.answer], st.answerText);
    assert.ok(!seen.has(st.prompt), 'not asked twice'); seen.add(st.prompt);
  }
  const none = talkQuestion({ ...unit, questions: [] }, rng);
  assert.equal(none.kind, 'choice', 'a unit without questions still gets a quick question');
});
