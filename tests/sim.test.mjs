import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMatch } from '../src/game/match.mjs';
import { Grid, GRID } from '../src/game/grid.mjs';
import { Nav } from '../src/game/nav.mjs';
import { Sim, makeCharacter, SIM } from '../src/game/sim.mjs';
import { makeRng } from '../src/tasks/subtasks.mjs';
import { CONFIG } from '../src/config.js';

const arena = JSON.parse(readFileSync(new URL('../public/arenas/arena1-block.json', import.meta.url), 'utf8'));
const fresh = () => JSON.parse(JSON.stringify(arena)); // the grid is mutated by snow walls

test('the arena has Our School, buildings, streets and no-snowball zones, and never stores real names', () => {
  const base = arena.places.find(p => p.kind === 'base');
  assert.equal(base.label, 'Our School');
  assert.ok(arena.buildings.some(b => b.k === 'ourSchool'));
  assert.ok(arena.buildings.length > 500 && arena.roads.length > 50 && arena.zones.length > 0);
  assert.equal(arena.credit, '© OpenStreetMap contributors');
  const text = JSON.stringify({ ...arena, grid: '' });
  for (const name of ['İmam Hatip', 'Camii', 'Cami', 'Mezarlığı']) assert.ok(!text.includes(name), `arena file contains "${name}"`);
});

test('A* finds a street path from Our School to Boulevard Park', () => {
  const grid = new Grid(arena), nav = new Nav(arena, grid);
  const base = arena.places.find(p => p.kind === 'base'), park = arena.places.find(p => p.id === 'boulevard-park');
  const path = nav.path(base.x, base.z, park.x, park.z);
  assert.ok(path && path.length >= 2, 'path exists');
  let [x, z] = [base.x, base.z];
  for (const [px, pz] of path) { assert.ok(grid.clearLine(x, z, px, pz), 'every leg is walkable'); [x, z] = [px, pz]; }
});

function duel() {
  const m = createMatch({ arena: fresh(), myTeam: 'ravenclaw', rivalTeam: 'gryffindor', rng: makeRng(4) });
  const sim = m.sim, p = m.player;
  // Put one rival next to the player on an open street cell, everyone else far away.
  const r = sim.chars.find(c => c.side === 'rival');
  for (const c of sim.chars) if (c !== p && c !== r) { c.x = 9999; c.z = 9999; }
  return { m, sim, p, r };
}

test('four quick hits freeze a character into a snowman for 3 seconds, then they respawn at a held point', () => {
  const { sim, p, r } = duel();
  r.x = p.x + 3; r.z = p.z;
  for (let i = 0; i < 4; i++) sim.hit(r, { vx: 1, vz: 0, big: false, owner: p.id });
  assert.ok(r.frozen > 0 && r.warmth === 0);
  let t = 0;
  while (r.frozen > 0) { sim.step(0.05); t += 0.05; }
  assert.ok(Math.abs(t - CONFIG.timing.frozenSeconds) < 0.11, `frozen for ${t}s`);
  while (r.thaw > 0) sim.step(0.05);
  const spawn = sim.spawns.rival[0];
  assert.ok(Math.hypot(r.x - spawn.x, r.z - spawn.z) < 3, 'back at the rival start');
  assert.equal(r.warmth, r.maxWarmth);
  const ev = sim.drainEvents().map(e => e.type);
  assert.ok(ev.includes('freeze') && ev.includes('shake') && ev.includes('respawn'));
});

test('a thrown snowball flies an arc and hits a rival standing in the open', () => {
  const { sim, p, r } = duel();
  // find an open straight street stretch from the player
  let placed = false;
  for (const [dx, dz] of [[4, 0], [-4, 0], [0, 4], [0, -4], [3, 3], [-3, 3]]) {
    if (sim.grid.freeCircle(p.x + dx, p.z + dz, SIM.radius) && sim.grid.clearLine(p.x, p.z, p.x + dx, p.z + dz) && !sim.grid.has(p.x + dx, p.z + dz, GRID.ZONE)) { r.x = p.x + dx; r.z = p.z + dz; placed = true; break; }
  }
  assert.ok(placed);
  const before = r.warmth, ammo = p.ammo;
  assert.equal(sim.throwBall(p, r.x, r.z), true);
  assert.equal(p.ammo, ammo - 1);
  let peak = 0;
  for (let i = 0; i < 60 && sim.balls.length; i++) { sim.step(1 / 60); for (const b of sim.balls) peak = Math.max(peak, b.y); }
  assert.ok(peak > 1.2, 'the snowball arcs upward');
  assert.equal(r.warmth, before - CONFIG.fight.hitWarmth);
});

test('snowballs stop at buildings and vanish in no-snowball zones', () => {
  const grid = new Grid(fresh());
  const sim = new Sim({ arena: fresh(), grid, nav: null, seats: [] });
  // find a zone cell and a building cell
  let zone = null, wall = null;
  for (let z = -150; z < 150 && !(zone && wall); z += 1) for (let x = -150; x < 150; x += 1) {
    if (!zone && grid.has(x, z, GRID.ZONE) && !grid.blocked(x, z)) zone = [x, z];
    if (!wall && grid.blocked(x, z) && !grid.has(x, z, GRID.ZONE)) wall = [x, z];
  }
  sim.balls.push({ x: zone[0], z: zone[1], y: 1, vx: 0.1, vz: 0, vy: 0, side: 'home', big: false, life: 1 });
  sim.balls.push({ x: wall[0], z: wall[1], y: 1, vx: 0.1, vz: 0, vy: 0, side: 'home', big: false, life: 1 });
  sim.step(1 / 60);
  const ev = sim.drainEvents();
  assert.ok(ev.some(e => e.type === 'poof'), 'a snowball in a zone vanishes');
  assert.ok(ev.some(e => e.type === 'splat' && e.wall), 'a snowball hits the wall');
  assert.equal(sim.balls.length, 0);
});

