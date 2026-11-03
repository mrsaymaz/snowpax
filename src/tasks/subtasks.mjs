// The five task families and their 23 sub-tasks (brief §9).
// Each sub-task knows which unit items it can use at an arena (pool / capacity) and builds
// one round: a set of 3 items. Everything comes from the selected unit only.
//
// Step kinds (rendered by the task card in M2):
//   match     left/right tiles, `pairs` maps left id → right id
//   choice    one answer out of `options` (3, or 4 for odd-one-out and misspelling)
//   sort      cards into 2–3 categories
//   fix       tap the wrong word in `tokens`, then pick the repair
//   order     put sentence blocks in order (any order that rebuilds `text` is right)
//   spell     letter tiles
//   listen    hear a word, pick it            (speech; `fallbackText` when no voice)
//   multi     hear two words, pick both
//   sequence  follow written instructions: tap items in order
import { CONFIG } from '../config.js';
import { fitsTile, fitsWideTile, fitsOption, fitsPrompt, fitsBlock } from './layout.mjs';
import { numberWords } from './numbers.mjs';

export const FAMILIES = [
  { id: 'match',  letter: 'A', name: 'Matching',  outpost: 'Matching outpost' },
  { id: 'answer', letter: 'B', name: 'Answer',    outpost: 'Answer outpost' },
  { id: 'sort',   letter: 'C', name: 'Sorting',   outpost: 'Sorting outpost' },
  { id: 'build',  letter: 'D', name: 'Builder',   outpost: 'Builder outpost' },
  { id: 'listen', letter: 'E', name: 'Listening', outpost: 'Listening outpost' },
];

const D = CONFIG.demand;
const PER = D.itemsPerRound;

// Items one outpost visit uses (seize + defend), and the extra round a final-battle banner needs.
export const needFor = arena => (D.seizeRounds[arena - 1] + D.defendRounds[arena - 1]) * PER;

