// Longer snowball fights with English inside them (the Archery Ground sample, from the third
// play-test talk). No DOM here, so it is tested in node.
//
// An outpost is taken in two halves, with fights round them:
//   1. the opening round: the rival team holds its line and keeps coming back from its camp;
//      snowmen keep walking out. Freeze `goal` rivals to break the line (after `max` seconds the
//      rivals give up anyway, so a class is never stuck);
//   2. the first half of the English (one task family);
//   3. "They strike back!": hold the circle for `seconds` (the clock stops while rivals stand in
//      the circle with nobody of ours);
//   4. the second half of the English (the other family);
//   5. the final wave, `final` seconds at most.
// Being frozen in a fight never costs a life: the kid goes back to the spawn, as in brawler games.
//
// English inside the fights:
//   - word snowmen: three snowmen walk out carrying English words, and the student is told one
//     word's Turkish meaning: freeze the snowman with the right English word (practice only, never
//     counted toward the 80%, because a snowball can always hit the wrong snowman by accident);
//   - supply crates: a crate drops on the field; walk onto it for one quick question, and a right
//     answer refills the whole team's snowballs and charges the super.

export const FIGHT_PLANS = {
  long: {
    open: { goal: 12, max: 90, trickle: 8, snowmen: 4 },
    strike: { seconds: 50, max: 85 },
    final: 30,
    hunt: { every: 16, first: 9, seconds: 22, size: 3, bonus: 2 },
    crate: { every: 20, first: 14 },
  },
};

// Words that read well on a snowman's sign: short English, with a Turkish meaning.
export function huntWords(unit) {
  const seen = new Set();
  return (unit?.words || []).filter(w => {
    if (!w.en || !w.tr || w.en.length > 12 || /[^A-Za-z' -]/.test(w.en) || seen.has(w.en.toLowerCase()) || seen.has('tr:' + w.tr)) return false;
    seen.add(w.en.toLowerCase()); seen.add('tr:' + w.tr); return true;
  });
}

// The word snowman hunts: each one picks a target word and distractors, missed words come back.
export class WordHunt {
  constructor(unit, rng = Math.random, size = 3) {
    this.words = huntWords(unit); this.rng = rng; this.size = size; this.recent = []; this.missed = new Map();
    this.right = 0; this.total = 0; this.cur = null;
  }
  get ready() { return this.words.length >= this.size; }
  // a new hunt: { target, words } — words has the target and size-1 others, shuffled
  next() {
    if (!this.ready) return null;
    const weight = w => (this.missed.get(w.id) || 0) * 3 + (this.recent.includes(w.id) ? -5 : 0) + this.rng();
    const target = this.words.slice().sort((a, b) => weight(b) - weight(a))[0];
    const others = this.words.filter(w => w !== target).sort(() => this.rng() - 0.5).slice(0, this.size - 1);
    const words = [target, ...others].sort(() => this.rng() - 0.5);
    this.recent = [target.id, ...this.recent].slice(0, 4);
    this.cur = { target, words, done: false, wrong: 0 }; this.total++;
    return this.cur;
  }
  // a word snowman was frozen: 'right' (the hunt is won), 'wrong' (keep looking) or null
  frozen(word) {
    const h = this.cur; if (!h || h.done || !word) return null;
    if (word.id === h.target.id) { h.done = true; if (!h.wrong) this.right++; else this.missed.set(h.target.id, (this.missed.get(h.target.id) || 0) + 1); return 'right'; }
    h.wrong++; return 'wrong';
  }
  // time ran out
  timeout() { const h = this.cur; if (!h || h.done) return null; h.done = true; this.missed.set(h.target.id, (this.missed.get(h.target.id) || 0) + 1); return h.target; }
}

// Where a supply crate lands: an open spot in the middle of the field, away from the team.
export function supplySpot(grid, z, rng = Math.random, avoid = []) {
  const f = z.battlefield; if (!f) return null;
  for (let k = 0; k < 40; k++) {
    const v = (rng() * 2 - 1) * (f.hw - 2.5), d = 9 + rng() * (f.front - 16), x = z.x + v, zz = z.z + d;
    if (!grid.freeCircle(x, zz, 0.6)) continue;
    if (avoid.some(p => Math.hypot(p.x - x, p.z - zz) < 3)) continue;
    return { x, z: zz };
  }
  return null;
}

// The family whose station (3D activity) a task family opens in: each family keeps its own
// activity wherever it is played (matching at the fountain, sorting at the archery lodge …).
export const FAMILY_STATION = { answer: 'boulevard', sort: 'archery', match: 'kizilay', build: 'sururi', listen: 'waterfront' };
