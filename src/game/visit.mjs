// One outpost visit (brief §9): SEIZE by answering rounds from the outpost's task family, then
// DEFEND with one short round between rival waves. No DOM here, so it is tested in node.
// Items are counted the way the 80% rule counts them: each pair, card or question once.
import { CONFIG } from '../config.js';
import { makeRound } from '../tasks/subtasks.mjs';

const D = CONFIG.demand;

// How many scorable items a step holds.
export const stepItems = st => (st.kind === 'match' ? st.left.length : st.kind === 'sort' ? st.cards.length : 1);
// Order-pairs become two ordinary steps, so the card only ever shows one thing at a time.
export const flatten = steps => steps.flatMap(s => (s.kind === 'order-pair' ? s.steps : [s]));

// Seconds for a step on the Challenge pace (scaled by the pace's taskTime).
const SECONDS = { choice: 14, listen: 15, spell: 18, order: 20, matchPair: 9, sortCard: 8 };
export function stepSeconds(st, pace = 'challenge') {
  const k = CONFIG.pace[pace]?.taskTime ?? 1;
  const base = st.kind === 'match' ? SECONDS.matchPair * st.left.length : st.kind === 'sort' ? SECONDS.sortCard * st.cards.length : SECONDS[st.kind] || 15;
  return Math.round(base * k);
}

export class Visit {
  // families + perFamily: a mixed visit (the Schoolyard Showdown) that takes about perFamily items
  // from each family in turn; each family finished raises one banner.
  constructor({ unit, family, arena = 1, rng = Math.random, history = [], speech = true, phase = 'seize', families = null, perFamily = 2 }) {
    this.unit = unit; this.family = family; this.arena = arena; this.rng = rng; this.history = history; this.speech = speech;
    this.families = families; this.perFamily = perFamily;
    this.setPhase(phase);
  }
  setPhase(phase) {
    this.phase = phase;
    const rounds = phase === 'seize' ? D.seizeRounds[this.arena - 1] : D.defendRounds[this.arena - 1];
    this.total = this.families ? this.families.length * this.perFamily : rounds * D.itemsPerRound; this.done = 0; this.firstTry = 0; this.queue = []; this.title = null; this.coach = null;
    this.famIdx = 0; this.famDone = 0; if (this.families) this.family = this.families[0];
  }
  // banners raised so far (mixed visits): one per family whose share is answered
  get bannersUp() { return this.families ? Math.min(this.families.length, this.famIdx + (this.famDone >= this.perFamily ? 1 : 0)) : 0; }
  get progress() { return this.families ? this.bannersUp / this.families.length + (this.famDone < this.perFamily ? this.famDone / this.perFamily / this.families.length : 0) : Math.min(1, this.done / this.total); } // a finished family counts once, in bannersUp
  get finished() { return this.families ? this.bannersUp >= this.families.length : this.done >= this.total; }
  // The next step to show (a fresh round when the last one is used up), or null when finished.
  next() {
    if (this.finished) return null;
    if (this.families && this.famDone >= this.perFamily) { this.famIdx++; this.famDone = 0; this.family = this.families[this.famIdx]; this.queue = []; } // next banner, next family
    if (!this.queue.length) {
      const round = makeRound(this.unit, this.family, this.arena, { rng: this.rng, history: this.history, speech: this.speech });
      if (!round) { if (this.families) { this.famDone = this.perFamily; return this.next(); } return null; } // nothing in this family: skip its banner's tasks
      this.history.push(round.subtask); this.title = round.title; this.coach = round.coach; this.subtask = round.subtask;
      this.queue = flatten(round.steps);
    }
    return this.queue.shift();
  }
  answer(correctFirstTry) { this.done++; this.famDone++; if (correctFirstTry) this.firstTry++; }
}

// One quick question for a hot-cocoa cup: a clue for a word of this unit (or an ending, a gap …).
export function cocoaQuestion(unit, rng = Math.random) {
  for (const fam of ['answer', 'match']) {
    const round = makeRound(unit, fam, 1, { rng, speech: false });
    const step = round && flatten(round.steps).find(s => s.kind === 'choice');
    if (step) return step;
  }
  const w = unit.words[Math.floor(rng() * unit.words.length)], others = unit.words.filter(x => x !== w).sort(() => rng() - 0.5).slice(0, 2);
  const options = [w, ...others].sort(() => rng() - 0.5).map(x => x.tr);
  return { kind: 'choice', prompt: `What is "${w.en}" in Turkish?`, options, answer: options.indexOf(w.tr), answerText: w.tr, sourceIds: [w.id] };
}

// A question a neighbourhood child asks you face to face (the camp): one of the unit's questions with
// its answer and two others as replies ("Who leads the school?" – "The headteacher leads it."); a
// cocoa-style question when a unit has none. `used` keeps the camp from asking one twice.
export function talkQuestion(unit, rng = Math.random, used = new Set()) {
  const qs = (unit.questions || []).filter(q => q.q && q.a && (q.options || []).length >= 2 && q.options.includes(q.a) && !used.has(q.id));
  if (!qs.length) return cocoaQuestion(unit, rng);
  const q = qs[Math.floor(rng() * qs.length)]; used.add(q.id);
  const options = q.options.slice(0, 3); if (!options.includes(q.a)) options[0] = q.a;
  for (let i = options.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [options[i], options[j]] = [options[j], options[i]]; }
  return { kind: 'choice', prompt: q.q, options, answer: options.indexOf(q.a), answerText: q.a, sourceIds: [q.id], talk: true };
}

// Words for the glowing snowflakes: missed words first, then the rest of the unit, shuffled.
export function flakeWords(unit, n, missed = {}, rng = Math.random) {
  const words = unit.words.filter(w => w.en && w.tr && w.en.length <= 16);
  const weight = w => (missed[w.id] || 0) * 10 + rng();
  return words.sort((a, b) => weight(b) - weight(a)).slice(0, n).map(w => ({ id: w.id, en: w.en, tr: w.tr }));
}