// ---------- small helpers ----------
// mulberry32: small, fast and well mixed even for neighbouring seeds.
export function makeRng(seed = 1) {
  let a = (Math.floor(seed) * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const norm = s => String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}' ]/gu, ' ').replace(/\s+/g, ' ').trim();
const firstWord = s => norm(s).split(' ')[0];
const wordCount = s => norm(s).split(' ').filter(Boolean).length;

const HOMOPHONE = new Map();
CONFIG.homophones.forEach((group, i) => group.forEach(w => HOMOPHONE.set(w.toLowerCase(), i)));

// Two words can share a board only when no answer could be confused:
// same English, same Turkish, same picture or picture group, or homophones.
function wordKeys(w) {
  const keys = new Set(['en:' + norm(w.en), 'tr:' + norm(w.tr)]);
  if (w.pic) keys.add('pic:' + w.pic);
  if (w.pg != null) keys.add('pg:' + w.pg);
  for (const t of norm(w.en).split(' ')) if (HOMOPHONE.has(t)) keys.add('hp:' + HOMOPHONE.get(t));
  return keys;
}
const keyCache = new WeakMap();
const keysOf = w => { let k = keyCache.get(w); if (!k) keyCache.set(w, k = wordKeys(w)); return k; };
export const wordsCompatible = (a, b) => { const kb = keysOf(b); for (const k of keysOf(a)) if (kb.has(k)) return false; return true; };
// Listening also avoids one word hiding inside another (school / school gate).
const listenCompatible = (a, b) => wordsCompatible(a, b) && !norm(a.en).includes(norm(b.en)) && !norm(b.en).includes(norm(a.en));

// Picks n items: missed items first, then unseen, then recently seen; all pairwise compatible.
export function choose(pool, n, ctx, compatible = () => true) {
  if (pool.length < n) return null;
  const { rng, missed = new Map(), recent = new Set() } = ctx;
  for (let attempt = 0; attempt < 6; attempt++) {
    const score = x => (attempt < 3 ? (missed.get(x.id) || 0) * 10 - (recent.has(x.id) ? 5 : 0) : 0) + rng() * (attempt + 1);
    const order = pool.map(x => [score(x), x]).sort((a, b) => b[0] - a[0]).map(p => p[1]);
    const out = [];
    for (const x of order) { if (out.length === n) break; if (out.every(y => compatible(x, y))) out.push(x); }
    if (out.length === n) return out;
  }
  return null;
}

// A choice step with the answer at a random position.
function choiceStep(base, answer, distractors, rng) {
  const options = shuffle([answer, ...distractors], rng);
  return { kind: 'choice', ...base, options, answer: options.indexOf(answer), answerText: answer };
}
function reviewedDistractors(options, answer, n, rng) {
  const others = options.filter(o => norm(o) !== norm(answer) && fitsOption(o));
  return others.length >= n ? shuffle(others, rng).slice(0, n) : null;
}
const repeatSteps = (n, make) => { const steps = []; for (let i = 0; i < n; i++) { const s = make(i, steps); if (!s) return null; steps.push(s); } return steps; };
// Builds 3 one-item steps from 3 distinct chosen items.
function threeSteps(pool, ctx, make, compatible) {
  const picked = choose(pool, PER, ctx, compatible);
  if (!picked) return null;
  const steps = picked.map(x => make(x));
  return steps.every(Boolean) ? steps : null;
}

// Per-unit memo of pools (units are plain objects loaded once).
const memo = new WeakMap();
function cached(unit, keyName, make) {
  let m = memo.get(unit); if (!m) memo.set(unit, m = new Map());
  if (!m.has(keyName)) m.set(keyName, make());
  return m.get(keyName);
}

// ---------- pools ----------
const singleWords = unit => cached(unit, 'single', () => unit.words.filter(w => /^[a-z]+$/.test(w.en)));
const tileWords = unit => cached(unit, 'tileWords', () => unit.words.filter(w => fitsTile(w.en) && fitsTile(w.tr)));
const pictureWords = unit => cached(unit, 'picWords', () => unit.words.filter(w => w.pic && fitsTile(w.en)));
const listenWords = unit => cached(unit, 'listenWords', () => unit.words.filter(w => fitsOption(w.en)));
const leaks = (text, word) => norm(text).split(' ').includes(norm(word)) || norm(text).includes(norm(word) + ' ');

const definitionItems = unit => cached(unit, 'defs', () => {
  const out = [], seen = new Set();
  for (const w of unit.words) if (w.def && fitsWideTile(w.def) && fitsTile(w.en) && !leaks(w.def, w.en)) { out.push({ id: w.id, word: w.en, def: w.def, tr: w.tr }); seen.add(norm(w.en)); }
  for (const c of unit.clues) if (!seen.has(norm(c.answer)) && fitsWideTile(c.clue) && fitsTile(c.answer) && !leaks(c.clue, c.answer)) { out.push({ id: c.id, word: c.answer, def: c.clue }); seen.add(norm(c.answer)); }
  return out;
});

// Sentence halves on a matching board: every pairing on the board must be a reviewed wrong
// ending in at least one direction, so no start can take two of the shown endings.
const halvesBoardPool = unit => cached(unit, 'halvesBoard', () => unit.halves.filter(h => fitsWideTile(h.start) && fitsWideTile(h.end)));
function halvesRelated(a, b) {
  const wa = new Set(a.wrong.map(norm)), wb = new Set(b.wrong.map(norm));
  return wa.has(norm(b.end)) || wb.has(norm(a.end));
}
function triangles(pool, related, limit = Infinity) {
  const out = [];
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
    if (!related(pool[i], pool[j])) continue;
    for (let k = j + 1; k < pool.length; k++) if (related(pool[i], pool[k]) && related(pool[j], pool[k])) { out.push([pool[i], pool[j], pool[k]]); if (out.length >= limit) return out; }
  }
  return out;
}
function disjointCount(tris) {
  const used = new Set(); let n = 0;
  for (const t of tris) if (t.every(x => !used.has(x.id))) { t.forEach(x => used.add(x.id)); n++; }
  return n;
}

// Categories: an item may sit in a bin only if no other bin on the board also claims it,
// and (when that bin lists its non-members) it is listed as a non-member there.
const categories = unit => cached(unit, 'cats', () => unit.categories.map(c => ({
  ...c, yesSet: new Set(c.yes.map(norm)), noSet: new Set(c.no.map(norm)),
})).filter(c => fitsWideTile(c.title)));
function validCards(cat, others) {
  return cat.yes.filter(item => fitsTile(item) && others.every(o => !o.yesSet.has(norm(item)) && (o.noSet.size === 0 || o.noSet.has(norm(item)))));
}
function combos(arr, k, start = 0, acc = [], out = []) {
  if (acc.length === k) { out.push([...acc]); return out; }
  for (let i = start; i < arr.length; i++) { acc.push(arr[i]); combos(arr, k, i + 1, acc, out); acc.pop(); }
  return out;
}
const sortBoards = (unit, k) => cached(unit, 'sort' + k, () => combos(categories(unit), k)
  .filter(cs => new Set(cs.map(c => norm(c.title))).size === k)
  .map(cs => ({ cats: cs, cards: cs.map((c, i) => validCards(c, cs.filter((_, j) => j !== i))) }))
  .filter(b => b.cards.every(list => list.length >= 1) && b.cards.flat().length >= PER)
  .sort((a, b) => b.cards.flat().length - a.cards.flat().length));

