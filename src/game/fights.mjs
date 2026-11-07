// Prepare, then fight. English and fighting are kept apart, so nobody reads while being hit, but
// the English decides the fight: right answers recruit neighbourhood children to your team and
// earn ❄ snowflakes, the money of the Snow Shop. No DOM here, so it is tested in node.
//
// The arena's one outpost (Kasımpaşa), after the sled ride in (its rare word snowflakes are the
// first ❄):
//   1. camp: neighbourhood children wait at the home end in plain coats; walk up to one and answer
//      their question: right first time and they join your team (team colour, puffer jacket) and
//      you get a ❄; wrong and they wait, ask again in a moment; no rivals on the field yet;
//   2. the Snow Shop: ❄ buy boosts (big gloves, quick hands, super start, warm coat), 5 ❄ each,
//      kept for the whole outpost; the sled and the camp pay for one; then Fight!;
//   3. the opening round: the rival team keeps coming back from its camp; freeze `goal` rivals to
//      break the line (after `max` seconds they give up anyway, so a class is never stuck);
//   4. Part 1 of the English (two places' tasks; each right first try is a ❄), the shop (one more
//      boost if it went well);
//   5. "They strike back!": hold the circle for `seconds` (the clock stops while rivals stand in it
//      with nobody of ours);
//   6. Part 2 (the other three places' tasks, ❄ again), the shop (two more boosts), then the
//      Final Showdown: the rival captain, tough and quick to warm up again, with the whole rival
//      team; freeze the captain within `showdown.seconds`. Without boosts that is very hard. If the
//      time runs out, a short snowflake round of English, the shop, and the Showdown again.
// Being frozen in a fight never costs a life: the kid goes back to the spawn, as in brawler games.
// Word snowmen (practice only, never counted toward the 80%) walk out in a tidy row, side by side,
// slowly and without throwing: freeze the one with the English word for the Turkish word shown.

export const FIGHT_PLANS = {
  long: {
    // camp: neighbourhood children waiting at the home end (v, d: across and rows south of the
    // outpost centre), one role each
    camp: { kids: [[-7, 24.5, 'thrower'], [0, 21.8, 'lobber'], [7, 24.5, 'sprayer']], max: 75, retry: 4 },
    build: 35,
    perFamily: 4, // items of each place's task (Part 1: two places, Part 2: three)
    recruits: { max: 3, extraSnowmen: 1 }, // the camp's children (3 at most); each one brings an extra snowman to the rivals' side
    open: { goal: 12, max: 90, trickle: 8, snowmen: 4 },
    strike: { seconds: 50, max: 85 },
    final: 30,
    // the Final Showdown: freeze the rival captain (warmth × the snowman's, warms up again after
    // `regenDelay` s without a hit; teammates' snowballs count × `others`: it is the student's
    // duel, the team keeps the rest busy); a short snowflake round of `retryItems` before trying again,
    // and the captain × `tired` warmth on each new try
    showdown: { seconds: 80, captainWarmth: 2.4, regenDelay: 2.5, regenRate: 14, others: 0.15, tired: 0.8, retryItems: 4 },
    // word snowmen: a tidy row walking slowly, side by side, never throwing
    hunt: { every: 18, first: 8, seconds: 24, size: 3, bonus: 2, gap: 4 },
  },
};

