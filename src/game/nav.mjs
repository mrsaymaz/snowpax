// Street graph + A* for tap-to-travel and bots. Paths follow the real streets, then get
// smoothed with the walk grid so characters don't zig-zag through every street node.
export class Nav {
  constructor(arena, grid) {
    this.grid = grid;
    this.nodes = arena.graph.nodes;
    this.adj = this.nodes.map(() => []);
    for (const [a, b] of arena.graph.edges) {
      const d = Math.hypot(this.nodes[a][0] - this.nodes[b][0], this.nodes[a][1] - this.nodes[b][1]);
      this.adj[a].push([b, d]); this.adj[b].push([a, d]);
    }
    // Spatial hash for nearest-node lookups.
    this.bucket = 16; this.hash = new Map();
    this.nodes.forEach(([x, z], i) => { const k = this.key(x, z); if (!this.hash.has(k)) this.hash.set(k, []); this.hash.get(k).push(i); });
  }
  key(x, z) { return `${Math.floor(x / this.bucket)},${Math.floor(z / this.bucket)}`; }
  // Nearest node, preferring ones in clear line of sight.
  nearest(x, z, needSight = true) {
    let best = -1, bd = Infinity;
    for (let r = 0; r < 6 && best < 0; r++) {
      const bx = Math.floor(x / this.bucket), bz = Math.floor(z / this.bucket);
      for (let i = bx - r; i <= bx + r; i++) for (let j = bz - r; j <= bz + r; j++) {
        for (const n of this.hash.get(`${i},${j}`) || []) {
          const [nx, nz] = this.nodes[n], d = Math.hypot(nx - x, nz - z);
          if (d < bd && (!needSight || this.grid.clearLine(x, z, nx, nz))) { bd = d; best = n; }
        }
      }
    }
    return best < 0 && needSight ? this.nearest(x, z, false) : best;
  }
  astar(s, t) {
    if (s < 0 || t < 0) return null;
    const N = this.nodes.length, g = new Float64Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const h = i => Math.hypot(this.nodes[i][0] - this.nodes[t][0], this.nodes[i][1] - this.nodes[t][1]);
    const open = [[h(s), s]]; g[s] = 0;
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, u] = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      if (closed[u]) continue; closed[u] = 1;
      if (u === t) { const path = []; for (let v = t; v >= 0; v = came[v]) path.push(v); return path.reverse(); }
      for (const [v, d] of this.adj[u]) { const ng = g[u] + d; if (ng < g[v]) { g[v] = ng; came[v] = u; open.push([ng + h(v), v]); } }
    }
    return null;
  }
  // World-space path from (x0,z0) to (x1,z1): straight if clear, else along the streets.
  path(x0, z0, x1, z1) {
    if (this.grid.clearLine(x0, z0, x1, z1)) return [[x1, z1]];
    const ids = this.astar(this.nearest(x0, z0), this.nearest(x1, z1));
    if (!ids) return null;
    const pts = [...ids.map(i => this.nodes[i]), [x1, z1]];
    // Smooth: skip points while the line stays clear.
    const out = []; let cx = x0, cz = z0, k = 0;
    while (k < pts.length) {
      let far = k;
      for (let j = pts.length - 1; j > k; j--) if (this.grid.clearLine(cx, cz, pts[j][0], pts[j][1])) { far = j; break; }
      out.push(pts[far]); [cx, cz] = pts[far]; k = far + 1;
    }
    return out;
  }
}
