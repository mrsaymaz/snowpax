import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTileArena } from '../src/game/tilemap.mjs';
import { createMatch } from '../src/game/match.mjs';
import { WORLD } from '../src/game/sim.mjs';
import { makeGround } from '../src/game/terrain.mjs';
import { makeRng } from '../src/tasks/subtasks.mjs';

const def = JSON.parse(readFileSync(new URL('../public/arenas/arena1.json', import.meta.url), 'utf8'));
const world = () => createMatch({ arena: buildTileArena(def), myTeam: 'hufflepuff', rivalTeam: 'gryffindor', pace: 'relaxed', rng: makeRng(3) });
const run = (m, sec, inputs = () => ({})) => { const ev = []; for (let t = 0; t < sec; t += 0.05) { m.sim.step(0.05, new Map([['p1', inputs()]])); ev.push(...m.sim.drainEvents()); } return ev; };
const park = m => { for (const c of m.sim.chars) if (c !== m.player) { c.x = m.base.x; c.z = m.base.z; c.frozen = 999; } }; // keep the bots out of the way

// Sled runs and hills are engine features; the stage fields are flat, so they are checked on a
// small slope made for the test: a hill in the north-west, one run straight down its south side.
const SLOPE = {
  id: 'slope', name: 'Test slope', kind: 'tiles', world: true,
  rows: Array.from({ length: 40 }, (_, j) => Array.from({ length: 40 }, (_, i) => (i === 4 && j === 36 ? 'h' : i === 36 && j === 3 ? 'r' : '.')).join('')),
  outposts: [], hills: [{ i: 10, j: 8, r: 7, h: 3 }],
  sledRuns: [{ id: 'test-run', label: 'Test run', pts: [[10, 8], [10, 18], [11, 30]], len: 22 }],
};
const slope = () => createMatch({ arena: buildTileArena(SLOPE), myTeam: 'hufflepuff', rivalTeam: 'gryffindor', pace: 'relaxed', rng: makeRng(3) });

test('a sled run starts on a hill; the ground rises on a hill and is flat elsewhere', () => {
  const a = buildTileArena(SLOPE);
  assert.equal(a.sledRuns.length, 1);
  const ground = makeGround(a.hills);
  for (const r of a.sledRuns) {
    const [x, z] = r.pts[0], [ex, ez] = r.pts[r.pts.length - 1];
    assert.ok(ground(x, z) > 1.5, `${r.id} starts high`);
    assert.ok(ground(ex, ez) < 0.01, `${r.id} ends on the flat`);
  }
  assert.equal(ground(a.places[0].x, a.places[0].z), 0);
});

test('a kid on the start pad heading downhill rides the whole run, fast, then gets off', () => {
  const m = slope(); park(m); const P = m.player, r = m.sim.runs[0];
  P.x = r.pts[0][0]; P.z = r.pts[0][1]; P.padT = 1;
  const ev = run(m, 12);
  assert.ok(ev.some(e => e.type === 'sledStart' && e.id === P.id));
  const end = ev.find(e => e.type === 'sledEnd' && e.id === P.id);
  assert.ok(end, 'reached the bottom');
  assert.ok(end.t < r.len / 3.4, 'quicker than walking');
  assert.equal(P.sled, null);
  assert.ok(Math.hypot(P.x - r.pts.at(-1)[0], P.z - r.pts.at(-1)[1]) < 2.5);
});

test('getting frozen on a sled knocks you off', () => {
  const m = slope(); park(m); const P = m.player, r = m.sim.runs[0];
  P.x = r.pts[0][0]; P.z = r.pts[0][1]; P.padT = 1; run(m, 0.3);
  assert.ok(P.sled);
  P.warmth = 1; m.sim.hit(P, { dmg: 10, owner: -1, kind: 'straight', vx: 1, vz: 0, x: P.x, z: P.z });
  assert.equal(P.sled, null); assert.ok(P.frozen > 0);
});

test('far journeys can ride a sled run: the path goes to the start pad, then the bottom', () => {
  const m = slope(), r = m.sim.runs[0];
  const from = [r.pts[0][0] + 3, r.pts[0][1] - 3], to = r.pts.at(-1);
  const path = m.nav.path(from[0], from[1], to[0] + 1, to[1] + 1);
  assert.ok(path && path.sled, 'the path uses the sled');
  const k = path.findIndex(p => p[0] === r.pts[0][0] && p[1] === r.pts[0][1]);
  assert.ok(k >= 0 && path[k + 1][0] === to[0] && path[k + 1][1] === to[1]);
});