const oddBoards = unit => cached(unit, 'odd', () => {
  const cats = categories(unit), out = [];
  for (const x of cats) {
    const members = x.yes.filter(fitsOption);
    if (members.length < 3) continue;
    const pool = (x.no.length ? x.no : cats.filter(c => c !== x).flatMap(c => c.yes)).filter(o => !x.yesSet.has(norm(o)) && fitsOption(o));
    if (pool.length) out.push({ cat: x, members, odd: [...new Set(pool)] });
  }
  return out;
});

const fixItems = unit => cached(unit, 'fix', () => unit.repairs.map(r => {
  const sentence = r.prompt.replace('___', r.broken);
  const tokens = sentence.split(' ');
  const hits = tokens.map((t, i) => (norm(t) === norm(r.broken) ? i : -1)).filter(i => i >= 0);
  const repairs = r.options.filter(o => norm(o) !== norm(r.broken));
  if (r.broken.includes(' ') || hits.length !== 1 || !repairs.some(o => norm(o) === norm(r.answer)) || repairs.length < 2) return null;
  if (!tokens.every(t => t.length <= CONFIG.layout.card.charsPerLine) || !fitsPrompt(sentence)) return null;
  return { id: r.id, tokens, wrong: hits[0], repairs, answer: r.answer, full: r.prompt.replace('___', r.answer), tr: r.tr };
}).filter(Boolean));

const correctSentenceItems = unit => cached(unit, 'correct', () => unit.gaps.filter(g => g.tr).map(g => {
  const right = g.prompt.replace('___', g.answer);
  const wrongs = g.options.filter(o => norm(o) !== norm(g.answer)).map(o => g.prompt.replace('___', o)).filter(s => norm(s) !== norm(right));
  if (wrongs.length < 2 || ![right, ...wrongs].every(fitsOption) || !fitsPrompt(g.tr)) return null;
  return { id: g.id, right, wrongs, tr: g.tr };
}).filter(Boolean));

// Builder uses only sentences whose block boundaries were reviewed in Languini (SENTENCE-BLOCKS.md).
const sentencesWithBlocks = (unit, min, max) => cached(unit, `blocks${min}-${max}`, () =>
  unit.sentences.filter(s => s.rb && s.blocks.length >= min && s.blocks.length <= max && s.blocks.every(fitsBlock)));

const translateItems = unit => cached(unit, 'translate', () => {
  const sents = unit.sentences.filter(s => s.tr && fitsOption(s.text) && fitsPrompt(s.tr));
  const gapByFull = new Map();
  for (const g of unit.gaps) gapByFull.set(norm(g.prompt.replace('___', g.answer)), g);
  return sents.map(s => {
    const g = gapByFull.get(norm(s.text));
    let near = g ? g.options.filter(o => norm(o) !== norm(g.answer)).map(o => g.prompt.replace('___', o)).filter(fitsOption) : [];
    return { id: s.id, text: s.text, tr: s.tr, near };
  });
});

const spokenSentences = unit => cached(unit, 'spoken', () => unit.sentences.filter(s => s.tr && fitsWideTile(s.tr) && wordCount(s.text) <= 8));

const qaPairs = unit => cached(unit, 'qa', () => unit.questions.filter(q => fitsWideTile(q.q) && fitsWideTile(q.a)));
const replyItems = unit => cached(unit, 'reply', () => unit.questions.filter(q => q.options.filter(o => norm(o) !== norm(q.a)).length >= 2));
const contextItems = unit => cached(unit, 'ctx', () => unit.contexts.flatMap(c => c.questions.map(q => ({ ...q, id: q.id, context: c.text, contextTr: c.tr }))));
const spellWords = (unit, arena) => cached(unit, 'spell' + arena, () => singleWords(unit).filter(w => w.en.length >= 3 && w.en.length <= 10 && fitsPrompt(w.tr)));

// ---------- the 23 sub-tasks ----------
const S = [];
const def = (id, family, minArena, title, coach, impl) => S.push({ id, family, minArena, title, coach, ...impl });

