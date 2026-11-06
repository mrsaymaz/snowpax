// Rival waves at the outpost (Tower Swarm-style): the rival team, the strike-back and the Final
// Showdown with the rival captain.
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

// m: snowmen by type; kids: how many rival kids join this wave. Three waves at the outpost: the
// rival team (the opening round), the strike-back between the parts, and the Final Showdown with
// the rival captain.
export const WAVES = {
  kasimpasa: [
    { name: 'The rival team', m: { waddler: 2, shield: 1 }, kids: 2 },
    { name: 'They strike back!', m: { shield: 2, sledder: 2 }, kids: 1 },
    { name: 'The Final Showdown', m: { captain: 1, lobber: 2, shield: 1, sledder: 1 }, kids: 3, final: true },
  ],
  // the Golden Horn: lobbers throwing from the quay; the Final Showdown at Miniatürk
  'golden-horn': [
    { name: 'The rival team', m: { waddler: 2, lobber: 1 }, kids: 2 },
    { name: 'They strike back!', m: { lobber: 2, sledder: 2 }, kids: 1 },
    { name: 'The Final Showdown', m: { captain: 1, lobber: 2, shield: 2, sledder: 1 }, kids: 3, final: true },
  ],
};
export const minionList = wave => Object.entries(wave.m).flatMap(([type, n]) => Array(n).fill(type));

// The ring of snowbanks that closes a stage: walkable cells between rIn and rOut of the centre.
export function stageWall(grid, z, rIn = 13, rOut = 14.3) {
  if (z.battlefield) return fieldWall(grid, z);
  const cells = [];
  const i0 = Math.floor(z.x - grid.x0), j0 = Math.floor(z.z - grid.z0), R = Math.ceil(rOut) + 1;
  for (let j = j0 - R; j <= j0 + R; j++) for (let i = i0 - R; i <= i0 + R; i++) {
    if (i < 0 || j < 0 || i >= grid.W || j >= grid.H) continue;
    const [cx, cz] = grid.center(i, j), d = Math.hypot(cx - z.x, cz - z.z);
    if (d >= rIn && d < rOut && !(grid.f[j * grid.W + i] & GRID.BLOCK)) cells.push([i, j, cx, cz]);
  }
  return cells;
}
// A battlefield's fence: a band of snowbanks just outside the field's rectangle.
export function fieldWall(grid, z, w = 1.3) {
  const { back, front, hw } = z.battlefield, cells = [];
  const i0 = Math.floor(z.x - grid.x0 - hw - w - 1), i1 = Math.ceil(z.x - grid.x0 + hw + w + 1), j0 = Math.floor(z.z - grid.z0 - back - w - 1), j1 = Math.ceil(z.z - grid.z0 + front + w + 1);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    if (i < 0 || j < 0 || i >= grid.W || j >= grid.H) continue;
    const [cx, cz] = grid.center(i, j), d = cz - z.z, v = Math.abs(cx - z.x);
    const inside = d > -back && d < front && v < hw, near = d > -back - w && d < front + w && v < hw + w;
    if (!inside && near && !(grid.f[j * grid.W + i] & GRID.BLOCK)) cells.push([i, j, cx, cz]);
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
