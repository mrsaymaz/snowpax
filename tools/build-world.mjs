#!/usr/bin/env node
// Builds the Arena 1 world ("Home Turf") from the OpenStreetMap tiles in data/osm/arena1:
// a heavy-snow Kasımpaşa where the real streets are snowy footpaths, cars are buried, and
// most buildings are snowed in. Five outpost plazas sit at their real relative positions,
// each with a recognisable landmark. Our School is the home base.
//
//   node tools/build-world.mjs
//
// Output: public/arenas/arena1.json (tile rows + outposts, landmarks and scenery).
// One tile = 15 m. Not a copy of the real place: the general likeness of the neighbourhood (main
// streets, shoreline, outposts, landmarks) interpreted in the game's style. Small alleys are left
// out so the blocks stay chunky and the streets wide enough to play in.
// No real names of schools are written; places of worship are scenery only.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../src/config.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TILE = 15;                                // metres per tile
const BOUNDS = { x0: -620, x1: 760, z0: -520, z1: 1260 }; // metres around Our School (x east, z south)
const W = Math.ceil((BOUNDS.x1 - BOUNDS.x0) / TILE), H = Math.ceil((BOUNDS.z1 - BOUNDS.z0) / TILE);
const base = CONFIG.arenas[0].base;

// Outposts (confirmed with Mr. Saymaz) and their landmarks.
const OUTPOSTS = [
  { id: 'boulevard', family: 'answer', label: 'Boulevard Park', lat: 41.04235, lng: 28.96738, landmark: 'treehouse' },
  { id: 'archery', family: 'sort', label: 'Archery Ground', lat: 41.04282, lng: 28.95960, landmark: 'archers-lodge' },
  { id: 'kizilay', family: 'match', label: 'Kızılay Square', lat: 41.034234, lng: 28.967138, landmark: 'fountain' },
  { id: 'waterfront', family: 'listen', label: 'Waterfront Park', lat: 41.03036, lng: 28.96705, landmark: 'admiral' },
  { id: 'sururi', family: 'build', label: 'Sururi Park', lat: 41.03741, lng: 28.97180, landmark: 'snow-castle' },
];
const RIVAL_CAMP = { x: -60, z: -470 }; // metres: north of the school, between the archery ground and the boulevard

// ---------- OSM ----------
const nodes = new Map(), ways = [];
const attr = (s, k) => { const m = new RegExp(`\\b${k}="([^"]*)"`).exec(s); return m ? m[1] : null; };
const unesc = s => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const tagsOf = b => { const t = {}; for (const m of b.matchAll(/<tag k="([^"]*)" v="([^"]*)"\s*\/>/g)) t[unesc(m[1])] = unesc(m[2]); return t; };
const seenW = new Set();
for (const f of readdirSync(join(ROOT, 'data/osm/arena1')).filter(f => f.endsWith('.osm.gz')).sort()) {
  const xml = gunzipSync(readFileSync(join(ROOT, 'data/osm/arena1', f))).toString('utf8');
  for (const m of xml.matchAll(/<node ([^>]*?)(\/>|>([\s\S]*?)<\/node>)/g)) { const id = attr(m[1], 'id'); if (!nodes.has(id)) nodes.set(id, { lat: +attr(m[1], 'lat'), lon: +attr(m[1], 'lon'), tags: m[3] ? tagsOf(m[3]) : {} }); }
  for (const m of xml.matchAll(/<way ([^>]*?)>([\s\S]*?)<\/way>/g)) { const id = attr(m[1], 'id'); if (seenW.has(id)) continue; seenW.add(id); ways.push({ id, refs: [...m[2].matchAll(/<nd ref="(\d+)"/g)].map(r => r[1]), tags: tagsOf(m[2]) }); }
}
const mx = 111320 * Math.cos(base.lat * Math.PI / 180), mz = 110540;
const metres = (lat, lon) => [(lon - base.lng) * mx, -(lat - base.lat) * mz];
const toCell = ([x, z]) => [(x - BOUNDS.x0) / TILE, (z - BOUNDS.z0) / TILE]; // fractional cell coords
const wayCells = w => w.refs.map(r => nodes.get(r)).filter(Boolean).map(n => toCell(metres(n.lat, n.lon)));

// ---------- grid of characters ----------
const g = Array.from({ length: H }, () => Array(W).fill('.'));
const inB = (i, j) => i >= 0 && j >= 0 && i < W && j < H;
const set = (i, j, ch, onlyOn = null) => { if (inB(i, j) && (!onlyOn || onlyOn.includes(g[j][i]))) g[j][i] = ch; };
const get = (i, j) => (inB(i, j) ? g[j][i] : 'X');
let seed = 7; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function pointIn([x, z], p) { let c = false; for (let a = 0, b = p.length - 1; a < p.length; b = a++) { const [xa, za] = p[a], [xb, zb] = p[b]; if ((za > z) !== (zb > z) && x < (xb - xa) * (z - za) / (zb - za) + xa) c = !c; } return c; }
function fillPoly(p, fn) {
  const xs = p.map(q => q[0]), zs = p.map(q => q[1]);
  for (let j = Math.max(0, Math.floor(Math.min(...zs))); j <= Math.min(H - 1, Math.ceil(Math.max(...zs))); j++)
    for (let i = Math.max(0, Math.floor(Math.min(...xs))); i <= Math.min(W - 1, Math.ceil(Math.max(...xs))); i++) if (pointIn([i + 0.5, j + 0.5], p)) fn(i, j);
}
function stroke(pts, r, fn) {
  for (let k = 0; k + 1 < pts.length; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L * 3));
    for (let s = 0; s <= n; s++) { const x = ax + (bx - ax) * s / n, z = az + (bz - az) * s / n; for (let j = Math.floor(z - r); j <= Math.ceil(z + r); j++) for (let i = Math.floor(x - r); i <= Math.ceil(x + r); i++) if (Math.hypot(i + 0.5 - x, j + 0.5 - z) <= r) fn(i, j); }
  }
}

// 1. frozen Golden Horn: coastline cells, then flood fill from a point in the water
const COAST = new Set();
for (const w of ways) if (w.tags.natural === 'coastline') stroke(wayCells(w), 0.75, (i, j) => { if (inB(i, j)) COAST.add(i + ',' + j); });
{
  const [si, sj] = toCell([-300, 1000]).map(Math.floor), st = [[si, sj]], seen = new Set();
  while (st.length) {
    const [i, j] = st.pop(), k = i + ',' + j; if (!inB(i, j) || seen.has(k) || COAST.has(k)) continue;
    seen.add(k); g[j][i] = 'W'; st.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]);
  }
  for (const k of COAST) { const [i, j] = k.split(',').map(Number); g[j][i] = 'W'; }
}
const land = (i, j) => inB(i, j) && g[j][i] !== 'W';

