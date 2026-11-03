import test from 'node:test';
import assert from 'node:assert/strict';
import { SUBTASKS, FAMILIES, makeRng, makeRound, usableSubtasks, choose, wordsCompatible, needFor, norm } from '../src/tasks/subtasks.mjs';
import { validateStep } from '../src/tasks/validate.mjs';
import { numberWords } from '../src/tasks/numbers.mjs';
import { fits, wrapLines } from '../src/tasks/layout.mjs';
import { unit, allUnits, unitItemIds } from './helpers.mjs';

const g5u1 = unit(5, 'g5u1');

test('there are 23 sub-tasks in 5 families, with the brief\'s arena thresholds', () => {
  assert.equal(SUBTASKS.length, 23);
  assert.deepEqual(FAMILIES.map(f => f.id), ['match', 'answer', 'sort', 'build', 'listen']);
  const min = Object.fromEntries(SUBTASKS.map(s => [s.id, s.minArena]));
  assert.deepEqual(min, { A1: 1, A2: 1, A3: 2, A4: 2, A5: 2, A6: 3, A7: 3, B8: 1, B9: 1, B10: 2, B11: 2, B12: 3, B13: 3, B14: 3, C15: 1, C16: 2, C17: 2, C18: 3, D19: 1, D20: 1, E21: 1, E22: 2, E23: 2 });
});

test('items needed per visit grow with the arena (2, 3, 4 seize rounds + 1 defend)', () => {
  assert.deepEqual([1, 2, 3].map(needFor), [9, 12, 15]);
});

test('every sub-task builds valid rounds of 3 items from the selected unit only', () => {
  const ids = unitItemIds(g5u1);
  for (const s of SUBTASKS) {
    if (s.id === 'A4') continue; // g5u1 has no numbers
    const arena = Math.max(1, s.minArena);
    for (let seed = 1; seed <= 5; seed++) {
      const round = s.round(g5u1, arena, { rng: makeRng(seed) });
      assert.ok(round, `${s.id} should fill a round`);
      const items = round.reduce((n, st) => n + (st.items || 1), 0);
      assert.ok(items >= 3, `${s.id} round has ${items} items`);
      for (const st of round) {
        assert.deepEqual(validateStep(st), [], `${s.id} step problems`);
        for (const id of st.sourceIds) {
          const base = id.includes(':') ? null : id; // category cards use "category:word" ids
          if (base) assert.ok(ids.has(base), `${s.id} used ${id}, which is not in g5u1`);
        }
      }
    }
  }
});

test('category cards come from this unit\'s own categories', () => {
  const words = new Set(g5u1.categories.flatMap(c => c.yes.map(norm)));
  for (let seed = 1; seed < 20; seed++) {
    const [step] = SUBTASKS.find(s => s.id === 'C15').round(g5u1, 1, { rng: makeRng(seed) });
    for (const c of step.cards) assert.ok(words.has(norm(c.text)));
  }
});

test('numbers only appear in units that teach them, in British English', () => {
  assert.equal(numberWords(0), 'zero');
  assert.equal(numberWords(40), 'forty');
  assert.equal(numberWords(21), 'twenty-one');
  assert.equal(numberWords(112), 'one hundred and twelve');
  assert.equal(numberWords(200), 'two hundred');
  assert.throws(() => numberWords(201));
  const a4 = SUBTASKS.find(s => s.id === 'A4');
  assert.equal(a4.round(g5u1, 2, { rng: makeRng(1) }), null);
  const g5u2 = unit(5, 'g5u2');
  const [board] = a4.round(g5u2, 2, { rng: makeRng(1) });
  for (const l of board.left) { const n = Number(l.text); assert.ok(n >= g5u2.numbers.min && n <= g5u2.numbers.max); }
});

