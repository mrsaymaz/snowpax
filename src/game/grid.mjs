// The walk grid shared by arena builders, the simulation and the renderer.
// One cell is `cell` world units. Each cell holds bit flags.
export const GRID = {
  cell: 1,
  BLOCK: 1,      // wall, building, tree, car…: cannot walk, stops straight snowballs
  ROAD: 2,       // cleared street: fast
  ZONE: 4,       // quiet zone (place of worship, cemetery, tomb, hospital): snowballs vanish
  PARK: 8,       // park, pitch, playground, wood
  CEMETERY: 16,  // inside a cemetery (always inside a zone too)
  YARD: 32,      // a schoolyard
  ICE: 64,       // ice patch: slippery
  BUSH: 128,     // snowy hedge: walk in to hide
};

export class Grid {
  // Works for square street arenas (size, half) and rectangular tile arenas (w, h, x0, z0).
  constructor(arena) {
    this.cell = arena.cell || 1;
    this.W = arena.w ?? arena.size; this.H = arena.h ?? arena.size;
    this.x0 = arena.x0 ?? -arena.half; this.z0 = arena.z0 ?? -arena.half;
    this.N = this.W; this.half = arena.half;
    if (arena.grid instanceof Uint8Array) this.f = new Uint8Array(arena.grid);
    else {
      const bin = typeof atob === 'function' ? atob(arena.grid) : Buffer.from(arena.grid, 'base64').toString('binary');
      this.f = Uint8Array.from(bin, c => c.charCodeAt(0));
    }
  }
  idx(x, z) {
    const i = Math.floor((x - this.x0) / this.cell), j = Math.floor((z - this.z0) / this.cell);
    return i < 0 || j < 0 || i >= this.W || j >= this.H ? -1 : j * this.W + i;
  }
  center(i, j) { return [this.x0 + (i + 0.5) * this.cell, this.z0 + (j + 0.5) * this.cell]; }
  flags(x, z) { const k = this.idx(x, z); return k < 0 ? GRID.BLOCK : this.f[k]; }
  has(x, z, flag) { return (this.flags(x, z) & flag) !== 0; }
  blocked(x, z) { return this.has(x, z, GRID.BLOCK); }
  // A circle is free when its centre and eight edge points are not blocked.
  freeCircle(x, z, r) {
    if (this.blocked(x, z)) return false;
    const d = r * Math.SQRT1_2;
    return !this.blocked(x + r, z) && !this.blocked(x - r, z) && !this.blocked(x, z + r) && !this.blocked(x, z - r)
      && !this.blocked(x + d, z + d) && !this.blocked(x - d, z + d) && !this.blocked(x + d, z - d) && !this.blocked(x - d, z - d);
  }
  // Line of sight in steps of a quarter cell.
  clearLine(x0, z0, x1, z1, flag = GRID.BLOCK) {
    const d = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(d / (this.cell * 0.25)));
    for (let k = 1; k < n; k++) { const t = k / n; if (this.has(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, flag)) return false; }
    return true;
  }
  // A body-wide corridor: the centre line and two lines offset by the radius.
  clearPath(x0, z0, x1, z1, r) {
    const d = Math.hypot(x1 - x0, z1 - z0) || 1, nx = -(z1 - z0) / d * r, nz = (x1 - x0) / d * r;
    return this.clearLine(x0, z0, x1, z1) && this.clearLine(x0 + nx, z0 + nz, x1 + nx, z1 + nz) && this.clearLine(x0 - nx, z0 - nz, x1 - nx, z1 - nz);
  }
  set(x, z, flag, on = true) { const k = this.idx(x, z); if (k >= 0) this.f[k] = on ? this.f[k] | flag : this.f[k] & ~flag; }
}
