#!/usr/bin/env node
// Builds content/grade5…8.json from Mr. Saymaz's existing lesson banks (read-only).
//
//   node tools/import-content.mjs [--maxima DIR] [--towerswarm DIR] [--languini DIR]
//
// Primary source: maxima/language-pack/grade-N.json. Gaps filled from towerswarm/content
// (pictures, translations, completions) and languini/content (sorting packs, reviewed
// sentence blocks, dialogue links). Original item IDs are kept for tracing.
// Pictures: only the licensed images the games already ship are copied, with their licence.
// Nothing new is written except procedural misspellings (Growbloom-style, listed for review).
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fitsPrompt, fitsOption } from '../src/tasks/layout.mjs';
import { makeMisspelling } from './lib/misspell.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GRADES = [5, 6, 7, 8];

// ---------- locate the source repos ----------
const arg = name => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : null; };
function locate(name, probe) {
  const tries = [arg(name), process.env[`SNOW_${name.toUpperCase()}`], join(ROOT, '..', name), join(ROOT, '..', 'mrsaymaz', name), join(ROOT, '..', '..', name)].filter(Boolean);
  const found = tries.find(d => existsSync(join(d, probe)));
  if (!found) { console.error(`Cannot find the ${name} repo (looked for ${probe} in: ${tries.join(', ')}). Pass --${name} DIR.`); process.exit(1); }
  return resolve(found);
}
const SRC = {
  maxima: locate('maxima', 'language-pack/grade-5.json'),
  towerswarm: locate('towerswarm', 'content/grade5.json'),
  languini: locate('languini', 'content/sorting-packs.json'),
};
const commitOf = dir => { try { return execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return 'unknown'; } };
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const readJSON = file => JSON.parse(readFileSync(file, 'utf8'));
const sourceFiles = [];
function load(repo, rel) {
  const file = join(SRC[repo], rel);
  sourceFiles.push({ repo: `mrsaymaz/${repo}`, commit: commitOf(SRC[repo]), file: rel, sha256: sha(file) });
  return readJSON(file);
}

// ---------- shared source tables ----------
const sentenceBlocks = load('languini', 'content/sentence-blocks.json').sentences;
const sortingPacks = load('languini', 'content/sorting-packs.json');
const dialogueLinks = load('languini', 'content/dialogue-links.json');
const towerPictureSrc = readFileSync(join(SRC.towerswarm, 'src/pictures.mjs'), 'utf8');
sourceFiles.push({ repo: 'mrsaymaz/towerswarm', commit: commitOf(SRC.towerswarm), file: 'src/pictures.mjs', sha256: sha(join(SRC.towerswarm, 'src/pictures.mjs')) });
const TOWER_EMOJI = Object.fromEntries([...towerPictureSrc.matchAll(/'([^']+)':'([^']+)'/g)].map(m => [m[1].toLowerCase(), m[2]]));
const emojiFile = e => [...e].map(c => c.codePointAt(0).toString(16)).filter(h => h !== 'fe0f').join('-');

// ---------- helpers ----------
const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const key = s => clean(s).toLowerCase();
const uniq = arr => { const seen = new Set(); return arr.filter(x => { const k = key(x); if (seen.has(k)) return false; seen.add(k); return true; }); };
const sentenceCase = t => { const s = clean(t); return s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s; };

const log = { excluded: [], merged: [], added: [], pictures: new Set(), misspellings: [], blockFixes: [] };
const exclude = (unit, type, id, why, text) => log.excluded.push({ unit, type, id, why, text: clean(text).slice(0, 120) });

// Words that exist anywhere in the banks: a generated misspelling must not be one of them.
const DICTIONARY = new Set();
function addWords(text) { for (const w of String(text ?? '').toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || []) DICTIONARY.add(w); }

