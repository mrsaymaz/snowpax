#!/usr/bin/env node
// Builds the Arena 1 world (Kasımpaşa): one purpose-built field, the Kasımpaşa outpost. Each arena
// has one outpost; the places of the neighbourhood (Boulevard Park, Archery Ground, Kızılay Square,
// Sururi Park and the Pier) are all part of it: the outpost is a big carousel with a ship's mast in
// the middle (Kasımpaşa grew up round the old naval shipyard) and miniatures of the five landmarks
// riding round it, and each place's English task opens in its own scene. There is no real map and there are no real streets: the field is laid out for a good
// snowball fight, and only the look of the neighbourhood is kept round it (a cobbled lane,
// snowed-in houses with lit windows, buried roofs, old lamps, trees and street stalls).
// Later arenas (İstiklal Street, …) are built the same way: one PLACES entry each.
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
const CORE = 3, CORE_R = 3.1, RING_R = 4.6; // the carousel: a round solid core of cells within CORE_R, the circle round it

// The arena's outpost. `back`: rows behind the outpost centre. `seats`: the landmarks riding the
// carousel, in the order their places' tasks are played (Part 1, then Part 2).
const PLACES = [
  { id: 'kasimpasa', family: 'match', label: 'Kasımpaşa', landmark: 'carousel', back: 6, trees: 'TxvT', stalls: ['chestnut', 'simit', 'cay', 'salep'],
    seats: ['treehouse', 'archers-lodge', 'fountain', 'snow-castle', 'admiral'] },
  // Arena 2: the Golden Horn (Haliç): a model of the Golden Horn with the great chain across its
  // mouth, the places along its shores; the frozen water itself lies north of the field
  { id: 'golden-horn', family: 'match', label: 'The Golden Horn', landmark: 'golden-horn', back: 6, trees: 'xTxv', stalls: ['fish', 'simit', 'cay', 'chestnut'], sea: true,
    seats: ['karakoy', 'bankalar', 'tersane', 'aynalikavak', 'miniaturk'] },
];

// Field layouts: [kind, d0, d1, v0, v1] covers the cells whose centres have d0 ≤ d ≤ d1 (rows
// south of the outpost centre: home spawn near d 26, the rival line near d 8) and v0 ≤ |v| ≤ v1
// (across, mirrored left–right). Centres sit on .5. Kept clear: the home spawn (d 24–27, |v| < 2),
// the rival line (d 7–8.5, |v| < 4.5), the reinforcement spots (|v| 8, d −3.5 and |v| 9.5, d 4).
const ARENAS = {
  kasimpasa: [ // the neighbourhood square: stone walls in L shapes, barricades and crates, a bush in the middle
    ['#', 23.5, 23.5, 1.5, 3.5], ['B', 26.5, 27.5, 8.5, 10.5],         // an eyebrow wall shielding the spawn, corner bushes
    ['w', 21.5, 21.5, 7.5, 8.5],                                       // a barricade at the head of each side lane
    ['z', 19.5, 19.5, 0.5, 0.5], ['i', 18.5, 19.5, 9.5, 10.5],          // a crate splitting the middle lane, ice on the flanks
    ['#', 15.5, 17.5, 4.5, 4.5], ['#', 17.5, 17.5, 3.5, 3.5],          // an L of snow wall each side
    ['B', 14.5, 15.5, 0.5, 1.5],                                       // a bush in the middle lane
    ['z', 12.5, 13.5, 9.5, 9.5],
    ['#', 11.5, 11.5, 6.5, 7.5],
    ['w', 9.5, 9.5, 1.5, 2.5], ['#', 6.5, 7.5, 8.5, 8.5], ['B', 4.5, 6.5, 9.5, 10.5], // the rival line
    ['z', 5.5, 5.5, 4.5, 4.5],                                         // crates at the corners of the plaza
  ],
  'golden-horn': [ // the quay: cargo crates, mooring barricades, wide ice, stone bollards
    ['z', 23.5, 23.5, 2.5, 4.5], ['B', 25.5, 27.5, 9.5, 10.5],          // crates shielding the spawn, corner bushes
    ['i', 19.5, 21.5, 4.5, 8.5],                                       // a wide icy patch each side
    ['z', 17.5, 18.5, 0.5, 0.5],                                       // a crate stack in the middle lane
    ['w', 15.5, 15.5, 7.5, 10.5],                                      // a mooring barricade from each edge
    ['#', 12.5, 13.5, 2.5, 3.5],                                       // stone bollard blocks
    ['i', 10.5, 11.5, 0.5, 1.5],
    ['z', 9.5, 9.5, 5.5, 6.5], ['#', 6.5, 7.5, 8.5, 8.5], ['B', 4.5, 6.5, 9.5, 10.5], // the rival line
  ],
};