// The neighbourhood children who can join (each plays differently), and what ❄ snowflakes buy.
export const ROLES = {
  thrower: { name: 'Quick thrower', kit: 'thrower', style: 'rusher', icon: '❄️', tip: 'Fast snowballs, runs in' },
  lobber: { name: 'Lobber', kit: 'lobber', style: 'sniper', icon: '🌨️', tip: 'Throws over walls' },
  sprayer: { name: 'Sprayer', kit: 'sprayer', style: 'flanker', icon: '💨', tip: 'Three snowballs up close' },
  builder: { name: 'Wall builder', kit: 'thrower', style: 'builder', icon: '🧱', tip: 'Puts up snow walls' },
};
// first names for the neighbourhood children (girls and boys)
export const KID_NAMES = { girl: ['Elif', 'Zeynep', 'Defne', 'Ada', 'Nil', 'Ela'], boy: ['Can', 'Emir', 'Mert', 'Kaan', 'Ege', 'Arda'] };
export const SHOP = {
  // every boost costs the same and lasts the whole outpost (every fight there)
  boosts: {
    gloves: { name: 'Big gloves', cost: 5, icon: '🧤', tip: '4 snowballs instead of 3', keep: true },
    quick: { name: 'Quick hands', cost: 5, icon: '⚡', tip: 'Snowballs come back faster', keep: true },
    super: { name: 'Super start', cost: 5, icon: '☄️', tip: 'Every fight starts with half a super', keep: true },
    coat: { name: 'Warm coat', cost: 5, icon: '🧥', tip: 'The first hit in each fight does not count', keep: true },
  },
};

// The ❄ snowflakes, the team's recruits and the boosts at one outpost (no DOM, tested in node).
export class Armoury {
  constructor({ max = 3 } = {}) { this.flakes = 0; this.earned = 0; this.max = max; this.team = []; this.boosts = new Set(); this.next = new Set(); }
  earn(n = 1) { this.flakes += n; this.earned += n; }
  // a child joined (from the camp)
  join(role) { if (this.team.length >= this.max || !ROLES[role]) return false; this.team.push(role); return true; }
  canBoost(id) { const b = SHOP.boosts[id]; return !!(b && !(b.keep ? this.boosts : this.next).has(id) && this.flakes >= b.cost); }
  buyBoost(id) { if (!this.canBoost(id)) return false; const b = SHOP.boosts[id]; this.flakes -= b.cost; (b.keep ? this.boosts : this.next).add(id); return true; }
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

// The word snowman hunts: each one picks a target word and distractors. The targets go round the
// whole unit in a shuffled order before any word comes again (a bag); a missed word comes back once,
// three hunts later, and then takes its turn like the others.
export class WordHunt {
  constructor(unit, rng = Math.random, size = 3) {
    this.words = huntWords(unit); this.rng = rng; this.size = size; this.missed = new Map(); this.bag = []; this.retry = []; this.last = null;
    this.right = 0; this.total = 0; this.cur = null;
  }
  get ready() { return this.words.length >= this.size; }
  shuffle(list) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  // a new hunt: { target, words } — words has the target and size-1 others, shuffled
  next() {
    if (!this.ready) return null;
    let target = null;
    const due = this.retry.findIndex(r => r.at <= this.total && r.word.id !== this.last); // a missed word, back once
    if (due >= 0) target = this.retry.splice(due, 1)[0].word;
    else {
      if (!this.bag.length) { this.bag = this.shuffle(this.words); if (this.bag.length > 1 && this.bag.at(-1).id === this.last) this.bag.unshift(this.bag.pop()); } // a new round of the bag, never the same word twice in a row
      target = this.bag.pop();
    }
    this.bag = this.bag.filter(w => w.id !== target.id || w === target);
    const others = this.shuffle(this.words.filter(w => w.id !== target.id)).slice(0, this.size - 1);
    const words = this.shuffle([target, ...others]);
    this.last = target.id;
    this.cur = { target, words, done: false, wrong: 0 }; this.total++;
    return this.cur;
  }
  miss(word) { this.missed.set(word.id, (this.missed.get(word.id) || 0) + 1); if (!this.retry.some(r => r.word.id === word.id)) this.retry.push({ word, at: this.total + 3 }); }
  // a word snowman was frozen: 'right' (the hunt is won), 'wrong' (keep looking) or null
  frozen(word) {
    const h = this.cur; if (!h || h.done || !word) return null;
    if (word.id === h.target.id) { h.done = true; if (!h.wrong) this.right++; else this.miss(h.target); return 'right'; }
    h.wrong++; return 'wrong';
  }
  // time ran out
  timeout() { const h = this.cur; if (!h || h.done) return null; h.done = true; this.miss(h.target); return h.target; }
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
