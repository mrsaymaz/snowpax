// Bot brains: small state machines that produce the same input object a player would.
// Teammates stay with the student and guard them; rivals play the capture zone. Team style
// (config.styles) shapes how each bot fights: flanker (air) strafes wide, rusher (fire)
// closes in, sniper (water) keeps long range, builder (nature) puts up snow walls.
import { CONFIG } from '../config.js';
import { GRID } from './grid.mjs';
import { MINIONS } from './sim.mjs';

const STYLE = CONFIG.styles, KITS = CONFIG.kits;
const PREF = { thrower: 6, lobber: 5.2, sprayer: 3.4 };

export class Bot {
  constructor(sim, char, { style = 'rusher', leader = null, rng = Math.random } = {}) {
    this.sim = sim; this.c = char; this.style = STYLE[style] ? style : 'rusher'; this.s = STYLE[this.style];
    this.leader = leader; this.rng = rng;
    this.state = 'idle'; this.path = null; this.pathT = 0; this.goal = null; this.stuck = 0;
    this.throwT = 0.4 + rng() * 0.8; this.side = rng() < 0.5 ? 1 : -1; this.wallT = 3 + rng() * 4;
    this.slot = rng() * Math.PI * 2; this.target = null;
  }

  steerTo(x, z, dt, near = 0.5) {
    const c = this.c, g = this.sim.grid;
    if (Math.hypot(x - c.x, z - c.z) < near) return { mx: 0, mz: 0 };
    this.pathT -= dt;
    const moved = !this.goal || Math.hypot(this.goal[0] - x, this.goal[1] - z) > 1.5;
    const far = this.sim.nav?.links?.size && Math.hypot(x - c.x, z - c.z) >= 14; // far away: maybe a sled run is quicker
    if (g.clearPath(c.x, c.z, x, z, 0.3) && !far) { this.path = null; this.goal = [x, z]; }
    else if (!this.path || this.pathT <= 0 || moved) { this.path = this.sim.nav ? this.sim.nav.path(c.x, c.z, x, z) : null; this.pathT = 0.8 + this.rng() * 0.5; this.goal = [x, z]; }
    this.stuck = c.moving < 0.25 ? this.stuck + dt : 0;
    if (this.stuck > 0.5) { this.stuck = 0; this.path = this.sim.nav ? this.sim.nav.path(c.x, c.z, x, z) : null; }
    let tx = x, tz = z;
    if (this.path && this.path.length) {
      while (this.path.length > 1 && Math.hypot(this.path[0][0] - c.x, this.path[0][1] - c.z) < 0.45) this.path.shift();
      [tx, tz] = this.path[0];
    }
    const dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz) || 1;
    return { mx: dx / d, mz: dz / d };
  }

  pickTarget() {
    const c = this.c, seek = c.side === 'rival' ? 11 : 9;
    let best = null, bd = Infinity;
    for (const o of this.sim.enemiesOf(c)) {
      if (!this.sim.canSee(c, o) || this.sim.grid.has(o.x, o.z, GRID.ZONE)) continue;
      if (o.word && c.side === 'home') continue; // word snowmen are the student's to find
      const raw = Math.hypot(o.x - c.x, o.z - c.z);
      if (raw > seek) continue;
      const d = raw - (o.role === 'player' && c.side === 'rival' ? 1.5 : 0) + (o.warmth / o.maxWarmth) * 1.5;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  // A snowball flying at me? Sidestep.
  incoming() {
    const c = this.c;
    for (const b of this.sim.balls) {
      if (b.side === c.side || b.kind === 'lob') continue;
      const rx = c.x - b.x, rz = c.z - b.z, d = Math.hypot(rx, rz); if (d > 4) continue;
      const sp = Math.hypot(b.vx, b.vz) || 1, along = (rx * b.vx + rz * b.vz) / sp; if (along < 0) continue;
      const miss = Math.abs((rx * b.vz - rz * b.vx) / sp);
      if (miss < 0.8) return { mx: -b.vz / sp, mz: b.vx / sp };
    }
    return null;
  }

  think(dt) {
    const c = this.c, sim = this.sim;
    if (c.frozen || c.thaw) return {};
    this.throwT -= dt; this.wallT -= dt;
    const inp = { mx: 0, mz: 0 };
    // a guard (a defender on a battlefield) fights only near its post and goes back to it after
    const G = c.guard, pick = this.pickTarget();
    const t = this.target = G && pick && Math.hypot(pick.x - G.x, pick.z - G.z) > G.leash ? null : pick;
    const kit = KITS[c.kit] || KITS.thrower;
    const want = (PREF[c.kit] || 5) + (this.style === 'sniper' ? 1.2 : this.style === 'rusher' ? -1 : 0);
    const low = c.warmth < c.maxWarmth * 0.35 && this.style !== 'rusher';

    // Where to be when not fighting
    let goal = null;
    // the outpost that matters is the one nearest the student (where the fight is)
    const P = this.leader || sim.chars.find(o => o.role === 'player') || c;
    const z = sim.nearestZone ? sim.nearestZone(P.x, P.z) : sim.zone;
    if (G) {
      const a = this.slot + sim.t * 0.3; goal = [G.x + Math.sin(a) * G.r, G.z + Math.cos(a) * G.r * 0.5];
    } else if (c.side === 'home' && this.leader) {
      const L = this.leader, inZone = z && Math.hypot(L.x - z.x, L.z - z.z) < z.r + 1;
      this.slot += dt * (inZone || L.guarding ? 0.5 : 0.1);
      const r = inZone || L.guarding ? 2.6 : 2.2;
      goal = [L.x + Math.sin(this.slot) * r, L.z + Math.cos(this.slot) * r];
    } else if (z && z.owner !== c.side) {
      const a = this.slot + sim.t * 0.2; goal = [z.x + Math.sin(a) * z.r * 0.6, z.z + Math.cos(a) * z.r * 0.6];
    } else {
      const p = sim.chars.find(o => o.role === 'player' && !o.frozen) || sim.enemiesOf(c)[0];
      if (p) goal = [p.x, p.z];
    }

    if (low && t) { // back off to warm up
      this.state = 'retreat';
      const home = sim.spawns[c.side][0];
      Object.assign(inp, this.steerTo(home.x, home.z, dt, 1));
    } else if (t) {
      this.state = 'fight';
      const d = Math.hypot(t.x - c.x, t.z - c.z), ux = (t.x - c.x) / (d || 1), uz = (t.z - c.z) / (d || 1);
      let mx = 0, mz = 0;
      const tether = c.side === 'home' && this.leader && Math.hypot(this.leader.x - c.x, this.leader.z - c.z) > 6;
      if (tether) { const s = this.steerTo(this.leader.x, this.leader.z, dt, 2); mx = s.mx; mz = s.mz; }
      else if (d > want + 0.8 || (kit.shot !== 'lob' && !sim.grid.clearLine(c.x, c.z, t.x, t.z))) { const s = this.steerTo(t.x, t.z, dt, want); mx = s.mx; mz = s.mz; }
      else if (d < want - 1.2) { mx = -ux; mz = -uz; }
      const strafe = this.style === 'flanker' ? 0.85 : this.style === 'builder' ? 0.15 : 0.45;
      mx += -uz * this.side * strafe; mz += ux * this.side * strafe;
      if (this.rng() < dt * 0.5) this.side *= -1;
      const dodge = this.incoming(); if (dodge && this.rng() < 0.7) { mx = dodge.mx * this.side; mz = dodge.mz * this.side; }
      inp.mx = mx * (this.s.speed || 1); inp.mz = mz * (this.s.speed || 1);
      // super when it lines up
      if (c.super >= 1 && d < CONFIG.superBoulder.range * 0.8 && sim.grid.clearLine(c.x, c.z, t.x, t.z)) inp.super = { x: t.x, z: t.z };
      else if (this.throwT <= 0 && c.ammo >= 1 && d < kit.range + 0.3 && (kit.shot === 'lob' || sim.grid.clearLine(c.x, c.z, t.x, t.z))) {
        const err = c.side === 'rival' ? 0.9 : 0.6, lead = d / (kit.speed || 9);
        inp.attack = { x: t.x + t.vx * lead * 0.7 + (this.rng() - 0.5) * err, z: t.z + t.vz * lead * 0.7 + (this.rng() - 0.5) * err };
        inp.manual = true;
        const rate = (this.s.throwRate || 1) * (c.side === 'rival' ? sim.pace.rivalThrowRate : 1);
        this.throwT = (0.55 + this.rng() * 0.6) / rate;
      }
      if (this.style === 'builder' && this.wallT <= 0 && d < 7) { inp.wall = true; this.wallT = 7 + this.rng() * 5; }
    } else if (goal) {
      this.state = 'move';
      Object.assign(inp, this.steerTo(goal[0], goal[1], dt, 0.6));
    }
    return inp;
  }
}

// A rival snowman: waddles toward the outpost, throws at the nearest kid in range, never retreats.
export class MinionBot {
  constructor(sim, char, { goal, rng = Math.random } = {}) {
    this.sim = sim; this.c = char; this.goal = goal; this.rng = rng; this.M = MINIONS[char.minion] || MINIONS.waddler;
    this.throwT = 0.8 + rng() * this.M.reload; this.path = null; this.pathT = 0; this.slot = rng() * Math.PI * 2;
    this.inner = new Bot(sim, char, { style: 'rusher', rng });
  }
  think(dt) {
    const c = this.c, sim = this.sim; if (c.frozen || c.thaw) return {};
    this.throwT -= dt;
    const inp = { mx: 0, mz: 0, speedMul: this.M.speed / (sim.pace.rivalSpeed || 1) };
    let t = null, bd = Infinity;
    for (const o of sim.enemiesOf(c)) { const d = Math.hypot(o.x - c.x, o.z - c.z); if (d < bd && d <= this.M.range + 1.5) { bd = d; t = o; } }
    if (t && this.throwT <= 0 && c.ammo >= 1 && (this.M.kit === 'lobber' || sim.grid.clearLine(c.x, c.z, t.x, t.z))) {
      inp.attack = { x: t.x + (this.rng() - 0.5) * 0.8, z: t.z + (this.rng() - 0.5) * 0.8 }; inp.manual = true; this.throwT = this.M.reload * (0.8 + this.rng() * 0.5);
    }
    // walk to a spot on the outpost circle (snowmen stand round it); stop when a kid is close
    const g = this.goal, a = this.slot + sim.t * 0.05, gx = g.x + Math.sin(a) * g.r * 0.7, gz = g.z + Math.cos(a) * g.r * 0.7;
    if (!(t && bd < this.M.range * 0.7)) Object.assign(inp, this.inner.steerTo(gx, gz, dt, 0.6), { speedMul: inp.speedMul });
    if (t) c.face = Math.atan2(t.x - c.x, t.z - c.z);
    return inp;
  }
}
