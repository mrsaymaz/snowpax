#!/usr/bin/env node
// Builds a playable arena from the OpenStreetMap tiles in data/osm/<arena>/.
//
//   node tools/build-arena.mjs [arena1-block]
//
// Keeps the real streets and mapped buildings, widens streets a little, fills empty street
// frontage with simple procedural houses (OSM maps only a few of the real buildings here),
// marks no-snowball zones (places of worship, cemeteries, tombs, hospitals), and writes a
// walk grid and a street graph for movement and A* travel. Real names are never written.
// Output: public/arenas/<id>.json (world units; x = east, z = south).
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../src/config.js';
import { GRID } from '../src/game/grid.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const ARENAS = {
  'arena1-block': {
    osm: 'data/osm/arena1',
    center: CONFIG.arenas[0].base,          // Our School
    halfSize: 380,                          // metres around the centre
    places: [
      { id: 'base', kind: 'base', label: 'Our School', lat: CONFIG.arenas[0].base.lat, lng: CONFIG.arenas[0].base.lng },
      { id: 'boulevard-park', kind: 'outpost', family: 'answer', label: 'Boulevard Park', lat: 41.04235, lng: 28.96738 },
    ],
  },
};

const id = process.argv[2] || 'arena1-block';
const A = ARENAS[id];
if (!A) { console.error('Unknown arena', id); process.exit(1); }
const S = CONFIG.world.scale;                  // world units per metre
const cell = GRID.cell;                        // world units per grid cell

// ---------- parse OSM XML (regular enough for a small parser) ----------
const nodes = new Map(), ways = [];
const attr = (s, k) => { const m = new RegExp(`\\b${k}="([^"]*)"`).exec(s); return m ? m[1] : null; };
const unesc = s => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function tagsOf(body) { const t = {}; for (const m of body.matchAll(/<tag k="([^"]*)" v="([^"]*)"\s*\/>/g)) t[unesc(m[1])] = unesc(m[2]); return t; }
for (const f of readdirSync(join(ROOT, A.osm)).filter(f => f.endsWith('.osm.gz')).sort()) {
  const xml = gunzipSync(readFileSync(join(ROOT, A.osm, f))).toString('utf8');
  for (const m of xml.matchAll(/<node ([^>]*?)(\/>|>([\s\S]*?)<\/node>)/g)) {
    const nid = attr(m[1], 'id');
    if (!nodes.has(nid)) nodes.set(nid, { lat: +attr(m[1], 'lat'), lon: +attr(m[1], 'lon'), tags: m[3] ? tagsOf(m[3]) : {} });
  }
  for (const m of xml.matchAll(/<way ([^>]*?)>([\s\S]*?)<\/way>/g)) {
    ways.push({ id: attr(m[1], 'id'), refs: [...m[2].matchAll(/<nd ref="(\d+)"/g)].map(r => r[1]), tags: tagsOf(m[2]) });
  }
}
const seenWay = new Set();
const uniqWays = ways.filter(w => (seenWay.has(w.id) ? false : (seenWay.add(w.id), true)));

// ---------- projection ----------
const lat0 = A.center.lat, lon0 = A.center.lng;
const mx = 111320 * Math.cos(lat0 * Math.PI / 180), mz = 110540;
const proj = (lat, lon) => [(lon - lon0) * mx * S, -(lat - lat0) * mz * S];
const H = A.halfSize * S;
const inside = ([x, z], pad = 0) => Math.abs(x) <= H + pad && Math.abs(z) <= H + pad;
const wayPts = w => w.refs.map(r => nodes.get(r)).filter(Boolean).map(n => proj(n.lat, n.lon));

