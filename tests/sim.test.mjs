import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMatch } from '../src/game/match.mjs';
import { Grid, GRID } from '../src/game/grid.mjs';
import { Nav } from '../src/game/nav.mjs';
import { GridNav } from '../src/game/gridnav.mjs';
import { Sim, makeCharacter, SIM } from '../src/game/sim.mjs';
import { buildTileArena } from '../src/game/tilemap.mjs';
import { SCHOOLYARD } from '../src/game/arenas/schoolyard.mjs';
import { makeRng } from '../src/tasks/subtasks.mjs';
import { CONFIG } from '../src/config.js';

const arena = () => buildTileArena(SCHOOLYARD); // fresh each time (snow walls change the grid)
const K = CONFIG.kits;

test('the schoolyard arena: Our School at the bottom, the rivals\' fort at the top, a zone in the street, a quiet zone by the mosque', () => {
  const a = arena();
  assert.equal(a.w, 26); assert.equal(a.h, 36);
  const base = a.places.find(p => p.kind === 'base'), rival = a.places.find(p => p.kind === 'rivalBase'), zone = a.places.find(p => p.kind === 'zone');
  assert.equal(base.label, 'Our School');
  assert.ok(base.z > zone.z && zone.z > rival.z, 'home at the bottom, zone in the middle, rivals at the top');
  const g = new Grid(a);
  assert.ok(g.has(12, 0, GRID.ZONE) || a.rows.some(r => r.includes('M')), 'the mosque grounds are a quiet zone');
  assert.ok(!g.has(zone.x, zone.z, GRID.ZONE), 'the capture zone is not in the quiet zone');
  assert.ok(a.drifts.length >= 6);
});

test('both starts can reach the capture zone (grid A*)', () => {
  const a = arena(), g = new Grid(a), nav = new GridNav(g, SIM.radius);
  const zone = a.places.find(p => p.kind === 'zone');
  for (const start of a.places.filter(p => p.kind !== 'zone')) {
    const path = nav.path(start.x, start.z, zone.x, zone.z);
    assert.ok(path && path.length, `${start.label} reaches the zone`);
    let [x, z] = [start.x, start.z];
    for (const [px, pz] of path) { assert.ok(g.clearLine(x, z, px, pz), 'every leg is walkable'); [x, z] = [px, pz]; }
  }
});

function duel(kit = 'thrower') {
  const m = createMatch({ arena: arena(), myTeam: 'ravenclaw', rivalTeam: 'gryffindor', rng: makeRng(4), playerKit: kit });
  const sim = m.sim, p = m.player, r = sim.chars.find(c => c.side === 'rival');
  for (const c of sim.chars) if (c !== p && c !== r) { c.x = 999; c.z = 999; }
  // stand on an open stretch of the street, 4 tiles apart
  p.x = -2.5; p.z = -1.5; r.x = 1.5; r.z = -1.5;
  return { m, sim, p, r };
}
const run = (sim, s, inp = new Map()) => { for (let i = 0; i < s * 60; i++) sim.step(1 / 60, inp); };

test('a straight snowball hits for the kit\'s damage and charges the super', () => {
  const { sim, p, r } = duel();
  assert.equal(sim.attack(p, r.x, r.z), true);
  run(sim, 0.6);
  assert.equal(r.warmth, r.maxWarmth - K.thrower.damage);
  assert.ok(Math.abs(p.super - K.thrower.superPerHit) < 1e-9);
  assert.ok(sim.drainEvents().some(e => e.type === 'hit' && e.dmg === K.thrower.damage));
});

test('snowballs reload by themselves: three in hand, one comes back each reload time', () => {
  const { sim, p, r } = duel();
  r.x = 999;
  for (let i = 0; i < 3; i++) { sim.attack(p, 5, -1.5); p.attackCd = 0; }
  assert.ok(p.ammo < 1);
  assert.equal(sim.attack(p, 5, -1.5), false, 'no snowball in hand');
  run(sim, K.thrower.reload + 0.05);
  assert.ok(p.ammo >= 1);
});

test('the lobber throws over cover; the sprayer throws three at once', () => {
  const lob = duel('lobber');
  lob.sim.attack(lob.p, lob.r.x, lob.r.z); run(lob.sim, 1);
  assert.equal(lob.r.warmth, lob.r.maxWarmth - K.lobber.damage);
  const spray = duel('sprayer');
  spray.sim.attack(spray.p, spray.r.x, spray.r.z);
  assert.equal(spray.sim.balls.length, K.sprayer.count);
});