test('boards never put two words with the same meaning, picture or sound together', () => {
  assert.equal(wordsCompatible({ en: 'pupil', tr: 'öğrenci' }, { en: 'student', tr: 'öğrenci' }), false);
  assert.equal(wordsCompatible({ en: 'sea', tr: 'deniz' }, { en: 'see', tr: 'görmek' }), false);
  assert.equal(wordsCompatible({ en: 'bag', tr: 'çanta', pic: 'p/1.webp' }, { en: 'schoolbag', tr: 'okul çantası', pic: 'p/1.webp' }), false);
  assert.equal(wordsCompatible({ en: 'library', tr: 'kütüphane' }, { en: 'canteen', tr: 'kantin' }), true);
});

test('missed items come back first', () => {
  const pool = Array.from({ length: 30 }, (_, i) => ({ id: 'w' + i }));
  const missed = new Map([['w17', 2], ['w4', 1]]);
  for (let seed = 1; seed < 10; seed++) {
    const picked = choose(pool, 3, { rng: makeRng(seed), missed });
    assert.ok(picked.some(x => x.id === 'w17') && picked.some(x => x.id === 'w4'));
  }
});

test('outposts rotate sub-tasks and skip speech tasks when there is no English voice', () => {
  const history = [];
  for (let i = 0; i < 6; i++) {
    const r = makeRound(g5u1, 'answer', 1, { rng: makeRng(i + 1), history });
    history.push(r.subtask);
  }
  assert.deepEqual(new Set(history), new Set(['B8', 'B9']), 'the Answer outpost alternates its sub-tasks');
  assert.notEqual(history[0], history[1]);
  for (let i = 0; i < 5; i++) {
    const r = makeRound(g5u1, 'listen', 2, { rng: makeRng(i + 1), speech: false });
    assert.equal(r.subtask, 'E23', 'without a voice, the written-instructions task runs');
  }
  const r = makeRound(g5u1, 'match', 3, { rng: makeRng(9), speech: false, history: ['A1', 'A2', 'A3', 'A5', 'A6'] });
  assert.notEqual(r.subtask, 'A7');
});

test('arena 1 builder sentences have 3 blocks; arena 3 has 5–6 blocks or two sentences', () => {
  const d19 = SUBTASKS.find(s => s.id === 'D19');
  for (const st of d19.round(g5u1, 1, { rng: makeRng(3) })) assert.equal(st.blocks.length, 3);
  for (const st of d19.round(g5u1, 3, { rng: makeRng(3) })) {
    if (st.kind === 'order') assert.ok(st.blocks.length >= 5);
    else { assert.equal(st.kind, 'order-pair'); assert.equal(st.steps.length, 2); }
  }
});

test('spelling gives the first letter in arenas 1–2 and not in arena 3', () => {
  const d20 = SUBTASKS.find(s => s.id === 'D20');
  assert.ok(d20.round(g5u1, 1, { rng: makeRng(2) }).every(s => s.given.length === 1));
  assert.ok(d20.round(g5u1, 3, { rng: makeRng(2) }).every(s => s.given === ''));
});

test('sorting uses 2 groups in arena 1 and 3 groups from arena 2', () => {
  const c15 = SUBTASKS.find(s => s.id === 'C15');
  assert.equal(c15.round(g5u1, 1, { rng: makeRng(1) })[0].categories.length, 2);
  assert.equal(c15.round(g5u1, 2, { rng: makeRng(1) })[0].categories.length, 3);
});

test('every unit can run all five outposts in arena 1', () => {
  for (const u of allUnits()) for (const f of FAMILIES) assert.ok(usableSubtasks(u, f.id, 1).length, `${u.id} ${f.id}`);
});

test('text wrapping never splits a word', () => {
  assert.deepEqual(wrapLines('Put the blocks in order', 10), ['Put the', 'blocks in', 'order']);
  assert.equal(wrapLines('extraordinarily', 10), null);
  assert.equal(fits('one two three four five', { charsPerLine: 9, lines: 2 }), false);
  assert.equal(fits('one two three', { charsPerLine: 9, lines: 2 }), true);
});
