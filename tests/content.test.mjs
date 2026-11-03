import test from 'node:test';
import assert from 'node:assert/strict';
import { checkContent } from '../tools/check-content.mjs';
import { makeMisspelling } from '../tools/lib/misspell.mjs';
import { grade } from './helpers.mjs';

test('the imported content passes the content check', () => {
  assert.deepEqual(checkContent({ quiet: true, seeds: 2 }), []);
});

function broken(mutate) {
  const g = structuredClone(grade(5));
  g.units = g.units.slice(0, 2);
  mutate(g.units[0], g);
  return checkContent({ quiet: true, seeds: 1, grades: { 5: g } });
}

test('the check catches duplicate IDs', () => {
  const e = broken(u => { u.clues[1].id = u.clues[0].id; });
  assert.ok(e.some(x => x.includes('duplicate id')));
});
test('the check catches a right answer that is also a wrong option', () => {
  const e = broken(u => { u.clues[0].options = [u.clues[0].answer, u.clues[0].answer, 'canteen']; });
  assert.ok(e.some(x => x.includes('more than once') || x.includes('repeat')));
});
test('the check catches missing answers', () => {
  const e = broken(u => { u.gaps[0].answer = ''; });
  assert.ok(e.some(x => x.includes('missing answer')));
});
test('the check catches empty units', () => {
  const e = broken(u => { for (const k of ['words', 'clues', 'halves', 'sentences', 'questions', 'gaps', 'repairs', 'contexts', 'categories', 'misspellings']) u[k] = []; });
  assert.ok(e.some(x => x.includes('empty unit')));
});
test('the check catches text too long for the 640 × 360 card', () => {
  const e = broken(u => { u.clues[0].clue = 'This clue is far too long to fit on the small phone task card because it keeps going and going with many many words that will never fit in six lines of text at sixteen pixels, no matter how hard we try to squeeze them in.'; });
  assert.ok(e.some(x => x.includes('too long')));
});

test('misspellings are repeatable and never real words or spelling variants', () => {
  const dict = new Set(['library', 'colour', 'color', 'centre']);
  assert.equal(makeMisspelling('library', dict), makeMisspelling('library', dict));
  for (const w of ['colour', 'centre', 'travelling', 'grey', 'programme']) {
    for (let i = 0; i < 3; i++) {
      const m = makeMisspelling(w, dict);
      if (!m) continue;
      assert.notEqual(m, w);
      assert.ok(!dict.has(m));
      assert.ok(!['color', 'center', 'traveling', 'gray', 'program'].includes(m), `${w} → ${m} is a real spelling`);
    }
  }
  assert.equal(makeMisspelling('cat'), null, 'short words are not misspelled');
});
