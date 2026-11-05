#!/usr/bin/env node
// Builds the Arena 1 world ("Home Turf"): six purpose-built stage fields, one for each outpost and
// one for the Schoolyard Showdown. There is no real map and there are no real streets: each field
// is laid out for a good snowball fight, and only the look of the neighbourhood is kept round it
// (a cobbled lane, snowed-in houses with lit windows and tea on the sills, buried roofs, old
// lamps, the outpost's own trees and street stalls, the frozen Golden Horn by the waterfront).
//
//   node tools/build-world.mjs
//
// Output: public/arenas/arena1.json (tile rows + outposts, landmarks, pickups). Deterministic.
//
// Field size, from 3v3 brawler maps (about 21 × 33 tiles, heroes running about 2.5 tiles/s and
// throwing 3–10 tiles). Our kids run 3.4 tiles/s and throw 5–7.5 tiles, so the same footprint gives
// the same rhythm: a few seconds from spawn to the first fight, room to dodge sideways, cover
// every 4–6 tiles. Each field is 22 × 34 tiles. The rivals hold the outpost: its landmark stands at
// the north end, behind the rival team; our team spawns at the south end. The long axis runs
// north–south, up the screen (portrait-first). Every field is mirrored left–right.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TILE = 15; // nominal metres per tile (for the sound of distances only)

// Kit: a field a, plaza P, outpost core O, snow wall #, barricade w, crate z, bush B, ice i,
// snowman n, bench b. Frame: snow ., cobbled lane _, lamp l, house H, buried roof R, trees T v y x,
// stall G (with a landmark entry), frozen sea W, Our School S, home spawn h, rival camp r.
const FIELD = { front: 28, hw: 11 };      // rows in front of the outpost centre, half width
const FRAME = 7;                          // frame depth round the field: 2 snow (the fence), lane, 2 houses, 2 roofs and trees
const CORE = 2, RING_R = 3.9;

// The stages' places. `back`: rows behind the outpost centre (the Showdown has Our School there).
const PLACES = [
  { id: 'boulevard', family: 'answer', label: 'Boulevard Park', landmark: 'treehouse', back: 6, trees: 'TT', stalls: ['chestnut', 'cay', 'salep'] },
  { id: 'archery', family: 'sort', label: 'Archery Ground', landmark: 'archers-lodge', back: 6, trees: 'xv', stalls: ['salep', 'chestnut'] },
  { id: 'kizilay', family: 'match', label: 'Kızılay Square', landmark: 'fountain', back: 6, trees: 'vT', stalls: ['simit', 'cay', 'corn'] },
  { id: 'sururi', family: 'build', label: 'Sururi Park', landmark: 'snow-castle', back: 6, trees: 'yx', stalls: ['salep', 'corn'] },
  { id: 'waterfront', family: 'listen', label: 'Waterfront Park', landmark: 'admiral', back: 6, trees: 'xT', stalls: ['fish', 'simit', 'cay'], sea: true },
  { id: 'schoolyard', label: 'Our School', back: 9, trees: 'Ty', stalls: ['simit', 'cay'], school: true },
];

