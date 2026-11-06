// The snowball-fight simulation. No rendering here, so it runs in tests and could later run
// for remote players too.
//
// Seats: every character sits in a seat whose controller is 'local' (this device), 'bot' or
// 'remote' (a future peer-to-peer player). The simulation only reads one input object per
// seat: { mx, mz, attack: {x,z}, super: {x,z}, manual, dodge: {dx,dz}, wall: true }.
import { CONFIG } from '../config.js';
import { GRID } from './grid.mjs';
import { makeGround } from './terrain.mjs';

const F = CONFIG.fight, KITS = CONFIG.kits, BOULDER = CONFIG.superBoulder, ZONE = CONFIG.zone;
export const SIM = {
  radius: 0.36,
  accel: 30,
  iceGrip: 0.12,
  ballRadius: 0.22, ballHeight: 0.8, lobPeak: 2.6,
  dodgeTime: 0.2, dodgeSpeed: 3, dodgeCooldown: 1.2,
  thawTime: 0.7,
  driftCooldown: 6,
  wallLife: 25, wallHalf: [1.0, 0.3],
  attackCooldown: 0.28,
};
// Snowmen the rivals have built, who waddle in waves toward the outpost (Tower Swarm-style).
// warmth: how many hits; speed: × normal; kit: how they throw; shield: dustbin lid that blocks
// straight snowballs from the front (× damage taken); range: how far they throw.
export const MINIONS = {
  waddler: { warmth: 24, speed: 0.55, kit: 'thrower', range: 5.0, dmg: 6, reload: 1.7 },
  shield: { warmth: 36, speed: 0.48, kit: 'thrower', range: 4.5, dmg: 6, reload: 2.0, shield: 0.25 },
  sledder: { warmth: 18, speed: 1.15, kit: 'sprayer', range: 3.4, dmg: 5, reload: 1.6 },
  lobber: { warmth: 22, speed: 0.5, kit: 'lobber', range: 6.0, dmg: 8, reload: 2.3 },
  captain: { warmth: 160, speed: 0.75, kit: 'thrower', range: 6.5, dmg: 10, reload: 1.0, shield: 0.6 },
};

// Sled runs, pickups, snow falling off roofs, wind and weather (Arena 1 world).
export const WORLD = {
  sled: { start: 2.5, push: 2.2, gravity: 9, max: 9.5, board: 0.75, cooldown: 1.5, cost: 2.6 },
  cocoa: { respawn: 40, reach: 0.85, superBonus: 0.35 }, // a question first; right answer = full warmth, full snowballs, some super
  supply: { reach: 0.9, superBonus: 0.45 }, // supply crates in the fights
  recruit: { reach: 1.3 }, // neighbourhood children waiting to join (fights.mjs camp)
  flake: { reach: 0.85 },
  dump: { reach: 1.4, damage: 6, slow: 1.1, cooldown: 4, tiles: 'HRtlTvyx' },
  gust: { every: [25, 45], seconds: 6, strength: 2.4, dir: [-Math.SQRT1_2, Math.SQRT1_2] }, // poyraz: from the north-east
  weather: { first: [55, 80], every: [60, 100], blizzard: 18, sun: 15, blizzardSight: 7, sunRegen: 1.6 },
};

let nextId = 1;