// 2. parks, woods, yards, cemeteries (areas)
const isWorship = t => t.amenity === 'place_of_worship' || ['mosque', 'church', 'synagogue', 'chapel', 'cathedral'].includes(t.building);
const scenery = [];
let schoolYard = null;
for (const w of ways) {
  const t = w.tags; if (w.refs[0] !== w.refs[w.refs.length - 1]) continue;
  const p = wayCells(w); if (p.length < 3) continue;
  if (t.leisure === 'park' || t.leisure === 'garden' || t.leisure === 'playground' || t.leisure === 'pitch' || t.natural === 'wood' || t.landuse === 'grass') fillPoly(p, (i, j) => land(i, j) && set(i, j, 'p'));
  if (t.landuse === 'cemetery' || t.amenity === 'grave_yard') { fillPoly(p, (i, j) => land(i, j) && set(i, j, 'C')); scenery.push({ type: 'cemetery', poly: p.map(q => q.map(v => +v.toFixed(2))) }); }
  if (t.amenity === 'school') { const [bx, bz] = toCell([0, 0]); if (pointIn([bx, bz], p)) { schoolYard = p; fillPoly(p, (i, j) => land(i, j) && set(i, j, 'Y')); } }
}

// 3. streets: the real street network, now snowy footpaths (the boulevard is wider)
const STREET_R = { primary: 1.2, primary_link: 0.8, secondary: 1.0, tertiary: 0.9, tertiary_link: 0.7, unclassified: 0.75, residential: 0.7, living_street: 0.7, pedestrian: 0.7 };
const wayLength = w => { const p = wayCells(w); let L = 0; for (let k = 1; k < p.length; k++) L += Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]); return L * TILE; };
for (const w of ways) { const r = STREET_R[w.tags.highway]; if (!r || w.tags.tunnel === 'yes') continue;
  /* skip short alleys */ if (['residential', 'living_street', 'pedestrian'].includes(w.tags.highway) && wayLength(w) < 110) continue; const ch = w.tags.highway.startsWith('primary') ? '=' : '_'; stroke(wayCells(w), r, (i, j) => { if (land(i, j) && get(i, j) !== '=') set(i, j, ch); }); }

// 4. buildings: places of worship (scenery), the school; ordinary buildings are collected and
//    mostly buried later (step 5b), so open snow is what you see between the streets
const buildings = [];
for (const w of ways) {
  const t = w.tags; if (!t.building || w.refs[0] !== w.refs[w.refs.length - 1]) continue;
  const p = wayCells(w); if (p.length < 3) continue;
  if (isWorship(t)) {
    const cells = []; fillPoly(p, (i, j) => { if (land(i, j)) { set(i, j, 'Q'); cells.push([i, j]); } });
    const c = p.reduce((a, q) => [a[0] + q[0] / p.length, a[1] + q[1] / p.length], [0, 0]);
    if (!cells.length) { const [i, j] = c.map(Math.floor); if (land(i, j)) { set(i, j, 'Q'); cells.push([i, j]); } }
    const area = Math.abs(p.reduce((a, q, k) => a + q[0] * p[(k + 1) % p.length][1] - p[(k + 1) % p.length][0] * q[1], 0) / 2);
    const m = { type: 'mosque', x: +c[0].toFixed(2), z: +c[1].toFixed(2), size: +Math.max(1, Math.sqrt(area)).toFixed(2), special: /Piyale Pa/.test(t.name || '') ? 'piyale-pasa' : null };
    const twin = scenery.find(q => q.type === 'mosque' && Math.hypot(q.x - m.x, q.z - m.z) < 2.5); // a precinct and its building
    if (twin) { if (m.size > twin.size) Object.assign(twin, { ...m, special: twin.special || m.special }); } else scenery.push(m);
    continue;
  }
  if (schoolYard && pointIn(p.reduce((a, q) => [a[0] + q[0] / p.length, a[1] + q[1] / p.length], [0, 0]), schoolYard)) { fillPoly(p, (i, j) => land(i, j) && set(i, j, 'S')); continue; }
  const cells = []; fillPoly(p, (i, j) => { if (land(i, j) && !'=_YSQ'.includes(get(i, j))) cells.push([i, j]); });
  if (cells.length) buildings.push(cells);
}
// small worship nodes too
for (const [, n] of nodes) if (isWorship(n.tags)) { const [x, z] = toCell(metres(n.lat, n.lon)); const i = Math.floor(x), j = Math.floor(z); const dup = scenery.some(q => q.type === 'mosque' && Math.hypot(q.x - x, q.z - z) < 3); if (!dup && land(i, j) && !'=_'.includes(get(i, j))) { set(i, j, 'Q'); scenery.push({ type: 'mosque', x: +x.toFixed(2), z: +z.toFixed(2), size: 1, special: /Piyale Pa/.test(n.tags.name || '') ? 'piyale-pasa' : null }); } }
// quiet zones: a one-tile buffer around places of worship and cemeteries (walkable, no snowballs)
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if ('QC'.includes(g[j][i])) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if ('._=p'.includes(get(i + di, j + dj))) g[j + dj][i + di] = get(i + di, j + dj) === '=' ? '+' : 'q';

