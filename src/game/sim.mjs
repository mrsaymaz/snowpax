// The snowball-fight simulation: characters, movement, snowballs, warmth, freezing,
// ammo, snow walls. No rendering here, so it runs in tests and could later run for remote
// players too.
//
// Seats: every character sits in a seat whose controller is 'local' (this device), 'bot'
// or 'remote' (a future peer-to-peer player). The simulation only ever reads an input
// object per seat: { mx, mz, throwAt, big, charge, dodge }. Bots produce the same input.
import { CONFIG } from '../config.js';
import { GRID } from './grid.mjs';

const F = CONFIG.fight;
export const SIM = {
  radius: 0.45,          // character radius (world units)
  speed: 6.2,            // running speed on a cleared street
  snowSpeed: 0.78,       // deep snow multiplier
  accel: 28,
  ballSpeed: 17,
  bigBallSpeed: 12,
  gravity: 22,
  hitRadius: 0.7,
  bigSplash: 1.6,
  dodgeTime: 0.22, dodgeSpeed: 3.2, dodgeCooldown: 1.0,
  invulnAfterThaw: 1.5,
  thawTime: 0.7,
  regenDelay: 4, regenRate: 10,
  driftAmmo: 4, driftCooldown: 7,
  baseRefillEvery: 0.4, baseRadius: 6,
  wallLife: 30, wallHalf: [1.2, 0.35],
  throwCooldown: 0.32,
};

let nextId = 1;

export function makeCharacter({ seat, team, side, role, x, z, captain = false }) {
  return {
    id: nextId++, seat, team, side, role, captain,
    x, z, vx: 0, vz: 0, face: 0, moving: 0,
    warmth: F.warmth * (captain ? 1.8 : 1), maxWarmth: F.warmth * (captain ? 1.8 : 1),
    ammo: F.ammoMax, frozen: 0, thaw: 0, invuln: 0, dodge: 0, dodgeCd: 0, throwCd: 0,
    charge: 0, lastHit: -99, shield: 0, travel: null, hits: 0, frozenCount: 0,
  };
}

export class Sim {
  constructor({ arena, grid, nav, seats, rng = Math.random, pace = 'relaxed' }) {
    this.arena = arena; this.grid = grid; this.nav = nav; this.rng = rng;
    this.pace = CONFIG.pace[pace] || CONFIG.pace.relaxed;
    this.t = 0; this.events = []; this.balls = []; this.walls = [];
    this.seats = new Map(seats.map(s => [s.id, s]));
    this.chars = [];
    this.drifts = arena.drifts.map(([x, z], i) => ({ id: i, x, z, cd: 0 }));
    this.spawns = { home: [], rival: [] };
    this.held = { home: [], rival: [] }; // refill/respawn points each side holds
  }
  add(char) { this.chars.push(char); return char; }
  setSpawn(side, x, z) { this.spawns[side].push({ x, z }); this.held[side].push({ x, z }); }
  emit(type, data) { this.events.push({ type, t: this.t, ...data }); }
  drainEvents() { const e = this.events; this.events = []; return e; }
  enemiesOf(c) { return this.chars.filter(o => o.side !== c.side && !o.frozen); }
  alliesOf(c) { return this.chars.filter(o => o.side === c.side && o !== c && !o.frozen); }

  // Nearest point this side holds (respawn and refill).
  nearestHeld(side, x, z) {
    let best = this.held[side][0], bd = Infinity;
    for (const h of this.held[side]) { const d = Math.hypot(h.x - x, h.z - z); if (d < bd) { bd = d; best = h; } }
    return best;
  }