// ---------- geometry helpers ----------
const area = p => { let a = 0; for (let i = 0; i < p.length; i++) { const [x1, z1] = p[i], [x2, z2] = p[(i + 1) % p.length]; a += x1 * z2 - x2 * z1; } return a / 2; };
const centroid = p => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
function simplify(pts, eps) { // Douglas–Peucker
  if (pts.length < 4) return pts;
  const d = (p, a, b) => {
    const [x, z] = p, [x1, z1] = a, [x2, z2] = b, L = Math.hypot(x2 - x1, z2 - z1);
    if (L < 1e-9) return Math.hypot(x - x1, z - z1); // closed ring: distance to the start point
    return Math.abs((x2 - x1) * (z1 - z) - (x1 - x) * (z2 - z1)) / L;
  };
  let idx = 0, max = 0;
  for (let i = 1; i < pts.length - 1; i++) { const v = d(pts[i], pts[0], pts[pts.length - 1]); if (v > max) { max = v; idx = i; } }
  if (max <= eps) return [pts[0], pts[pts.length - 1]];
  return [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)];
}
function cleanRing(pts) {
  let p = pts.slice();
  if (p.length > 1 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p.pop();
  p = simplify([...p, p[0]], 0.35 * S).slice(0, -1);
  if (p.length < 3) return null;
  if (area(p) < 0) p.reverse(); // counter-clockwise in x/z
  return p;
}
function hash(...v) { let h = 2166136261; for (const n of v) { h = Math.imul(h ^ Math.round(n * 100), 16777619); } return (h >>> 0) / 4294967296; }
let seed = 12345; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const r1 = v => Math.round(v * 10) / 10;

// ---------- grid ----------
const N = Math.ceil((2 * H) / cell);
const grid = new Uint8Array(N * N);
const toCell = (x, z) => [Math.floor((x + H) / cell), Math.floor((z + H) / cell)];
const cellCenter = (i, j) => [i * cell - H + cell / 2, j * cell - H + cell / 2];
function stampPolygon(p, flag) {
  const zs = p.map(q => q[1]); const j0 = Math.max(0, toCell(0, Math.min(...zs))[1]), j1 = Math.min(N - 1, toCell(0, Math.max(...zs))[1]);
  for (let j = j0; j <= j1; j++) {
    const z = cellCenter(0, j)[1], xs = [];
    for (let k = 0; k < p.length; k++) { const [x1, z1] = p[k], [x2, z2] = p[(k + 1) % p.length]; if ((z1 > z) !== (z2 > z)) xs.push(x1 + (z - z1) * (x2 - x1) / (z2 - z1)); }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil((xs[k] + H) / cell - 0.5)), i1 = Math.min(N - 1, Math.floor((xs[k + 1] + H) / cell - 0.5));
      for (let i = i0; i <= i1; i++) grid[j * N + i] |= flag;
    }
  }
}
function stampCapsule(a, b, r, flag) {
  const [x0, z0] = toCell(Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r), [x1, z1] = toCell(Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r);
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-9;
  for (let j = Math.max(0, z0); j <= Math.min(N - 1, z1); j++) for (let i = Math.max(0, x0); i <= Math.min(N - 1, x1); i++) {
    const [x, z] = cellCenter(i, j); const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
    if (Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz) <= r) grid[j * N + i] |= flag;
  }
}
function stampRing(p, r, flag) { for (let k = 0; k < p.length; k++) stampCapsule(p[k], p[(k + 1) % p.length], r, flag); stampPolygon(p, flag); }
const anyFlag = (p, flags) => { // any cell of polygon p has one of flags
  const zs = p.map(q => q[1]), xs = p.map(q => q[0]);
  const [i0, j0] = toCell(Math.min(...xs), Math.min(...zs)), [i1, j1] = toCell(Math.max(...xs), Math.max(...zs));
  if (i0 < 1 || j0 < 1 || i1 > N - 2 || j1 > N - 2) return true;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    if (!(grid[j * N + i] & flags)) continue;
    const [x, z] = cellCenter(i, j); if (pointIn([x, z], p)) return true;
  }
  return false;
};
function pointIn([x, z], p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, zi] = p[i], [xj, zj] = p[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }

// ---------- roads ----------
const ROAD_W = { primary: 16, primary_link: 9, secondary: 13, tertiary: 10, unclassified: 8, residential: 8, living_street: 7, pedestrian: 6, service: 5.5, footway: 3.5, steps: 3.5, path: 3 };
const roads = [];
for (const w of uniqWays) {
  const cls = w.tags.highway; if (!ROAD_W[cls] || w.tags.area === 'yes' || w.tags.tunnel === 'yes') continue;
  const p = wayPts(w); if (p.length < 2 || !p.some(q => inside(q, 40 * S))) continue;
  roads.push({ cls, w: ROAD_W[cls] * S, p: simplify(p, 0.4 * S), refs: w.refs, oneway: w.tags.oneway === 'yes' });
}
for (const r of roads) for (let k = 0; k + 1 < r.p.length; k++) stampCapsule(r.p[k], r.p[k + 1], r.w / 2, GRID.ROAD);

// ---------- areas and zones ----------
const areas = [], zones = [];
const AREA_KIND = t => (t.amenity === 'school' ? 'schoolyard' : t.leisure === 'park' || t.leisure === 'garden' ? 'park' : t.leisure === 'playground' ? 'playground' : t.leisure === 'pitch' ? 'pitch' : t.landuse === 'cemetery' || t.amenity === 'grave_yard' ? 'cemetery' : t.natural === 'wood' || t.landuse === 'forest' ? 'wood' : null);
const isWorship = t => t.amenity === 'place_of_worship' || ['mosque', 'church', 'synagogue', 'chapel', 'cathedral'].includes(t.building);
const isSensitive = t => isWorship(t) || t.landuse === 'cemetery' || t.amenity === 'grave_yard' || t.historic === 'tomb' || t.amenity === 'hospital';
const ZONE_PAD = 12 * S;
const baseXY = proj(A.center.lat, A.center.lng);
let ourYard = null;
for (const w of uniqWays) {
  const kind = AREA_KIND(w.tags); if (!kind || w.refs[0] !== w.refs[w.refs.length - 1]) continue;
  const p = cleanRing(wayPts(w)); if (!p || !p.some(q => inside(q))) continue;
  const isOurs = kind === 'schoolyard' && pointIn(baseXY, p);
  if (isOurs) ourYard = p;
  areas.push({ kind: isOurs ? 'ourYard' : kind, p });
  stampPolygon(p, kind === 'cemetery' ? GRID.CEMETERY : kind === 'schoolyard' ? GRID.YARD : GRID.PARK);
}
for (const w of uniqWays) {
  if (!isSensitive(w.tags) || w.refs.length < 3) continue;
  const p = cleanRing(wayPts(w)); if (!p || !p.some(q => inside(q, ZONE_PAD))) continue;
  zones.push({ p, pad: r1(ZONE_PAD) }); stampRing(p, ZONE_PAD, GRID.ZONE);
}
for (const [, n] of nodes) {
  if (!isSensitive(n.tags)) continue;
  const q = proj(n.lat, n.lon); if (!inside(q, ZONE_PAD)) continue;
  zones.push({ c: q.map(r1), r: r1(ZONE_PAD + 6 * S) }); stampCapsule(q, q, ZONE_PAD + 6 * S, GRID.ZONE);
}