// A · Matching (one board of 3 pairs per round)
const matchBoard = (prompt, items, left, right) => [{
  kind: 'match', prompt, items: items.length,
  left: items.map(x => ({ id: 'L' + x.id, ...left(x) })),
  right: items.map(x => ({ id: 'R' + x.id, ...right(x) })),
  pairs: Object.fromEntries(items.map(x => ['L' + x.id, 'R' + x.id])),
  sourceIds: items.map(x => x.id),
}];

def('A1', 'match', 1, 'English ↔ Turkish', 'Tap a word, then its Turkish meaning.', {
  pool: u => tileWords(u),
  round: (u, a, ctx) => { const w = choose(tileWords(u), PER, ctx, wordsCompatible); return w && matchBoard('Match each word to its Turkish meaning.', w, x => ({ text: x.en, lang: 'en' }), x => ({ text: x.tr, lang: 'tr' })); },
});
def('A2', 'match', 1, 'Word ↔ picture', 'Tap a word, then its picture.', {
  pool: u => pictureWords(u),
  round: (u, a, ctx) => { const w = choose(pictureWords(u), PER, ctx, wordsCompatible); return w && matchBoard('Match each word to its picture.', w, x => ({ text: x.en, lang: 'en' }), x => ({ pic: x.pic, alt: x.en })); },
});
def('A3', 'match', 2, 'Word ↔ definition', 'Tap a word, then what it means.', {
  pool: u => definitionItems(u),
  round: (u, a, ctx) => { const w = choose(definitionItems(u), PER, ctx, (x, y) => norm(x.word) !== norm(y.word) && !leaks(x.def, y.word) && !leaks(y.def, x.word)); return w && matchBoard('Match each word to its meaning.', w, x => ({ text: x.word, lang: 'en' }), x => ({ text: x.def, lang: 'en', wide: true })); },
});
def('A4', 'match', 2, 'Numbers ↔ number words', 'Tap a number, then its English words.', {
  pool: u => (u.numbers ? Array.from({ length: u.numbers.max - u.numbers.min + 1 }, (_, i) => ({ id: 'number:' + (u.numbers.min + i), n: u.numbers.min + i })) : []),
  round(u, a, ctx) { const n = choose(this.pool(u), PER, ctx); return n && matchBoard('Match each number to its English words.', n, x => ({ text: String(x.n), lang: 'en' }), x => ({ text: numberWords(x.n), lang: 'en', wide: true })); },
});
def('A5', 'match', 2, 'Sentence halves', 'Join each start to its ending.', {
  pool: u => halvesBoardPool(u),
  capacity: u => disjointCount(triangles(halvesBoardPool(u), halvesRelated)) * PER,
  round(u, a, ctx) {
    const pool = shuffle(halvesBoardPool(u), ctx.rng).sort((x, y) => (ctx.missed?.get(y.id) || 0) - (ctx.missed?.get(x.id) || 0) + (ctx.recent?.has(x.id) ? 1 : 0) - (ctx.recent?.has(y.id) ? 1 : 0));
    const t = triangles(pool, halvesRelated, 1)[0];
    return t && matchBoard('Join each start to its ending.', t, x => ({ text: x.start, lang: 'en', wide: true }), x => ({ text: x.end, lang: 'en', wide: true }));
  },
});
def('A6', 'match', 3, 'Question ↔ answer', 'Tap a question, then its answer.', {
  pool: u => qaPairs(u),
  round: (u, a, ctx) => { const q = choose(qaPairs(u), PER, ctx, (x, y) => firstWord(x.q) !== firstWord(y.q) && norm(x.a) !== norm(y.a)); return q && matchBoard('Match each question to its answer.', q, x => ({ text: x.q, lang: 'en', wide: true }), x => ({ text: x.a, lang: 'en', wide: true })); },
});
def('A7', 'match', 3, 'Spoken English ↔ Turkish', 'Tap a speaker to listen, then tap the Turkish meaning.', {
  speech: true,
  pool: u => spokenSentences(u),
  round: (u, a, ctx) => { const s = choose(spokenSentences(u), PER, ctx, (x, y) => norm(x.tr) !== norm(y.tr) && norm(x.text) !== norm(y.text)); return s && matchBoard('Listen, then match each sentence to its Turkish meaning.', s, x => ({ speak: x.text, fallbackText: x.text, lang: 'en' }), x => ({ text: x.tr, lang: 'tr', wide: true })); },
});

