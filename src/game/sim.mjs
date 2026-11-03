// The snowball-fight simulation. No rendering here, so it runs in tests and could later run
// for remote players too.
//
// Seats: every character sits in a seat whose controller is 'local' (this device), 'bot' or
// 'remote' (a future peer-to-peer player). The simulation only reads one input object per
// seat: { mx, mz, attack: {x,z}, super: {x,z}, manual, dodge: {dx,dz}, wall: true }.
import { CONFIG } from '../config.js';
import { GRID } from './grid.mjs';

const F = CONFIG.fight, KITS = CONFIG.kits, BOULDER = CONFIG.superBoulder, ZONE = CONFIG.zone;
export const SIM = {
  radius: 0.36,
  accel: 30,
  iceGrip: 0.12,
  ballRadius: 0.22, ballHeight: 1.0, lobPeak: 2.6,
  dodgeTime: 0.2, dodgeSpeed: 3, dodgeCooldown: 1.2,
  thawTime: 0.7,
  driftCooldown: 6,
  wallLife: 25, wallHalf: [1.0, 0.3],
  attackCooldown: 0.28,
};

let nextId = 1;

export function makeCharacter({ seat, team, side, role, x, z, kit = 'thrower', captain = false }) {
  const warmth = F.warmth * (captain ? 1.8 : 1);
  return {
    id: nextId++, seat, team, side, role, captain, kit,
    x, z, vx: 0, vz: 0, face: side === 'rival' ? 0 : Math.PI, moving: 0,
    warmth, maxWarmth: warmth, ammo: F.ammoMax, super: 0,
    frozen: 0, thaw: 0, shield: 0, dodge: 0, dodgeCd: 0, attackCd: 0,
    hidden: false, revealT: 0, lastHit: -99, lastAttack: -99, flash: 0,
    travel: null, hits: 0, frozenCount: 0, freezes: 0, guarding: false,
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
    this.held = { home: [], rival: [] };
    // capture zones (outposts): one in a feel-test arena, five in a world
    this.zones = arena.places.filter(p => p.kind === 'zone').map(zp => ({ id: zp.id, label: zp.label, family: zp.family || null, x: zp.x, z: zp.z, r: zp.r || 2.3, progress: 0, owner: null, home: 0, rival: 0 }));
    this.zone = this.zones[0] || null;
  }
  add(char) { this.chars.push(char); return char; }
  setSpawn(side, x, z) { this.spawns[side].push({ x, z }); this.held[side].push({ x, z }); }
  emit(type, data) { this.events.push({ type, t: this.t, ...data }); }
  drainEvents() { const e = this.events; this.events = []; return e; }
  enemiesOf(c) { return this.chars.filter(o => o.side !== c.side && !o.frozen && !o.thaw); }
  alliesOf(c) { return this.chars.filter(o => o.side === c.side && o !== c && !o.frozen); }
  kitOf(c) { return KITS[c.kit] || KITS.thrower; }
  nearestHeld(side, x, z) {
    let best = this.held[side][0], bd = Infinity;
    for (const h of this.held[side]) { const d = Math.hypot(h.x - x, h.z - z); if (d < bd) { bd = d; best = h; } }
    return best;
  }
  // Hidden in a hedge: only seen from close by, or for a moment after throwing.
  canSee(viewer, target) {
    if (!target.hidden || target.revealT > 0) return true;
    return Math.hypot(viewer.x - target.x, viewer.z - target.z) <= F.hideRange;
  }

  // Auto-aim: nearest visible rival in range (straight shots also need a clear line).
  autoTarget(c, range = null) {
    const kit = this.kitOf(c); range = range ?? kit.range + 0.5;
    let best = null, bs = Infinity;
    for (const o of this.enemiesOf(c)) {
      const d = Math.hypot(o.x - c.x, o.z - c.z);
      if (d > range || !this.canSee(c, o) || this.grid.has(o.x, o.z, GRID.ZONE)) continue;
      if (kit.shot !== 'lob' && !this.grid.clearLine(c.x, c.z, o.x, o.z)) continue;
      if (d < bs) { bs = d; best = o; }
    }
    return best;
  }

  // Throw toward a point. Returns false if the throw could not happen.
  attack(c, tx, tz, { isSuper = false, aimHelp = 0 } = {}) {
    if (c.frozen || c.thaw || c.attackCd > 0) return false;
    if (isSuper ? c.super < 1 : c.ammo < 1) return false;
    if (this.grid.has(c.x, c.z, GRID.ZONE)) { this.emit('noThrowZone', { id: c.id }); return false; }
    let dx = tx - c.x, dz = tz - c.z;
    if (Math.hypot(dx, dz) < 0.05) { dx = Math.sin(c.face); dz = Math.cos(c.face); }
    const kit = this.kitOf(c);
    // lead a moving target a little (auto-aim strength comes from the pace)
    const target = aimHelp > 0 && this.chars.find(o => o.side !== c.side && Math.hypot(o.x - tx, o.z - tz) < 0.8);
    if (target && kit.shot !== 'lob') { const t = Math.hypot(dx, dz) / (kit.speed || 10); tx += target.vx * t * aimHelp; tz += target.vz * t * aimHelp; dx = tx - c.x; dz = tz - c.z; }
    const len = Math.hypot(dx, dz) || 1, ux = dx / len, uz = dz / len;
    c.face = Math.atan2(ux, uz); c.attackCd = SIM.attackCooldown; c.lastAttack = this.t; c.revealT = F.revealSeconds;
    const base = { owner: c.id, side: c.side, team: c.team, kit: c.kit };
    if (isSuper) {
      c.super = 0;
      this.balls.push({ ...base, kind: 'boulder', x: c.x + ux * 0.6, z: c.z + uz * 0.6, y: BOULDER.radius, vx: ux * BOULDER.speed, vz: uz * BOULDER.speed, dmg: BOULDER.damage, r: BOULDER.radius, left: BOULDER.range, hitIds: [] });
      this.emit('super', { id: c.id, x: c.x, z: c.z });
      return true;
    }
    c.ammo -= 1;
    if (kit.shot === 'lob') {
      const d = Math.min(len, kit.range), ex = c.x + ux * d, ez = c.z + uz * d;
      this.balls.push({ ...base, kind: 'lob', x: c.x, z: c.z, y: 1.2, x0: c.x, z0: c.z, x1: ex, z1: ez, T: kit.flight * (0.6 + 0.4 * d / kit.range), t: 0, dmg: kit.damage, splash: kit.splash });
    } else {
      const n = kit.shot === 'spread' ? kit.count : 1, spread = (kit.spreadDeg || 0) * Math.PI / 180;
      for (let i = 0; i < n; i++) {
        const a = Math.atan2(ux, uz) + (n > 1 ? (i - (n - 1) / 2) * spread : 0);
        this.balls.push({ ...base, kind: 'straight', x: c.x + Math.sin(a) * 0.45, z: c.z + Math.cos(a) * 0.45, y: SIM.ballHeight, vx: Math.sin(a) * kit.speed, vz: Math.cos(a) * kit.speed, dmg: kit.damage, r: SIM.ballRadius, left: kit.range, d0: kit.range });
      }
    }
    this.emit('throw', { id: c.id, kit: c.kit, x: c.x, z: c.z });
    return true;
  }

  buildWall(c) {
    if (this.walls.filter(w => w.owner === c.id).length >= 2) return false;
    const fx = Math.sin(c.face), fz = Math.cos(c.face), x = c.x + fx * 1.3, z = c.z + fz * 1.3;
    if (this.grid.has(x, z, GRID.BLOCK | GRID.ZONE)) return false;
    const w = { id: nextId++, owner: c.id, team: c.team, x, z, rot: c.face, life: SIM.wallLife, cells: [] };
    const [hx, hz] = SIM.wallHalf, cos = Math.cos(c.face), sin = Math.sin(c.face);
    for (let a = -hx; a <= hx; a += 0.5) for (let b = -hz; b <= hz; b += 0.5) {
      const px = x + a * cos + b * sin, pz = z - a * sin + b * cos;
      if (!this.grid.blocked(px, pz)) { this.grid.set(px, pz, GRID.BLOCK); w.cells.push([px, pz]); }
    }
    if (!w.cells.length || this.chars.some(o => !this.grid.freeCircle(o.x, o.z, SIM.radius * 0.6))) { this.removeWall(w); return false; }
    this.walls.push(w); this.emit('wall', { id: w.id, x, z, rot: c.face }); return true;
  }
  removeWall(w) { for (const [px, pz] of w.cells) this.grid.set(px, pz, GRID.BLOCK, false); this.walls = this.walls.filter(o => o !== w); }
  wallAt(x, z) { return this.walls.find(w => w.cells.some(([px, pz]) => Math.floor(px) === Math.floor(x) && Math.floor(pz) === Math.floor(z))); }

  hit(c, ball, mul = 1) {
    if (c.frozen || c.thaw || c.shield > 0 || c.dodge > 0) return false;
    const dmg = Math.round(ball.dmg * mul);
    c.warmth = Math.max(0, c.warmth - dmg); c.lastHit = this.t; c.hits++; c.flash = 0.12;
    const kx = ball.vx || (c.x - ball.x), kz = ball.vz || (c.z - ball.z), len = Math.hypot(kx, kz) || 1;
    const kb = ball.kind === 'boulder' ? BOULDER.knockback : ball.kind === 'lob' ? 1.6 : 1.1;
    c.vx += (kx / len) * kb; c.vz += (kz / len) * kb;
    const by = this.chars.find(o => o.id === ball.owner);
    if (by && ball.kind !== 'boulder') {
      const before = by.super; by.super = Math.min(1, by.super + (KITS[by.kit]?.superPerHit || 0.2) * mul);
      if (before < 1 && by.super >= 1) this.emit('superReady', { id: by.id });
    }
    this.emit('hit', { id: c.id, by: ball.owner, dmg, kind: ball.kind, x: c.x, z: c.z });
    if (c.warmth <= 0) {
      c.frozen = CONFIG.timing.frozenSeconds; c.frozenCount++; c.travel = null; c.hidden = false;
      if (by) by.freezes++;
      this.emit('freeze', { id: c.id, by: ball.owner, x: c.x, z: c.z });
    }
    return true;
  }

  step(dt, inputs = new Map()) {
    dt = Math.min(dt, 0.05);
    this.t += dt;
    for (const c of this.chars) this.stepChar(c, dt, inputs.get(c.seat) || {});
    this.stepBalls(dt);
    for (const w of [...this.walls]) if ((w.life -= dt) <= 0) { this.removeWall(w); this.emit('wallMelt', { id: w.id }); }
    for (const d of this.drifts) d.cd = Math.max(0, d.cd - dt);
    for (const z of this.zones) this.stepZone(z, dt);
  }

  nearestZone(x, z) { let best = null, bd = Infinity; for (const zn of this.zones) { const d = Math.hypot(zn.x - x, zn.z - z); if (d < bd) { bd = d; best = zn; } } return best; }
  stepZone(z, dt) {
    let home = 0, rival = 0;
    for (const c of this.chars) if (!c.frozen && !c.thaw && Math.hypot(c.x - z.x, c.z - z.z) <= z.r) { if (c.side === 'home') home++; else rival++; }
    z.home = home; z.rival = rival; z.contested = home > 0 && rival > 0;
    if (z.owner) return;
    const rate = dt / ZONE.captureSeconds;
    if (home && !rival) z.progress = Math.min(1, z.progress + rate * (1 + ZONE.extraKidBonus * (home - 1)));
    if (rival && !home) z.progress = Math.max(-1, z.progress - rate * (1 + ZONE.extraKidBonus * (rival - 1)));
    if (z.progress >= 1) { z.owner = 'home'; this.emit('zoneCaptured', { side: 'home', zone: z.id }); }
    if (z.progress <= -1) { z.owner = 'rival'; this.emit('zoneCaptured', { side: 'rival', zone: z.id }); }
  }
  resetZone(id = null) { for (const z of this.zones) if (!id || z.id === id) Object.assign(z, { progress: 0, owner: null }); }

  stepChar(c, dt, inp) {
    c.attackCd = Math.max(0, c.attackCd - dt); c.shield = Math.max(0, c.shield - dt); c.dodgeCd = Math.max(0, c.dodgeCd - dt);
    c.revealT = Math.max(0, c.revealT - dt); c.flash = Math.max(0, c.flash - dt);
    if (c.frozen > 0) {
      c.vx = c.vz = 0; c.frozen -= dt;
      if (c.frozen <= 0) { c.frozen = 0; c.thaw = SIM.thawTime; this.emit('shake', { id: c.id }); }
      return;
    }
    if (c.thaw > 0) {
      c.thaw -= dt;
      if (c.thaw <= 0) {
        c.thaw = 0; const h = this.nearestHeld(c.side, c.x, c.z) || this.spawns[c.side][0]; // back at the nearest point your team holds
        c.x = h.x + (this.rng() - 0.5) * 1.5; c.z = h.z + (this.rng() - 0.5) * 1.5;
        if (!this.grid.freeCircle(c.x, c.z, SIM.radius)) { c.x = h.x; c.z = h.z; }
        c.warmth = c.maxWarmth; c.ammo = F.ammoMax; c.shield = F.spawnShield; c.vx = c.vz = 0;
        this.emit('respawn', { id: c.id, x: c.x, z: c.z });
      }
      return;
    }
    const kit = this.kitOf(c);
    if (c.ammo < F.ammoMax) c.ammo = Math.min(F.ammoMax, c.ammo + dt / kit.reload);
    if (this.t - c.lastHit > F.regenDelay && this.t - c.lastAttack > F.regenDelay) c.warmth = Math.min(c.maxWarmth, c.warmth + F.regenRate * dt);

    // movement intent: stick/keys, else tap-to-move path
    let mx = inp.mx || 0, mz = inp.mz || 0;
    if ((mx || mz) && c.travel) { c.travel = null; this.emit('travelCancel', { id: c.id }); }
    if (!mx && !mz && c.travel) {
      c.travel.stuck = c.moving < 0.3 ? (c.travel.stuck || 0) + dt : 0;
      if (c.travel.stuck > 0.6 && this.nav) { const last = c.travel.path[c.travel.path.length - 1]; const again = last && this.nav.path(c.x, c.z, last[0], last[1]); if (again) { c.travel.path = again; c.travel.stuck = 0; } }
      const wp = c.travel.path[0];
      if (wp) { const dx = wp[0] - c.x, dz = wp[1] - c.z, d = Math.hypot(dx, dz); if (d < 0.35) c.travel.path.shift(); else { mx = dx / d; mz = dz / d; } }
      if (!c.travel.path.length) { this.emit('arrive', { id: c.id, to: c.travel.to }); c.travel = null; }
    }
    const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
    if (inp.dodge && c.dodgeCd <= 0) {
      let dx = inp.dodge.dx, dz = inp.dodge.dz; const l = Math.hypot(dx, dz);
      if (l < 0.1) { dx = Math.sin(c.face); dz = Math.cos(c.face); } else { dx /= l; dz /= l; }
      c.dodge = SIM.dodgeTime; c.dodgeCd = SIM.dodgeCooldown;
      c.vx = dx * F.moveSpeed * SIM.dodgeSpeed; c.vz = dz * F.moveSpeed * SIM.dodgeSpeed; this.emit('dodge', { id: c.id });
    }
    const f = this.grid.flags(c.x, c.z);
    const speed = F.moveSpeed * (f & GRID.ROAD ? F.streetBonus : 1) * (c.side === 'rival' ? this.pace.rivalSpeed : 1) * (inp.speedMul || 1);
    if (c.dodge > 0) c.dodge -= dt;
    else if (f & GRID.ICE) { c.vx += mx * SIM.accel * SIM.iceGrip * dt; c.vz += mz * SIM.accel * SIM.iceGrip * dt; const sp = Math.hypot(c.vx, c.vz); if (sp > speed * 1.3) { c.vx *= speed * 1.3 / sp; c.vz *= speed * 1.3 / sp; } }
    else { const k = Math.min(1, SIM.accel * dt / speed); c.vx += (mx * speed - c.vx) * k; c.vz += (mz * speed - c.vz) * k; }
    const nx = c.x + c.vx * dt, nz = c.z + c.vz * dt;
    if (this.grid.freeCircle(nx, c.z, SIM.radius)) c.x = nx; else c.vx = 0;
    if (this.grid.freeCircle(c.x, nz, SIM.radius)) c.z = nz; else c.vz = 0;
    c.moving = Math.hypot(c.vx, c.vz);
    if (ml > 0.1 && !inp.attack && !inp.super) c.face = Math.atan2(mx, mz);
    c.hidden = this.grid.has(c.x, c.z, GRID.BUSH);

    const aim = this.pace.autoAim * (c.side === 'home' ? 1 : 0.5);
    if (inp.super) this.attack(c, inp.super.x, inp.super.z, { isSuper: true, aimHelp: inp.manual ? 0 : aim });
    else if (inp.attack) this.attack(c, inp.attack.x, inp.attack.z, { aimHelp: inp.manual ? 0 : aim });
    if (inp.wall) this.buildWall(c);

    // snowdrifts: run through one to refill every snowball at once
    if (c.ammo < F.ammoMax - 0.05) for (const d of this.drifts) {
      if (d.cd > 0 || Math.hypot(d.x - c.x, d.z - c.z) > 0.9) continue;
      c.ammo = F.ammoMax; d.cd = SIM.driftCooldown; this.emit('pickup', { id: c.id, drift: d.id }); break;
    }
  }

  stepBalls(dt) {
    const keep = [];
    for (const b of this.balls) {
      let done = false;
      if (b.kind === 'lob') {
        b.t += dt; const u = Math.min(1, b.t / b.T);
        b.x = b.x0 + (b.x1 - b.x0) * u; b.z = b.z0 + (b.z1 - b.z0) * u; b.y = 1.2 * (1 - u) + 4 * SIM.lobPeak * u * (1 - u) + 0.2 * u;
        if (u >= 1) {
          if (this.grid.has(b.x, b.z, GRID.ZONE)) this.emit('poof', { x: b.x, y: 0.3, z: b.z });
          else {
            let any = false;
            for (const c of this.chars) if (c.side !== b.side && Math.hypot(c.x - b.x, c.z - b.z) < b.splash + SIM.radius) any = this.hit(c, { ...b, vx: c.x - b.x, vz: c.z - b.z }) || any;
            this.emit('splat', { x: b.x, y: 0.2, z: b.z, ground: !any, big: true, kind: 'lob', team: b.team });
          }
          done = true;
        }
      } else {
        const sx = b.vx * dt, sz = b.vz * dt, step = Math.hypot(sx, sz);
        b.x += sx; b.z += sz; b.left -= step;
        if (b.kind === 'straight') b.y = SIM.ballHeight + 0.25 * Math.sin(Math.PI * Math.min(1, 1 - b.left / b.d0));
        if (this.grid.has(b.x, b.z, GRID.ZONE)) { this.emit('poof', { x: b.x, y: b.y, z: b.z }); done = true; }
        else if (this.grid.blocked(b.x, b.z)) {
          const w = b.kind === 'boulder' && this.wallAt(b.x, b.z);
          if (w) { this.removeWall(w); this.emit('wallBreak', { id: w.id, x: w.x, z: w.z }); }
          else { this.emit('splat', { x: b.x - Math.sign(b.vx) * 0.2, y: b.y, z: b.z - Math.sign(b.vz) * 0.2, wall: true, big: b.kind === 'boulder', kind: b.kind, team: b.team }); done = true; }
        }
        if (!done) for (const c of this.chars) {
          if (c.side === b.side || c.frozen || c.thaw) continue;
          if (Math.hypot(c.x - b.x, c.z - b.z) > (b.r || SIM.ballRadius) + SIM.radius) continue;
          if (b.kind === 'boulder') { if (!b.hitIds.includes(c.id)) { b.hitIds.push(c.id); this.hit(c, b); this.emit('splat', { x: c.x, y: 0.8, z: c.z, onChar: c.id, big: true, kind: 'boulder', team: b.team }); } continue; }
          if (this.hit(c, b)) { this.emit('splat', { x: b.x, y: b.y, z: b.z, onChar: c.id, kind: b.kind, team: b.team }); done = true; break; }
        }
        if (!done && b.left <= 0) { this.emit('splat', { x: b.x, y: 0.1, z: b.z, ground: true, big: b.kind === 'boulder', kind: b.kind, team: b.team }); done = true; }
      }
      if (!done) keep.push(b);
    }
    this.balls = keep;
  }

  travelTo(c, x, z, to = null) {
    if (!this.nav) return false;
    const path = this.nav.path(c.x, c.z, x, z);
    if (!path) return false;
    c.travel = { path, to };
    this.emit('travel', { id: c.id, to });
    return true;
  }
}