export function makeCharacter({ seat, team, side, role, x, z, kit = 'thrower', captain = false, look = null }) {
  const warmth = F.warmth * (captain ? 1.8 : 1);
  return {
    id: nextId++, seat, team, side, role, captain, kit, look,
    x, z, vx: 0, vz: 0, face: side === 'rival' ? 0 : Math.PI, moving: 0,
    warmth, maxWarmth: warmth, ammo: F.ammoMax, super: 0,
    frozen: 0, thaw: 0, shield: 0, dodge: 0, dodgeCd: 0, attackCd: 0,
    hidden: false, revealT: 0, lastHit: -99, lastAttack: -99, flash: 0,
    travel: null, hits: 0, frozenCount: 0, freezes: 0, guarding: false,
    sled: null, sledCd: 0, padT: 0, slow: 0, flakes: 0, planted: false,
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
    this.zones = arena.places.filter(p => p.kind === 'zone').map(zp => ({ id: zp.id, label: zp.label, family: zp.family || null, yard: zp.yard ?? null, battlefield: zp.battlefield || null, x: zp.x, z: zp.z, r: zp.r || 2.3, progress: 0, owner: null, home: 0, rival: 0 }));
    this.zone = this.zones[0] || null;
    this.ground = makeGround(arena.hills || []);
    this.runs = (arena.sledRuns || []).map(r => { const cum = [0]; for (let k = 1; k < r.pts.length; k++) cum.push(cum[k - 1] + Math.hypot(r.pts[k][0] - r.pts[k - 1][0], r.pts[k][1] - r.pts[k - 1][1])); return { ...r, cum, len: cum[cum.length - 1] }; });
    this.pickups = (arena.pickups || []).map(p => ({ ...p, cd: 0, taken: false }));
    this.dumpCd = new Map();
    // in the world, the student seizes outposts by answering tasks (rivals still seize by standing)
    this.taskCapture = !!arena.world;
    // weather only in the world (the small feel-test arena stays calm)
    const W = WORLD, rr = ([a, b]) => a + this.rng() * (b - a);
    this.weather = { on: !!arena.world, kind: 'clear', until: 0, next: arena.world ? rr(W.weather.first) : Infinity, gust: 0, gustUntil: 0, gustNext: arena.world ? rr(W.gust.every) : Infinity, wx: 0, wz: 0 };
    this._rr = rr;
  }
  add(char) { this.chars.push(char); return char; }
  setSpawn(side, x, z) { this.spawns[side].push({ x, z }); this.held[side].push({ x, z }); }
  emit(type, data) { this.events.push({ type, t: this.t, ...data }); }
  drainEvents() { const e = this.events; this.events = []; return e; }
  enemiesOf(c) { return this.chars.filter(o => o.side !== c.side && !o.frozen && !o.thaw && !o.benched); }
  alliesOf(c) { return this.chars.filter(o => o.side === c.side && o !== c && !o.frozen && !o.benched); }
  kitOf(c) { return KITS[c.kit] || KITS.thrower; }
  nearestHeld(side, x, z) {
    let best = this.held[side][0], bd = Infinity;
    for (const h of this.held[side]) { const d = Math.hypot(h.x - x, h.z - z); if (d < bd) { bd = d; best = h; } }
    return best;
  }
  // Hidden in a hedge: only seen from close by, or for a moment after throwing.
  canSee(viewer, target) {
    if (this.weather.kind === 'blizzard' && Math.hypot(viewer.x - target.x, viewer.z - target.z) > WORLD.weather.blizzardSight) return false; // lost in the snow
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
      this.balls.push({ ...base, kind: 'boulder', x: c.x + ux * 0.6, z: c.z + uz * 0.6, y: BOULDER.radius + this.ground(c.x, c.z), vx: ux * BOULDER.speed, vz: uz * BOULDER.speed, dmg: BOULDER.damage, r: BOULDER.radius, left: BOULDER.range, hitIds: [] });
      this.emit('super', { id: c.id, x: c.x, z: c.z });
      return true;
    }
    c.ammo -= 1;
    if (kit.shot === 'lob') {
      const d = Math.min(len, kit.range), ex = c.x + ux * d, ez = c.z + uz * d;
      this.balls.push({ ...base, kind: 'lob', x: c.x, z: c.z, y: 1.2 + this.ground(c.x, c.z), x0: c.x, z0: c.z, x1: ex, z1: ez, T: kit.flight * (0.6 + 0.4 * d / kit.range), t: 0, dmg: kit.damage, splash: kit.splash });
    } else {
      const n = kit.shot === 'spread' ? kit.count : 1, spread = (kit.spreadDeg || 0) * Math.PI / 180;
      for (let i = 0; i < n; i++) {
        const a = Math.atan2(ux, uz) + (n > 1 ? (i - (n - 1) / 2) * spread : 0);
        this.balls.push({ ...base, kind: 'straight', x: c.x + Math.sin(a) * 0.45, z: c.z + Math.cos(a) * 0.45, y: SIM.ballHeight + this.ground(c.x, c.z), vx: Math.sin(a) * kit.speed, vz: Math.cos(a) * kit.speed, dmg: kit.damage, r: SIM.ballRadius, left: kit.range, d0: kit.range });
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
    if (c.frozen || c.thaw || c.shield > 0 || c.dodge > 0 || c.benched) return false;
    if (c.coat > 0) { c.coat--; c.flash = 0.12; this.emit('coat', { id: c.id, x: c.x, z: c.z }); return true; } // a warm coat: this hit does not count
    let dmgMul = mul;
    if (c.shieldFront && ball.kind === 'straight') { const bl = Math.hypot(ball.vx, ball.vz) || 1; if ((ball.vx * Math.sin(c.face) + ball.vz * Math.cos(c.face)) / bl < -0.3) dmgMul *= c.shieldFront; } // the lid takes it
    const dmg = Math.round(ball.dmg * dmgMul);
    c.warmth = Math.max(c.planted ? 1 : 0, c.warmth - dmg); // answering a task: never frozen, only chilled
    if (c.planted) this.emit('plantedHit', { id: c.id }); c.lastHit = this.t; c.hits++; c.flash = 0.12;
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
      if (c.sled) { c.sled = null; this.emit('sledCrash', { id: c.id, x: c.x, z: c.z }); }
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
    this.stepWorld(dt);
    for (const w of [...this.walls]) if ((w.life -= dt) <= 0) { this.removeWall(w); this.emit('wallMelt', { id: w.id }); }
    for (const d of this.drifts) d.cd = Math.max(0, d.cd - dt);
    for (const z of this.zones) this.stepZone(z, dt);
  }

  // ---------- neighbourhood children waiting to join (the camp before a fight) ----------
  addRecruitSpot(spot) { const p = { ...spot, kind: 'recruit', cd: 0, taken: false, asking: false }; this.pickups.push(p); this.emit('recruitWait', { pickup: p.id }); return p; }
  removeRecruitSpot(id = null) { for (const p of this.pickups.filter(q => q.kind === 'recruit' && (!id || q.id === id))) { this.pickups.splice(this.pickups.indexOf(p), 1); this.emit('recruitGone', { pickup: p.id }); } }

  // ---------- sled runs ----------
  runPoint(run, s) {
    s = Math.max(0, Math.min(run.len, s)); let k = 1; while (k < run.cum.length - 1 && run.cum[k] < s) k++;
    const a = run.pts[k - 1], b = run.pts[k], seg = run.cum[k] - run.cum[k - 1] || 1, u = (s - run.cum[k - 1]) / seg;
    return { x: a[0] + (b[0] - a[0]) * u, z: a[1] + (b[1] - a[1]) * u, dx: (b[0] - a[0]) / seg, dz: (b[1] - a[1]) / seg };
  }
  stepSled(c, dt) {
    const S = WORLD.sled, sl = c.sled, run = sl.run, p0 = this.runPoint(run, sl.s), p1 = this.runPoint(run, sl.s + 0.3);
    const slope = (this.ground(p0.x, p0.z) - this.ground(p1.x, p1.z)) / 0.3; // downhill is positive
    sl.v = Math.min(S.max, sl.v + (S.push + Math.max(0, slope) * S.gravity) * dt);
    sl.s += sl.v * dt;
    const p = this.runPoint(run, sl.s);
    c.x = p.x; c.z = p.z; c.vx = p.dx * sl.v; c.vz = p.dz * sl.v; c.moving = sl.v; c.face = Math.atan2(p.dx, p.dz);
    if (sl.s >= run.len) { // off at the bottom with a little glide
      c.sled = null; c.sledCd = S.cooldown; c.vx *= 0.45; c.vz *= 0.45;
      this.emit('sledEnd', { id: c.id, run: run.id, x: c.x, z: c.z });
    }
  }
  tryBoard(c, dt) {
    if (c.sled || c.sledCd > 0 || c.frozen || c.thaw || !this.runs.length) return;
    for (const run of this.runs) {
      const [px, pz] = run.pts[0], d = Math.hypot(c.x - px, c.z - pz);
      if (d > WORLD.sled.board) continue;
      const p = this.runPoint(run, 0.5), along = c.vx * p.dx + c.vz * p.dz;
      c.padT += dt;
      if (along > 0.6 || c.padT > 0.7) { // heading down the run, or waiting on the start
        c.sled = { run, s: 0, v: WORLD.sled.start }; c.padT = 0; c.x = px; c.z = pz;
        this.emit('sledStart', { id: c.id, run: run.id, x: px, z: pz });
      }
      return;
    }
    c.padT = 0;
  }

  // ---------- pickups, wind and weather ----------
  stepWorld(dt) {
    for (const p of this.pickups) {
      if (p.taken || p.asking) continue;
      if (p.cd > 0) { p.cd -= dt; if (p.cd <= 0) this.emit('pickupBack', { pickup: p.id }); continue; }
      for (const c of this.chars) {
        if (c.frozen || c.thaw) continue;
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        if (p.kind === 'flake' && c.role === 'player' && d < WORLD.flake.reach) { p.taken = true; c.flakes++; this.emit('collect', { id: c.id, pickup: p.id, kind: 'flake', x: p.x, z: p.z }); break; }
        if (p.kind === 'recruit' && c.role === 'player' && !c.planted && d < WORLD.recruit.reach) { // a child waiting to join: a question first
          p.asking = true; this.emit('recruitAsk', { id: c.id, pickup: p.id, x: p.x, z: p.z }); break;
        }
        if (p.kind === 'supply' && c.role === 'player' && !c.planted && d < WORLD.supply.reach) { // a supply crate: a quick question first
          p.asking = true; this.emit('supplyAsk', { id: c.id, pickup: p.id, x: p.x, z: p.z }); break;
        }
        if (p.kind === 'cocoa' && c.role === 'player' && !c.planted && !p.asking && d < WORLD.cocoa.reach) { // a question first
          p.asking = true; this.emit('cocoaAsk', { id: c.id, pickup: p.id, x: p.x, z: p.z }); break;
        }
      }
    }
    for (const [k, t] of this.dumpCd) { if (t - dt <= 0) this.dumpCd.delete(k); else this.dumpCd.set(k, t - dt); }
    const w = this.weather; if (!w.on) return;
    // poyraz gusts: the north-east wind pushes snowballs for a few seconds
    if (this.t >= w.gustNext && !w.gust) { w.gust = 1; w.gustUntil = this.t + WORLD.gust.seconds; this.emit('gust', { on: true }); }
    if (w.gust) {
      const u = 1 - (w.gustUntil - this.t) / WORLD.gust.seconds, env = Math.sin(Math.PI * Math.min(1, Math.max(0, u)));
      w.wx = WORLD.gust.dir[0] * WORLD.gust.strength * env; w.wz = WORLD.gust.dir[1] * WORLD.gust.strength * env;
      if (this.t >= w.gustUntil) { w.gust = 0; w.wx = w.wz = 0; w.gustNext = this.t + this._rr(WORLD.gust.every); this.emit('gust', { on: false }); }
    }
    // weather events: a blizzard (short sight) or a burst of sunshine (warm up faster)
    if (w.kind === 'clear' && this.t >= w.next) {
      w.kind = w.force || (this.rng() < 0.55 ? 'blizzard' : 'sun'); w.force = null; w.until = this.t + WORLD.weather[w.kind];
      this.emit('weather', { kind: w.kind });
    } else if (w.kind !== 'clear' && this.t >= w.until) {
      w.kind = 'clear'; w.next = this.t + this._rr(WORLD.weather.every); this.emit('weather', { kind: 'clear' });
    }
  }

  // a snowball hits a roof, a tree or a lamp: the snow on it falls on whoever stands below
  snowDump(b) {
    const rows = this.arena.rows; if (!rows) return;
    const i = Math.floor(b.x - this.arena.x0), j = Math.floor(b.z - this.arena.z0), ch = rows[j]?.[i];
    if (!ch || !WORLD.dump.tiles.includes(ch)) return;
    const key = i + ',' + j; if (this.dumpCd.has(key)) return; this.dumpCd.set(key, WORLD.dump.cooldown);
    const x = this.arena.x0 + i + 0.5, z = this.arena.z0 + j + 0.5, hit = [];
    for (const c of this.chars) {
      if (c.frozen || c.thaw || c.side === b.side || Math.hypot(c.x - x, c.z - z) > WORLD.dump.reach) continue;
      c.slow = WORLD.dump.slow; hit.push(c.id);
      this.hit(c, { ...b, kind: 'dump', dmg: WORLD.dump.damage, vx: 0, vz: 0, x, z });
    }
    this.emit('snowDump', { x, z, tile: ch, hit });
  }

  // during a stage only its own outpost counts (the other fields sit next to it in the world file)
  nearestZone(x, z) { if (this.activeZone) return this.activeZone; let best = null, bd = Infinity; for (const zn of this.zones) { const d = Math.hypot(zn.x - x, zn.z - z); if (d < bd) { bd = d; best = zn; } } return best; }
  stepZone(z, dt) {
    let home = 0, rival = 0;
    for (const c of this.chars) if (!c.frozen && !c.thaw && !c.benched && Math.hypot(c.x - z.x, c.z - z.z) <= z.r) { if (c.side === 'home') home++; else rival++; }
    z.home = home; z.rival = rival; z.contested = home > 0 && rival > 0;
    if (z.owner === 'home' || (z.owner && !this.taskCapture)) return;
    if (this.taskCapture) { // home seizes by answering (seizeProgress); rivals by standing in a free circle
      if (z.owner || z.seizing || z.stand) return; // a stage stand: the English decides the outpost, not standing in it
      const rate = dt / ZONE.captureSeconds;
      if (rival && !home) z.progress = Math.max(-1, Math.min(0, z.progress) - rate * (1 + ZONE.extraKidBonus * (rival - 1)));
      if (z.progress <= -1) { z.owner = 'rival'; this.emit('zoneCaptured', { side: 'rival', zone: z.id }); }
      return;
    }
    const rate = dt / ZONE.captureSeconds;
    if (home && !rival) z.progress = Math.min(1, z.progress + rate * (1 + ZONE.extraKidBonus * (home - 1)));
    if (rival && !home) z.progress = Math.max(-1, z.progress - rate * (1 + ZONE.extraKidBonus * (rival - 1)));
    if (z.progress >= 1) { z.owner = 'home'; this.emit('zoneCaptured', { side: 'home', zone: z.id }); }
    if (z.progress <= -1) { z.owner = 'rival'; this.emit('zoneCaptured', { side: 'rival', zone: z.id }); }
  }
  // the student's answers move the bar; when it is full the outpost is theirs (even one the rivals held)
  seizeProgress(z, p) { z.progress = Math.max(0, Math.min(1, p)); }
  capture(z, side = 'home') { if (z.owner === side) return; z.owner = side; z.progress = side === 'home' ? 1 : -1; z.seizing = false; this.emit('zoneCaptured', { side, zone: z.id }); }
  // a right answer: the outpost throws a volley at the nearest rivals
  volley(c, z, n = 3) {
    const targets = this.enemiesOf(c).filter(o => Math.hypot(o.x - z.x, o.z - z.z) < 11).sort((a, b) => Math.hypot(a.x - z.x, a.z - z.z) - Math.hypot(b.x - z.x, b.z - z.z));
    if (!targets.length) return 0;
    for (let k = 0; k < n; k++) {
      const t = targets[k % targets.length], dx = t.x - z.x, dz = t.z - z.z, d = Math.hypot(dx, dz) || 1, sx = z.x + dx / d * (z.r * 0.7), sz = z.z + dz / d * (z.r * 0.7);
      const a = Math.atan2(t.x - sx, t.z - sz) + (k - (n - 1) / 2) * 0.12;
      this.balls.push({ owner: c.id, side: c.side, team: c.team, kit: 'thrower', kind: 'straight', x: sx, z: sz, y: 1.6 + this.ground(sx, sz), vx: Math.sin(a) * 11, vz: Math.cos(a) * 11, dmg: 12, r: SIM.ballRadius, left: 12, d0: 12 });
    }
    this.emit('volley', { zone: z.id, x: z.x, z: z.z, n });
    return n;
  }
  spawnMinion(type, x, z, team) {
    const M = MINIONS[type] || MINIONS.waddler;
    const c = makeCharacter({ seat: 'mn' + nextId, team, side: 'rival', role: 'minion', x, z, kit: M.kit });
    Object.assign(c, { minion: type, warmth: M.warmth, maxWarmth: M.warmth, shieldFront: M.shield || 0, captain: type === 'captain' });
    this.add(c); this.emit('spawnMinion', { id: c.id, minion: type, x, z }); return c;
  }
  removeGone() { const gone = this.chars.filter(c => c.gone); if (gone.length) this.chars = this.chars.filter(c => !c.gone); return gone; }
  // the landmark's own attack (stage outposts): snowballs arc from the top of the landmark onto
  // the nearest rivals — a right answer powers it
  blast(c, z, n = 3, dmg = 30) {
    const targets = this.enemiesOf(c).filter(o => Math.hypot(o.x - z.x, o.z - z.z) < 13).sort((a, b) => Math.hypot(a.x - z.x, a.z - z.z) - Math.hypot(b.x - z.x, b.z - z.z)).slice(0, n);
    for (const t of targets) this.balls.push({ owner: c.id, side: c.side, team: c.team, kit: 'lobber', kind: 'lob', blast: z.id, x: z.x, z: z.z, y: 3, x0: z.x, z0: z.z, x1: t.x + t.vx * 0.5, z1: t.z + t.vz * 0.5, T: 0.7, t: 0, dmg, splash: 1.1 });
    this.emit('blast', { zone: z.id, x: z.x, z: z.z, n: targets.length });
    return targets.length;
  }
  refillTeam(side) { for (const c of this.chars) if (c.side === side && !c.frozen) c.ammo = c.ammoMax || F.ammoMax; }
  // the cocoa question was answered
  cocoaResult(pickupId, c, right) {
    const p = this.pickups.find(q => q.id === pickupId); if (!p) return;
    p.asking = false; p.cd = WORLD.cocoa.respawn;
    if (right) { c.warmth = c.maxWarmth; c.ammo = F.ammoMax; const before = c.super; c.super = Math.min(1, c.super + WORLD.cocoa.superBonus); if (before < 1 && c.super >= 1) this.emit('superReady', { id: c.id }); }
    this.emit('collect', { id: c.id, pickup: p.id, kind: 'cocoa', right, x: p.x, z: p.z });
  }

  // supply crates (fights): dropped on the field, a quick question when the student walks onto one
  dropSupply(x, z) { const p = { id: 's' + (this.supplyN = (this.supplyN || 0) + 1), kind: 'supply', x, z, cd: 0, taken: false }; this.pickups.push(p); this.emit('supplyDrop', { pickup: p.id, x, z }); return p; }
  removeSupply(id = null) { for (const p of this.pickups.filter(q => q.kind === 'supply' && (!id || q.id === id))) { this.pickups.splice(this.pickups.indexOf(p), 1); this.emit('supplyGone', { pickup: p.id, x: p.x, z: p.z }); } }
  // right: the whole team's snowballs refilled, the student warm and the super charged; wrong: a
  // snowball in hand all the same (a question never punishes)
  supplyResult(pickupId, c, right) {
    const p = this.pickups.find(q => q.id === pickupId); if (!p) return;
    if (right) { this.refillTeam(c.side); c.warmth = c.maxWarmth; const before = c.super; c.super = Math.min(1, c.super + WORLD.supply.superBonus); if (before < 1 && c.super >= 1) this.emit('superReady', { id: c.id }); }
    else c.ammo = Math.min(F.ammoMax, c.ammo + 1);
    this.emit('collect', { id: c.id, pickup: p.id, kind: 'supply', right, x: p.x, z: p.z });
    this.removeSupply(pickupId);
  }
  resetZone(id = null) { for (const z of this.zones) if (!id || z.id === id) Object.assign(z, { progress: 0, owner: null }); }

  stepChar(c, dt, inp) {
    if (c.benched) return; // waiting for their wave, off the field
    c.attackCd = Math.max(0, c.attackCd - dt); c.shield = Math.max(0, c.shield - dt); c.dodgeCd = Math.max(0, c.dodgeCd - dt);
    c.revealT = Math.max(0, c.revealT - dt); c.flash = Math.max(0, c.flash - dt); c.sledCd = Math.max(0, c.sledCd - dt); c.slow = Math.max(0, c.slow - dt);
    if (c.frozen > 0) {
      c.vx = c.vz = 0; c.frozen -= dt;
      if (c.frozen <= 0) { c.frozen = 0; c.thaw = SIM.thawTime; this.emit('shake', { id: c.id }); }
      return;
    }
    if (c.thaw > 0) {
      c.thaw -= dt;
      if (c.thaw <= 0 && c.role === 'minion') { c.thaw = 0; c.gone = true; this.emit('melt', { id: c.id, x: c.x, z: c.z }); return; } // snowmen melt away
      if (c.thaw <= 0) {
        c.thaw = 0; const h = this.nearestHeld(c.side, c.x, c.z) || this.spawns[c.side][0]; // back at the nearest point your team holds
        c.x = h.x + (this.rng() - 0.5) * 1.5; c.z = h.z + (this.rng() - 0.5) * 1.5;
        if (!this.grid.freeCircle(c.x, c.z, SIM.radius)) { c.x = h.x; c.z = h.z; }
        c.warmth = c.maxWarmth; c.ammo = c.ammoMax || F.ammoMax; c.shield = F.spawnShield; c.vx = c.vz = 0;
        this.emit('respawn', { id: c.id, x: c.x, z: c.z });
      }
      return;
    }
    const kit = this.kitOf(c);
    const amax = c.ammoMax || F.ammoMax; if (c.ammo < amax) c.ammo = Math.min(amax, c.ammo + dt / kit.reload * (c.reloadMul || 1));
    if (this.t - c.lastHit > F.regenDelay && this.t - c.lastAttack > F.regenDelay) c.warmth = Math.min(c.maxWarmth, c.warmth + F.regenRate * (this.weather.kind === 'sun' ? WORLD.weather.sunRegen : 1) * dt);
    const aim = this.pace.autoAim * (c.side === 'home' ? 1 : 0.5);
    if (c.planted) { c.vx = c.vz = 0; c.moving = 0; c.travel = null; return; } // reading a task card: stays put while the team guards
    if (c.sled) { // riding down a sled run: no steering, but you can still throw
      this.stepSled(c, dt);
      if (inp.super) this.attack(c, inp.super.x, inp.super.z, { isSuper: true, aimHelp: inp.manual ? 0 : aim });
      else if (inp.attack) this.attack(c, inp.attack.x, inp.attack.z, { aimHelp: inp.manual ? 0 : aim });
      return;
    }

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
    const speed = F.moveSpeed * (f & GRID.ROAD ? F.streetBonus : 1) * (c.side === 'rival' ? this.pace.rivalSpeed : 1) * (inp.speedMul || 1) * (c.slow > 0 ? 0.6 : 1);
    if (c.dodge > 0) c.dodge -= dt;
    else if (f & GRID.ICE) { c.vx += mx * SIM.accel * SIM.iceGrip * dt; c.vz += mz * SIM.accel * SIM.iceGrip * dt; const sp = Math.hypot(c.vx, c.vz); if (sp > speed * 1.3) { c.vx *= speed * 1.3 / sp; c.vz *= speed * 1.3 / sp; } }
    else { const k = Math.min(1, SIM.accel * dt / speed); c.vx += (mx * speed - c.vx) * k; c.vz += (mz * speed - c.vz) * k; }
    const nx = c.x + c.vx * dt, nz = c.z + c.vz * dt;
    if (this.grid.freeCircle(nx, c.z, SIM.radius)) c.x = nx; else c.vx = 0;
    if (this.grid.freeCircle(c.x, nz, SIM.radius)) c.z = nz; else c.vz = 0;
    c.moving = Math.hypot(c.vx, c.vz);
    if (ml > 0.1 && !inp.attack && !inp.super) c.face = Math.atan2(mx, mz);
    c.hidden = this.grid.has(c.x, c.z, GRID.BUSH);
    this.tryBoard(c, dt);

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
        b.x1 += this.weather.wx * dt * 0.6; b.z1 += this.weather.wz * dt * 0.6; // the wind carries lobs a little
        b.x = b.x0 + (b.x1 - b.x0) * u; b.z = b.z0 + (b.z1 - b.z0) * u; b.y = 0.95 * (1 - u) + 4 * SIM.lobPeak * u * (1 - u) + 0.2 * u + this.ground(b.x, b.z);
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
        if (b.kind === 'straight' && this.weather.gust) { b.vx += this.weather.wx * dt; b.vz += this.weather.wz * dt; } // blown sideways by the poyraz
        const sx = b.vx * dt, sz = b.vz * dt, step = Math.hypot(sx, sz);
        b.x += sx; b.z += sz; b.left -= step;
        if (b.kind === 'straight') b.y = SIM.ballHeight + 0.25 * Math.sin(Math.PI * Math.min(1, 1 - b.left / b.d0)) + this.ground(b.x, b.z);
        else b.y = BOULDER.radius + this.ground(b.x, b.z);
        if (this.grid.has(b.x, b.z, GRID.ZONE)) { this.emit('poof', { x: b.x, y: b.y, z: b.z }); done = true; }
        else if (this.grid.blocked(b.x, b.z)) {
          const w = b.kind === 'boulder' && this.wallAt(b.x, b.z);
          if (w) { this.removeWall(w); this.emit('wallBreak', { id: w.id, x: w.x, z: w.z }); }
          else { this.emit('splat', { x: b.x - Math.sign(b.vx) * 0.2, y: b.y, z: b.z - Math.sign(b.vz) * 0.2, wall: true, big: b.kind === 'boulder', kind: b.kind, team: b.team }); this.snowDump(b); done = true; }
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
