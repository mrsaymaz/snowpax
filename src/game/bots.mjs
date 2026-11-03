// Bot brains: small state machines that produce the same input object a player would.
// Teammates follow and guard the student; rivals play their team's style (config.styles):
// flanker (air) circles to the sides, rusher (fire) closes in with fast volleys,
// sniper (water) keeps long range, builder (nature) puts up snow walls and holds ground.
import { CONFIG } from '../config.js';
import { GRID } from './grid.mjs';

const STYLE = CONFIG.styles;
const RANGE = CONFIG.fight.throwRange;

export class Bot {
  constructor(sim, char, { style = 'rusher', leader = null, rng = Math.random } = {}) {
    this.sim = sim; this.c = char; this.style = STYLE[style] ? style : 'rusher'; this.s = STYLE[this.style];
    this.leader = leader; this.rng = rng;
    this.state = 'idle'; this.path = null; this.pathT = 0; this.goal = null;
    this.throwT = 0.5 + rng() * 1.2; this.side = rng() < 0.5 ? 1 : -1; this.wallT = 3 + rng() * 4;
    this.slot = rng() * Math.PI * 2;
    char.rangeMul = this.s.range || 1;
    this.target = null;
  }

  steerTo(x, z, dt, near = 0.8) {
    const c = this.c, g = this.sim.grid;
    if (Math.hypot(x - c.x, z - c.z) < near) return { mx: 0, mz: 0 };
    this.pathT -= dt;
    const goalMoved = !this.goal || Math.hypot(this.goal[0] - x, this.goal[1] - z) > 3;
    if (g.clearLine(c.x, c.z, x, z)) { this.path = null; this.goal = [x, z]; }
    else if (!this.path || this.pathT <= 0 || goalMoved) {
      this.path = this.sim.nav ? this.sim.nav.path(c.x, c.z, x, z) : null; this.pathT = 1.2 + this.rng() * 0.6; this.goal = [x, z];
    }
    // Not moving although we should: force a fresh route soon.
    this.stuck = c.moving < 0.4 ? (this.stuck || 0) + dt : 0;
    if (this.stuck > 0.7) { this.pathT = 0; this.stuck = 0; this.path = this.sim.nav ? this.sim.nav.path(c.x, c.z, x, z) : null; }
    let tx = x, tz = z;
    if (this.path && this.path.length) {
      while (this.path.length > 1 && Math.hypot(this.path[0][0] - c.x, this.path[0][1] - c.z) < 1) this.path.shift();
      [tx, tz] = this.path[0];
    }
    const dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz) || 1;
    return { mx: dx / d, mz: dz / d };
  }

  pickTarget() {
    const c = this.c, maxSeek = this.c.side === 'rival' ? 70 : 14;
    let best = null, bd = Infinity;
    for (const o of this.sim.enemiesOf(c)) {
      if (this.sim.grid.has(o.x, o.z, GRID.ZONE)) continue;
      const d = Math.hypot(o.x - c.x, o.z - c.z) + (o.role === 'player' && c.side === 'rival' ? -4 : 0);
      if (d < bd && d < maxSeek) { bd = d; best = o; }
    }
    return best;
  }

  think(dt) {
    const c = this.c, sim = this.sim;
    if (c.frozen || c.thaw) return {};
    const inp = { mx: 0, mz: 0 };
    this.throwT -= dt; this.wallT -= dt;
    this.target = this.pickTarget();
    const t = this.target;

    // Out of snowballs: fetch some from the nearest drift.
    if (c.ammo === 0) {
      this.state = 'refill';
      let best = null, bd = Infinity;
      for (const d of sim.drifts) { if (d.cd > 0) continue; const dd = Math.hypot(d.x - c.x, d.z - c.z); if (dd < bd) { bd = dd; best = d; } }
      const h = sim.nearestHeld(c.side, c.x, c.z);
      const goTo = h && (!best || Math.hypot(h.x - c.x, h.z - c.z) < bd) ? h : best;
      if (goTo) Object.assign(inp, this.steerTo(goTo.x, goTo.z, dt, 0.4));
      return inp;
    }

    if (c.side === 'home' && this.leader) {
      const L = this.leader, guard = L.guarding;
      const dl = Math.hypot(L.x - c.x, L.z - c.z);
      if (t && Math.hypot(t.x - c.x, t.z - c.z) < RANGE * 1.05 && (dl < 12 || guard)) {
        this.state = 'engage'; Object.assign(inp, this.fight(t, dt, 0.75));
        if (guard && dl > 5) Object.assign(inp, this.steerTo(L.x, L.z, dt, 3)); // stay close while the student seizes
      } else {
        this.state = 'follow';
        this.slot += dt * (guard ? 0.6 : 0.15);
        const r = guard ? 3.2 : 2.6;
        const gx = L.x + Math.sin(this.slot) * r, gz = L.z + Math.cos(this.slot) * r;
        Object.assign(inp, this.steerTo(gx, gz, dt, dl > 6 ? 1.5 : 0.9));
      }
      return inp;
    }

    if (!t) { // rivals with nobody near: advance on the home side
      const home = sim.chars.filter(o => o.side !== c.side && !o.frozen);
      if (home.length) { this.state = 'advance'; const h = home[0]; Object.assign(inp, this.steerTo(h.x, h.z, dt, 2)); }
      return inp;
    }
    const lowWarmth = c.warmth < c.maxWarmth * 0.3;
    if (lowWarmth && this.style !== 'rusher') { // back off
      this.state = 'retreat';
      const dx = c.x - t.x, dz = c.z - t.z, d = Math.hypot(dx, dz) || 1;
      Object.assign(inp, this.steerTo(c.x + (dx / d) * 6, c.z + (dz / d) * 6, dt, 0.5));
      if (this.throwT <= 0 && d < RANGE) this.tryThrow(inp, t);
      return inp;
    }
    this.state = 'engage';
    Object.assign(inp, this.fight(t, dt, 1));
    return inp;
  }

  // Keep a style-dependent distance, strafe, throw when the shot is clear.
  fight(t, dt, aggression) {
    const c = this.c, inp = {};
    const s = this.s, d = Math.hypot(t.x - c.x, t.z - c.z);
    const want = this.style === 'sniper' ? RANGE * 1.05 : this.style === 'rusher' ? RANGE * 0.45 : this.style === 'builder' ? RANGE * 0.8 : RANGE * 0.65;
    const ux = (t.x - c.x) / (d || 1), uz = (t.z - c.z) / (d || 1);
    let mx = 0, mz = 0;
    if (d > want + 1) { const st = this.steerTo(t.x, t.z, dt, want); mx = st.mx; mz = st.mz; }
    else if (d < want - 1.5) { mx = -ux; mz = -uz; }
    const strafe = this.style === 'flanker' ? 0.9 : this.style === 'builder' ? 0.1 : 0.35;
    mx += -uz * this.side * strafe; mz += ux * this.side * strafe;
    if (this.rng() < dt * 0.4) this.side *= -1;
    inp.mx = mx * (s.speed || 1); inp.mz = mz * (s.speed || 1);
    if (this.style === 'builder' && this.wallT <= 0 && d < RANGE * 1.1) { inp.wall = true; this.wallT = 6 + this.rng() * 5; }
    if (this.throwT <= 0 && d < RANGE * (s.range || 1)) this.tryThrow(inp, t, aggression);
    return inp;
  }

  tryThrow(inp, t, aggression = 1) {
    const c = this.c, sim = this.sim;
    if (!sim.grid.clearLine(c.x, c.z, t.x, t.z)) { this.throwT = 0.3; return; }
    const sloppy = c.side === 'rival' ? 1.4 : 0.9; // rivals miss a bit more
    inp.throwAt = { x: t.x + (this.rng() - 0.5) * sloppy, z: t.z + (this.rng() - 0.5) * sloppy };
    const rate = (this.s.throwRate || 1) * (c.side === 'rival' ? sim.pace.rivalThrowRate : 1) * aggression;
    this.throwT = (1.5 + this.rng() * 1.1) / rate;
  }
}
