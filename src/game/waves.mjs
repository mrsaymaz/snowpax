// Rival waves at each outpost stage (Tower Swarm-style): two waves while the student seizes,
// a final wave after the capture. Each stage brings in one new kind of rival snowman.
// Also the stage walls (a ring of snowbanks round the outpost) and the entry points the waves
// walk in from. Rules only, tested in node.
import { GRID } from './grid.mjs';

export const RIVAL_INFO = {
  waddler: { name: 'Snowmen', tip: 'The rivals built snowmen! They waddle in and throw snowballs. Freeze them before they reach the circle.' },
  shield: { name: 'Shield snowmen', tip: 'Shield snowmen carry a dustbin lid. Hit them from the side, or lob a snowball over the lid.' },
  sledder: { name: 'Sledder snowmen', tip: 'Sledder snowmen are fast! They rush in on little sleds.' },
  lobber: { name: 'Lobber snowmen', tip: 'Lobber snowmen throw over walls from far away. Go after them!' },
  captain: { name: 'The rival captain', tip: 'The rival captain is big and tough, with a crown. The whole team must work together!' },
};

// m: snowmen by type; kids: how many rival kids join this wave
export const WAVES = {
  boulevard: [
    { name: 'Snowman scouts', m: { waddler: 3 }, kids: 0 },
    { name: 'More snowmen!', m: { waddler: 4 }, kids: 1 },
    { name: 'They want it back!', m: { waddler: 3 }, kids: 2, final: true },
  ],
  archery: [
    { name: 'Lids up!', m: { waddler: 2, shield: 1 }, kids: 0 },
    { name: 'Shield wall', m: { shield: 2, waddler: 2 }, kids: 1 },
    { name: 'They want it back!', m: { shield: 2, waddler: 2 }, kids: 2, final: true },
  ],
  kizilay: [
    { name: 'Here come the sleds', m: { waddler: 2, sledder: 2 }, kids: 0 },
    { name: 'Rush hour', m: { sledder: 3, shield: 1 }, kids: 1 },
    { name: 'They want it back!', m: { sledder: 2, waddler: 2, shield: 1 }, kids: 2, final: true },
  ],
  sururi: [
    { name: 'Snowballs from the sky', m: { waddler: 2, lobber: 1 }, kids: 1 },
    { name: 'Mixed snow', m: { lobber: 2, shield: 1, sledder: 1 }, kids: 1 },
    { name: 'They want it back!', m: { lobber: 2, shield: 1, waddler: 2 }, kids: 2, final: true },
  ],
  waterfront: [
    { name: 'From the ice', m: { waddler: 2, sledder: 2, lobber: 1 }, kids: 1 },
    { name: 'The big push', m: { shield: 2, lobber: 2, sledder: 1 }, kids: 2 },
    { name: 'They want it back!', m: { shield: 2, lobber: 1, sledder: 2, waddler: 1 }, kids: 3, final: true },
  ],
  // the Schoolyard Showdown: waves come with the banners (see stagerun.js), the captain in the second
  showdown: [
    { name: 'The last stand', m: { waddler: 2, shield: 1, sledder: 1 }, kids: 1 },
    { name: 'The rival captain!', m: { captain: 1, waddler: 2 }, kids: 1 },
    { name: 'Everyone at once!', m: { lobber: 2, shield: 1, sledder: 2 }, kids: 2, final: true },
  ],
};
// The five banners of the Showdown: one per outpost won, each raised by that outpost's task family.
export const BANNERS = [
  { outpost: 'boulevard', family: 'answer', name: 'Boulevard' },
  { outpost: 'archery', family: 'sort', name: 'Archery' },
  { outpost: 'kizilay', family: 'match', name: 'Kızılay' },
  { outpost: 'sururi', family: 'build', name: 'Sururi' },
  { outpost: 'waterfront', family: 'listen', name: 'Waterfront' },
];
export const minionList = wave => Object.entries(wave.m).flatMap(([type, n]) => Array(n).fill(type));

// The ring of snowbanks that closes a stage: walkable cells between rIn and rOut of the centre.
export function stageWall(grid, z, rIn = 13, rOut = 14.3) {
  const cells = [];
  const i0 = Math.floor(z.x - grid.x0), j0 = Math.floor(z.z - grid.z0), R = Math.ceil(rOut) + 1;
  for (let j = j0 - R; j <= j0 + R; j++) for (let i = i0 - R; i <= i0 + R; i++) {
    if (i < 0 || j < 0 || i >= grid.W || j >= grid.H) continue;
    const [cx, cz] = grid.center(i, j), d = Math.hypot(cx - z.x, cz - z.z);
    if (d >= rIn && d < rOut && !(grid.f[j * grid.W + i] & GRID.BLOCK)) cells.push([i, j, cx, cz]);
  }
  return cells;
}
export function setWall(grid, cells, on) { for (const [i, j] of cells) { const k = j * grid.W + i; grid.f[k] = on ? grid.f[k] | GRID.BLOCK : grid.f[k] & ~GRID.BLOCK; } }

// Where the waves walk in: up to three walkable spots just inside the wall, spread round it,
// preferring streets (the way the rivals would come).
export function entryPoints(grid, z, r = 11.2, n = 3) {
  const spots = [];
  for (let k = 0; k < 48; k++) {
    const a = k / 48 * Math.PI * 2, x = z.x + Math.sin(a) * r, zz = z.z + Math.cos(a) * r;
    if (!grid.freeCircle(x, zz, 0.45)) continue;
    spots.push({ a, x, z: zz, road: grid.has(x, zz, GRID.ROAD) ? 1 : 0 });
  }
  const picked = [];
  for (const s of spots.sort((p, q) => q.road - p.road)) if (picked.every(p => Math.abs(Math.atan2(Math.sin(p.a - s.a), Math.cos(p.a - s.a))) > 1.4)) { picked.push(s); if (picked.length === n) break; }
  return picked.length ? picked : spots.slice(0, 1);
}

// The Showdown circle in the schoolyard: the most open spot near Our School, so the team has
// room to fight and the waves have streets to come in by.
export function schoolyardSpot(grid, base, r = 2.6) {
  let best = null;
  for (let dz = -12; dz <= 12; dz += 1) for (let dx = -12; dx <= 12; dx += 1) {
    const x = base.x + dx, z = base.z + dz, d = Math.hypot(dx, dz);
    if (d < 2.5 || d > 12 || !grid.freeCircle(x, z, r)) continue;
    let open = 0, n = 0;
    for (let k = 0; k < 24; k++) for (const rr of [4, 6.5, 9]) { const a = k / 24 * Math.PI * 2; n++; if (grid.freeCircle(x + Math.sin(a) * rr, z + Math.cos(a) * rr, 0.4)) open++; }
    const score = open / n - d * 0.012;
    if (!best || score > best.score) best = { x, z, score };
  }
  return best ? { x: best.x, z: best.z, r } : { x: base.x, z: base.z, r };
}