// Field layouts: [kind, d0, d1, v0, v1] covers the cells whose centres have d0 ≤ d ≤ d1 (rows
// south of the outpost centre: home spawn near d 26, the rival line near d 8) and v0 ≤ |v| ≤ v1
// (across, mirrored left–right). Centres sit on .5. Kept clear: the home spawn (d 24–27, |v| < 2),
// the rival line (d 7–8.5, |v| < 4.5), the reinforcement spots (|v| 8, d −3.5 and |v| 9.5, d 4).
const ARENAS = {
  boulevard: [ // plane trees and park bushes: long hedges down the sides, a hedge in the middle lane
    ['#', 23.5, 23.5, 2.5, 4.5], ['B', 25.5, 27.5, 9.5, 10.5],       // an eyebrow wall shielding the spawn, corner bushes
    ['w', 21.5, 21.5, 7.5, 8.5],                                       // a barricade at the head of each side lane
    ['z', 19.5, 19.5, 0.5, 0.5], ['i', 18.5, 19.5, 8.5, 10.5],          // a crate pair splitting the middle lane, ice on the flanks
    ['#', 15.5, 17.5, 4.5, 4.5], ['#', 17.5, 17.5, 3.5, 3.5],          // an L of snow wall each side
    ['B', 12.5, 16.5, 9.5, 10.5], ['B', 16.5, 17.5, 0.5, 1.5],         // a long bush along each edge, a bush in the middle lane
    ['z', 13.5, 13.5, 0.5, 0.5],                                       // the last cover before the rival line
    ['w', 9.5, 9.5, 2.5, 4.5], ['#', 7.5, 8.5, 7.5, 7.5], ['B', 5.5, 7.5, 9.5, 10.5], // the rival line
    ['z', 5.5, 5.5, 4.5, 4.5],                                         // crates at the corners of the plaza
  ],
  archery: [ // a wooden practice ground: barricades and crates, few bushes, a long open middle
    ['w', 23.5, 23.5, 1.5, 3.5], ['z', 25.5, 26.5, 9.5, 10.5],
    ['#', 20.5, 21.5, 6.5, 6.5],
    ['B', 18.5, 19.5, 0.5, 1.5],
    ['w', 15.5, 15.5, 4.5, 7.5],                                       // a long barricade across each inner lane
    ['z', 12.5, 13.5, 9.5, 9.5],
    ['i', 11.5, 12.5, 0.5, 2.5],
    ['w', 9.5, 9.5, 5.5, 7.5], ['#', 5.5, 6.5, 8.5, 8.5], ['z', 5.5, 5.5, 4.5, 4.5],
  ],
  kizilay: [ // a town square: stone walls in L shapes round the corners, a wide bush in the middle
    ['#', 23.5, 23.5, 1.5, 3.5], ['B', 26.5, 27.5, 8.5, 10.5],
    ['z', 20.5, 21.5, 5.5, 5.5], ['#', 18.5, 18.5, 8.5, 10.5],         // a wall stub from each edge: go round it
    ['B', 15.5, 16.5, 0.5, 2.5],
    ['#', 13.5, 13.5, 5.5, 7.5], ['#', 12.5, 12.5, 5.5, 5.5],
    ['i', 10.5, 12.5, 9.5, 10.5],
    ['w', 9.5, 9.5, 1.5, 2.5], ['z', 6.5, 6.5, 6.5, 7.5], ['B', 4.5, 6.5, 9.5, 10.5],
  ],
  sururi: [ // the snow-castle park: thick snow walls like ramparts, an icy middle
    ['#', 23.5, 23.5, 2.5, 5.5], ['#', 24.5, 25.5, 5.5, 5.5],          // a long rampart at the spawn
    ['i', 20.5, 21.5, 0.5, 3.5],
    ['#', 18.5, 18.5, 7.5, 10.5],
    ['B', 14.5, 17.5, 3.5, 4.5], ['#', 14.5, 14.5, 0.5, 0.5],          // inner bushes, a pillar in the middle lane
    ['#', 11.5, 11.5, 6.5, 8.5], ['#', 10.5, 10.5, 8.5, 8.5],
    ['z', 9.5, 9.5, 2.5, 3.5], ['#', 6.5, 6.5, 5.5, 6.5], ['B', 4.5, 7.5, 9.5, 10.5],
  ],
  waterfront: [ // the quay: cargo crates, wide ice, barricades from the railings
    ['z', 23.5, 23.5, 2.5, 4.5], ['B', 25.5, 27.5, 9.5, 10.5],
    ['i', 19.5, 21.5, 4.5, 8.5],                                       // a wide icy patch each side
    ['z', 17.5, 18.5, 0.5, 0.5],
    ['w', 15.5, 15.5, 7.5, 10.5],
    ['B', 12.5, 14.5, 2.5, 3.5],
    ['i', 10.5, 11.5, 0.5, 1.5],
    ['z', 9.5, 9.5, 5.5, 6.5], ['#', 6.5, 7.5, 8.5, 8.5], ['B', 4.5, 6.5, 9.5, 10.5],
  ],
  schoolyard: [ // the playground: low walls, benches, a snowman, bushes by the fence
    ['#', 23.5, 23.5, 2.5, 4.5], ['B', 25.5, 27.5, 9.5, 10.5],
    ['w', 20.5, 20.5, 7.5, 9.5],
    ['n', 17.5, 17.5, 0.5, 0.5],
    ['B', 14.5, 16.5, 4.5, 5.5],
    ['z', 12.5, 12.5, 8.5, 9.5],
    ['#', 10.5, 10.5, 1.5, 3.5],
    ['b', 6.5, 6.5, 7.5, 8.5], ['B', 4.5, 6.5, 9.5, 10.5],
  ],
};

