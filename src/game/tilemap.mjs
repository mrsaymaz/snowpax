// Turns a hand-made tile arena (rows of characters) into the arena object the simulation,
// navigation and renderer use. One tile = one world unit; x = east (columns), z = south (rows).
import { GRID } from './grid.mjs';

const SOLID = 'HSKMFctLb#nOfQCWGRDl';     // tiles you cannot walk through (G = landmark, R = buried roof, D = edge snowbank, l = street lamp)
const TALL = 'HSKM';                      // edge buildings
export const TILE = {
  '.': 'snow', '_': 'street', Y: 'yard', '#': 'wall', b: 'bench', c: 'car', n: 'snowman', t: 'tree', L: 'lamp', F: 'fence',
  B: 'bush', H: 'house', S: 'school', K: 'fort', M: 'mosque', d: 'drift', i: 'ice', o: 'zone', O: 'outpost', f: 'fire', h: 'home', r: 'rival',
};

export function buildTileArena(def) {
  const rows = def.rows, h = rows.length, w = rows[0].length;
  const x0 = -w / 2, z0 = -h / 2;
  const grid = new Uint8Array(w * h);
  const at = (i, j) => [x0 + i + 0.5, z0 + j + 0.5];
  const drifts = [], zoneTiles = [], quiet = [];
  let home = null, rival = null;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = rows[j][i], k = j * w + i;
    if (SOLID.includes(ch)) grid[k] |= GRID.BLOCK;
    if ('_=+ioPj'.includes(ch)) grid[k] |= GRID.ROAD;
    if ('QCq+'.includes(ch)) grid[k] |= GRID.ZONE;   // places of worship, cemeteries and their quiet buffer
    if (ch === 'p') grid[k] |= GRID.PARK;
    if (ch === 'Y' || ch === 'h') grid[k] |= GRID.YARD;
    if (ch === 'B') grid[k] |= GRID.BUSH;
    if (ch === 'i') grid[k] |= GRID.ICE;
    if (ch === 'd') drifts.push(at(i, j));
    if (ch === 'o' || ch === 'O') zoneTiles.push(at(i, j));
    if (ch === 'h') home = at(i, j);
    if (ch === 'r') rival = at(i, j);
    if (ch === 'M') quiet.push([i, j]);
  }
  // Quiet zone around the place of worship: its grounds plus a small buffer.
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (quiet.some(([qi, qj]) => Math.hypot(qi - i, qj - j) <= 1.6)) grid[j * w + i] |= GRID.ZONE;
  }
  const zc = zoneTiles.length ? [zoneTiles.reduce((s, p) => s + p[0], 0) / zoneTiles.length, zoneTiles.reduce((s, p) => s + p[1], 0) / zoneTiles.length] : [0, 0];
  return {
    v: 2, kind: 'tiles', id: def.id, name: def.name, theme: def.theme,
    w, h, cell: 1, x0, z0, half: Math.max(w, h) / 2, rows, solid: SOLID, tall: TALL,
    grid,
    drifts,
    places: [
      { id: 'base', kind: 'base', label: 'Our School', x: home[0], z: home[1] },
      { id: 'rival-base', kind: 'rivalBase', label: 'Snow Camp', x: rival[0], z: rival[1] },
      ...(def.outposts
        ? def.outposts.map(o => ({ id: o.id, kind: 'zone', family: o.family, label: o.label, landmark: o.landmark, x: x0 + o.i, z: z0 + o.j, r: o.r || 3.4 }))
        : [{ id: 'zone', kind: 'zone', label: 'Street Outpost', x: zc[0], z: zc[1], r: def.zoneRadius || 2.3 }]),
    ],
    world: !!def.world, landmarks: def.landmarks || [], scenery: def.scenery || [],
    graph: null,
  };
}