// ---------- OSM buildings ----------
const buildings = [];
const levelsFor = (t, c) => { const l = parseInt(t['building:levels'], 10); if (l > 0) return Math.min(l, 10); return t.building === 'apartments' ? 5 + Math.floor(hash(c[0], c[1]) * 3) : 3 + Math.floor(hash(c[0], c[1]) * 4); };
for (const w of uniqWays) {
  const t = w.tags; if (!t.building || t.building === 'roof' || w.refs[0] !== w.refs[w.refs.length - 1]) continue;
  const p = cleanRing(wayPts(w)); if (!p) continue;
  const c = centroid(p); if (!inside(c)) continue;
  if (Math.abs(area(p)) < 16 * S * S) continue;
  let kind = isWorship(t) ? 'worship' : t.building === 'school' || t.amenity === 'school' ? 'school' : 'house';
  if (kind === 'school' && ourYard && pointIn(c, ourYard)) kind = 'ourSchool';
  if (kind === 'house' && ourYard && pointIn(c, ourYard)) kind = 'ourSchool';
  const levels = kind === 'worship' ? 2 : kind === 'ourSchool' || kind === 'school' ? 3 : levelsFor(t, c);
  buildings.push({ p, levels, kind, osm: 1 });
  stampPolygon(p, GRID.BLOCK);
}

// ---------- procedural houses along street frontage ----------
const FILL_CLASSES = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'pedestrian', 'service']);
const AVOID = GRID.ROAD | GRID.BLOCK | GRID.PARK | GRID.CEMETERY | GRID.YARD;
let placed = 0;
for (const r of roads) {
  if (!FILL_CLASSES.has(r.cls)) continue;
  for (let k = 0; k + 1 < r.p.length; k++) {
    const a = r.p[k], b = r.p[k + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 4 * S) continue;
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, nx = -uz, nz = ux;
    for (const side of [1, -1]) {
      let s = 1.5 * S;
      while (s < L - 3 * S) {
        const wdt = (6 + rand() * 6) * S, dep = (8 + rand() * 6) * S, gap = rand() < 0.12 ? (4 + rand() * 6) * S : 0.3 * S;
        if (s + wdt > L) break;
        const off = r.w / 2 + 1.6 * S;
        const c0 = [a[0] + ux * s + nx * side * off, a[1] + uz * s + nz * side * off];
        const p = [c0, [c0[0] + ux * wdt, c0[1] + uz * wdt], [c0[0] + ux * wdt + nx * side * dep, c0[1] + uz * wdt + nz * side * dep], [c0[0] + nx * side * dep, c0[1] + nz * side * dep]];
        if (area(p) < 0) p.reverse();
        if (p.every(q => inside(q)) && !anyFlag(p, AVOID)) {
          const c = centroid(p);
          buildings.push({ p: p.map(q => q.slice()), levels: 3 + Math.floor(hash(c[0], c[1]) * 4), kind: 'house' });
          stampPolygon(p, GRID.BLOCK); placed++;
        }
        s += wdt + gap;
      }
    }
  }
}

// ---------- trees: parks, woods and the boulevard's planted strip ----------
const trees = [];
for (const a of areas) {
  if (!['park', 'wood', 'ourYard', 'playground'].includes(a.kind)) continue;
  const xs = a.p.map(q => q[0]), zs = a.p.map(q => q[1]);
  const n = Math.min(60, Math.floor(Math.abs(area(a.p)) / ((a.kind === 'wood' ? 30 : 60) * S * S)));
  for (let k = 0; k < n * 3 && trees.length < 900; k++) {
    const q = [Math.min(...xs) + rand() * (Math.max(...xs) - Math.min(...xs)), Math.min(...zs) + rand() * (Math.max(...zs) - Math.min(...zs))];
    if (!pointIn(q, a.p) || !inside(q)) continue;
    const [i, j] = toCell(...q); if (grid[j * N + i] & (GRID.BLOCK | GRID.ROAD)) continue;
    if (a.kind === 'ourYard' && rand() < 0.7) continue; // keep the yard open for the final battle
    trees.push(q.map(r1)); grid[j * N + i] |= GRID.BLOCK;
  }
}
for (const r of roads) {
  if (r.cls !== 'primary') continue;
  for (let k = 0; k + 1 < r.p.length; k++) {
    const a = r.p[k], b = r.p[k + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let s = 0; s < L; s += 7 * S) {
      const t = s / L, q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L;
      for (const side of [1, -1]) {
        const p = [q[0] + nx * side * (r.w / 2 + 0.8 * S), q[1] + nz * side * (r.w / 2 + 0.8 * S)];
        if (!inside(p)) continue;
        const [i, j] = toCell(...p); if (grid[j * N + i] & (GRID.BLOCK | GRID.ROAD)) continue;
        trees.push(p.map(r1)); grid[j * N + i] |= GRID.BLOCK;
      }
    }
  }
}