test('four hits freeze a kid into a snowman for 3 seconds; they come back at their start with a shield', () => {
  const { sim, p, r } = duel();
  for (let i = 0; i < 4; i++) sim.hit(r, { dmg: 26, vx: 0, vz: -1, owner: p.id, kind: 'straight' });
  assert.ok(r.frozen > 0);
  let t = 0; while (r.frozen > 0) { sim.step(0.05); t += 0.05; }
  assert.ok(Math.abs(t - CONFIG.timing.frozenSeconds) < 0.11);
  while (r.thaw > 0) sim.step(0.05);
  const s = sim.spawns.rival[0];
  assert.ok(Math.hypot(r.x - s.x, r.z - s.z) < 2);
  assert.ok(r.shield > 0 && r.warmth === r.maxWarmth);
  assert.equal(p.freezes, 1);
});

test('the super boulder rolls through several rivals and knocks them back', () => {
  const { sim, p, r } = duel();
  const r2 = sim.chars.filter(c => c.side === 'rival')[1]; r2.x = 3.5; r2.z = -1.5;
  p.super = 1;
  assert.equal(sim.attack(p, r.x, r.z, { isSuper: true }), true);
  run(sim, 1.2);
  assert.equal(r.warmth, r.maxWarmth - CONFIG.superBoulder.damage);
  assert.equal(r2.warmth, r2.maxWarmth - CONFIG.superBoulder.damage);
  assert.equal(p.super, 0);
});

test('warmth comes back after a few quiet seconds', () => {
  const { sim, r } = duel();
  sim.hit(r, { dmg: 40, vx: 0, vz: 0, kind: 'straight' });
  run(sim, CONFIG.fight.regenDelay + 2);
  assert.ok(r.warmth > r.maxWarmth - 40 + 10);
});

test('hiding in a hedge: rivals cannot target you from far away, only from close by', () => {
  const a = arena(), g = new Grid(a);
  let bush = null;
  for (let j = 0; j < a.h && !bush; j++) for (let i = 0; i < a.w; i++) if (a.rows[j][i] === 'B') { bush = g.center(i, j); break; }
  const sim = new Sim({ arena: a, grid: g, nav: null, seats: [] });
  const hider = sim.add(makeCharacter({ seat: 'p1', team: 'hufflepuff', side: 'home', role: 'player', x: bush[0], z: bush[1] }));
  const seeker = sim.add(makeCharacter({ seat: 'r1', team: 'ravenclaw', side: 'rival', role: 'rival', x: bush[0], z: bush[1] - 5 }));
  sim.step(1 / 60);
  assert.equal(hider.hidden, true);
  assert.equal(sim.canSee(seeker, hider), false);
  seeker.z = bush[1] - 2; assert.equal(sim.canSee(seeker, hider), true);
  seeker.z = bush[1] - 5; sim.attack(hider, seeker.x, seeker.z); assert.equal(sim.canSee(seeker, hider), true, 'throwing gives you away');
});

test('snowballs stop at walls and vanish in the quiet zone; nobody throws from inside it', () => {
  const a = arena(), g = new Grid(a), sim = new Sim({ arena: a, grid: g, nav: null, seats: [] });
  let wall = null, quiet = null;
  for (let j = 0; j < a.h; j++) for (let i = 0; i < a.w; i++) {
    const [x, z] = g.center(i, j);
    if (!wall && a.rows[j][i] === '#') wall = [x, z];
    if (!quiet && g.has(x, z, GRID.ZONE) && !g.blocked(x, z)) quiet = [x, z];
  }
  sim.balls.push({ kind: 'straight', x: wall[0], z: wall[1], y: 1, vx: 0.01, vz: 0, side: 'home', left: 5, d0: 5, dmg: 1 });
  sim.balls.push({ kind: 'straight', x: quiet[0], z: quiet[1], y: 1, vx: 0.01, vz: 0, side: 'home', left: 5, d0: 5, dmg: 1 });
  sim.step(1 / 60);
  const ev = sim.drainEvents();
  assert.ok(ev.some(e => e.type === 'splat' && e.wall));
  assert.ok(ev.some(e => e.type === 'poof'));
  const c = sim.add(makeCharacter({ seat: 'p', team: 'hufflepuff', side: 'home', role: 'player', x: quiet[0], z: quiet[1] }));
  assert.equal(sim.attack(c, quiet[0] - 3, quiet[1]), false);
});

