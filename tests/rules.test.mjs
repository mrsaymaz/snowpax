import test from 'node:test';
import assert from 'node:assert/strict';
import { drawRivals, ensureUnit, startRun, recordItem, holdOutpost, finishFinal, nextRivalLine, noteMissed, missedMap } from '../src/rules/progress.mjs';
import { defaultSave } from '../src/save.mjs';
import { makeRng } from '../src/tasks/subtasks.mjs';
import { TEAM_IDS } from '../src/config.js';

test('rival draw: the three other teams, each once, never your own', () => {
  for (const team of TEAM_IDS) for (let s = 1; s < 30; s++) {
    const r = drawRivals(team, makeRng(s));
    assert.equal(r.length, 3);
    assert.equal(new Set(r).size, 3);
    assert.ok(!r.includes(team));
  }
});

test('rival draw: every order happens (no team is always first)', () => {
  const firsts = new Set();
  for (let s = 1; s < 200; s++) firsts.add(drawRivals('hufflepuff', makeRng(s))[0]);
  assert.equal(firsts.size, 3);
});

test('rival order is saved per unit and kept for retries; a new unit gets a new draw', () => {
  const save = { ...defaultSave(), team: 'ravenclaw' };
  const u = ensureUnit(save, 'g5u1', makeRng(1));
  const order = [...u.rivals];
  startRun(u, 0); finishFinal(u, 0, false);
  assert.deepEqual(ensureUnit(save, 'g5u1', makeRng(99)).rivals, order);
  const other = new Set();
  for (let s = 2; s < 20; s++) other.add(ensureUnit(save, 'g5u' + s, makeRng(s)).rivals.join());
  assert.ok(other.size > 1);
  assert.match(nextRivalLine(order, 1), /^Next rival: (Hufflepuff|Gryffindor|Ravenclaw|Slytherin) at the Golden Horn$/);
});

function play(u, arena, right, wrong, { sled = 0 } = {}) {
  startRun(u, arena);
  for (let i = 0; i < right; i++) recordItem(u, arena, { correctFirstTry: true });
  for (let i = 0; i < wrong; i++) recordItem(u, arena, { correctFirstTry: false });
  for (let i = 0; i < sled; i++) recordItem(u, arena, { correctFirstTry: false, practice: true });
}

test('80% rule: won with exactly 80% unlocks the next arena; 79% does not', () => {
  const save = { ...defaultSave(), team: 'gryffindor' };
  const u = ensureUnit(save, 'g6u1', makeRng(3));
  play(u, 0, 79, 21);
  let r = finishFinal(u, 0, true);
  assert.equal(r.passed, false);
  assert.equal(u.arenas[1].unlocked, false);
  assert.equal(r.message, 'Great battle! Get 80% right to unlock the Golden Horn.');
  play(u, 0, 8, 2);
  r = finishFinal(u, 0, true);
  assert.equal(r.passed, true);
  assert.equal(u.arenas[1].unlocked, true);
});

test('80% rule: sled-run spelling does not count', () => {
  const u = ensureUnit({ ...defaultSave(), team: 'slytherin', units: {} }, 'g7u1', makeRng(1));
  play(u, 0, 8, 2, { sled: 50 });
  assert.equal(finishFinal(u, 0, true).accuracy, 0.8);
});

test('a lost final battle keeps held outposts and asks only for the final again', () => {
  const u = ensureUnit({ ...defaultSave(), team: 'slytherin', units: {} }, 'g7u1', makeRng(1));
  play(u, 0, 10, 0);
  for (const f of ['match', 'answer', 'sort', 'build', 'listen']) holdOutpost(u, 0, f);
  const r = finishFinal(u, 0, false);
  assert.equal(r.retry, 'final');
  assert.equal(u.arenas[0].held.length, 5);
  assert.equal(u.arenas[1].unlocked, false);
  assert.equal(finishFinal(u, 0, true).passed, true);
});

test('winning all three arenas with 80% masters the unit', () => {
  const u = ensureUnit({ ...defaultSave(), team: 'hufflepuff', units: {} }, 'g8u1', makeRng(1));
  for (const a of [0, 1, 2]) { play(u, a, 9, 1); assert.equal(finishFinal(u, a, true).passed, true); }
  assert.equal(u.mastered, true);
  assert.throws(() => startRun(ensureUnit({ ...defaultSave(), team: 'hufflepuff', units: {} }, 'x', makeRng(1)), 1), /locked/);
});

test('missed items gain weight on a miss and fade after correct answers', () => {
  const u = { missed: {} };
  noteMissed(u, 'w1', false); noteMissed(u, 'w1', false);
  assert.equal(missedMap(u).get('w1'), 4);
  for (let i = 0; i < 4; i++) noteMissed(u, 'w1', true);
  assert.equal(missedMap(u).has('w1'), false);
});
