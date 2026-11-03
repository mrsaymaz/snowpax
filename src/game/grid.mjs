// The walk grid shared by the arena builder, the simulation and the renderer.
// One cell is GRID.cell world units. Each cell holds bit flags.
export const GRID = {
  cell: 1,
  BLOCK: 1,      // building, tree or wall: cannot walk, stops snowballs
  ROAD: 2,       // cleared street: fast
  ZONE: 4,       // no-snowball zone (place of worship, cemetery, tomb, hospital)
  PARK: 8,       // park, pitch, playground, wood
  CEMETERY: 16,  // inside a cemetery (always inside a zone too)
  YARD: 32,      // a schoolyard
  ICE: 64,       // ice patch: slippery
};

export class Grid {
  constructor(arena) {
    this.N = arena.size; this.cell = arena.cell; this.half = arena.half;
    const bin = typeof atob === 'function' ? atob(arena.grid) : Buffer.from(arena.grid, 'base64').toString('binary');
    this.f = Uint8Array.from(bin, c => c.charCodeAt(0));
  }
  idx(x, z) {
    const i = Math.floor((x + this.half) / this.cell), j = Math.floor((z + this.half) / this.cell);
    return i < 0 || j < 0 || i >= this.N || j >= this.N ? -1 : j * this.N + i;
  }
  flags(x, z) { const k = this.idx(x, z); return k < 0 ? GRID.BLOCK : this.f[k]; }
  has(x, z, flag) { return (this.flags(x, z) & flag) !== 0; }
  blocked(x, z) { return this.has(x, z, GRID.BLOCK); }
  // A circle is free when its centre and four edge points are not blocked.
  freeCircle(x, z, r) {
    return !this.blocked(x, z) && !this.blocked(x + r, z) && !this.blocked(x - r, z) && !this.blocked(x, z + r) && !this.blocked(x, z - r);
  }
  // Line of sight in steps of half a cell.
  clearLine(x0, z0, x1, z1, flag = GRID.BLOCK) {
    const d = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(d / (this.cell * 0.5)));
    for (let k = 1; k < n; k++) { const t = k / n; if (this.has(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, flag)) return false; }
    return true;
  }
  set(x, z, flag, on = true) { const k = this.idx(x, z); if (k >= 0) this.f[k] = on ? this.f[k] | flag : this.f[k] & ~flag; }
}