test('standing in the zone with nobody from the other side captures it; a rival inside stops the capture', () => {
  const { sim, p, r } = duel();
  const z = sim.zone; p.x = z.x - 2.2; p.z = z.z + 2.0; r.x = 999;
  run(sim, 3);
  assert.ok(z.progress > 0.3);
  r.x = z.x + 2.2; r.z = z.z - 2.0; const before = z.progress; r.warmth = 9999; r.maxWarmth = 9999;
  sim.step(1 / 60);
  assert.equal(z.progress, before, 'contested: no progress');
  r.x = 999;
  run(sim, CONFIG.zone.captureSeconds);
  assert.equal(z.owner, 'home');
  assert.ok(sim.drainEvents().some(e => e.type === 'zoneCaptured' && e.side === 'home'));
});

test('characters never walk through walls', () => {
  const { sim, p } = duel();
  for (let i = 0; i < 900; i++) { sim.step(1 / 60, new Map([['p1', { mx: Math.sin(i / 90), mz: Math.cos(i / 70) }]])); assert.ok(sim.grid.freeCircle(p.x, p.z, SIM.radius * 0.99)); }
});

test('a full bot match runs for two minutes: everyone fights, kids freeze, someone captures the zone', () => {
  const m = createMatch({ arena: arena(), myTeam: 'gryffindor', rivalTeam: 'slytherin', rng: makeRng(11) });
  // the student walks to the zone and stands there
  const counts = {};
  for (let i = 0; i < 60 * 120; i++) {
    const p = m.player, z = m.sim.zone;
    const gx = z.x - 2.2, gz = z.z + 2.0, d = Math.hypot(gx - p.x, gz - p.z);
    if (!p.travel && d > 1.2) m.sim.travelTo(p, gx, gz);
    const t = m.sim.autoTarget(p);
    m.step(1 / 60, t && p.ammo >= 1 ? { attack: { x: t.x, z: t.z } } : {});
    for (const e of m.sim.drainEvents()) counts[e.type] = (counts[e.type] || 0) + 1;
    for (const c of m.sim.chars) assert.ok(Number.isFinite(c.x) && Number.isFinite(c.z));
  }
  assert.ok(counts.throw > 40, `throws ${counts.throw}`);
  assert.ok(counts.hit > 15, `hits ${counts.hit}`);
  assert.ok(counts.freeze >= 2, `freezes ${counts.freeze}`);
  assert.ok(counts.zoneCaptured >= 1, 'the zone was captured');
});

test('any seat can be a remote player without a bot (ready for multiplayer later)', () => {
  const seats = [
    { id: 'p1', team: 'hufflepuff', side: 'home', role: 'player', controller: 'local' },
    { id: 'r1', team: 'ravenclaw', side: 'rival', role: 'rival', controller: 'remote' },
  ];
  const m = createMatch({ arena: arena(), myTeam: 'hufflepuff', rivalTeam: 'ravenclaw', seats, rng: makeRng(1) });
  assert.equal(m.bots.size, 0);
  const r = m.sim.chars.find(c => c.seat === 'r1'), x0 = r.x;
  for (let i = 0; i < 30; i++) m.step(1 / 60, {}, new Map([['r1', { mx: 1, mz: 0 }]]));
  assert.notEqual(r.x, x0);
});

test('the street arena from M1 still loads and routes (kept for reference)', () => {
  const street = JSON.parse(readFileSync(new URL('../public/arenas/arena1-block.json', import.meta.url), 'utf8'));
  const g = new Grid(street), nav = new Nav(street, g);
  const base = street.places.find(p => p.kind === 'base'), park = street.places.find(p => p.id === 'boulevard-park');
  assert.ok(nav.path(base.x, base.z, park.x, park.z));
  const text = JSON.stringify({ ...street, grid: '' });
  for (const name of ['İmam Hatip', 'Camii', 'Mezarlığı']) assert.ok(!text.includes(name));
});