// B · Answer (3 one-answer questions per round)
def('B8', 'answer', 1, 'Clue → word', 'Read the clue. Pick the word.', {
  pool: u => u.clues.filter(c => c.options.length >= 3),
  round(u, a, ctx) { return threeSteps(this.pool(u), ctx, c => { const d = reviewedDistractors(c.options, c.answer, 2, ctx.rng); return d && choiceStep({ prompt: c.clue, sourceIds: [c.id], readback: c.answer }, c.answer, d, ctx.rng); }, (x, y) => norm(x.answer) !== norm(y.answer)); },
});
def('B9', 'answer', 1, 'Sentence ending', 'Pick the ending that finishes the sentence.', {
  pool: u => u.halves.filter(h => h.wrong.length >= 2),
  round(u, a, ctx) { return threeSteps(this.pool(u), ctx, h => choiceStep({ prompt: h.start, sourceIds: [h.id], readback: h.start.replace(/…$/, '') + ' ' + h.end.replace(/^…/, '') }, h.end, shuffle(h.wrong, ctx.rng).slice(0, 2), ctx.rng)); },
});
def('B10', 'answer', 2, 'Fill the gap', 'Pick the word that fills the gap.', {
  pool: u => u.gaps.filter(g => g.options.filter(o => norm(o) !== norm(g.answer)).length >= 2 && g.options.every(fitsOption)),
  round(u, a, ctx) { return threeSteps(this.pool(u), ctx, g => { const d = reviewedDistractors(g.options, g.answer, 2, ctx.rng); return d && choiceStep({ prompt: g.prompt, hintTr: g.tr || null, sourceIds: [g.id], readback: g.prompt.replace('___', g.answer), meaningTr: g.tr || null }, g.answer, d, ctx.rng); }); },
});
def('B11', 'answer', 2, 'Choose a reply', 'Pick the best reply.', {
  pool: u => replyItems(u),
  round(u, a, ctx) {
    const pool = replyItems(u), byId = new Map(pool.map(q => [q.id, q]));
    const step = q => { const d = reviewedDistractors(q.options, q.a, 2, ctx.rng); return d && choiceStep({ prompt: q.q, sourceIds: [q.id], readback: q.a, meaningTr: q.aTr || null }, q.a, d, ctx.rng); };
    const dialogues = (u.dialogues || []).filter(d => byId.has(d.first) && byId.has(d.second));
    if (dialogues.length && ctx.rng() < 0.4) {
      const dlg = dialogues[Math.floor(ctx.rng() * dialogues.length)];
      const first = step(byId.get(dlg.first)), second = step(byId.get(dlg.second));
      const rest = choose(pool.filter(q => q.id !== dlg.first && q.id !== dlg.second), 1, ctx);
      const third = rest && step(rest[0]);
      if (first && second && third) return [{ ...first, dialogue: dlg.topic }, { ...second, dialogue: dlg.topic, chained: true }, third];
    }
    return threeSteps(pool, ctx, step);
  },
});
def('B12', 'answer', 3, 'The correct sentence', 'Only one sentence is correct. Find it.', {
  pool: u => correctSentenceItems(u),
  round(u, a, ctx) { return threeSteps(this.pool(u), ctx, x => choiceStep({ prompt: 'Which sentence is correct?', hintTr: x.tr, sourceIds: [x.id], readback: x.right, meaningTr: x.tr }, x.right, shuffle(x.wrongs, ctx.rng).slice(0, 2), ctx.rng)); },
});
def('B13', 'answer', 3, 'Read and answer', 'Read the text, then answer the question.', {
  pool: u => contextItems(u).filter(q => q.options.filter(o => norm(o) !== norm(q.a)).length >= 2),
  round(u, a, ctx) { return threeSteps(this.pool(u), ctx, q => { const d = reviewedDistractors(q.options, q.a, 2, ctx.rng); return d && choiceStep({ context: q.context, prompt: q.q, sourceIds: [q.id], readback: q.a, meaningTr: q.contextTr || null }, q.a, d, ctx.rng); }, (x, y) => x.context !== y.context); },
});
def('B14', 'answer', 3, 'Turkish → English', 'Read the Turkish sentence. Pick the English one.', {
  pool: u => translateItems(u),
  round(u, a, ctx) {
    const all = translateItems(u);
    return threeSteps(all, ctx, s => {
      let d = s.near.length >= 2 ? shuffle(s.near, ctx.rng).slice(0, 2) : null;
      if (!d) {
        const others = all.filter(o => o.id !== s.id && norm(o.tr) !== norm(s.tr) && norm(o.text) !== norm(s.text))
          .sort((x, y) => Math.abs(wordCount(x.text) - wordCount(s.text)) - Math.abs(wordCount(y.text) - wordCount(s.text)) + (ctx.rng() - 0.5));
        if (others.length < 2) return null;
        d = others.slice(0, 2).map(o => o.text);
      }
      return choiceStep({ prompt: s.tr, promptLang: 'tr', sourceIds: [s.id], readback: s.text }, s.text, d, ctx.rng);
    });
  },
});

