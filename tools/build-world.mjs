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
const BOUNDS = { x0: -620, x1: 760, z0: -520, z1: 1140 }; // metres around Our School (x east, z south)
const W = Math.ceil((BOUNDS.x1 - BOUNDS.x0) / TILE), H = Math.ceil((BOUNDS.z1 - BOUNDS.z0) / TILE);
const base = CONFIG.arenas[0].base;

// Outposts (confirmed with Mr. Saymaz) and their landmarks.
const OUTPOSTS = [
  { id: 'boulevard', family: 'answer', label: 'Boulevard Park', lat: 41.04235, lng: 28.96738, landmark: 'footbridge' },
  { id: 'archery', family: 'sort', label: 'Archery Ground', lat: 41.04282, lng: 28.95960, landmark: 'archers-lodge' },
  { id: 'kizilay', family: 'match', label: 'Kızılay Square', lat: 41.034234, lng: 28.967138, landmark: 'fountain' },
  { id: 'waterfront', family: 'listen', label: 'Waterfront Park', lat: 41.03036, lng: 28.96705, landmark: 'admiral' },
  { id: 'sururi', family: 'build', label: 'Sururi Park', lat: 41.03741, lng: 28.97180, landmark: 'pavilion' },
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

// 5. outposts: plaza, lodge, fire barrels, cover, drifts, landmark
const outposts = [];
const cellOfLatLng = (lat, lng) => toCell(metres(lat, lng));
for (const op of OUTPOSTS) {
  let [cx, cz] = cellOfLatLng(op.lat, op.lng);
  cx = Math.round(cx); cz = Math.round(cz); // plaza centred on a cell corner: the lodge is 2×2
  const R = 5.4;
  for (let j = cz - 6; j < cz + 6; j++) for (let i = cx - 6; i < cx + 6; i++) if (land(i, j) && Math.hypot(i + 0.5 - cx, j + 0.5 - cz) <= R) g[j][i] = 'P';
  for (const [i, j] of [[cx - 1, cz - 1], [cx, cz - 1], [cx - 1, cz], [cx, cz]]) set(i, j, 'O');
  for (const [dx, dz] of [[-3, -3], [2, -3], [-3, 2], [2, 2]]) set(cx + dx, cz + dz, 'f', 'P');
  for (const [dx, dz] of [[-5, -1], [4, 0]]) set(cx + dx, cz + dz, 'd', 'P');
  for (const [dx, dz] of [[-1, -4], [0, 3]]) set(cx + dx, cz + dz, '#', 'P');
  outposts.push({ ...op, i: cx, j: cz, r: 3.4 });
}
// landmarks next to each plaza
const landmarks = [];
const place = (type, i0, j0, w, h, extra = {}) => { for (let j = j0; j < j0 + h; j++) for (let i = i0; i < i0 + w; i++) if (land(i, j)) set(i, j, 'G'); const lm = { type, i: i0, j: j0, w, h, ...extra }; landmarks.push(lm); return lm; };
const clearAround = (i0, j0, w, h, pad = 1) => { for (let j = j0 - pad; j < j0 + h + pad; j++) for (let i = i0 - pad; i < i0 + w + pad; i++) if (land(i, j) && 'HR.'.includes(get(i, j))) set(i, j, 'P'); };
for (const op of outposts) {
  const { i, j } = op;
  if (op.landmark === 'footbridge') { // a footbridge over the boulevard: find the boulevard next to the park
    let best = null, bd = Infinity;
    for (let jj = j - 12; jj <= j + 12; jj++) for (let ii = i - 12; ii <= i + 12; ii++) if (get(ii, jj) === '=') { const d = Math.hypot(ii - i, jj - j); if (d > 5.5 && d < bd) { bd = d; best = [ii, jj]; } }
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
  } else if (op.landmark === 'archers-lodge') { clearAround(i + 6, j - 3, 3, 3); place('archers-lodge', i + 6, j - 3, 3, 3, { outpost: op.id }); for (const [dx, dz] of [[-6, -6], [-7, 4], [6, 5]]) { clearAround(i + dx, j + dz, 1, 1); place('target', i + dx, j + dz, 1, 1, { outpost: op.id }); } for (const [dx, dz] of [[-6, 0], [5, -6]]) { clearAround(i + dx, j + dz, 1, 1); place('marker-stone', i + dx, j + dz, 1, 1, { outpost: op.id }); } }
  else if (op.landmark === 'fountain') { clearAround(i - 1, j - 8, 2, 2); place('fountain', i - 1, j - 8, 2, 2, { outpost: op.id }); clearAround(i + 6, j - 2, 2, 2); place('plane-tree', i + 6, j - 2, 2, 2, { outpost: op.id }); }
  else if (op.landmark === 'admiral') {
    clearAround(i - 1, j - 7, 2, 2); place('admiral', i - 1, j - 7, 2, 2, { outpost: op.id });
    // the ferry pier: from the plaza into the frozen Golden Horn (walkable), a ferry stuck in the ice at the end
    let pi = i, pj = j + 6; while (land(pi, pj) && pj < H - 1) { set(pi, pj, 'P'); set(pi - 1, pj, 'P'); pj++; }
    const start = pj; for (let k = 0; k < 6 && pj < H - 2; k++, pj++) { set(pi, pj, 'j'); set(pi - 1, pj, 'j'); }
    landmarks.push({ type: 'pier', i: pi - 1, j: start, w: 2, h: pj - start, outpost: op.id });
    landmarks.push({ type: 'ferry', i: pi + 1, j: pj - 3, w: 4, h: 2, outpost: op.id });
  } else if (op.landmark === 'pavilion') { clearAround(i + 6, j - 2, 2, 2); place('pavilion', i + 6, j - 2, 2, 2, { outpost: op.id }); for (const [dx, dz] of [[-7, -2], [-7, 1]]) { clearAround(i + dx, j + dz, 1, 1); place(dz < 0 ? 'slide' : 'swings', i + dx, j + dz, 1, 1, { outpost: op.id }); } clearAround(i - 6, j - 8, 2, 2); place('giant-snowman', i - 6, j - 8, 2, 2, { outpost: op.id }); /* behind the lodge, so it never hides the play */ }
}

// 5b. the town under the snow. Almost every building is buried: open snow fills the blocks.
//     A few houses near the outposts and Our School still show their street front (H); elsewhere
//     only the odd roof ridge or chimney pokes out of the drifts (R, low cover).
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

// 9. everything walkable must be reachable from the school: fill pockets, open blocked outposts
const WALK = new Set(['.', '_', '=', 'p', 'P', 'Y', 'h', 'r', 'q', '+', 'd', 'j']);
const flood = () => {
  const seen = new Uint8Array(W * H), st = [home];
  while (st.length) { const [i, j] = st.pop(); if (!inB(i, j) || seen[j * W + i] || !WALK.has(g[j][i])) continue; seen[j * W + i] = 1; st.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]); }
  return seen;
};
let seen = flood();
// connect anything important that is cut off (an outpost plaza or the rival camp) with a straight dug path
const dig = (from, to) => { let [i, j] = from; const [ti, tj] = to; while (i !== ti || j !== tj) { if (!seen[j * W + i] && 'HR.'.includes(g[j][i])) g[j][i] = '_'; if (seen[j * W + i]) break; if (Math.abs(ti - i) > Math.abs(tj - j)) i += Math.sign(ti - i); else j += Math.sign(tj - j); } };
for (const target of [...outposts.map(o => [o.i, o.j - 4]), rival]) {
  if (seen[target[1] * W + target[0]]) continue;
  dig(target, home); seen = flood();
}
let filled = 0;
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (WALK.has(g[j][i]) && !seen[j * W + i] && g[j][i] !== 'j') { g[j][i] = g[j][i] === 'p' ? 't' : 'D'; filled++; }
// a few trees in the parks
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (get(i, j) === 'p' && rand() < 0.12) g[j][i] = 't';

const rows = g.map(r => r.join(''));
const out = {
  v: 3, id: 'arena1', name: 'Home Turf', kind: 'tiles', world: true, tile: TILE, w: W, h: H,
  credit: '© OpenStreetMap contributors',
  rows, outposts: outposts.map(({ lat, lng, ...o }) => o), landmarks, scenery,
  home, rival,
};
mkdirSync(join(ROOT, 'public/arenas'), { recursive: true });
writeFileSync(join(ROOT, 'public/arenas/arena1.json'), JSON.stringify(out));
const count = ch => rows.join('').split(ch).length - 1;
console.log(`World ${W}×${H} tiles (${TILE} m each): houses ${count('H')}, buried roofs ${count('R')}, open snow ${count('.')}, streets ${count('_') + count('=')}, plazas ${count('P')}, water ${count('W')}, parks ${count('p')}, scenery ${scenery.length}, landmarks ${landmarks.length}, buried cars ${count('c')}, filled pockets ${filled}`);