test('the student collects glowing snowflakes; hot cocoa asks a question, then warms you right up and comes back later', () => {
  const m = world(); park(m); const P = m.player, sim = m.sim;
  const flake = sim.pickups.find(p => p.kind === 'flake'), cocoa = sim.pickups.find(p => p.kind === 'cocoa');
  P.x = flake.x; P.z = flake.z;
  let ev = run(m, 0.1);
  assert.ok(ev.some(e => e.type === 'collect' && e.kind === 'flake')); assert.equal(P.flakes, 1); assert.ok(flake.taken);
  P.x = cocoa.x; P.z = cocoa.z; P.warmth = 20; P.ammo = 0; P.lastHit = sim.t;
  ev = run(m, 0.1);
  const ask = ev.find(e => e.type === 'cocoaAsk'); assert.ok(ask, 'the cocoa asks a question first'); assert.equal(P.warmth < 30, true);
  sim.cocoaResult(ask.pickup, P, true);
  assert.equal(P.warmth, P.maxWarmth); assert.ok(P.ammo >= 3); assert.ok(cocoa.cd > 0);
  P.x += 5;
  ev = run(m, WORLD.cocoa.respawn + 0.5, () => ({ mx: 0, mz: 0 }));
  assert.ok(ev.some(e => e.type === 'pickupBack' && e.pickup === cocoa.id));
});

test('a snowball on a roof drops its snow on a rival below: a little cold and slow', () => {
  const m = world(); park(m); const sim = m.sim, a = sim.arena;
  let spot = null;
  for (let j = 2; j < a.h - 2 && !spot; j++) for (let i = 2; i < a.w - 2 && !spot; i++) if (a.rows[j][i] === 'R' && a.rows[j + 1][i] === '.') spot = [i, j];
  const x = a.x0 + spot[0] + 0.5, z = a.z0 + spot[1] + 0.5, rival = sim.chars.find(c => c.side === 'rival');
  rival.frozen = 0; rival.x = x; rival.z = z + 1; rival.shield = 0;
  const before = rival.warmth;
  sim.snowDump({ x, z, side: 'home', owner: m.player.id, team: 'hufflepuff', dmg: 10, kind: 'straight' });
  const ev = sim.drainEvents();
  assert.ok(ev.some(e => e.type === 'snowDump' && e.hit.includes(rival.id)));
  assert.equal(rival.warmth, before - WORLD.dump.damage); assert.ok(rival.slow > 0);
  sim.snowDump({ x, z, side: 'home', owner: m.player.id, dmg: 10, kind: 'straight' });
  assert.ok(!sim.drainEvents().some(e => e.type === 'snowDump'), 'the roof needs time to gather snow again');
});

test('the poyraz blows snowballs sideways; a blizzard hides far rivals; sunshine warms faster', () => {
  const m = world(); park(m); const sim = m.sim, P = m.player;
  sim.weather.gustNext = sim.t;
  let ev = run(m, 2);
  assert.ok(ev.some(e => e.type === 'gust' && e.on)); assert.ok(sim.weather.wx < 0 && sim.weather.wz > 0, 'from the north-east');
  for (let k = 0; k < 400; k++) { const x = m.base.x + (k % 20) - 10, z = m.base.z + Math.floor(k / 20) - 10; if ([0, 1, 2, 3, 4, 5].every(d => m.grid.freeCircle(x, z - d, 0.5))) { P.x = x; P.z = z; break; } } // open snow to throw over
  sim.balls.push({ kind: 'straight', side: 'home', owner: P.id, x: P.x, z: P.z - 1, y: 1, vx: 0, vz: -10, dmg: 10, r: 0.22, left: 6, d0: 6 });
  sim.stepBalls(0.3); assert.ok(sim.balls[0]?.vx < 0, 'pushed west');

  sim.weather.kind = 'clear'; sim.weather.next = sim.t; sim.rng = () => 0.1;
  ev = run(m, 0.1);
  assert.ok(ev.some(e => e.type === 'weather' && e.kind === 'blizzard'));
  const rival = sim.chars.find(c => c.side === 'rival'); rival.frozen = 0; rival.x = P.x + 9; rival.z = P.z;
  assert.equal(sim.canSee(P, rival), false); rival.x = P.x + 4; assert.equal(sim.canSee(P, rival), true);

  sim.weather.kind = 'sun'; sim.weather.until = sim.t + 10; P.warmth = 50; P.lastHit = P.lastAttack = -99;
  sim.stepChar(P, 1, {}); assert.ok(P.warmth >= 50 + 14 * WORLD.weather.sunRegen - 0.01);
});

test('the small feel-test arena stays calm (no weather, no sleds, no pickups)', async () => {
  const { SCHOOLYARD } = await import('../src/game/arenas/schoolyard.mjs');
  const m = createMatch({ arena: buildTileArena(SCHOOLYARD), myTeam: 'hufflepuff', rivalTeam: 'gryffindor', rng: makeRng(1) });
  run(m, 120);
  assert.equal(m.sim.weather.kind, 'clear'); assert.equal(m.sim.runs.length, 0); assert.equal(m.sim.pickups.length, 0);
});
