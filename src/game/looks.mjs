// How each kid looks: girl or boy, skin tone, hair colour and hair style. Every team of two or
// more always has girls and boys together, never only one or the other.
export const SKIN_TONES = 5, HAIR_COLOURS = 5;
export const HAIR_STYLES = { girl: ['pigtails', 'braids', 'ponytail'], boy: ['short', 'curly', 'tuft'] };
export const GENDERS = ['girl', 'boy'];

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length) % arr.length];
const other = g => (g === 'girl' ? 'boy' : 'girl');

// genders for a team of n; `first` (the player's choice) keeps its place at the front
export function teamGenders(n, rng = Math.random, first = null) {
  if (n <= 0) return [];
  const g0 = first || pick(GENDERS, rng), out = [g0];
  if (n >= 2) out.push(other(g0));
  while (out.length < n) out.push(pick(GENDERS, rng));
  if (!first) for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  else for (let i = out.length - 1; i > 1; i--) { const j = 1 + Math.floor(rng() * i); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

export function makeLook(gender, rng = Math.random, taken = new Set()) {
  let look;
  for (let k = 0; k < 12; k++) { // try not to repeat a skin + hair pair within the team
    look = { gender, skin: Math.floor(rng() * SKIN_TONES), hair: Math.floor(rng() * HAIR_COLOURS), style: pick(HAIR_STYLES[gender], rng) };
    if (!taken.has(look.skin + ':' + look.hair)) break;
  }
  taken.add(look.skin + ':' + look.hair);
  return look;
}

// a full player look from a saved one, filling in anything missing
export function playerLook(saved, rng = Math.random) {
  const gender = GENDERS.includes(saved?.gender) ? saved.gender : pick(GENDERS, rng);
  const base = makeLook(gender, rng);
  const ok = (v, n) => Number.isInteger(v) && v >= 0 && v < n;
  return {
    gender,
    skin: ok(saved?.skin, SKIN_TONES) ? saved.skin : base.skin,
    hair: ok(saved?.hair, HAIR_COLOURS) ? saved.hair : base.hair,
    style: HAIR_STYLES[gender].includes(saved?.style) ? saved.style : base.style,
  };
}

// gives every seat without a look one, so that each team mixes girls and boys
export function assignLooks(seats, rng = Math.random) {
  const teams = new Map();
  for (const s of seats) { if (s.role === 'minion') continue; const k = s.side + ':' + s.team; if (!teams.has(k)) teams.set(k, []); teams.get(k).push(s); }
  for (const list of teams.values()) {
    const fixed = list.find(s => s.look), order = fixed ? [fixed, ...list.filter(s => s !== fixed)] : list;
    const genders = teamGenders(order.length, rng, fixed?.look.gender || null), taken = new Set();
    if (fixed) taken.add(fixed.look.skin + ':' + fixed.look.hair);
    order.forEach((s, i) => { if (!s.look) s.look = makeLook(genders[i], rng, taken); });
  }
  return seats;
}