// ---------- street graph (for A* travel and bots) ----------
const gIndex = new Map(), gNodes = [], gEdges = [];
const WALK = new Set(['primary', 'primary_link', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'pedestrian', 'service', 'footway', 'steps', 'path']);
const nodeOf = ref => {
  if (gIndex.has(ref)) return gIndex.get(ref);
  const n = nodes.get(ref); if (!n) return -1;
  const q = proj(n.lat, n.lon); if (!inside(q, -1)) return -1;
  gIndex.set(ref, gNodes.length); gNodes.push(q.map(r1)); return gNodes.length - 1;
};
for (const r of roads) {
  if (!WALK.has(r.cls)) continue;
  for (let k = 0; k + 1 < r.refs.length; k++) {
    const a = nodeOf(r.refs[k]), b = nodeOf(r.refs[k + 1]);
    if (a >= 0 && b >= 0 && a !== b) gEdges.push([a, b]);
  }
}
// Drop links a character cannot walk (a mapped footway under a building, a corner cut by a house).
const free = (x, z) => { const [i, j] = toCell(x, z); return i >= 0 && j >= 0 && i < N && j < N && !(grid[j * N + i] & GRID.BLOCK); };
const walkable = (a, b) => {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(d / (cell * 0.4)));
  for (let k = 0; k <= n; k++) { const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n; if (!free(x, z)) return false; }
  return true;
};
for (let k = gEdges.length - 1; k >= 0; k--) if (!walkable(gNodes[gEdges[k][0]], gNodes[gEdges[k][1]])) gEdges.splice(k, 1);
// Keep the largest connected part so every travel target is reachable.
const adj = gNodes.map(() => []); for (const [a, b] of gEdges) { adj[a].push(b); adj[b].push(a); }
const comp = new Int32Array(gNodes.length).fill(-1); let best = -1, bestSize = 0;
for (let s0 = 0, cid = 0; s0 < gNodes.length; s0++) {
  if (comp[s0] >= 0) continue;
  let size = 0; const st = [s0]; comp[s0] = cid;
  while (st.length) { const u = st.pop(); size++; for (const v of adj[u]) if (comp[v] < 0) { comp[v] = cid; st.push(v); } }
  if (size > bestSize) { bestSize = size; best = cid; } cid++;
}
const remap = new Int32Array(gNodes.length).fill(-1), keptNodes = [];
gNodes.forEach((q, i) => { if (comp[i] === best) { remap[i] = keptNodes.length; keptNodes.push(q); } });
const keptEdges = gEdges.filter(([a, b]) => comp[a] === best && comp[b] === best).map(([a, b]) => [remap[a], remap[b]]);

// ---------- reachability: fill pockets nobody can walk into (inner courtyards) ----------
const reach = new Uint8Array(N * N);
{
  const st = [];
  for (const [x, z] of keptNodes) { const [i, j] = toCell(x, z); const k = j * N + i; if (i >= 0 && j >= 0 && i < N && j < N && !(grid[k] & GRID.BLOCK) && !reach[k]) { reach[k] = 1; st.push(k); } }
  while (st.length) {
    const k = st.pop(), i = k % N, j = (k / N) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue;
      const kk = jj * N + ii; if (!reach[kk] && !(grid[kk] & GRID.BLOCK)) { reach[kk] = 1; st.push(kk); }
    }
  }
  let filled = 0;
  for (let k = 0; k < N * N; k++) if (!reach[k] && !(grid[k] & GRID.BLOCK)) { grid[k] |= GRID.BLOCK; filled++; }
  console.log(`Filled ${filled} unreachable cells.`);
}
const nearestReachable = (x, z) => {
  const [i0, j0] = toCell(x, z);
  for (let r = 0; r < 40; r++) {
    let best = null, bd = Infinity;
    for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) {
      if (i < 1 || j < 1 || i >= N - 1 || j >= N - 1) continue;
      // need the 3×3 block free so a character fits
      let ok = true; for (let b = -1; b <= 1 && ok; b++) for (let a = -1; a <= 1; a++) if (grid[(j + b) * N + i + a] & GRID.BLOCK) { ok = false; break; }
      if (!ok) continue;
      const [cx, cz] = cellCenter(i, j), d = Math.hypot(cx - x, cz - z);
      if (d < bd) { bd = d; best = [cx, cz]; }
    }
    if (best) return best;
  }
  return [x, z];
};