test('nobody can throw from inside a no-snowball zone', () => {
  const grid = new Grid(fresh());
  const sim = new Sim({ arena: fresh(), grid, nav: null, seats: [] });
  let spot = null;
  for (let z = -150; z < 150 && !spot; z++) for (let x = -150; x < 150; x++) if (grid.has(x, z, GRID.ZONE) && grid.freeCircle(x, z, SIM.radius)) { spot = [x, z]; break; }
  const c = sim.add(makeCharacter({ seat: 'p1', team: 'hufflepuff', side: 'home', role: 'player', x: spot[0], z: spot[1] }));
  assert.equal(sim.throwBall(c, spot[0] + 3, spot[1]), false);
  assert.ok(sim.drainEvents().some(e => e.type === 'noThrowZone'));
});

test('characters cannot walk through buildings', () => {
  const { sim, p } = duel();
  for (let i = 0; i < 600; i++) {
    sim.step(1 / 60, new Map([['p1', { mx: 1, mz: 0.3 }]]));
    assert.ok(sim.grid.freeCircle(p.x, p.z, SIM.radius * 0.99), 'never inside a wall');
  }
});

test('running through a snowdrift refills snowballs; dodging gives a moment of protection', () => {
  const { sim, p } = duel();
  const d = sim.drifts[0];
  p.ammo = 1; p.x = d.x; p.z = d.z;
  sim.step(1 / 60);
  assert.ok(p.ammo >= 1 + 4 - 1 || p.ammo === CONFIG.fight.ammoMax, `ammo ${p.ammo}`);
  sim.step(1 / 60, new Map([['p1', { dodge: { dx: 1, dz: 0 } }]]));
  assert.ok(p.invuln > 0);
  const w = p.warmth; sim.hit(p, { vx: 1, vz: 0, big: false });
  assert.equal(p.warmth, w, 'a dodge slides out of the way of a hit');
});

test('tap-to-travel walks the streets and stops when the joystick moves', () => {
  const m = createMatch({ arena: fresh(), myTeam: 'hufflepuff', rivalTeam: 'slytherin', rng: makeRng(2) });
  const park = arena.places.find(p => p.id === 'boulevard-park');
  for (const c of m.sim.chars) if (c.side === 'rival') { c.x = 9999; c.z = 9999; }
  assert.ok(m.sim.travelTo(m.player, park.x, park.z, 'boulevard-park'));
  let arrived = false;
  for (let i = 0; i < 60 * 90 && !arrived; i++) { m.step(1 / 60, {}); arrived = m.sim.drainEvents().some(e => e.type === 'arrive'); }
  assert.ok(arrived, 'the student arrives at Boulevard Park');
  assert.ok(Math.hypot(m.player.x - park.x, m.player.z - park.z) < 2);
  m.sim.travelTo(m.player, m.base.x, m.base.z);
  m.step(1 / 60, { mx: 0, mz: 1 });
  assert.equal(m.player.travel, null, 'the joystick takes over');
});

test('a full bot match runs for two minutes without errors; rivals and teammates throw and get frozen', () => {
  const m = createMatch({ arena: fresh(), myTeam: 'gryffindor', rivalTeam: 'slytherin', rng: makeRng(11) });
  const counts = {};
  for (let i = 0; i < 60 * 120; i++) {
    m.step(1 / 60, {});
    for (const e of m.sim.drainEvents()) counts[e.type] = (counts[e.type] || 0) + 1;
    for (const c of m.sim.chars) assert.ok(Number.isFinite(c.x) && Number.isFinite(c.z));
  }
  assert.ok(counts.throw > 20, `throws: ${counts.throw}`);
  assert.ok(counts.hit > 5, `hits: ${counts.hit}`);
  assert.ok(counts.freeze >= 1, `freezes: ${counts.freeze}`);
});

test('any seat can be a remote player without a bot (ready for multiplayer later)', () => {
  const seats = [
    { id: 'p1', team: 'hufflepuff', side: 'home', role: 'player', controller: 'local' },
    { id: 'p2', team: 'hufflepuff', side: 'home', role: 'mate', controller: 'remote' },
    { id: 'r1', team: 'ravenclaw', side: 'rival', role: 'rival', controller: 'remote' },
  ];
  const m = createMatch({ arena: fresh(), myTeam: 'hufflepuff', rivalTeam: 'ravenclaw', seats, rng: makeRng(1) });
  assert.equal(m.bots.size, 0);
  const r = m.sim.chars.find(c => c.seat === 'r1'), x0 = r.x;
  for (let i = 0; i < 30; i++) m.step(1 / 60, {}, new Map([['r1', { mx: 1, mz: 0 }]]));
  assert.notEqual(r.x, x0, 'the remote seat moves from its received input');
});