// ---------- the grid: six pockets, three across ----------
const maxBack = Math.max(...PLACES.map(p => p.back));
const PW = FIELD.hw * 2 + FRAME * 2, PH = maxBack + FIELD.front + FRAME * 2, GAP = 2, COLS = 3;
const W = COLS * (PW + GAP) + GAP, H = Math.ceil(PLACES.length / COLS) * (PH + GAP) + GAP;
const g = Array.from({ length: H }, () => Array(W).fill('~')); // '~': nothing there
let seed = 7; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const landmarks = [], pickups = [], outposts = [];
let home = null, rival = null, schoolyard = null;

PLACES.forEach((pl, k) => {
  const { hw, front } = FIELD, back = pl.back;
  const px0 = GAP + (k % COLS) * (PW + GAP), py0 = GAP + Math.floor(k / COLS) * (PH + GAP);
  const ci = px0 + FRAME + hw, cj = py0 + FRAME + maxBack; // the outpost centre (a cell corner)
  const dv = (i, j) => [j + 0.5 - cj, i + 0.5 - ci];
  const set = (i, j, ch) => { g[j][i] = ch; };
  // the field
  for (let j = cj - back; j < cj + front; j++) for (let i = ci - hw; i < ci + hw; i++) {
    const [d, v] = dv(i, j); set(i, j, Math.hypot(d, v) <= RING_R + 0.4 ? 'P' : 'a');
  }
  // the frame: how far a cell is outside the field (1, 2, …) and on which side
  const tree = () => pl.trees[Math.floor(rand() * pl.trees.length)];
  for (let j = cj - back - FRAME; j < cj + front + FRAME; j++) for (let i = ci - hw - FRAME; i < ci + hw + FRAME; i++) {
    const [d, v] = dv(i, j), dOut = d < -back ? -back - d + 0.5 : d > front ? d - front + 0.5 : 0, vOut = Math.abs(v) > hw ? Math.abs(v) - hw + 0.5 : 0;
    const e = Math.max(dOut, vOut); if (!e) continue;
    const side = dOut >= vOut ? (d < 0 ? 'N' : 'S') : 'EW', along = side === 'EW' ? j : i;
    let ch = '.';
    if (pl.sea && side === 'N' && e >= 4) ch = 'W';              // the frozen Golden Horn beyond the quay
    else if (e === 3) ch = along % 7 === 3 ? 'l' : '_';            // a cobbled lane with old lamps
    else if (e === 4 || e === 5) {
      if (side === 'S') ch = e === 5 && rand() < 0.5 ? tree() : '.'; // low at the south end (the camera looks over it)
      else ch = along % 7 === 6 ? (e === 5 ? tree() : '.') : 'H';  // snowed-in houses, an alley every few doors
    } else if (e >= 6) ch = rand() < 0.4 ? 'R' : rand() < 0.35 ? tree() : '.';
    set(i, j, ch);
  }
  // the layout
  for (let j = cj - back; j < cj + front; j++) for (let i = ci - hw; i < ci + hw; i++) {
    if (!'aP'.includes(g[j][i])) continue;
    const [d, v] = dv(i, j), av = Math.abs(v);
    for (const [ch, d0, d1, v0, v1] of ARENAS[pl.id]) if (d >= d0 - 1e-6 && d <= d1 + 1e-6 && av >= v0 - 1e-6 && av <= v1 + 1e-6) set(i, j, ch);
  }
  // street stalls on the lane behind the home spawn (2 × 1 each)
  pl.stalls.forEach((kind, n) => {
    const i = ci - 7 + n * 6, j = cj + front + 3;
    set(i, j, 'G'); set(i + 1, j, 'G'); landmarks.push({ type: 'stall', kind, i, j, w: 2, h: 1, outpost: pl.id });
  });
  // the sea: a ferry stuck in the ice and a wooden pier off the quay
  if (pl.sea) {
    landmarks.push({ type: 'ferry', i: ci + 3, j: cj - back - 7, w: 5, h: 2, along: 'x', outpost: pl.id });
    landmarks.push({ type: 'pier', i: ci - 7, j: cj - back - 6, w: 2, h: 3, along: 'z', outpost: pl.id });
  }
  // pickups: snowflakes in pairs, one cup of cocoa at each outpost
  const open = (v, d) => { const i = Math.floor(ci + v), j = Math.floor(cj + d); return g[j][i] === 'a' ? [i, j] : null; };
  for (const [v, d] of [[6.5, 21.5], [2.5, 15.5], [8.5, 11.5], [5.5, 3.5], [9.5, 24.5]]) for (const s of [-1, 1]) { const c = open(s * v, d); if (c) pickups.push({ id: `f${pickups.length}`, kind: 'flake', i: c[0], j: c[1] }); }
  if (!pl.school) { const c = [[-7.5, 14.5], [-6.5, 16.5], [-3.5, 19.5], [-8.5, 20.5]].map(([v, d]) => open(v, d)).find(Boolean); if (c) pickups.push({ id: `c${pickups.length}`, kind: 'cocoa', i: c[0], j: c[1] }); }

  const arena = { back, front, hw };
  if (pl.school) {
    // Our School stands behind the circle at the north end; the rivals have taken its yard
    for (let j = cj - back + 1; j < cj - back + 4; j++) for (let i = ci - 6; i < ci + 6; i++) set(i, j, 'S');
    home = [ci, cj + front - 3]; set(...home, 'h');            // the team starts at the south end
    rival = [ci + 8, cj - 3]; set(...rival, 'r');              // the rivals' camp, by the school
    schoolyard = { i: ci, j: cj, r: 3.4, arena };
  } else {
    for (let dj = -CORE; dj < CORE; dj++) for (let di = -CORE; di < CORE; di++) set(ci + di, cj + dj, 'O');
    landmarks.push({ type: pl.landmark, i: ci - CORE, j: cj - CORE, w: CORE * 2, h: CORE * 2, outpost: pl.id, centre: true });
    outposts.push({ id: pl.id, family: pl.family, label: pl.label, landmark: pl.landmark, i: ci, j: cj, r: RING_R, yard: 90, arena });
  }
});

const rows = g.map(r => r.join(''));
const out = {
  v: 4, id: 'arena1', name: 'Home Turf', kind: 'tiles', world: true, tile: TILE, w: W, h: H,
  rows, outposts, schoolyard, landmarks, scenery: [], home, rival, hills: [], sledRuns: [], pickups, signposts: [],
};
mkdirSync(join(ROOT, 'public/arenas'), { recursive: true });
writeFileSync(join(ROOT, 'public/arenas/arena1.json'), JSON.stringify(out));
const count = ch => rows.join('').split(ch).length - 1;
console.log(`World ${W}×${H} tiles: ${PLACES.length} fields of ${FIELD.hw * 2} × ${maxBack === 6 ? 34 : '34–37'} tiles; houses ${count('H')}, buried roofs ${count('R')}, lamps ${count('l')}, landmarks ${landmarks.length}, snowflakes ${pickups.filter(p => p.kind === 'flake').length}, cocoa ${pickups.filter(p => p.kind === 'cocoa').length}`);
if (process.env.SHOW_FIELD) for (const r of rows) console.log(r);