// ---------- the grid: one pocket per place, three across ----------
const maxBack = Math.max(...PLACES.map(p => p.back));
const PW = FIELD.hw * 2 + FRAME * 2, PH = maxBack + FIELD.front + FRAME * 2, GAP = 2, COLS = 3;
const W = Math.min(COLS, PLACES.length) * (PW + GAP) + GAP, H = Math.ceil(PLACES.length / COLS) * (PH + GAP) + GAP;
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
    const i = ci - 9 + n * 5, j = cj + front + 3;
    set(i, j, 'G'); set(i + 1, j, 'G'); landmarks.push({ type: 'stall', kind, i, j, w: 2, h: 1, outpost: pl.id });
  });
  // the sea: a ferry stuck in the ice and a wooden pier off the quay
  if (pl.sea) {
    landmarks.push({ type: 'ferry', i: ci + 3, j: cj - back - 7, w: 5, h: 2, along: 'x', outpost: pl.id });
    landmarks.push({ type: 'pier', i: ci - 7, j: cj - back - 6, w: 2, h: 3, along: 'z', outpost: pl.id });
  }
  // pickups: one cup of cocoa (snowflakes are rare now: the sled ride's word snowflakes)
  const open = (v, d) => { const i = Math.floor(ci + v), j = Math.floor(cj + d); return g[j][i] === 'a' ? [i, j] : null; };
  if (!pl.school) { const c = [[-7.5, 14.5], [-6.5, 16.5], [-3.5, 19.5], [-8.5, 20.5]].map(([v, d]) => open(v, d)).find(Boolean); if (c) pickups.push({ id: `c${pickups.length}`, kind: 'cocoa', i: c[0], j: c[1] }); }

  const arena = { back, front, hw };
  if (pl.school) {
    // Our School stands behind the circle at the north end; the rivals have taken its yard
    for (let j = cj - back + 1; j < cj - back + 4; j++) for (let i = ci - 6; i < ci + 6; i++) set(i, j, 'S');
    home = [ci, cj + front - 3]; set(...home, 'h');            // the team starts at the south end
    rival = [ci + 8, cj - 3]; set(...rival, 'r');              // the rivals' camp, by the school
    schoolyard = { i: ci, j: cj, r: 3.4, arena };
  } else {
    for (let dj = -CORE; dj < CORE; dj++) for (let di = -CORE; di < CORE; di++) if (Math.hypot(dj + 0.5, di + 0.5) <= CORE_R) set(ci + di, cj + dj, 'O');
    if (!home) { home = [ci, cj + front - 3]; set(...home, 'h'); rival = [ci + 8, cj - 3]; set(...rival, 'r'); } // the team starts at the south end; the rivals' camp is behind the outpost
    landmarks.push({ type: pl.landmark, i: ci - CORE, j: cj - CORE, w: CORE * 2, h: CORE * 2, outpost: pl.id, centre: true, ...(pl.seats ? { seats: pl.seats } : {}) });
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
console.log(`World ${W}×${H} tiles: ${PLACES.length} field(s) of ${FIELD.hw * 2} × ${maxBack === 6 ? 34 : '34–37'} tiles; houses ${count('H')}, buried roofs ${count('R')}, lamps ${count('l')}, landmarks ${landmarks.length}, snowflakes ${pickups.filter(p => p.kind === 'flake').length}, cocoa ${pickups.filter(p => p.kind === 'cocoa').length}`);
if (process.env.SHOW_FIELD) for (const r of rows) console.log(r);
