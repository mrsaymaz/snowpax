// Sets up a 3-vs-3 match: the student plus two bot teammates against three rival bots.
// Every seat names its controller, so a later version can hand any seat to a remote player
// (PeerJS) without touching the simulation. Each team has one kid of each throwing kit.
import { CONFIG } from '../config.js';
import { Grid } from './grid.mjs';
import { Nav } from './nav.mjs';
import { GridNav } from './gridnav.mjs';
import { Sim, makeCharacter, SIM } from './sim.mjs';
import { Bot, MinionBot } from './bots.mjs';
import { assignLooks } from './looks.mjs';

export function defaultSeats(myTeam, rivalTeam, playerKit = 'thrower', playerLook = null) {
  const mateKits = ['thrower', 'lobber', 'sprayer'].filter(k => k !== playerKit);
  return [
    { id: 'p1', team: myTeam, side: 'home', role: 'player', controller: 'local', kit: playerKit, look: playerLook },
    { id: 'm1', team: myTeam, side: 'home', role: 'mate', controller: 'bot', kit: mateKits[0] },
    { id: 'm2', team: myTeam, side: 'home', role: 'mate', controller: 'bot', kit: mateKits[1] },
    { id: 'r1', team: rivalTeam, side: 'rival', role: 'rival', controller: 'bot', kit: 'thrower' },
    { id: 'r2', team: rivalTeam, side: 'rival', role: 'rival', controller: 'bot', kit: 'lobber' },
    { id: 'r3', team: rivalTeam, side: 'rival', role: 'rival', controller: 'bot', kit: 'sprayer' },
  ];
}

export function createMatch({ arena, myTeam, rivalTeam, pace = 'relaxed', rng = Math.random, seats = null, playerKit = 'thrower', playerLook = null }) {
  const grid = new Grid(arena);
  const nav = arena.kind === 'tiles' ? new GridNav(grid, SIM.radius, arena.sledRuns || []) : new Nav(arena, grid);
  seats = assignLooks(seats || defaultSeats(myTeam, rivalTeam, playerKit, playerLook), rng); // girls and boys on every team
  const sim = new Sim({ arena, grid, nav, seats, rng, pace });
  const base = arena.places.find(p => p.kind === 'base');
  const rv = arena.places.find(p => p.kind === 'rivalBase') || { x: base.x, z: base.z - 20 };
  sim.setSpawn('home', base.x, base.z);
  sim.setSpawn('rival', rv.x, rv.z);

  const bots = new Map();
  let player = null;
  const placed = { home: 0, rival: 0 };
  for (const seat of seats) {
    const at = seat.side === 'home' ? base : rv, n = placed[seat.side]++;
    let x = at.x + (n - 1) * 1.4, z = at.z;
    if (!grid.freeCircle(x, z, SIM.radius)) { x = at.x; z = at.z; }
    const c = sim.add(makeCharacter({ seat: seat.id, team: seat.team, side: seat.side, role: seat.role, kit: seat.kit || 'thrower', look: seat.look || null, x, z }));
    if (seat.role === 'player') player = c;
    if (seat.controller === 'bot') bots.set(seat.id, { seat, c });
  }
  for (const [id, b] of bots) bots.set(id, new Bot(sim, b.c, { style: CONFIG.teams[b.seat.team]?.style, leader: b.seat.side === 'home' ? player : null, rng }));

  return {
    sim, grid, nav, bots, player, seats, base, rivalBase: rv,
    // a rival snowman joins the fight, walking toward `goal` (an outpost)
    addMinion(type, x, z, goal) {
      const c = sim.spawnMinion(type, x, z, rivalTeam);
      const seat = { id: c.seat, team: rivalTeam, side: 'rival', role: 'minion', controller: 'bot' };
      seats.push(seat); bots.set(seat.id, new MinionBot(sim, c, { goal, rng })); return c;
    },
    clearMinions() { for (const c of sim.chars) if (c.role === 'minion') c.gone = true; this.removeGone(); },
    removeGone() { const gone = sim.removeGone(); for (const c of gone) { const i = seats.findIndex(s => s.id === c.seat); if (i >= 0) seats.splice(i, 1); bots.delete(c.seat); } return gone; },
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
