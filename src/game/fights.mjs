// Prepare, then fight (the Archery Ground sample, from the third play-test talk). English and
// fighting are kept apart, so nobody reads while being hit, but the English decides the fight:
// right answers recruit neighbourhood children to your team and earn snow stars for more recruits
// and boosts. No DOM here, so it is tested in node.
//
// An outpost:
//   1. camp: neighbourhood children wait at the home end in plain coats; walk up to one and answer
//      their question: right first time and they join your team (team colour, puffer jacket) and
//      you get a star; wrong and they wait, ask again in a moment; no rivals on the field yet;
//   2. build: the Snow Shop, where stars buy boosts (big gloves, quick hands, super start,
//      warm coat); then Fight!;
//   3. the opening round: the rival team keeps coming back from its camp; freeze `goal` rivals to
//      break the line (after `max` seconds they give up anyway, so a class is never stuck);
//   4. part 1 of the outpost's English (each right first try is also a star), build;
//   5. "They strike back!": hold the circle for `seconds` (the clock stops while rivals stand in it
//      with nobody of ours);
//   6. part 2 (stars again), build, then the final wave, `final` seconds at most.
// Being frozen in a fight never costs a life: the kid goes back to the spawn, as in brawler games.
// Word snowmen (practice only, never counted toward the 80%) walk out in a tidy row, side by side,
// slowly and without throwing: freeze the one with the English word for the Turkish word shown.

export const FIGHT_PLANS = {
  long: {
    // camp: neighbourhood children waiting at the home end (v, d: across and rows south of the
    // outpost centre), one role each
    camp: { kids: [[-7, 24.5, 'thrower'], [0, 21.8, 'lobber'], [7, 24.5, 'sprayer']], max: 75, retry: 4 },
    build: 35,
    recruits: { max: 3, extraSnowmen: 1 }, // the camp's children (3 at most); each one brings an extra snowman to the rivals' side
    open: { goal: 12, max: 90, trickle: 8, snowmen: 4 },
    strike: { seconds: 50, max: 85 },
    final: 30,
    // word snowmen: a tidy row walking slowly, side by side, never throwing
    hunt: { every: 18, first: 8, seconds: 24, size: 3, bonus: 2, gap: 4 },
  },
};

// The neighbourhood children who can join (each plays differently), and what stars buy.
export const ROLES = {
  thrower: { name: 'Quick thrower', kit: 'thrower', style: 'rusher', icon: '❄️', tip: 'Fast snowballs, runs in' },
  lobber: { name: 'Lobber', kit: 'lobber', style: 'sniper', icon: '🌨️', tip: 'Throws over walls' },
  sprayer: { name: 'Sprayer', kit: 'sprayer', style: 'flanker', icon: '💨', tip: 'Three snowballs up close' },
  builder: { name: 'Wall builder', kit: 'thrower', style: 'builder', icon: '🧱', tip: 'Puts up snow walls' },
};
// first names for the neighbourhood children (girls and boys)
export const KID_NAMES = { girl: ['Elif', 'Zeynep', 'Defne', 'Ada', 'Nil', 'Ela'], boy: ['Can', 'Emir', 'Mert', 'Kaan', 'Ege', 'Arda'] };
export const SHOP = {
  boosts: {
    gloves: { name: 'Big gloves', cost: 2, icon: '🧤', tip: '4 snowballs instead of 3', keep: true },
    quick: { name: 'Quick hands', cost: 2, icon: '⚡', tip: 'Snowballs come back faster', keep: true },
    super: { name: 'Super start', cost: 1, icon: '⭐', tip: 'Start the fight with half a super' },
    coat: { name: 'Warm coat', cost: 1, icon: '🧥', tip: 'The first hit does not count' },
  },
};

// The stars, the team's recruits and the boosts at one outpost (no DOM, tested in node).
export class Armoury {
  constructor({ max = 3 } = {}) { this.stars = 0; this.earned = 0; this.max = max; this.team = []; this.boosts = new Set(); this.next = new Set(); }
  earn(n = 1) { this.stars += n; this.earned += n; }
  // a child joined (from the camp)
  join(role) { if (this.team.length >= this.max || !ROLES[role]) return false; this.team.push(role); return true; }
  canBoost(id) { const b = SHOP.boosts[id]; return !!(b && !(b.keep ? this.boosts : this.next).has(id) && this.stars >= b.cost); }
  buyBoost(id) { if (!this.canBoost(id)) return false; const b = SHOP.boosts[id]; this.stars -= b.cost; (b.keep ? this.boosts : this.next).add(id); return true; }
  // the boosts for the fight that is starting (the one-fight ones are used up)
  takeFight() { const all = new Set([...this.boosts, ...this.next]); this.next = new Set(); return all; }
}

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