// 5. outposts: each outpost IS its landmark, a big centrepiece on a 4×4 core in the middle of a
//    round plaza, with the capture ring round it, fire barrels, cover and snowdrifts
const outposts = [];
const cellOfLatLng = (lat, lng) => toCell(metres(lat, lng));
const CORE = 2, PLAZA_R = 6.2, RING_R = 3.9;
for (const op of OUTPOSTS) {
  let [cx, cz] = cellOfLatLng(op.lat, op.lng);
  cx = Math.round(cx); cz = Math.round(cz); // centred on a cell corner
  for (let j = cz - 7; j < cz + 7; j++) for (let i = cx - 7; i < cx + 7; i++) if (land(i, j) && Math.hypot(i + 0.5 - cx, j + 0.5 - cz) <= PLAZA_R) g[j][i] = 'P';
  for (let j = cz - CORE; j < cz + CORE; j++) for (let i = cx - CORE; i < cx + CORE; i++) set(i, j, 'O');
  for (const [dx, dz] of [[-5, -3], [4, -3], [-5, 2], [4, 2]]) set(cx + dx, cz + dz, 'f', 'P');
  for (const [dx, dz] of [[-6, -1], [5, 0]]) set(cx + dx, cz + dz, 'd', 'P');
  for (const [dx, dz] of [[-4, 5], [3, -6]]) set(cx + dx, cz + dz, '#', 'P');
  outposts.push({ ...op, i: cx, j: cz, r: RING_R });
}
// landmarks next to each plaza
const landmarks = [];
const place = (type, i0, j0, w, h, extra = {}) => { for (let j = j0; j < j0 + h; j++) for (let i = i0; i < i0 + w; i++) if (land(i, j)) set(i, j, 'G'); const lm = { type, i: i0, j: j0, w, h, ...extra }; landmarks.push(lm); return lm; };
const clearAround = (i0, j0, w, h, pad = 1) => { for (let j = j0 - pad; j < j0 + h + pad; j++) for (let i = i0 - pad; i < i0 + w + pad; i++) if (land(i, j) && 'HR.'.includes(get(i, j))) set(i, j, 'P'); };
for (const op of outposts) {
  const { i, j } = op;
  landmarks.push({ type: op.landmark, i: i - CORE, j: j - CORE, w: CORE * 2, h: CORE * 2, outpost: op.id, centre: true }); // the outpost itself
  if (op.id === 'boulevard') { // a footbridge over the boulevard: find the boulevard next to the park
    let best = null, bd = Infinity;
    for (let jj = j - 12; jj <= j + 12; jj++) for (let ii = i - 12; ii <= i + 12; ii++) if (get(ii, jj) === '=') { const d = Math.hypot(ii - i, jj - j); if (d > 7 && d < bd) { bd = d; best = [ii, jj]; } }
    if (best) {
      // which way does the boulevard run here? count road cells along each axis
      const [bi, bj] = best; let runZ = 0, runX = 0;
      for (let k = -3; k <= 3; k++) { if ('=c'.includes(get(bi, bj + k))) runZ++; if ('=c'.includes(get(bi + k, bj))) runX++; }
      const vertical = runZ >= runX; // the road runs north–south, so the bridge spans east–west
      // stair towers on both sides of the road, the deck spans over it
      let a = vertical ? bi - 1 : bi, b = vertical ? bi + 1 : bi, c = vertical ? bj : bj - 1, d = vertical ? bj : bj + 1;
      while (get(a, vertical ? bj : c) === '=' && Math.abs(a - bi) < 5) vertical ? a-- : c--;
      while (get(b, vertical ? bj : d) === '=' && Math.abs(b - bi) < 5) vertical ? b++ : d++;
      const t1 = vertical ? [a, bj] : [bi, c], t2 = vertical ? [b, bj] : [bi, d];
      for (const [ti, tj] of [t1, t2]) { clearAround(ti, tj, 1, 1); set(ti, tj, 'L'); }
      landmarks.push({ type: 'footbridge', a: t1, b: t2, outpost: op.id });
    }
  } else if (op.landmark === 'archers-lodge') {
    // the Archers' Lodge, straw targets, and the tall marble record stones (menzil taşları) that
    // mark famous long shots across the archery ground
    for (const [dx, dz] of [[-8, -6], [-8, 5], [-3, 8]]) { if (!land(i + dx, j + dz)) continue; clearAround(i + dx, j + dz, 1, 1); place('target', i + dx, j + dz, 1, 1, { outpost: op.id }); }
    [[-8, 0], [5, -9], [-3, -9], [-10, -3], [0, -10], [-10, 3], [9, -2], [-6, -8]].forEach(([dx, dz], k) => { if (!land(i + dx, j + dz)) return; clearAround(i + dx, j + dz, 1, 1, 0); place('marker-stone', i + dx, j + dz, 1, 1, { outpost: op.id, n: k }); });
  }
  else if (op.landmark === 'fountain') { clearAround(i + 7, j - 3, 2, 2); place('plane-tree', i + 7, j - 3, 2, 2, { outpost: op.id }); clearAround(i + 4, j + 4, 1, 1); place('simit-cart', i + 4, j + 4, 1, 1, { outpost: op.id }); }
  else if (op.landmark === 'admiral') {
    // the ferry pier: from the plaza into the frozen Golden Horn (walkable), a ferry stuck in the ice at the end
    // which way is the water closest? (the Golden Horn bends round Kasımpaşa)
    const dirs = [[0, 1], [-1, 0], [1, 0], [0, -1]].map(([di, dj]) => { let k = 5; while (k < 30 && land(i + di * k, j + dj * k)) k++; return { di, dj, k }; }).sort((a, b) => a.k - b.k);
    const { di, dj } = dirs[0], wide = [-dj, di]; // pier is two tiles wide, across the direction of travel
    let k = 3, ci = i + di * k, cj = j + dj * k;
    while (land(ci, cj) && k < 30) { for (const s2 of [0, -1]) { const a = ci + wide[0] * s2, b = cj + wide[1] * s2; if (land(a, b) && !'OfdG#'.includes(get(a, b))) set(a, b, 'P'); } k++; ci = i + di * k; cj = j + dj * k; }
    const cells = []; for (let m = 0; m < 6 && inB(ci, cj); m++, k++, ci = i + di * k, cj = j + dj * k) for (const s2 of [0, -1]) { set(ci + wide[0] * s2, cj + wide[1] * s2, 'j'); cells.push([ci + wide[0] * s2, cj + wide[1] * s2]); }
    const is = cells.map(c => c[0]), js = cells.map(c => c[1]);
    // a ferry pier building (iskele) at the far end of the pier
    const endCells = cells.slice(-4); for (const [a, b] of endCells) set(a, b, 'G');
    landmarks.push({ type: 'iskele', i: Math.min(...endCells.map(c => c[0])), j: Math.min(...endCells.map(c => c[1])), w: 2, h: 2, along: dj ? 'z' : 'x', dir: dj ? Math.sign(dj) : Math.sign(di), outpost: op.id });
    const pier = { type: 'pier', i: Math.min(...is), j: Math.min(...js), w: Math.max(...is) - Math.min(...is) + 1, h: Math.max(...js) - Math.min(...js) + 1, along: dj ? 'z' : 'x', outpost: op.id };
    landmarks.push(pier);
    // the ferry lies alongside the end of the pier, in the ice
    // docked head-on beyond the end of the pier, one tile of ice between
    const ferry = dj ? { i: Math.min(...is), j: dj > 0 ? Math.max(...js) + 2 : Math.min(...js) - 6, w: 2, h: 4 } : { i: di > 0 ? Math.max(...is) + 2 : Math.min(...is) - 6, j: Math.min(...js), w: 4, h: 2 };
    landmarks.push({ type: 'ferry', ...ferry, along: dj ? 'z' : 'x', outpost: op.id });
  } else if (op.landmark === 'snow-castle') { for (const [dx, dz] of [[-8, -2], [-8, 1]]) { clearAround(i + dx, j + dz, 1, 1); place(dz < 0 ? 'slide' : 'swings', i + dx, j + dz, 1, 1, { outpost: op.id }); } clearAround(i - 7, j - 9, 2, 2); place('giant-snowman', i - 7, j - 9, 2, 2, { outpost: op.id }); /* behind the lodge, so it never hides the play */ }
}