// C · Sorting
def('C15', 'sort', 1, 'Sort into groups', 'Sort each word into its group.', {
  pool: (u, a) => (sortBoards(u, D.sortCategories[a - 1])[0]?.cards.flat() || []),
  round(u, a, ctx) {
    const k = D.sortCategories[a - 1], boards = sortBoards(u, k);
    if (!boards.length) return null;
    const b = boards[Math.floor(ctx.rng() * Math.min(boards.length, 3))];
    const cards = b.cats.map((c, i) => b.cards[i].map(text => ({ id: c.id + ':' + norm(text), text, cat: i })));
    // one card from each bin first, then the rest, so every bin gets used
    const first = cards.map(list => choose(list, 1, ctx)?.[0]).filter(Boolean);
    const rest = choose(cards.flat().filter(c => !first.includes(c)), Math.max(0, PER - first.length), ctx) || [];
    const picked = shuffle([...first, ...rest].slice(0, Math.max(PER, k)), ctx.rng);
    return [{ kind: 'sort', prompt: 'Sort the words into the groups.', items: picked.length, categories: b.cats.map(c => ({ id: c.id, title: c.title, titleTr: c.titleTr || null })), cards: picked, sourceIds: picked.map(c => c.id) }];
  },
});
def('C16', 'sort', 2, 'Odd one out', 'Three belong together. Find the odd one out.', {
  pool: u => oddBoards(u).flatMap(b => b.members.map(m => ({ id: b.cat.id + ':' + norm(m) }))),
  capacity: u => oddBoards(u).reduce((n, b) => n + Math.floor(b.members.length / 3), 0) * 1,
  round(u, a, ctx) {
    const boards = oddBoards(u); if (!boards.length) return null;
    const cats = categories(u);
    return repeatSteps(PER, (i, prev) => {
      for (const b of shuffle(boards, ctx.rng)) for (let t = 0; t < 4; t++) {
        const three = choose(b.members.map(m => ({ id: b.cat.id + ':' + norm(m), text: m })).filter(m => !prev.some(p => p.options.includes(m.text))), 3, ctx);
        if (!three) break;
        // the odd word must not share any other group with the three
        const odd = shuffle(b.odd, ctx.rng).find(o => cats.every(c => !c.yesSet.has(norm(o)) || three.every(x => !c.yesSet.has(norm(x.text)))));
        if (odd) return { ...choiceStep({ prompt: 'Which one does not belong?', explain: `The others are: ${b.cat.title.toLowerCase()}.`, sourceIds: three.map(x => x.id) }, odd, three.map(x => x.text), ctx.rng), grid: true };
      }
      return null;
    });
  },
});
def('C17', 'sort', 2, 'Spot the misspelling', 'One word is spelled wrong. Find it.', {
  pool: u => (u.misspellings || []).filter(m => fitsOption(m.wrong)),
  round(u, a, ctx) {
    const correct = u.words.filter(w => /^[a-z]+( [a-z]+)?$/.test(w.en) && fitsOption(w.en));
    return threeSteps(this.pool(u), ctx, m => {
      const others = choose(correct.filter(w => norm(w.en) !== norm(m.word)), 3, ctx, (x, y) => norm(x.en) !== norm(y.en));
      return others && { ...choiceStep({ prompt: 'Which word is spelled wrong?', explain: `The right spelling is "${m.word}".`, sourceIds: [m.id], readback: m.word }, m.wrong, others.map(w => w.en), ctx.rng), grid: true };
    });
  },
});
def('C18', 'sort', 3, 'Find and fix', 'Tap the wrong word, then pick the right one.', {
  pool: u => fixItems(u),
  round(u, a, ctx) { return threeSteps(this.pool(u), ctx, x => ({ kind: 'fix', prompt: 'Tap the wrong word, then fix it.', tokens: x.tokens, wrong: x.wrong, options: shuffle(x.repairs.slice(0, 3).includes(x.answer) ? x.repairs.slice(0, 3) : [x.answer, ...x.repairs.filter(r => r !== x.answer).slice(0, 2)], ctx.rng), answerText: x.answer, readback: x.full, meaningTr: x.tr || null, sourceIds: [x.id] })); },
});