// ---------- per-unit conversion ----------
function convertUnit(mu, tu, grade) {
  const uid = mu.id;
  const unit = { id: uid, title: clean(mu.title), grade, cefr: mu.cefr || null };

  // Words (vocabulary). Pictures only when the picture is a reviewed sense match.
  const words = [];
  const byEn = new Map();
  for (const v of mu.vocabulary) {
    const en = clean(v.en), tr = clean(v.tr);
    if (!en || !tr) { exclude(uid, 'word', v.id, 'missing English or Turkish', en || tr); continue; }
    if (byEn.has(key(en))) { log.merged.push({ unit: uid, kept: byEn.get(key(en)).id, dropped: v.id, en }); continue; }
    const w = { id: v.id, en, tr };
    if (v.definition) w.def = clean(v.definition);
    if (v.picture && v.picturePolicy !== 'text-only') {
      w.pic = 'pictures/' + v.picture.replace(/^assets\//, '');
      if (v.pictureGroup != null) w.pg = String(v.pictureGroup);
      log.pictures.add(JSON.stringify({ from: 'maxima', path: v.picture }));
    }
    byEn.set(key(en), w); words.push(w);
  }
  // Tower Swarm: unit translations missing from Maxima, and picture words without a picture.
  if (tu) {
    for (const t of tu.translations || []) {
      if (byEn.has(key(t.en)) || !clean(t.tr)) continue;
      const w = { id: t.id, en: clean(t.en), tr: clean(t.tr), src: 'towerswarm' };
      byEn.set(key(w.en), w); words.push(w); log.added.push({ unit: uid, type: 'word', id: t.id, from: 'towerswarm', text: w.en });
    }
    for (const p of tu.pictures || []) {
      const w = byEn.get(key(p.word)), emoji = TOWER_EMOJI[key(p.word)];
      if (!w || w.pic || !emoji) continue;
      const file = emojiFile(emoji) + '.webp';
      if (!existsSync(join(SRC.towerswarm, 'public/emoji', file))) continue;
      w.pic = 'pictures/emoji/' + file;
      log.pictures.add(JSON.stringify({ from: 'towerswarm', path: 'public/emoji/' + file }));
    }
  }
  unit.words = words;

  // Clues (descriptions): clue → answer, with reviewed options.
  unit.clues = [];
  for (const d of mu.descriptions) {
    const options = uniq(d.options.map(clean));
    const item = { id: d.id, clue: clean(d.clue), answer: clean(d.answer), options };
    if (d.tr) item.tr = clean(d.tr);
    if (!fitsPrompt(item.clue)) { exclude(uid, 'clue', d.id, 'clue too long for the task card', item.clue); continue; }
    if (!options.every(fitsOption)) { exclude(uid, 'clue', d.id, 'an option is too long', options.join(' / ')); continue; }
    unit.clues.push(item);
  }

  // Sentence halves.
  unit.halves = [];
  for (const h of mu.halves) {
    const item = { id: h.id, start: clean(h.start), end: clean(h.end), wrong: uniq(h.wrongEndings.map(clean)).filter(w => key(w) !== key(h.end)) };
    if (![item.start, item.end, ...item.wrong].every(fitsOption)) { exclude(uid, 'half', h.id, 'too long for an answer button', item.start + ' ' + item.end); continue; }
    unit.halves.push(item);
  }

  // Sentences with blocks. Languini's reviewed boundaries win when the exact sentence is mapped.
  unit.sentences = [];
  for (const s of mu.sentences) {
    const text = clean(s.answer);
    // Generic questions about a reading text ("When does this happen?") only make sense with the text.
    if (/-context-\d+-q\d+-s$/.test(s.id)) { exclude(uid, 'sentence', s.id, 'generic reading question (used with its text in Read and answer)', text); continue; }
    let blocks = s.blocks.map(clean);
    const reviewed = sentenceBlocks[text];
    if (reviewed && JSON.stringify(reviewed.blocks) !== JSON.stringify(blocks)) { log.blockFixes.push({ id: s.id, from: blocks, to: reviewed.blocks }); blocks = reviewed.blocks.map(clean); }
    if (blocks.join(' ') !== text) { exclude(uid, 'sentence', s.id, 'blocks do not rebuild the sentence', text); continue; }
    const item = { id: s.id, text, blocks };
    if (s.tr) item.tr = clean(s.tr);
    if (reviewed) item.rb = 1; // block boundaries reviewed in Languini
    if (!fitsOption(text) && !fitsPrompt(text)) { exclude(uid, 'sentence', s.id, 'sentence too long', text); continue; }
    unit.sentences.push(item);
  }

  // Questions: plain question → reply, and short reading contexts with their questions.
  unit.questions = [];
  const contextQs = new Map();
  for (const q of mu.questions) {
    const options = uniq(q.options.map(clean));
    const item = { id: q.id, q: clean(q.question || q.prompt), a: clean(q.answer), options };
    if (q.questionTr) item.qTr = clean(q.questionTr);
    if (q.answerTr) item.aTr = clean(q.answerTr);
    if (!options.every(fitsOption)) { exclude(uid, 'question', q.id, 'an option is too long', options.join(' / ')); continue; }
    if (q.context) { contextQs.set(q.id, item); continue; }
    if (!fitsPrompt(item.q)) { exclude(uid, 'question', q.id, 'question too long', item.q); continue; }
    unit.questions.push(item);
  }
  unit.contexts = [];
  for (const c of mu.contexts || []) {
    const qs = (c.questions || []).map(id => contextQs.get(id)).filter(Boolean);
    const text = clean(c.en);
    const ok = qs.filter(q => fitsPrompt(text + '\n' + q.q));
    if (ok.length < qs.length) exclude(uid, 'context', c.id, 'text + question too long for the task card', text);
    if (!ok.length) continue;
    unit.contexts.push({ id: c.id, text, tr: clean(c.tr), genre: c.genre || null, questions: ok });
  }

  // Gaps and repairs (grammar). One ___ per prompt; options include the answer once.
  unit.gaps = [];
  for (const g of mu.gaps) {
    const item = { id: g.id, prompt: clean(g.prompt), answer: clean(g.answer), options: uniq(g.options.map(clean)) };
    if (g.fullCorrect) item.full = clean(g.fullCorrect);
    if (g.tr) item.tr = clean(g.tr);
    if (item.prompt.split('___').length !== 2) { exclude(uid, 'gap', g.id, 'prompt needs exactly one ___', item.prompt); continue; }
    if (!fitsPrompt(item.prompt)) { exclude(uid, 'gap', g.id, 'prompt too long', item.prompt); continue; }
    unit.gaps.push(item);
  }
  unit.repairs = [];
  for (const r of mu.repairs) {
    const item = { id: r.id, prompt: clean(r.prompt), broken: clean(r.broken), answer: clean(r.answer), options: uniq(r.options.map(clean)) };
    if (r.fullCorrect) item.full = clean(r.fullCorrect);
    if (r.tr) item.tr = clean(r.tr);
    if (item.prompt.split('___').length !== 2) { exclude(uid, 'repair', r.id, 'prompt needs exactly one ___', item.prompt); continue; }
    if (!fitsPrompt(item.prompt)) { exclude(uid, 'repair', r.id, 'prompt too long', item.prompt); continue; }
    unit.repairs.push(item);
  }

  // Categories: Growbloom lists (via Maxima) and Languini sorting packs.
  unit.categories = [];
  for (const c of mu.categories || []) {
    const yes = uniq(c.yes.map(clean)), no = uniq((c.no || []).map(clean));
    if (yes.length) unit.categories.push({ id: c.id, title: sentenceCase(c.title), yes, no });
  }
  const pack = sortingPacks.find(p => p.unit === uid);
  if (pack) {
    pack.categories.forEach((c, i) => {
      const yes = uniq(pack.cards.filter(card => card.category === i).map(card => clean(card.word)));
      const no = uniq(pack.cards.filter(card => card.category !== i).map(card => clean(card.word)));
      if (yes.length) unit.categories.push({ id: c.id, title: sentenceCase(c.name), titleTr: clean(c.translation), yes, no, pack: `${uid}-sort` });
    });
  }

  // Dialogue links (two exchanges in a row) from Languini, only when both questions exist here.
  const qIds = new Set(unit.questions.map(q => q.id));
  unit.dialogues = dialogueLinks.filter(d => d.unit === uid && qIds.has(d.first) && qIds.has(d.second))
    .map((d, i) => ({ id: `${uid}-dlg-${i + 1}`, topic: clean(d.topic), first: d.first, second: d.second }));

  // Numbers 0–200 only for units whose curriculum teaches numbers.
  if (mu.numberProfile && mu.numberProfile.cardinalMax > 0) {
    const min = Math.max(0, mu.numberProfile.cardinalMin ?? 0), max = Math.min(200, mu.numberProfile.cardinalMax);
    if (max > min) unit.numbers = { min, max };
  }
  return unit;
}

// ---------- run ----------
const out = {};
for (const g of GRADES) {
  const maxima = load('maxima', `language-pack/grade-${g}.json`);
  const tower = load('towerswarm', `content/grade${g}.json`);
  const towerUnits = new Map(tower.units.map(u => [u.id, u]));
  const units = maxima.units.map(mu => convertUnit(mu, towerUnits.get(mu.id), g));
  for (const u of units) for (const field of ['words', 'clues', 'halves', 'sentences', 'questions', 'contexts', 'gaps', 'repairs']) {
    for (const item of u[field]) addWords(JSON.stringify(item));
  }
  for (const u of units) for (const c of u.categories) addWords(c.yes.join(' ') + ' ' + c.no.join(' '));
  out[g] = { grade: g, cefr: maxima.units[0]?.cefr || null, units };
}

// Misspellings (after the dictionary holds every bank word, across all grades).
for (const g of GRADES) for (const u of out[g].units) {
  u.misspellings = [];
  const seen = new Set();
  for (const w of u.words) {
    if (!/^[a-z]+( [a-z]+)?$/.test(w.en) || seen.has(key(w.en))) continue;
    const wrong = makeMisspelling(w.en, DICTIONARY);
    if (!wrong) continue;
    seen.add(key(w.en));
    u.misspellings.push({ id: w.id + '-ms', word: w.en, wrong });
    log.misspellings.push({ unit: u.id, word: w.en, wrong });
  }
}

// ---------- write ----------
const contentDir = join(ROOT, 'content');
mkdirSync(contentDir, { recursive: true });
const imported = new Date().toISOString().slice(0, 10);
const dedupSources = [...new Map(sourceFiles.map(s => [s.repo + s.file, s])).values()];
for (const g of GRADES) {
  const data = { schemaVersion: 1, grade: g, cefr: out[g].cefr, imported, sources: dedupSources.filter(s => !/grade-?\d/.test(s.file) || s.file.includes(String(g))), units: out[g].units };
  writeFileSync(join(contentDir, `grade${g}.json`), JSON.stringify(data) + '\n');
}

// Pictures: copy exactly the referenced files and their licence.
const picDir = join(ROOT, 'public', 'pictures');
rmSync(picDir, { recursive: true, force: true });
let copied = 0;
for (const p of [...log.pictures].map(JSON.parse)) {
  const from = p.from === 'maxima' ? join(SRC.maxima, 'language-pack', p.path) : join(SRC.towerswarm, p.path);
  const to = join(picDir, p.from === 'maxima' ? p.path.replace(/^assets\//, '') : 'emoji/' + basename(p.path));
  if (!existsSync(from)) { console.error('Missing picture file', from); process.exit(1); }
  mkdirSync(dirname(to), { recursive: true });
  if (!existsSync(to)) { copyFileSync(from, to); copied++; }
}
copyFileSync(join(SRC.maxima, 'language-pack/assets/emoji/LICENSE.txt'), join(picDir, 'emoji', 'LICENSE.txt'));
writeFileSync(join(picDir, 'README.txt'), [
  'Pictures used by SnowPax, copied unchanged from Mr. Saymaz\'s own games:',
  '- emoji/: Fluent Emoji 3D by Microsoft (MIT licence, see emoji/LICENSE.txt), as packaged in solMaxima and Tower Swarm.',
  '- pictograms/: original pictograms drawn for solMaxima by the Maxima project (Mr. Saymaz).',
  'No other images were downloaded.', '',
].join('\n'));

writeFileSync(join(contentDir, 'IMPORT-LOG.json'), JSON.stringify({
  imported, sources: dedupSources, excluded: log.excluded, merged: log.merged, added: log.added,
  blockFixes: log.blockFixes, misspellings: log.misspellings,
}, null, 1) + '\n');

const n = GRADES.reduce((a, g) => a + out[g].units.length, 0);
console.log(`Imported ${n} units into content/grade5…8.json. Pictures: ${copied} files. Excluded ${log.excluded.length}, merged ${log.merged.length}, added ${log.added.length}, block fixes ${log.blockFixes.length}, misspellings ${log.misspellings.length}.`);