// 5a. hand-dressed stage arenas (the v2 stage sample: Boulevard Park first): hedges to hide in,
//     snow walls for cover, benches, snowmen, lamps, plane trees and winter street stalls
//     (roasted chestnuts, çay, salep), placed in a ring round the plaza; streets stay open so the
//     waves can walk in.
const DRESS = {
  boulevard: [
    { ch: '#', r: 5.3, at: [20, 110, 200, 290], onlyOn: 'P' },
    { ch: 'B', r: 8.4, at: [40, 140, 220, 320], run: 3 },
    { ch: 'b', r: 7.6, at: [70, 250, 340] },
    { ch: 'n', r: 8.2, at: [95, 185] },
    { ch: 'l', r: 9.4, at: [10, 100, 190, 280] },
    { stall: 'chestnut', r: 9.8, at: [60, 75, 50] }, { stall: 'cay', r: 9.8, at: [300, 285, 315] }, { stall: 'salep', r: 10.2, at: [160, 175, 145] },
    { ch: 'T', r: 11.3, every: 30 },
  ],
  // the Archers' Lodge: fenced shooting lanes, snow walls to shelter behind, a ring of spruces
  archery: [
    { ch: '#', r: 5.6, at: [45, 135, 225, 315], onlyOn: 'P' },
    { ch: 'F', r: 8.0, at: [20, 160, 200, 340], run: 4 },
    { ch: 'B', r: 8.6, at: [90, 270], run: 3 },
    { ch: 'b', r: 7.4, at: [110, 290] },
    { ch: 'l', r: 9.4, at: [0, 90, 180, 270] },
    { stall: 'salep', r: 9.8, at: [60, 70, 50] }, { stall: 'chestnut', r: 9.8, at: [240, 250, 230] },
    { ch: 'x', r: 11.2, every: 24 },
  ],
  // Kızılay Square: a busy square, benches round the fountain, plane trees, simit, çay and corn
  kizilay: [
    { ch: '#', r: 5.4, at: [0, 120, 240], onlyOn: 'P' },
    { ch: 'b', r: 7.2, at: [30, 90, 150, 210, 270, 330] },
    { ch: 'B', r: 8.8, at: [60, 240], run: 3 },
    { ch: 'l', r: 9.0, at: [0, 60, 120, 180, 240, 300] },
    { stall: 'simit', r: 9.8, at: [45, 35, 55] }, { stall: 'cay', r: 9.8, at: [165, 155, 175] }, { stall: 'corn', r: 10.0, at: [285, 275, 295] },
    { ch: 'T', r: 11.4, every: 30 },
  ],
  // Sururi Park: a snowman park, snow forts, hedges, birches and rowans
  sururi: [
    { ch: '#', r: 5.6, at: [30, 150, 270], onlyOn: 'P', run: 2 },
    { ch: 'n', r: 7.6, at: [10, 80, 130, 200, 250, 320] },
    { ch: 'B', r: 8.8, at: [50, 170, 290], run: 3 },
    { ch: 'b', r: 7.8, at: [100, 220] },
    { ch: 'l', r: 9.6, at: [40, 160, 280] },
    { stall: 'salep', r: 10.0, at: [340, 330, 350] }, { stall: 'corn', r: 10.0, at: [190, 180, 200] },
    { ch: 'v', r: 11.0, every: 40 }, { ch: 'y', r: 11.6, every: 40, offset: 20 },
  ],
  // Waterfront Park: railings, benches facing the water, lamps, fish sandwiches, simit and çay
  waterfront: [
    { ch: '#', r: 5.4, at: [60, 180, 300], onlyOn: 'P' },
    { ch: 'F', r: 8.2, at: [0, 90, 180, 270], run: 4 },
    { ch: 'b', r: 7.4, at: [45, 135, 225, 315] },
    { ch: 'l', r: 9.2, at: [20, 110, 200, 290] },
    { stall: 'fish', r: 9.8, at: [70, 60, 80, 250, 240] }, { stall: 'simit', r: 9.8, at: [160, 150, 170] }, { stall: 'cay', r: 10.0, at: [340, 330, 350] },
    { ch: 'x', r: 11.2, every: 36 },
  ],
};
const dressLog = {};
function dressStage(op) {
  const plan = DRESS[op.id]; if (!plan) return;
  const free = (i, j, onlyOn) => inB(i, j) && (onlyOn ? onlyOn.includes(get(i, j)) : '.RH'.includes(get(i, j)));
  const spot = (r, deg) => { const a = deg * Math.PI / 180; return [Math.floor(op.i + Math.cos(a) * r), Math.floor(op.j + Math.sin(a) * r)]; };
  for (const it of plan) {
    if (it.stall) { // a 2×1 stall, first angle that fits
      const stalls = landmarks.filter(l => l.type === 'stall' && l.outpost === op.id), apart = (i, j) => stalls.every(l => Math.hypot(l.i - i, l.j - j) > 4);
      const tries = [...it.at.map(d => [it.r, d]), ...[0, 1, -1].flatMap(dr => Array.from({ length: 36 }, (_, k) => [it.r + dr, it.at[0] + k * 10]))]; // the given angles, then the whole ring
      for (const [r, deg] of tries) { const [i, j] = spot(r, deg); if (!apart(i, j)) continue; if (free(i, j) && free(i + 1, j)) { set(i, j, 'G'); set(i + 1, j, 'G'); landmarks.push({ type: 'stall', kind: it.stall, i, j, w: 2, h: 1, outpost: op.id }); (dressLog[op.id] ||= []).push(it.stall); break; } }
      continue;
    }
    const angles = it.every ? Array.from({ length: Math.floor(360 / it.every) }, (_, k) => k * it.every + (it.offset || 0)) : it.at;
    for (const deg of angles) {
      const run = it.run || 1, a = deg * Math.PI / 180, ti = -Math.sin(a), tj = Math.cos(a); // along the ring
      for (let k = 0; k < run; k++) { const [i, j] = spot(it.r, deg); const ii = Math.round(i + ti * (k - (run - 1) / 2)), jj = Math.round(j + tj * (k - (run - 1) / 2)); if (free(ii, jj, it.onlyOn)) { set(ii, jj, it.ch); dressLog[op.id] = dressLog[op.id] || []; dressLog[op.id].n = (dressLog[op.id].n || 0) + 1; } }
    }
  }
}

