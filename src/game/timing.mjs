// How long Arena 1 takes, played through once: the real task steps the outpost would deal (from
// the unit), timed with what a Grade 5 student needs per item, plus the sled ride in and the
// moments between (the camp, the shops, the fights, the results card). The brief asks for 10–12
// minutes.
import { STAGES } from './stages.mjs';
import { Visit, stepItems } from './visit.mjs';
import { FIGHT_PLANS } from './fights.mjs';
import { CONFIG } from '../config.js';

// seconds a student needs per item on the Relaxed pace (reading, thinking, tapping), and the
// feedback moment after each step
export const STUDENT_SECONDS = { choice: 7, listen: 9, spell: 12, order: 12, matchPair: 5, sortCard: 5, feedback: 1.5 };
// fight: the opening fight on a field (about 6 s up to the rival team, about 15 s to beat it);
// longOpen: the opening round of a long fight (freeze the goal's worth of rivals, about 60 s)
// camp: three children's questions with the walks between; build: one shop visit; showdown: the
// Final Showdown, won first time
// scene: one place's cinematic scene on the sled ride in (about 7 s at 60% speed, plus its clear stretch)
export const OVERHEAD = { map: 10, arrive: 3, fight: 21, longOpen: 60, camp: 35, build: 12, walkIn: 3, celebrate: 1.8, showdown: 60, results: 6, scene: 9 };

export const stepTime = (st, S = STUDENT_SECONDS) => (st.kind === 'match' ? S.matchPair * stepItems(st) : st.kind === 'sort' ? S.sortCard * stepItems(st) : S[st.kind] || S.choice) + S.feedback;

function visitTime(v) { let t = 0, items = 0; for (let k = 0; k < 80 && !v.finished; k++) { const st = v.next(); if (!st) break; t += stepTime(st); const n = stepItems(st); items += n; for (let i = 0; i < n; i++) v.answer(true); } return { t, items }; }

export function arenaTime(unit, { rng = Math.random, O = OVERHEAD } = {}) {
  const parts = [];
  for (const st of STAGES) {
    const P = st.fights && FIGHT_PLANS[st.fights];
    const v = st.parts ? new Visit({ unit, family: st.family, rng, families: st.parts.flat(), perFamily: P?.perFamily || CONFIG.demand.itemsPerRound }) : new Visit({ unit, family: st.family, rng });
    // the long fights (fights.mjs): the camp, an opening round, the strike-back between the parts,
    // three shop visits and the Final Showdown
    const fights = !P ? O.fight : O.camp + O.longOpen + P.strike.seconds + O.walkIn + 3 * O.build + O.showdown;
    const tasks = visitTime(v), extra = fights + O.walkIn + 2 * O.celebrate + O.arrive + O.results;
    const ride = st.ride.seconds + (st.parts ? st.parts.flat().length * O.scene : 0); // the ride in, with a scene at each place
    parts.push({ id: st.id, ride, tasks: Math.round(tasks.t), items: tasks.items, extra, total: Math.round(ride + tasks.t + extra) });
  }
  const seconds = O.map + parts.reduce((s, p) => s + p.total, 0);
  return { seconds, minutes: seconds / 60, parts };
}
