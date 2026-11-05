// Arena 1 as stages (inspired by Growbloom's garden path and solMaxima's gates): a sled journey
// to each outpost, nearest first, then a stand there against waves of rivals while the student
// answers English tasks; the sixth stage is the ride home and the Schoolyard Showdown.
// Rules only (no DOM), tested in node.
import { CONFIG } from '../config.js';

export const LIVES = 3;

// The order: Our School → nearest outpost → … → furthest, then home.
// ride: the themed sled track; spell: the run has letters to spell a word (practice only).
// newRival: the rival type this stage introduces ("New rivals!" card).
export const STAGES = [
  { id: 'boulevard', outpost: 'boulevard', family: 'answer', title: 'Boulevard Park', ride: { theme: 'boulevard', seconds: 45, spell: false }, newRival: 'waddler' },
  { id: 'archery', outpost: 'archery', family: 'sort', title: 'Archery Ground', ride: { theme: 'archery', seconds: 45, spell: true }, newRival: 'shield' },
  { id: 'kizilay', outpost: 'kizilay', family: 'match', title: 'Kızılay Square', ride: { theme: 'kizilay', seconds: 45, spell: false }, newRival: 'sledder' },
  { id: 'sururi', outpost: 'sururi', family: 'build', title: 'Sururi Park', ride: { theme: 'sururi', seconds: 45, spell: true }, newRival: 'lobber' },
  { id: 'waterfront', outpost: 'waterfront', family: 'listen', title: 'Waterfront Park', ride: { theme: 'waterfront', seconds: 45, spell: false }, newRival: null },
  { id: 'showdown', outpost: null, family: null, title: 'Schoolyard Showdown', ride: { theme: 'home', seconds: 45, spell: true }, newRival: 'captain', final: true },
];
export const stageById = id => STAGES.find(s => s.id === id);

// Stars for a finished stage, from its first-try accuracy.
export const starsFor = (firstTry, total) => { const a = total ? firstTry / total : 1; return a >= 0.9 ? 3 : a >= 0.7 ? 2 : 1; };

// Stage progress lives in the unit's Arena 1 record: { stages: { id: { done, stars, best } } }.
export function stageState(unitProgress) {
  const a = unitProgress.arenas[0];
  if (!a.stages) a.stages = {};
  return a.stages;
}
// A stage is open when the one before it is done (the first always is). The Showdown also needs
// all five outposts.
export function isUnlocked(unitProgress, id) {
  const st = stageState(unitProgress), i = STAGES.findIndex(s => s.id === id);
  if (i <= 0) return i === 0;
  return !!st[STAGES[i - 1].id]?.done;
}
export function nextStage(unitProgress) {
  const st = stageState(unitProgress);
  return STAGES.find(s => !st[s.id]?.done) || null;
}
export function finishStage(unitProgress, id, { firstTry, total, flakes = 0, seconds = 0 }) {
  const st = stageState(unitProgress), stars = starsFor(firstTry, total), prev = st[id];
  st[id] = { done: true, stars: Math.max(stars, prev?.stars || 0), best: Math.max(total ? firstTry / total : 1, prev?.best || 0), flakes: Math.max(flakes, prev?.flakes || 0), seconds: prev?.seconds ? Math.min(prev.seconds, seconds) : seconds };
  return { stars, newBest: !prev || stars > (prev.stars || 0) };
}
export const totalStars = unitProgress => Object.values(stageState(unitProgress)).reduce((s, x) => s + (x.stars || 0), 0);

// Lives: a crash on the sled or a freeze at the outpost costs one; none left → the stage restarts
// (English answers already given still count).
export class Lives {
  constructor(n = LIVES) { this.max = n; this.left = n; }
  lose() { this.left = Math.max(0, this.left - 1); return this.left; }
  get out() { return this.left <= 0; }
  reset() { this.left = this.max; }
}

// The time of a whole Arena 1 played through is worked out in timing.mjs (arenaTime).
export const UNLOCK = CONFIG.demand.unlockAccuracy;