// 5b. the town under the snow. Almost every building is buried: open snow fills the blocks.
//     A few houses near the outposts and Our School still show their street front (H); elsewhere
//     only the odd roof ridge or chimney pokes out of the drifts (R, low cover).
for (const op of outposts) dressStage(op);
console.log('stage dressing:', Object.entries(dressLog).map(([k, v]) => `${k} ${v.n || 0} pieces + ${v.join('/') || 'no stalls'}`).join(' · '));
const near = (i, j, R) => outposts.some(o => Math.hypot(i - o.i, j - o.j) < R);
const nearHome = (i, j, R) => { const [bx, bz] = toCell([0, 0]); return Math.hypot(i - bx, j - bz) < R; };
const facesPath = (i, j) => [[0, 1], [0, -1]].some(([di, dj]) => '_=P'.includes(get(i + di, j + dj)));
const free = (i, j, r) => { for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if ('HR'.includes(get(i + di, j + dj))) return false; return true; };
for (const cells of buildings) {
  const [ci, cj] = cells[Math.floor(cells.length / 2)];
  const town = near(ci, cj, 15) || nearHome(ci, cj, 9);
  const front = cells.filter(([i, j]) => get(i, j) === '.' && facesPath(i, j));
  if (front.length && rand() < (town ? 0.45 : 0.07)) { // a house still showing its street front
    if (front.every(([i, j]) => free(i, j, 0) && [[0, 1], [0, -1]].every(([di, dj]) => !'HR'.includes(get(i + di, j + dj))))) { for (const [i, j] of front.slice(0, 3)) set(i, j, 'H'); continue; }
  }
  if (get(ci, cj) === '.' && rand() < (town ? 0.4 : 0.3) && free(ci, cj, 1)) set(ci, cj, 'R');
}
// the world's edge: high snowbanks (solid), so the town fades into drifts
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if ((i < 2 || j < 2 || i >= W - 2 || j >= H - 2) && land(i, j) && !'PGOf'.includes(g[j][i])) g[j][i] = 'D';

// 6. Our School: the yard is home; the start is the yard cell nearest the school point
let home = null;
{
  const [bx, bz] = toCell([0, 0]); let bd = Infinity;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (get(i, j) === 'Y') { const d = Math.hypot(i + 0.5 - bx, j + 0.5 - bz); if (d < bd) { bd = d; home = [i, j]; } }
  if (!home) { home = [Math.floor(bx), Math.floor(bz)]; }
  for (let j = home[1] - 1; j <= home[1] + 1; j++) for (let i = home[0] - 1; i <= home[0] + 1; i++) if (land(i, j) && 'HR.'.includes(get(i, j))) set(i, j, 'Y');
  set(home[0], home[1], 'h');
}
// 7. the rivals' snow camp
let rival = null;
{
  const [cx, cz] = toCell([RIVAL_CAMP.x, RIVAL_CAMP.z]).map(Math.round);
  for (let j = cz - 3; j <= cz + 3; j++) for (let i = cx - 4; i <= cx + 4; i++) if (land(i, j)) set(i, j, Math.abs(i - cx) === 4 || j === cz - 3 ? 'K' : 'Y');
  rival = [cx, cz]; set(cx, cz, 'r');
  // open the camp towards the south
  for (let j = cz + 1; j <= cz + 4; j++) for (let i = cx - 1; i <= cx + 1; i++) if (land(i, j) && 'HRK.'.includes(get(i, j))) set(i, j, '_');
}
// 8. buried cars on the boulevard (cover), drifts along the paths
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  if (get(i, j) !== '=') continue;
  const lane = (get(i + 1, j) === '=' && get(i - 1, j) === '=') || (get(i, j + 1) === '=' && get(i, j - 1) === '=');
  if (lane && rand() < 0.07) { g[j][i] = 'c'; }
}
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (get(i, j) === '_' && rand() < 0.02) g[j][i] = 'd';

// 8b. old street lamps poking out of the snow along the paths (solid, thin), well spaced
{
  const lamps = [];
  for (let j = 2; j < H - 2; j++) for (let i = 2; i < W - 2; i++) {
    if (get(i, j) !== '.' || lamps.length >= 120) continue;
    const byPath = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => '=_'.includes(get(i + di, j + dj)));
    if (!byPath || near(i, j, 8) || nearHome(i, j, 4)) continue;
    if (lamps.some(([a, b]) => Math.max(Math.abs(a - i), Math.abs(b - j)) < 10)) continue;
    if (rand() < 0.3) { lamps.push([i, j]); set(i, j, 'l'); }
  }
}

