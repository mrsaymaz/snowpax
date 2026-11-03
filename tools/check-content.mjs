#!/usr/bin/env node
// Fails (exit 1) on: missing answers, duplicate IDs, a right answer that is also offered as a
// wrong option, empty units, or text too long for the 640 × 360 task card.
// Runs in `npm run build`. Also runs every task generator on every unit and arena with
// several seeds, and checks each generated step (src/tasks/validate.mjs).
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SUBTASKS, FAMILIES, makeRng, norm, usableSubtasks, capacityOf } from '../src/tasks/subtasks.mjs';
import { validateStep } from '../src/tasks/validate.mjs';
import { fitsPrompt, fitsOption, fitsTile } from '../src/tasks/layout.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function checkContent({ seeds = 4, quiet = false, grades = null } = {}) {
  const errors = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const ids = new Map();
  const seeId = (id, where) => { if (!id) err(where, 'missing id'); else if (ids.has(id)) err(where, `duplicate id ${id} (also in ${ids.get(id)})`); else ids.set(id, where); };
  const answerOnce = (where, options, answer) => {
    if (!clean(answer)) return err(where, 'missing answer');
    const hits = options.filter(o => norm(o) === norm(answer)).length;
    if (hits !== 1) err(where, hits ? 'answer appears more than once among the options' : 'answer missing from options');
    if (new Set(options.map(norm)).size !== options.length) err(where, 'options repeat');
  };
  const clean = s => String(s ?? '').trim();
  let units = 0, steps = 0;

  for (const g of [5, 6, 7, 8]) {
    let data = grades?.[g];
    if (grades && !data) continue;
    if (!data) {
      try { data = JSON.parse(readFileSync(join(ROOT, 'content', `grade${g}.json`), 'utf8')); }
      catch (e) { err(`grade${g}`, 'missing or unreadable: ' + e.message); continue; }
    }
    if (!data.units?.length) err(`grade${g}`, 'no units');
    for (const u of data.units || []) {
      units++;
      const at = (type, id) => `${u.id} ${type} ${id}`;
      seeId(u.id, `grade${g}`);
      if (!clean(u.title)) err(u.id, 'unit has no title');
      const total = ['words', 'clues', 'halves', 'sentences', 'questions', 'gaps', 'repairs'].reduce((n, k) => n + (u[k]?.length || 0), 0);
      if (!total) err(u.id, 'empty unit');

      for (const w of u.words) { seeId(w.id, at('word', w.id)); if (!clean(w.en) || !clean(w.tr)) err(at('word', w.id), 'missing English or Turkish'); }
      for (const c of u.clues) { seeId(c.id, at('clue', c.id)); answerOnce(at('clue', c.id), c.options, c.answer); if (!fitsPrompt(c.clue)) err(at('clue', c.id), 'clue too long'); c.options.forEach(o => fitsOption(o) || err(at('clue', c.id), `option too long: ${o}`)); }
      for (const h of u.halves) {
        seeId(h.id, at('half', h.id));
        if (!clean(h.start) || !clean(h.end)) err(at('half', h.id), 'missing start or end');
        if (h.wrong.some(w => norm(w) === norm(h.end))) err(at('half', h.id), 'right ending listed as wrong');
        [h.start, h.end, ...h.wrong].forEach(t => fitsOption(t) || err(at('half', h.id), `too long: ${t}`));
      }
      for (const s of u.sentences) {
        seeId(s.id, at('sentence', s.id));
        if (s.blocks.join(' ') !== s.text) err(at('sentence', s.id), 'blocks do not rebuild the sentence');
      }
      for (const q of u.questions) { seeId(q.id, at('question', q.id)); answerOnce(at('question', q.id), q.options, q.a); if (!fitsPrompt(q.q)) err(at('question', q.id), 'question too long'); }
      for (const c of u.contexts) {
        seeId(c.id, at('context', c.id));
        for (const q of c.questions) { seeId(q.id, at('context question', q.id)); answerOnce(at('context question', q.id), q.options, q.a); if (!fitsPrompt(c.text + '\n' + q.q)) err(at('context', c.id), 'text + question too long'); }
      }
      for (const x of u.gaps) { seeId(x.id, at('gap', x.id)); answerOnce(at('gap', x.id), x.options, x.answer); if (!fitsPrompt(x.prompt)) err(at('gap', x.id), 'prompt too long'); }
      for (const x of u.repairs) {
        seeId(x.id, at('repair', x.id)); answerOnce(at('repair', x.id), x.options, x.answer);
        if (norm(x.broken) === norm(x.answer)) err(at('repair', x.id), 'broken word equals the repair');
      }
      for (const c of u.categories) {
        seeId(c.id, at('category', c.id));
        if (!c.yes.length) err(at('category', c.id), 'empty category');
        const yes = new Set(c.yes.map(norm));
        if (c.no.some(n => yes.has(norm(n)))) err(at('category', c.id), 'an item is both in and out of the group');
      }
      for (const m of u.misspellings || []) { seeId(m.id, at('misspelling', m.id)); if (norm(m.wrong) === norm(m.word)) err(at('misspelling', m.id), 'misspelling equals the word'); }

      // Every family must be able to run at Arena 1 (otherwise the unit is unplayable).
      for (const f of FAMILIES) if (!usableSubtasks(u, f.id, 1).length) err(u.id, `the ${f.name} outpost cannot run at Arena 1`);

      // Generated steps.
      for (const sub of SUBTASKS) for (const arena of [1, 2, 3]) {
        if (arena < sub.minArena || capacityOf(sub, u, arena) < 3) continue;
        for (let seed = 1; seed <= seeds; seed++) {
          const round = sub.round(u, arena, { rng: makeRng(seed * 101 + arena), missed: new Map(), recent: new Set() });
          if (!round) continue;
          for (const step of round) { steps++; for (const problem of validateStep(step)) err(`${u.id} ${sub.id} arena ${arena} seed ${seed}`, problem); }
        }
      }
    }
  }
  if (!quiet) {
    if (errors.length) { console.error(`Content check FAILED with ${errors.length} problem(s):`); for (const e of errors.slice(0, 60)) console.error(' - ' + e); if (errors.length > 60) console.error(` … and ${errors.length - 60} more`); }
    else console.log(`Content check passed: ${units} units, ${ids.size} IDs, ${steps} generated steps checked.`);
  }
  return errors;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(checkContent().length ? 1 : 0);
