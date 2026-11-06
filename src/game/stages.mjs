// Arena 1 (Kasımpaşa) as one stage: the sled ride into the neighbourhood, then its one outpost,
// taken in two parts: Part 1 is the tasks of two places (Boulevard Park, Archery Ground), Part 2
// the other three (Kızılay Square, Sururi Park, the Pier), with fights and the Snow Shop between,
// and the Final Showdown at the end. Later arenas (İstiklal Street, …) are one stage each in the
// same way. Rules only (no DOM), tested in node.
import { CONFIG } from '../config.js';

export const LIVES = 3;

// parts: the task families of Part 1 and Part 2 (each family opens in its own place's scene);
// ride: the sled ride in (its word snowflakes are the first ❄; spell: letters to spell a word);
// newRival: the rival type met in the first fight ("New rivals!" card); the captain comes last.
export const STAGES = [
  { id: 'kasimpasa', outpost: 'kasimpasa', family: 'match', parts: [['answer', 'sort'], ['match', 'build', 'listen']], fights: 'long', title: 'Kasımpaşa', ride: { theme: 'kasimpasa', seconds: 50, spell: true, flakes: 5 }, newRival: 'shield' },
];
// the place each task family belongs to (its landmark and its scene)
export const PLACE_OF = { answer: 'Boulevard Park', sort: 'Archery Ground', match: 'Kızılay Square', build: 'Sururi Park', listen: 'The Pier' };
// the place's id (its scene on the sled ride, render/cinema.js)
export const PLACE_ID = { answer: 'boulevard', sort: 'archery', match: 'kizilay', build: 'sururi', listen: 'pier' };
export const stageById = id => STAGES.find(s => s.id === id);

// Stars for a finished stage, from its first-try accuracy.
export const starsFor = (firstTry, total) => { const a = total ? firstTry / total : 1; return a >= 0.9 ? 3 : a >= 0.7 ? 2 : 1; };

// Stage progress lives in the unit's Arena 1 record: { stages: { id: { done, stars, best } } }.
export function stageState(unitProgress) {
  const a = unitProgress.arenas[0];
  if (!a.stages) a.stages = {};
  return a.stages;
}
// A stage is open when the one before it is done (the first always is).
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