// D · Builder
const orderStep = (s, rng) => {
  const blocks = s.blocks.map((text, i) => ({ id: `${s.id}#${i}`, text }));
  let shown = shuffle(blocks, rng);
  for (let t = 0; t < 5 && shown.map(b => b.text).join(' ') === s.text; t++) shown = shuffle(blocks, rng);
  return { kind: 'order', prompt: 'Put the blocks in order.', blocks: shown, text: s.text, answerText: s.text, readback: s.text, meaningTr: s.tr || null, sourceIds: [s.id] };
};
def('D19', 'build', 1, 'Build the sentence', 'Tap the blocks in the right order.', {
  pool: (u, a) => {
    const [min, max] = D.sentenceBlocks[a - 1];
    return sentencesWithBlocks(u, min, max);
  },
  capacity(u, a) {
    // Arena 3 may also use two shorter sentences in a row.
    if (a === 3) return sentencesWithBlocks(u, 5, 6).length + Math.floor(sentencesWithBlocks(u, 3, 4).length / 2);
    return this.pool(u, a).length;
  },
  round(u, a, ctx) {
    const [min, max] = D.sentenceBlocks[a - 1];
    const long = sentencesWithBlocks(u, min, max), short = sentencesWithBlocks(u, 3, Math.max(3, min - 1));
    const pick = choose(long.length >= PER ? long : [...long, ...(a === 3 ? [] : short)], PER, ctx);
    if (pick) return pick.map(s => orderStep(s, ctx.rng));
    if (a === 3) { // two sentences in a row per item
      const pairs = choose(sentencesWithBlocks(u, 3, 4), PER * 2, ctx);
      if (!pairs) return null;
      return Array.from({ length: PER }, (_, i) => ({ kind: 'order-pair', steps: [orderStep(pairs[2 * i], ctx.rng), orderStep(pairs[2 * i + 1], ctx.rng)], sourceIds: [pairs[2 * i].id, pairs[2 * i + 1].id] }));
    }
    return null;
  },
});
def('D20', 'build', 1, 'Spell the word', 'Tap the letters to spell the word.', {
  pool: (u, a) => spellWords(u, a),
  round(u, a, ctx) {
    const given = D.spellFirstLetter[a - 1];
    return threeSteps(spellWords(u, a), ctx, w => {
      const letters = [...w.en.toLowerCase()];
      const tiles = given ? letters.slice(1) : letters;
      let shown = shuffle(tiles, ctx.rng);
      for (let t = 0; t < 5 && shown.join('') === tiles.join('') && tiles.length > 1; t++) shown = shuffle(tiles, ctx.rng);
      return { kind: 'spell', prompt: w.tr, promptLang: 'tr', pic: w.pic || null, answerText: w.en.toLowerCase(), given: given ? letters[0] : '', tiles: shown, readback: w.en, sourceIds: [w.id] };
    }, wordsCompatible);
  },
});