// 8c. sled hills and runs: Kasımpaşa slopes down to the Golden Horn. Each run starts on a
//     round snow hill near a higher outpost and runs one way, downhill, to a lower place.
//     Coordinates are in cells (fractional, cell centres at +0.5).
const hills = [], sledRuns = [];
{
  const PROTECT = 'WQCq+GOPf#SYhrKjD';
  const RUNS = [
    { id: 'archery-run', label: 'Archery Hill', from: 'archery', start: [7, 10], to: 'home' },
    { id: 'boulevard-run', label: 'Boulevard Run', from: 'boulevard', start: [-7, 7], to: 'kizilay', end: [-3, -9] },
    { id: 'sururi-run', label: 'Sururi Run', from: 'sururi', start: [-6, 6], to: 'kizilay', end: [8, -4] },
  ];
  const opOf = id => outposts.find(o => o.id === id);
  const freeSpot = (ci, cj, r) => { // nearest cell to (ci, cj) whose surroundings can become a hill
    for (let k = 0; k < 8; k++) for (let dj = -k; dj <= k; dj++) for (let di = -k; di <= k; di++) {
      const i = ci + di, j = cj + dj; let ok = inB(i, j);
      for (let b = -r; ok && b <= r; b++) for (let a = -r; ok && a <= r; a++) if (Math.hypot(a, b) <= r && PROTECT.includes(get(i + a, j + b))) ok = false;
      if (ok) return [i, j];
    }
    return null;
  };
  // cheapest lane through open snow (crossing streets is allowed, plazas and quiet zones are not)
  const COST = { '.': 1, u: 1, s: 1, p: 1.3, '_': 2.2, '=': 2.6, d: 3, t: 5, R: 6, l: 6, H: 7, c: 4 };
  const lanePath = (s0, t0) => {
    const N = W * H, dist = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), done = new Uint8Array(N), heap = [[0, s0[1] * W + s0[0]]];
    dist[heap[0][1]] = 0; const goal = t0[1] * W + t0[0];
    while (heap.length) {
      let m = 0; for (let k = 1; k < heap.length; k++) if (heap[k][0] < heap[m][0]) m = k; const [, u] = heap.splice(m, 1)[0];
      if (done[u]) continue; done[u] = 1; if (u === goal) break;
      const ui = u % W, uj = (u / W) | 0;
      for (const [di, dj, w] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.41], [1, -1, 1.41], [-1, 1, 1.41], [-1, -1, 1.41]]) {
        const vi = ui + di, vj = uj + dj; if (!inB(vi, vj)) continue; const c = COST[g[vj][vi]]; if (!c) continue;
        const v = vj * W + vi, nd = dist[u] + c * w; if (nd < dist[v]) { dist[v] = nd; came[v] = u; heap.push([nd, v]); }
      }
    }
    if (came[goal] < 0) return null; const out = []; for (let v = goal; v >= 0; v = came[v]) out.push([v % W + 0.5, ((v / W) | 0) + 0.5]); return out.reverse();
  };
  const chaikin = pts => { const o = [pts[0]]; for (let k = 0; k + 1 < pts.length; k++) { const [a, b] = [pts[k], pts[k + 1]]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } o.push(pts[pts.length - 1]); return o; };
  for (const run of RUNS) {
    const op = opOf(run.from); if (!op) continue;
    const top = freeSpot(op.i + run.start[0], op.j + run.start[1], 5); if (!top) { console.warn('no room for hill', run.id); continue; }
    const R = 5.5, Hh = 2.4;
    for (let j = top[1] - 6; j <= top[1] + 6; j++) for (let i = top[0] - 6; i <= top[0] + 6; i++) if (land(i, j) && Math.hypot(i - top[0], j - top[1]) <= R - 0.5 && !PROTECT.includes(get(i, j))) set(i, j, 'u');
    hills.push({ i: top[0] + 0.5, j: top[1] + 0.5, r: R, h: Hh });
    run.top = top;
    const dest = run.to === 'home' ? [home[0] + 3, home[1] - 4] : [opOf(run.to).i + run.end[0], opOf(run.to).j + run.end[1]];
    let end = dest; for (let k = 0; k < 6 && (COST[get(...end)] === undefined); k++) end = [end[0], end[1] - 1];
    const cells = lanePath(top, end); if (!cells) { console.warn('no lane for', run.id); continue; }
    let pts = cells.filter((_, k) => k % 2 === 0 || k === cells.length - 1); pts = chaikin(chaikin(pts));
    for (const [x, z] of pts) for (let j = Math.floor(z - 0.7); j <= Math.floor(z + 0.7); j++) for (let i = Math.floor(x - 0.7); i <= Math.floor(x + 0.7); i++) {
      if (Math.hypot(i + 0.5 - x, j + 0.5 - z) > 0.75) continue; const c = get(i, j);
      if ('.Rltdcp'.includes(c) || c === 'H') set(i, j, 's');
    }
    let len = 0; for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    // snowy pines round the foot of the hill, away from the run (solid, like park trees)
    let trees = 0;
    for (let a = 0; a < 16 && trees < 6; a++) {
      const ang = a / 16 * Math.PI * 2 + 0.3, ti = Math.round(top[0] + Math.cos(ang) * 5.6), tj = Math.round(top[1] + Math.sin(ang) * 5.6);
      if (!'.u'.includes(get(ti, tj)) || near(ti, tj, 8) || pts.some(([x, z]) => Math.hypot(x - ti - 0.5, z - tj - 0.5) < 2.6) || rand() < 0.35) continue;
      set(ti, tj, 't'); trees++;
    }
    sledRuns.push({ id: run.id, label: run.label, from: run.from, to: run.to, pts: pts.map(p => p.map(v => +v.toFixed(2))), len: +len.toFixed(1) });
  }
}

// 8d. things to collect: glowing snowflakes along the paths between outposts; hot-cocoa cups
//     (warm you up) at a few resting spots on the way
const pickups = [];
{
  const farFromPlazas = (i, j, r) => !outposts.some(o => Math.hypot(i - o.i, j - o.j) < r);
  const spaced = (i, j, r, kind) => !pickups.some(p => p.kind === kind && Math.hypot(p.i - i, p.j - j) < r);
  for (let j = 3; j < H - 3; j++) for (let i = 3; i < W - 3; i++) {
    const c = get(i, j); if (!'_=s'.includes(c)) continue;
    if (farFromPlazas(i, j, 7) && !nearHome(i, j, 5) && spaced(i, j, 13, 'flake') && rand() < 0.25) pickups.push({ id: 'f' + pickups.length, kind: 'flake', i, j });
  }
  for (let j = 3; j < H - 3; j++) for (let i = 3; i < W - 3; i++) {
    if (get(i, j) !== '_' || pickups.filter(p => p.kind === 'cocoa').length >= 5 || !farFromPlazas(i, j, 10) || !spaced(i, j, 40, 'cocoa') || !spaced(i, j, 2, 'flake') || rand() > 0.08) continue;
    pickups.push({ id: 'c' + pickups.length, kind: 'cocoa', i, j });
  }
}