// ---------- places ----------
const places = A.places.map(pl => {
  let [x, z] = proj(pl.lat, pl.lng);
  if (pl.kind === 'base' && ourYard) { // stand in the yard, not inside the building
    const free = []; const xs = ourYard.map(q => q[0]), zs = ourYard.map(q => q[1]);
    for (let k = 0; k < 400; k++) { const q = [Math.min(...xs) + rand() * (Math.max(...xs) - Math.min(...xs)), Math.min(...zs) + rand() * (Math.max(...zs) - Math.min(...zs))]; const [i, j] = toCell(...q); if (pointIn(q, ourYard) && !(grid[j * N + i] & GRID.BLOCK)) free.push(q); }
    if (free.length) [x, z] = centroid(free);
  }
  [x, z] = nearestReachable(x, z); // always somewhere a character can stand and walk away from
  return { id: pl.id, kind: pl.kind, family: pl.family || null, label: pl.label, x: r1(x), z: r1(z) };
});

// Snowdrifts (ammo pickups): open, non-zone spots near streets.
const drifts = [];
for (let k = 0; k < 4000 && drifts.length < 70; k++) {
  const i = 2 + Math.floor(rand() * (N - 4)), j = 2 + Math.floor(rand() * (N - 4)), f = grid[j * N + i];
  if (f & (GRID.BLOCK | GRID.ZONE | GRID.CEMETERY)) continue;
  if (!(f & (GRID.ROAD | GRID.PARK | GRID.YARD))) continue;
  const q = cellCenter(i, j);
  if (drifts.some(d => Math.hypot(d[0] - q[0], d[1] - q[1]) < 18 * S)) continue;
  drifts.push(q.map(r1));
}

// ---------- write ----------
const out = {
  v: 1, id, scale: S, cell, size: N, half: r1(H),
  origin: { lat: lat0, lng: lon0 },
  credit: '© OpenStreetMap contributors',
  buildings: buildings.map(b => ({ p: b.p.flat().map(r1), l: b.levels, k: b.kind, ...(b.osm ? { o: 1 } : {}) })),
  roads: roads.map(r => ({ p: r.p.flat().map(r1), w: r1(r.w), c: r.cls })),
  areas: areas.map(a => ({ p: a.p.flat().map(r1), k: a.kind })),
  zones, trees, drifts, places,
  graph: { nodes: keptNodes, edges: keptEdges },
  grid: Buffer.from(grid).toString('base64'),
};
mkdirSync(join(ROOT, 'public', 'arenas'), { recursive: true });
const file = join(ROOT, 'public', 'arenas', `${id}.json`);
writeFileSync(file, JSON.stringify(out));
console.log(`Arena ${id}: ${buildings.length} buildings (${buildings.filter(b => b.osm).length} from OSM, ${placed} procedural), ${roads.length} roads, ${areas.length} areas, ${zones.length} no-snowball zones, ${trees.length} trees, ${drifts.length} drifts, graph ${keptNodes.length} nodes / ${keptEdges.length} edges, grid ${N}×${N}. ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