  // Quick throw target: nearest visible enemy in range, preferring the facing direction.
  autoTarget(c, range = F.throwRange) {
    let best = null, bs = Infinity;
    for (const o of this.enemiesOf(c)) {
      const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz);
      if (d > range || d < 0.3) continue;
      if (this.grid.has(o.x, o.z, GRID.ZONE)) continue;
      if (!this.grid.clearLine(c.x, c.z, o.x, o.z)) continue;
      const ang = Math.abs(((Math.atan2(dx, dz) - c.face + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      const score = d + ang * 2.5;
      if (score < bs) { bs = score; best = o; }
    }
    return best;
  }

  throwBall(c, tx, tz, big = false, aimHelp = 0) {
    if (c.frozen || c.thaw || c.ammo <= 0 || c.throwCd > 0) return false;
    if (this.grid.has(c.x, c.z, GRID.ZONE)) { this.emit('noThrowZone', { id: c.id }); return false; }
    let dx = tx - c.x, dz = tz - c.z;
    const dist = Math.min(Math.hypot(dx, dz), F.throwRange * (c.rangeMul || 1) * (big ? 1.25 : 1.15));
    if (dist < 0.2) return false;
    // Lead a moving target a little (auto-aim strength comes from the pace).
    const target = this.chars.find(o => o.side !== c.side && Math.hypot(o.x - tx, o.z - tz) < 0.9);
    const speed = big ? SIM.bigBallSpeed : SIM.ballSpeed;
    let time = dist / speed;
    if (target && aimHelp > 0) { tx += target.vx * time * aimHelp; tz += target.vz * time * aimHelp; dx = tx - c.x; dz = tz - c.z; }
    const len = Math.hypot(dx, dz) || 1, d = Math.min(len, F.throwRange * (c.rangeMul || 1) * (big ? 1.25 : 1.15));
    // A visible arc: at least ~0.3 s in the air, arriving at chest height on the target.
    time = Math.max(d / speed, 0.28 + d * 0.025);
    const sp = d / time, ux = dx / len, uz = dz / len, y0 = 1.3, yT = 0.9;
    this.balls.push({ x: c.x + ux * 0.5, z: c.z + uz * 0.5, y: y0, vx: ux * sp, vz: uz * sp, vy: (yT - y0) / time + (SIM.gravity * time) / 2, owner: c.id, side: c.side, team: c.team, big, life: time + 0.6 });
    c.ammo--; c.throwCd = SIM.throwCooldown * (big ? 1.6 : 1); c.face = Math.atan2(ux, uz);
    this.emit('throw', { id: c.id, big, x: c.x, z: c.z });
    return true;
  }

  buildWall(c) {
    if (this.walls.filter(w => w.owner === c.id).length >= 3) return false;
    const fx = Math.sin(c.face), fz = Math.cos(c.face), x = c.x + fx * 1.4, z = c.z + fz * 1.4;
    if (this.grid.has(x, z, GRID.BLOCK | GRID.ZONE)) return false;
    const w = { id: nextId++, owner: c.id, team: c.team, x, z, rot: c.face, life: SIM.wallLife, cells: [] };
    const [hx, hz] = SIM.wallHalf, cos = Math.cos(c.face), sin = Math.sin(c.face);
    for (let a = -hx; a <= hx; a += 0.5) for (let b = -hz; b <= hz; b += 0.5) {
      const px = x + a * cos + b * sin, pz = z - a * sin + b * cos;
      if (!this.grid.blocked(px, pz)) { this.grid.set(px, pz, GRID.BLOCK); w.cells.push([px, pz]); }
    }
    if (this.chars.some(o => !this.grid.freeCircle(o.x, o.z, SIM.radius * 0.6))) { this.removeWall(w); return false; }
    this.walls.push(w); this.emit('wall', { id: w.id, x, z }); return true;
  }
  removeWall(w) { for (const [px, pz] of w.cells) this.grid.set(px, pz, GRID.BLOCK, false); this.walls = this.walls.filter(o => o !== w); }

  hit(c, ball) {
    if (c.frozen || c.thaw || c.invuln > 0) return;
    if (c.shield > 0) { c.shield--; this.emit('shield', { id: c.id }); return; }
    const dmg = ball.big ? F.bigHitWarmth : F.hitWarmth;
    c.warmth = Math.max(0, c.warmth - dmg); c.lastHit = this.t; c.hits++;
    const len = Math.hypot(ball.vx, ball.vz) || 1, kb = ball.big ? 5 : 2.2;
    c.vx += (ball.vx / len) * kb; c.vz += (ball.vz / len) * kb;
    this.emit('hit', { id: c.id, by: ball.owner, big: ball.big, x: c.x, z: c.z });
    if (c.warmth <= 0) { c.frozen = F.frozenSeconds || CONFIG.timing.frozenSeconds; c.frozenCount++; c.travel = null; c.charge = 0; this.emit('freeze', { id: c.id, x: c.x, z: c.z }); }
  }

  step(dt, inputs = new Map()) {
    dt = Math.min(dt, 0.05);
    this.t += dt;
    for (const c of this.chars) this.stepChar(c, dt, inputs.get(c.seat) || {});
    this.stepBalls(dt);
    for (const w of [...this.walls]) if ((w.life -= dt) <= 0) { this.removeWall(w); this.emit('wallMelt', { id: w.id }); }
    for (const d of this.drifts) d.cd = Math.max(0, d.cd - dt);
  }

  stepChar(c, dt, inp) {
    c.throwCd = Math.max(0, c.throwCd - dt); c.invuln = Math.max(0, c.invuln - dt); c.dodgeCd = Math.max(0, c.dodgeCd - dt);
    if (c.frozen > 0) {
      c.vx = c.vz = 0; c.frozen -= dt;
      if (c.frozen <= 0) { c.frozen = 0; c.thaw = SIM.thawTime; this.emit('shake', { id: c.id }); }
      return;
    }
    if (c.thaw > 0) {
      c.thaw -= dt;
      if (c.thaw <= 0) {
        c.thaw = 0; const h = this.nearestHeld(c.side, c.x, c.z) || this.spawns[c.side][0];
        c.x = h.x + (this.rng() - 0.5) * 2; c.z = h.z + (this.rng() - 0.5) * 2;
        if (!this.grid.freeCircle(c.x, c.z, SIM.radius)) { c.x = h.x; c.z = h.z; }
        c.warmth = c.maxWarmth; c.ammo = F.ammoMax; c.invuln = SIM.invulnAfterThaw;
        this.emit('respawn', { id: c.id, x: c.x, z: c.z });
      }
      return;
    }
    // Warmth comes back slowly after a while without hits.
    if (this.t - c.lastHit > SIM.regenDelay) c.warmth = Math.min(c.maxWarmth, c.warmth + SIM.regenRate * dt);

    // Movement intent: joystick/keys, else tap-to-travel path.
    let mx = inp.mx || 0, mz = inp.mz || 0;
    if ((mx || mz) && c.travel) { c.travel = null; this.emit('travelCancel', { id: c.id }); }
    if (!mx && !mz && c.travel) {
      // Stuck on a corner for a moment: plan the route again from here.
      c.travel.stuck = c.moving < 0.5 ? (c.travel.stuck || 0) + dt : 0;
      if (c.travel.stuck > 0.8 && this.nav) {
        const last = c.travel.path[c.travel.path.length - 1];
        const again = last && this.nav.path(c.x, c.z, last[0], last[1]);
        if (again) { c.travel.path = again; c.travel.stuck = 0; }
      }
      const wp = c.travel.path[0];
      if (wp) {
        const dx = wp[0] - c.x, dz = wp[1] - c.z, d = Math.hypot(dx, dz);
        if (d < 0.8) c.travel.path.shift(); else { mx = dx / d; mz = dz / d; }
      }
      if (!c.travel.path.length) { this.emit('arrive', { id: c.id, to: c.travel.to }); c.travel = null; }
    }
    const mlen = Math.hypot(mx, mz);
    if (mlen > 1) { mx /= mlen; mz /= mlen; }

    // Dodge: a quick slide.
    if (inp.dodge && c.dodgeCd <= 0) {
      let dx = inp.dodge.dx, dz = inp.dodge.dz; const l = Math.hypot(dx, dz);
      if (l < 0.1) { dx = Math.sin(c.face); dz = Math.cos(c.face); } else { dx /= l; dz /= l; }
      c.dodge = SIM.dodgeTime; c.dodgeCd = SIM.dodgeCooldown; c.invuln = Math.max(c.invuln, SIM.dodgeTime + 0.08);
      c.vx = dx * SIM.speed * SIM.dodgeSpeed; c.vz = dz * SIM.speed * SIM.dodgeSpeed;
      this.emit('dodge', { id: c.id });
    }
    const f = this.grid.flags(c.x, c.z);
    const speedMul = (f & GRID.ROAD ? 1 : SIM.snowSpeed) * (c.side === 'rival' ? this.pace.rivalSpeed : 1) * (inp.speedMul || 1) * (c.charge > 0 ? 0.55 : 1);
    if (c.dodge > 0) c.dodge -= dt;
    else if (f & GRID.ICE) { c.vx += mx * SIM.accel * 0.15 * dt; c.vz += mz * SIM.accel * 0.15 * dt; }
    else {
      const tvx = mx * SIM.speed * speedMul, tvz = mz * SIM.speed * speedMul, k = Math.min(1, SIM.accel * dt / SIM.speed);
      c.vx += (tvx - c.vx) * k; c.vz += (tvz - c.vz) * k;
    }
    // Move with wall sliding.
    const nx = c.x + c.vx * dt, nz = c.z + c.vz * dt;
    if (this.grid.freeCircle(nx, c.z, SIM.radius)) c.x = nx; else c.vx = 0;
    if (this.grid.freeCircle(c.x, nz, SIM.radius)) c.z = nz; else c.vz = 0;
    c.moving = Math.hypot(c.vx, c.vz);
    if (mlen > 0.1) c.face = Math.atan2(mx, mz);

    // Throwing: quick throw, or charge then release a big snowball.
    const aim = this.pace.autoAim * (c.side === 'home' ? 1 : 0.6);
    if (inp.charge && c.ammo > 0) c.charge = Math.min(1, c.charge + dt / F.bigChargeSeconds);
    if (inp.throwAt) {
      const big = !!inp.big && c.charge >= 1;
      this.throwBall(c, inp.throwAt.x, inp.throwAt.z, big, aim);
      c.charge = 0;
    } else if (!inp.charge) c.charge = 0;
    if (inp.wall) this.buildWall(c);

    // Snowdrifts refill ammo; held points refill over time.
    if (c.ammo < F.ammoMax) {
      for (const d of this.drifts) {
        if (d.cd > 0 || Math.hypot(d.x - c.x, d.z - c.z) > 1.3) continue;
        c.ammo = Math.min(F.ammoMax, c.ammo + SIM.driftAmmo); d.cd = SIM.driftCooldown; this.emit('pickup', { id: c.id, drift: d.id }); break;
      }
      const h = this.nearestHeld(c.side, c.x, c.z);
      if (h && Math.hypot(h.x - c.x, h.z - c.z) < SIM.baseRadius) {
        c.refillT = (c.refillT || 0) + dt;
        if (c.refillT >= SIM.baseRefillEvery) { c.refillT = 0; c.ammo++; }
      }
    }
  }

  stepBalls(dt) {
    const keep = [];
    for (const b of this.balls) {
      b.life -= dt;
      b.x += b.vx * dt; b.z += b.vz * dt; b.vy -= SIM.gravity * dt; b.y += b.vy * dt;
      let done = false;
      if (this.grid.has(b.x, b.z, GRID.ZONE)) { this.emit('poof', { x: b.x, y: b.y, z: b.z }); done = true; }
      else if (this.grid.blocked(b.x, b.z) && b.y < 4) { this.emit('splat', { x: b.x, y: b.y, z: b.z, wall: true, big: b.big }); done = true; }
      if (!done && b.y < 2.2) {
        for (const c of this.chars) {
          if (c.side === b.side || c.frozen || c.thaw) continue;
          if (Math.hypot(c.x - b.x, c.z - b.z) < SIM.hitRadius * (b.big ? 1.3 : 1)) {
            this.hit(c, b);
            if (b.big) for (const o of this.chars) if (o !== c && o.side !== b.side && Math.hypot(o.x - b.x, o.z - b.z) < SIM.bigSplash) this.hit(o, { ...b, big: false });
            this.emit('splat', { x: b.x, y: b.y, z: b.z, onChar: c.id, big: b.big }); done = true; break;
          }
        }
      }
      if (!done && (b.y <= 0 || b.life <= 0)) { this.emit('splat', { x: b.x, y: 0, z: b.z, ground: true, big: b.big }); done = true; }
      if (!done) keep.push(b);
    }
    this.balls = keep;
  }

  // Tap-to-travel: walk the streets to a point; any joystick input cancels it.
  travelTo(c, x, z, to = null) {
    if (!this.nav) return false;
    const path = this.nav.path(c.x, c.z, x, z);
    if (!path) return false;
    c.travel = { path, to };
    this.emit('travel', { id: c.id, to });
    return true;
  }
}
