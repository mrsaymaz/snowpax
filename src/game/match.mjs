// Sets up a 3-vs-3 match on an arena: the student plus two bot teammates against three
// rival bots. Every seat names its controller, so a later version can hand any seat to a
// remote player (PeerJS) without touching the simulation.
import { CONFIG } from '../config.js';
import { Grid } from './grid.mjs';
import { Nav } from './nav.mjs';
import { Sim, makeCharacter, SIM } from './sim.mjs';
import { Bot } from './bots.mjs';

export function defaultSeats(myTeam, rivalTeam) {
  return [
    { id: 'p1', team: myTeam, side: 'home', role: 'player', controller: 'local' },
    { id: 'm1', team: myTeam, side: 'home', role: 'mate', controller: 'bot' },
    { id: 'm2', team: myTeam, side: 'home', role: 'mate', controller: 'bot' },
    { id: 'r1', team: rivalTeam, side: 'rival', role: 'rival', controller: 'bot' },
    { id: 'r2', team: rivalTeam, side: 'rival', role: 'rival', controller: 'bot' },
    { id: 'r3', team: rivalTeam, side: 'rival', role: 'rival', controller: 'bot' },
  ];
}

// A rival start point on the street graph, about `dist` units from the base.
function rivalSpawn(arena, nav, base, rng, dist = 48) {
  const options = arena.graph.nodes.map(([x, z], i) => ({ i, x, z, d: Math.hypot(x - base.x, z - base.z) }))
    .filter(n => n.d > dist * 0.8 && n.d < dist * 1.25 && nav.grid.freeCircle(n.x, n.z, SIM.radius));
  const pick = options.length ? options[Math.floor(rng() * options.length)] : { x: base.x + dist, z: base.z };
  return { x: pick.x, z: pick.z };
}

export function createMatch({ arena, myTeam, rivalTeam, pace = 'relaxed', rng = Math.random, seats = null }) {
  const grid = new Grid(arena), nav = new Nav(arena, grid);
  seats = seats || defaultSeats(myTeam, rivalTeam);
  const sim = new Sim({ arena, grid, nav, seats, rng, pace });
  const base = arena.places.find(p => p.kind === 'base');
  const rv = rivalSpawn(arena, nav, base, rng);
  sim.setSpawn('home', base.x, base.z);
  sim.setSpawn('rival', rv.x, rv.z);

  const bots = new Map();
  let player = null;
  seats.forEach((seat, i) => {
    const at = seat.side === 'home' ? base : rv;
    const ang = (i % 3) * 2.1, r = i % 3 === 0 ? 0 : 1.6;
    let x = at.x + Math.sin(ang) * r, z = at.z + Math.cos(ang) * r;
    if (!grid.freeCircle(x, z, SIM.radius)) { x = at.x; z = at.z; }
    const c = sim.add(makeCharacter({ seat: seat.id, team: seat.team, side: seat.side, role: seat.role, x, z }));
    if (seat.role === 'player') player = c;
    if (seat.controller === 'bot') bots.set(seat.id, { seat, c });
  });
  for (const [id, b] of bots) {
    const style = CONFIG.teams[b.seat.team]?.style;
    bots.set(id, new Bot(sim, b.c, { style, leader: b.seat.side === 'home' ? player : null, rng }));
  }

  return {
    sim, grid, nav, bots, player, seats, base, rivalBase: rv,
    // remoteInputs: inputs that arrived from peers (unused in version 1).
    step(dt, localInput = {}, remoteInputs = new Map()) {
      const inputs = new Map();
      for (const s of seats) {
        if (s.controller === 'local') inputs.set(s.id, localInput);
        else if (s.controller === 'remote') inputs.set(s.id, remoteInputs.get(s.id) || {});
        else inputs.set(s.id, bots.get(s.id).think(Math.min(dt, 0.05)));
      }
      sim.step(dt, inputs);
    },
  };
}
