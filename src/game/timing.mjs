// How long Arena 1 takes, played through once: the real task steps each stage would deal (from
// the unit), timed with what a Grade 5 student needs per item, plus the sled rides and the moments
// between (arriving, the final wave, the results card). The brief asks for 10–12 minutes.
import { STAGES } from './stages.mjs';
import { BANNERS } from './waves.mjs';
import { Visit, stepItems } from './visit.mjs';
import { FIGHT_PLANS } from './fights.mjs';
import { CONFIG } from '../config.js';

// seconds a student needs per item on the Relaxed pace (reading, thinking, tapping), and the
// feedback moment after each step
export const STUDENT_SECONDS = { choice: 7, listen: 9, spell: 12, order: 12, matchPair: 5, sortCard: 5, feedback: 1.5 };
// fight: the opening fight on a field (about 6 s up to the rival team, about 15 s to beat it);
// longOpen: the opening round of a long fight (freeze the goal's worth of rivals, about 60 s)
export const OVERHEAD = { map: 10, arrive: 3, fight: 21, longOpen: 60, walkIn: 3, celebrate: 1.8, finalWave: 8, results: 6, giantSnowball: 5, bell: 3, arenaResults: 8 };

export const stepTime = (st, S = STUDENT_SECONDS) => (st.kind === 'match' ? S.matchPair * stepItems(st) : st.kind === 'sort' ? S.sortCard * stepItems(st) : S[st.kind] || S.choice) + S.feedback;

function visitTime(v) { let t = 0, items = 0; for (let k = 0; k < 80 && !v.finished; k++) { const st = v.next(); if (!st) break; t += stepTime(st); const n = stepItems(st); items += n; for (let i = 0; i < n; i++) v.answer(true); } return { t, items }; }

export function arenaTime(unit, { rng = Math.random, O = OVERHEAD } = {}) {
  const parts = [];
  for (const st of STAGES) {
    const v = st.final
      ? new Visit({ unit, family: 'mixed', rng, families: BANNERS.map(b => b.family), perFamily: 2 })
      : st.halves ? new Visit({ unit, family: st.family, rng, families: st.halves, perFamily: CONFIG.demand.itemsPerRound })
      : new Visit({ unit, family: st.family, rng });
    // the long fights (fights.mjs): an opening round, the strike-back between the halves and a longer final wave
    const P = st.fights && FIGHT_PLANS[st.fights], fights = P ? O.longOpen + P.strike.seconds + O.walkIn + P.final - O.finalWave : O.fight;
    const tasks = visitTime(v), extra = fights + O.walkIn + O.celebrate + (st.final ? O.arrive + O.giantSnowball + O.bell + O.arenaResults : O.arrive + O.finalWave + O.results);
    parts.push({ id: st.id, ride: st.ride.seconds, tasks: Math.round(tasks.t), items: tasks.items, extra, total: Math.round(st.ride.seconds + tasks.t + extra) });
  }
  const seconds = O.map + parts.reduce((s, p) => s + p.total, 0);
  return { seconds, minutes: seconds / 60, parts };
}