// 8e. trees, hedges, fences and signposts make the paths easy to follow:
//     plane trees line the boulevard, mixed trees along the streets, groves out in the open snow,
//     hedges (hide in them) and picket fences beside the paths, fingerposts at junctions
const signposts = [];
{
  const PATH = '_=';
  const besidePath = (i, j) => [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([di, dj]) => PATH.includes(get(i + di, j + dj)));
  const clearOf = (i, j, chars, r) => { for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (chars.includes(get(i + di, j + dj))) return false; return true; };
  const okSpot = (i, j) => get(i, j) === '.' && !near(i, j, 8) && !nearHome(i, j, 4) && clearOf(i, j, 'lusGO', 1);
  const trees = []; const spaced = (i, j, r) => !trees.some(([a, b]) => Math.max(Math.abs(a - i), Math.abs(b - j)) < r);
  const STREET_TREES = 'tTvyx';
  for (let j = 2; j < H - 2; j++) for (let i = 2; i < W - 2; i++) {
    if (!okSpot(i, j)) continue; const side = besidePath(i, j); if (!side) continue;
    const boulevard = get(i + side[0], j + side[1]) === '=';
    if (boulevard ? spaced(i, j, 3) && rand() < 0.8 : spaced(i, j, 5) && rand() < 0.45) { set(i, j, boulevard ? 'T' : STREET_TREES[Math.floor(rand() * STREET_TREES.length)]); trees.push([i, j]); }
  }
  for (let n = 0; n < 22; n++) { // groves in the open snow
    const gi = 3 + Math.floor(rand() * (W - 6)), gj = 3 + Math.floor(rand() * (H - 6));
    if (!okSpot(gi, gj) || besidePath(gi, gj)) continue;
    const kind = ['t', 'x', 'v', 't', 'x', 'y'][n % 6];
    for (let k = 0; k < 6; k++) { const i = gi + Math.round((rand() - 0.5) * 4), j = gj + Math.round((rand() - 0.5) * 4); if (okSpot(i, j) && !besidePath(i, j) && spaced(i, j, 2)) { set(i, j, rand() < 0.75 ? kind : 't'); trees.push([i, j]); } }
  }
  // hedges (walk in to hide) and picket fences, in short runs along the paths
  const runAlong = (i, j, ch, len) => { const side = besidePath(i, j); if (!side) return 0; const [di, dj] = side[0] ? [0, 1] : [1, 0]; let n = 0; for (let k = 0; k < len; k++) { const a = i + di * k, b = j + dj * k; if (!okSpot(a, b) || !besidePath(a, b)) break; set(a, b, ch); n++; } return n; };
  let hedges = 0, fences = 0;
  for (let j = 2; j < H - 2 && (hedges < 30 || fences < 30); j++) for (let i = 2; i < W - 2; i++) {
    if (!okSpot(i, j) || !besidePath(i, j)) continue;
    const byHouse = !clearOf(i, j, 'H', 3);
    if (byHouse && fences < 30 && rand() < 0.35) fences += runAlong(i, j, 'F', 2 + Math.floor(rand() * 3)) ? 1 : 0;
    else if (hedges < 30 && rand() < 0.03) hedges += runAlong(i, j, 'B', 2 + Math.floor(rand() * 3)) ? 1 : 0;
  }
  // fingerposts at junctions, pointing to the nearest outposts and Our School
  const [hx, hz] = toCell([0, 0]);
  const dests = [...outposts.map(o => ({ label: o.label, i: o.i, j: o.j })), { label: 'Our School', i: hx, j: hz }];
  for (let j = 3; j < H - 3; j++) for (let i = 3; i < W - 3; i++) {
    if (!PATH.includes(get(i, j)) || near(i, j, 9) || nearHome(i, j, 6) || signposts.some(sp => Math.hypot(sp.i - i, sp.j - j) < 20)) continue;
    const arms = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([di, dj]) => PATH.includes(get(i + di * 2, j + dj * 2)));
    if (arms.length < 3) continue;
    const spot = [[1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2]].map(([di, dj]) => [i + di, j + dj]).find(([a, b]) => okSpot(a, b));
    if (!spot) continue;
    const arrows = dests.map(d => ({ label: d.label, ang: +Math.atan2(d.i - spot[0], d.j - spot[1]).toFixed(2), d: Math.hypot(d.i - spot[0], d.j - spot[1]) })).filter(d => d.d > 10).sort((a, b) => a.d - b.d).slice(0, 3).map(({ label, ang }) => ({ label, ang }));
    set(spot[0], spot[1], 'k'); signposts.push({ i: spot[0], j: spot[1], arrows });
  }
  console.log(`trees ${trees.length}, hedge runs ${hedges}, fence runs ${fences}, signposts ${signposts.length}`);
}

// 9. everything walkable must be reachable from the school: fill pockets, open blocked outposts
const WALK = new Set(['.', '_', '=', 'p', 'P', 'Y', 'h', 'r', 'q', '+', 'd', 'j', 'u', 's', 'B']);
const flood = () => {
  const seen = new Uint8Array(W * H), st = [home];
  while (st.length) { const [i, j] = st.pop(); if (!inB(i, j) || seen[j * W + i] || !WALK.has(g[j][i])) continue; seen[j * W + i] = 1; st.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]); }
  return seen;
};
let seen = flood();
// connect anything important that is cut off (an outpost plaza or the rival camp) with a straight dug path
const dig = (from, to) => { let [i, j] = from; const [ti, tj] = to; while (i !== ti || j !== tj) { if (!seen[j * W + i] && 'HRl.'.includes(g[j][i])) g[j][i] = '_'; if (seen[j * W + i]) break; if (Math.abs(ti - i) > Math.abs(tj - j)) i += Math.sign(ti - i); else j += Math.sign(tj - j); } };
for (const target of [...outposts.map(o => [o.i, o.j - 4]), rival]) {
  if (seen[target[1] * W + target[0]]) continue;
  dig(target, home); seen = flood();
}
let filled = 0;
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (WALK.has(g[j][i]) && !seen[j * W + i] && g[j][i] !== 'j') { g[j][i] = g[j][i] === 'p' ? 't' : 'D'; filled++; }
// a few trees in the parks
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (get(i, j) === 'p' && rand() < 0.12) g[j][i] = 't';