// E · Listening
def('E21', 'listen', 1, 'Listen and pick', 'Listen. Tap the word you hear.', {
  speech: true,
  pool: u => listenWords(u),
  round(u, a, ctx) {
    const targets = choose(listenWords(u), PER, ctx, listenCompatible);
    if (!targets) return null;
    const steps = targets.map(t => {
      const d = choose(listenWords(u).filter(w => w !== t && listenCompatible(w, t)), 2, { ...ctx, missed: undefined }, listenCompatible);
      return d && { ...choiceStep({ kind: 'listen', prompt: 'Tap the word you hear.', speak: t.en, fallbackText: t.en, sourceIds: [t.id], readback: t.en }, t.en, d.map(w => w.en), ctx.rng), kind: 'listen', pics: null };
    });
    return steps.every(Boolean) ? steps : null;
  },
});
def('E22', 'listen', 2, 'Listen and pick two', 'Listen. Tap the two things you hear.', {
  speech: true,
  pool: u => listenWords(u),
  capacity: u => (listenWords(u).length >= 5 ? listenWords(u).length : 0),
  round(u, a, ctx) {
    return repeatSteps(PER, (i, prev) => {
      const used = new Set(prev.flatMap(p => p.sourceIds));
      const targets = choose(listenWords(u).filter(w => !used.has(w.id)), 2, ctx, listenCompatible);
      if (!targets) return null;
      const d = choose(listenWords(u).filter(w => !targets.includes(w) && targets.every(t => listenCompatible(w, t))), 3, { ...ctx, missed: undefined }, listenCompatible);
      if (!d) return null;
      const options = shuffle([...targets, ...d].map(w => w.en), ctx.rng);
      const speak = `${targets[0].en} … and … ${targets[1].en}`;
      return { kind: 'multi', prompt: 'Tap the two things you hear.', speak, fallbackText: `${targets[0].en} and ${targets[1].en}`, options, answers: targets.map(t => options.indexOf(t.en)), answerText: `${targets[0].en} and ${targets[1].en}`, readback: speak, sourceIds: targets.map(t => t.id) };
    });
  },
});
def('E23', 'listen', 2, 'Follow the instructions', 'Read the instructions. Tap the things in that order.', {
  pool: u => listenWords(u),
  capacity: u => (listenWords(u).length >= 6 ? listenWords(u).length : 0),
  round(u, a, ctx) {
    const n = a >= 3 ? 3 : 2, size = n + 3;
    return repeatSteps(PER, () => {
      const board = choose(listenWords(u), size, ctx, listenCompatible);
      if (!board) return null;
      const targets = board.slice(0, n);
      const q = w => `"${w.en}"`;
      const prompt = n === 2 ? `Tap ${q(targets[0])}, then tap ${q(targets[1])}.` : `First tap ${q(targets[0])}. Then tap ${q(targets[1])}. Last, tap ${q(targets[2])}.`;
      if (!fitsPrompt(prompt)) return null;
      const options = shuffle(board.map(w => w.en), ctx.rng);
      return { kind: 'sequence', prompt, options, answer: targets.map(t => options.indexOf(t.en)), answerText: targets.map(t => t.en).join(', '), sourceIds: targets.map(t => t.id) };
    });
  },
});

export const SUBTASKS = S;
export const SUBTASK = Object.fromEntries(S.map(s => [s.id, s]));
export const subtasksOf = family => S.filter(s => s.family === family);

export function capacityOf(sub, unit, arena) {
  if (arena < sub.minArena) return 0;
  return sub.capacity ? sub.capacity(unit, arena) : sub.pool(unit, arena).length;
}

// 'good' = fresh on replays (twice a visit), 'ok' = one full visit without repeats,
// 'thin' = would repeat items inside one visit, 'none' = cannot fill a round.
export function statusOf(sub, unit, arena) {
  const cap = capacityOf(sub, unit, arena), need = needFor(arena);
  if (arena < sub.minArena) return { cap: 0, need, status: 'locked' };
  const can = cap >= PER && sub.round(unit, arena, { rng: makeRng(arena * 31 + 7) });
  if (!can) return { cap, need, status: 'none' };
  return { cap, need, status: cap >= need * 2 ? 'good' : cap >= need ? 'ok' : 'thin' };
}

// Sub-tasks that can run a full outpost visit for this family at this arena.
// A visit prefers 'ok'/'good' sub-tasks; 'thin' ones are a last resort.
export function usableSubtasks(unit, family, arena) {
  const rows = subtasksOf(family).map(s => ({ sub: s, ...statusOf(s, unit, arena) })).filter(r => r.status !== 'locked' && r.status !== 'none');
  const full = rows.filter(r => r.status !== 'thin');
  return (full.length ? full : rows).map(r => r.sub);
}

// One round for an outpost: rotate sub-tasks (least recently used first), skipping speech
// tasks when the device has no English voice only if a non-speech option exists.
export function makeRound(unit, family, arena, ctx) {
  const history = ctx.history || [];
  let subs = usableSubtasks(unit, family, arena);
  if (ctx.speech === false && subs.some(s => !s.speech)) subs = subs.filter(s => !s.speech);
  const lastUse = s => { const i = history.lastIndexOf(s.id); return i < 0 ? -1 : i; };
  subs = shuffle(subs, ctx.rng).sort((a, b) => lastUse(a) - lastUse(b));
  for (const sub of subs) {
    const steps = sub.round(unit, arena, ctx);
    if (steps) return { subtask: sub.id, family, title: sub.title, coach: sub.coach, supported: !!(sub.speech && ctx.speech === false), steps };
  }
  return null;
}

// Number of scorable items in a step (each pair, card or question counts once).
export const itemsIn = step => step.items || (step.kind === 'order-pair' ? 1 : 1);
