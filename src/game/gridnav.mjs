// A* over the tile grid (8 directions, no corner cutting) for bots and tap-to-move,
// then smoothed so characters walk straight wherever a body-wide path is clear.
// Sled runs are one-way links from the hilltop to the bottom: a path may ride one.
import { GRID } from './grid.mjs';

export class GridNav {
  constructor(grid, radius = 0.36, sledRuns = [], sledSpeed = 2.6) {
    this.grid = grid; this.r = radius; this.links = new Map(); this.sledSpeed = sledSpeed;
    for (const run of sledRuns) {
      const a = run.pts[0], b = run.pts[run.pts.length - 1], [si, sj] = this.cellOf(a[0], a[1]), [ei, ej] = this.cellOf(b[0], b[1]);
      const from = sj * grid.W + si, l = { to: ej * grid.W + ei, cost: 1.5 + (run.len || Math.hypot(b[0] - a[0], b[1] - a[1])) / sledSpeed, start: a, end: b };
      this.links.set(from, [...(this.links.get(from) || []), l]);
    }
  }
  walkable(i, j) { const g = this.grid; return i >= 0 && j >= 0 && i < g.W && j < g.H && !(g.f[j * g.W + i] & GRID.BLOCK); }
  cellOf(x, z) { const g = this.grid; return [Math.floor((x - g.x0) / g.cell), Math.floor((z - g.z0) / g.cell)]; }
  nearestWalkable(i, j) {
    if (this.walkable(i, j)) return [i, j];
    for (let r = 1; r < 6; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (this.walkable(i + di, j + dj)) return [i + di, j + dj];
    return null;
  }
  astar(s, t) {
    const g = this.grid, W = g.W, N = W * g.H, start = s[1] * W + s[0], goal = t[1] * W + t[0];
    const gs = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N), via = new Array(N);
    // with sled runs the estimate must allow for riding (otherwise a sled route is never tried)
    const hk = this.links.size ? 1 / this.sledSpeed : 1;
    const hx = k => { const dx = Math.abs((k % W) - t[0]), dz = Math.abs(((k / W) | 0) - t[1]); return (Math.max(dx, dz) + 0.414 * Math.min(dx, dz)) * hk; };
    // binary heap of [f, node]
    const heap = [[hx(start), start]]; gs[start] = 0;
    const push = it => { heap.push(it); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (heap.length) {
      const [, u] = pop();
      if (closed[u]) continue; closed[u] = 1;
      if (u === goal) { const out = []; for (let v = goal; v >= 0; v = came[v]) out.push([v % W, (v / W) | 0, via[v] || null]); return out.reverse(); }
      const ui = u % W, uj = (u / W) | 0;
      for (const [di, dj, c] of DIRS) {
        const vi = ui + di, vj = uj + dj; if (!this.walkable(vi, vj)) continue;
        if (di && dj && (!this.walkable(ui + di, uj) || !this.walkable(ui, uj + dj))) continue; // no corner cutting
        const v = vj * W + vi, ng = gs[u] + c;
        if (ng < gs[v]) { gs[v] = ng; came[v] = u; via[v] = null; push([ng + hx(v), v]); }
      }
      for (const l of this.links.get(u) || []) { const ng = gs[u] + l.cost; if (ng < gs[l.to]) { gs[l.to] = ng; came[l.to] = u; via[l.to] = l; push([ng + hx(l.to), l.to]); } }
    }
    return null;
  }
  path(x0, z0, x1, z1) {
    const g = this.grid;
    if (g.clearPath(x0, z0, x1, z1, this.r) && (!this.links.size || Math.hypot(x1 - x0, z1 - z0) < 14)) return [[x1, z1]];
    const s = this.nearestWalkable(...this.cellOf(x0, z0)), t = this.nearestWalkable(...this.cellOf(x1, z1));
    if (!s || !t) return null;
    const cells = this.astar(s, t); if (!cells) return null;
    // points, with a sled ride as a fixed pair: the start pad, then the bottom of the run
    const pts = [], hard = [];
    for (const [i, j, l] of cells) {
      if (l) { pts[pts.length - 1] = l.start; hard[pts.length - 1] = true; pts.push(l.end); hard.push(false); }
      else { pts.push(g.center(i, j)); hard.push(false); }
    }
    if (g.clearPath(pts[pts.length - 1][0], pts[pts.length - 1][1], x1, z1, this.r * 0.8)) { pts.push([x1, z1]); hard.push(false); }
    const out = []; let cx = x0, cz = z0, k = 0;
    while (k < pts.length) {
      let lim = pts.length - 1; for (let h = k; h < pts.length; h++) if (hard[h]) { lim = h; break; }
      let far = k;
      for (let j = lim; j > k; j--) if (g.clearPath(cx, cz, pts[j][0], pts[j][1], this.r)) { far = j; break; }
      out.push(pts[far]); [cx, cz] = pts[far];
      if (hard[far]) { out.push(pts[far + 1]); [cx, cz] = pts[far + 1]; out.sled = true; k = far + 2; } else k = far + 1;
    }
    return out;
  }
}