// 9. a fight yard in front of every outpost: the most open wedge of the stage (no water, no
//    landmarks) is cleared to open snow, with two low snow walls for cover. The team arrives at
//    its far end and fights the first wave there before walking into the circle to seize it.
const KEEP = 'WGOQCMSKkjX', CLEAR = 'HRDlTvyxtb#nFBcfL';
for (const op of outposts) {
  const cells = (deg, f) => { for (let r = 4.5; r <= 12.5; r += 0.5) for (let da = -34; da <= 34; da += 4) { const a = (deg + da) * Math.PI / 180, i = Math.round(op.i + Math.cos(a) * r), j = Math.round(op.j + Math.sin(a) * r); f(i, j, get(i, j)); } };
  let best = null;
  for (let deg = 0; deg < 360; deg += 10) {
    let score = 0; cells(deg, (i, j, c) => { score += c === 'W' ? -6 : KEEP.includes(c) ? -4 : CLEAR.includes(c) ? -0.4 : 1; });
    if (!best || score > best.score) best = { deg, score };
  }
  let cleared = 0; cells(best.deg, (i, j, c) => { if (CLEAR.includes(c)) { g[j][i] = '.'; cleared++; } });
  for (const da of [-15, 15]) { const a = (best.deg + da) * Math.PI / 180, ti = -Math.sin(a), tj = Math.cos(a); for (const k of [-0.5, 0.5]) { const i = Math.round(op.i + Math.cos(a) * 8 + ti * k), j = Math.round(op.j + Math.sin(a) * 8 + tj * k); if (get(i, j) === '.' || get(i, j) === '_') g[j][i] = '#'; } }
  op.yard = best.deg; console.log(`fight yard: ${op.id} at ${best.deg}°, ${cleared} cells cleared`);
}

// 10. purpose-built battlefields (Brawl-style principles: two spawn sides, a central objective,
//     three lanes round cover). Inside the stage ring the town is replaced by an arena laid out
//     from the environment kit: rounded snow walls #, wooden barricades w, crates z, frosted
//     bushes B (hide in them), ice patches i (slippery), on tinted arena snow a. The layout is
//     symmetric about the centre, so neither side has the better routes. Home spawns on the fight
//     yard's side, the rivals opposite.
const ARENA_R = 12.6, ARENAS = {
  // pieces for the home half [kind, u0, u1, v0, v1] in metres (u: home -> rival, v: across);
  // each is mirrored through the centre for the rival half, and across the lane axis
  boulevard: [
    ['w', -8.6, -8.0, 2.0, 3.6],           // barricades flanking the spawn exit
    ['z', -6.4, -5.6, -0.4, 0.4],          // a crate in the middle lane
    ['#', -6.0, -6.0, 4.4, 7.4], ['#', -5.5, -3.6, 7.2, 7.2], // an L of snow wall on each side lane, one block thick
    ['B', -3.2, -1.2, 8.0, 9.6],           // bushes on the side routes
    ['z', -2.2, -1.4, 4.6, 5.4],           // crates at the edge of the plaza
    ['i', -0.9, 0.9, 7.6, 9.4],            // an ice patch across each side route, in the middle
    ['w', -10.2, -9.6, -1.2, 1.2],         // a low barricade behind the spawn
  ],
};
for (const op of outposts) {
  const plan = ARENAS[op.id]; if (!plan) continue;
  op.yard = Math.round((op.yard ?? 0) / 90) * 90 % 360; // square to the grid, so walls run straight
  const a = op.yard * Math.PI / 180, ux = Math.round(Math.cos(a)), uz = Math.round(Math.sin(a)), vx = -uz, vz = ux;
  // clear the ring: everything but the outpost core becomes arena snow; the plaza stays
  for (let j = Math.floor(op.j - ARENA_R); j <= op.j + ARENA_R; j++) for (let i = Math.floor(op.i - ARENA_R); i <= op.i + ARENA_R; i++) {
    const d = Math.hypot(i - op.i, j - op.j); if (d > ARENA_R || !inB(i, j) || 'OW'.includes(get(i, j))) continue;
    g[j][i] = d <= RING_R + 0.4 ? 'P' : 'a';
  }
  for (let k = landmarks.length - 1; k >= 0; k--) { const l = landmarks[k]; if (!l.centre && Math.hypot(l.i + (l.w || 1) / 2 - op.i, l.j + (l.h || 1) / 2 - op.j) < ARENA_R) landmarks.splice(k, 1); }
  for (let k = signposts.length - 1; k >= 0; k--) if (Math.hypot(signposts[k].i - op.i, signposts[k].j - op.j) < ARENA_R) signposts.splice(k, 1);
  const stamp = (ch, u0, u1, v0, v1) => { for (let u = u0; u <= u1 + 1e-6; u += 0.5) for (let v = v0; v <= v1 + 1e-6; v += 0.5) { const i = Math.round(op.i + u * ux + v * vx), j = Math.round(op.j + u * uz + v * vz); if (inB(i, j) && 'aP'.includes(get(i, j))) g[j][i] = ch; } };
  for (const [ch, u0, u1, v0, v1] of plan) for (const [su, sv] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) stamp(ch, su > 0 ? u0 : -u1, su > 0 ? u1 : -u0, sv > 0 ? v0 : -v1, sv > 0 ? v1 : -v0);
  op.arena = true; console.log(`battlefield: ${op.id}, spawn axis ${op.yard}°`);
}

const rows = g.map(r => r.join(''));
const out = {
  v: 3, id: 'arena1', name: 'Home Turf', kind: 'tiles', world: true, tile: TILE, w: W, h: H,
  credit: '© OpenStreetMap contributors',
  rows, outposts: outposts.map(({ lat, lng, ...o }) => o), landmarks, scenery,
  home, rival, hills, sledRuns, pickups, signposts,
};
mkdirSync(join(ROOT, 'public/arenas'), { recursive: true });
writeFileSync(join(ROOT, 'public/arenas/arena1.json'), JSON.stringify(out));
const count = ch => rows.join('').split(ch).length - 1;
console.log(`World ${W}×${H} tiles (${TILE} m each): houses ${count('H')}, buried roofs ${count('R')}, open snow ${count('.')}, streets ${count('_') + count('=')}, plazas ${count('P')}, water ${count('W')}, parks ${count('p')}, scenery ${scenery.length}, landmarks ${landmarks.length}, buried cars ${count('c')}, lamps ${count('l')}, hills ${hills.length}, sled runs ${sledRuns.map(r => r.id + ' ' + r.len).join(', ')}, snowflakes ${pickups.filter(p => p.kind === 'flake').length}, cocoa ${pickups.filter(p => p.kind === 'cocoa').length}, filled pockets ${filled}`);
