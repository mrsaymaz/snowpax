// Our own team emblems: an element symbol in a circle, in team colours (never the film crests).
import { CONFIG } from './config.js';

const PATHS = {
  // air: three swirling gusts
  swirl: '<path d="M14 24c8 0 14-3 14-8 0-4-3-6-6-6-3 0-5 2-5 4" /><path d="M10 31h22c4 0 7 3 7 6s-2 5-5 5-4-2-4-4" /><path d="M14 38h8" />',
  // fire: a flame
  flame: '<path d="M25 44c-7 0-12-5-12-11 0-7 6-10 7-17 4 3 5 7 5 10 2-2 3-5 3-8 5 4 9 9 9 15 0 6-5 11-12 11z" /><path d="M25 44c-3 0-5-2-5-5 0-3 3-5 4-8 3 3 6 5 6 8 0 3-2 5-5 5z" />',
  // water: two waves and a drop
  wave: '<path d="M10 30c4-4 8-4 12 0s8 4 12 0 6-3 8-2" /><path d="M10 38c4-4 8-4 12 0s8 4 12 0 6-3 8-2" /><path d="M25 10c3 5 6 8 6 11a6 6 0 0 1-12 0c0-3 3-6 6-11z" />',
  // nature: a leaf
  leaf: '<path d="M12 38C12 20 24 12 40 12c0 16-8 28-26 28" /><path d="M12 40 30 22" />',
};

export function emblemSVG(teamId, size = 48) {
  const t = CONFIG.teams[teamId];
  return `<svg class="emblem" role="img" aria-label="${t.name} emblem" width="${size}" height="${size}" viewBox="0 0 50 50">
<circle cx="25" cy="25" r="23" fill="${t.color}" stroke="${t.dark}" stroke-width="3"/>
<g fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${PATHS[t.emblem]}</g></svg>`;
}
