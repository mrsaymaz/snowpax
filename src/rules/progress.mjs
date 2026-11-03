// Game rules that do not depend on rendering: rival draw, arena results and the 80% rule,
// unit progress, and the per-unit record of missed items.
import { CONFIG, TEAM_IDS } from '../config.js';

// ---------- rival draw (brief §6) ----------
// Shuffle the three other teams once per unit: Arena 1 vs the first, 2 vs the second, 3 vs the third.
export function drawRivals(myTeam, rng = Math.random) {
  if (!TEAM_IDS.includes(myTeam)) throw new Error(`Unknown team ${myTeam}`);
  const others = TEAM_IDS.filter(t => t !== myTeam);
  for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
  return others;
}

export const arenaName = i => CONFIG.arenas[i]?.name;
export function nextRivalLine(rivals, arenaIndex) {
  const t = CONFIG.teams[rivals[arenaIndex]], a = CONFIG.arenas[arenaIndex];
  return t && a ? `Next rival: ${t.name} at ${a.name.replace(/^The /, 'the ')}` : '';
}

// ---------- unit progress ----------
export function newUnitProgress(myTeam, rng) {
  return {
    rivals: drawRivals(myTeam, rng),
    arenas: CONFIG.arenas.map((_, i) => ({ unlocked: i === 0, held: [], run: null, best: 0, won: false, passed: false })),
    mastered: false,
    missed: {},
  };
}

// The rival order is fixed for a unit, including retries; a new unit gets its own draw.
export function ensureUnit(save, unitId, rng) {
  if (!save.units[unitId]) save.units[unitId] = newUnitProgress(save.team, rng);
  return save.units[unitId];
}

// A run is one play of an arena. First-try results of tasks count toward the 80%;
// sled-run spelling is practice and never counts.
export function startRun(unit, arenaIndex) {
  const a = unit.arenas[arenaIndex];
  if (!a.unlocked) throw new Error('Arena is locked');
  a.held = [];
  a.run = { firstTry: 0, total: 0 };
  return a.run;
}

export function recordItem(unit, arenaIndex, { correctFirstTry, practice = false, itemId = null }) {
  const a = unit.arenas[arenaIndex];
  if (!a.run) a.run = { firstTry: 0, total: 0 };
  if (!practice) { a.run.total++; if (correctFirstTry) a.run.firstTry++; }
  if (itemId) noteMissed(unit, itemId, correctFirstTry);
}

export function holdOutpost(unit, arenaIndex, family) {
  const a = unit.arenas[arenaIndex];
  if (!a.held.includes(family)) a.held.push(family);
  return a.held.length;
}

export const accuracyOf = run => (run && run.total ? run.firstTry / run.total : 0);

// Final battle finished. Won + ≥ 80% first-try unlocks the next arena (or masters the unit).
// Lost: only the final battle is retried; held outposts stay held.
export function finishFinal(unit, arenaIndex, won) {
  const a = unit.arenas[arenaIndex];
  const accuracy = accuracyOf(a.run);
  const need = CONFIG.demand.unlockAccuracy;
  const last = arenaIndex === CONFIG.arenas.length - 1;
  const nextName = last ? null : CONFIG.arenas[arenaIndex + 1].name.replace(/^The /, 'the ');
  if (!won) {
    return { won: false, accuracy, passed: false, retry: 'final', message: 'So close! Your outposts are still yours. Try the final battle again.' };
  }
  a.won = true;
  a.best = Math.max(a.best, accuracy);
  const passed = accuracy + 1e-9 >= need;
  if (passed) {
    a.passed = true;
    if (last) unit.mastered = true; else unit.arenas[arenaIndex + 1].unlocked = true;
  }
  const pct = Math.round(need * 100);
  const message = passed
    ? (last ? 'Unit mastered! All three arenas are yours.' : `Arena won! ${CONFIG.arenas[arenaIndex + 1].name} is open.`)
    : (last ? `Great battle! Get ${pct}% right to master this unit.` : `Great battle! Get ${pct}% right to unlock ${nextName}.`);
  return { won: true, accuracy, passed, retry: passed ? null : 'arena', mastered: unit.mastered, message };
}

// ---------- missed items ----------
// A miss adds weight, a first-try success takes some away. Higher weight = asked sooner.
const MISSED_LIMIT = 300;
export function noteMissed(unit, itemId, correct) {
  const m = unit.missed || (unit.missed = {});
  if (correct) { if (m[itemId]) { m[itemId] -= 1; if (m[itemId] <= 0) delete m[itemId]; } return; }
  m[itemId] = Math.min(5, (m[itemId] || 0) + 2);
  const keys = Object.keys(m);
  if (keys.length > MISSED_LIMIT) for (const k of keys.sort((x, y) => m[x] - m[y]).slice(0, keys.length - MISSED_LIMIT)) delete m[k];
}
export const missedMap = unit => new Map(Object.entries(unit.missed || {}));
