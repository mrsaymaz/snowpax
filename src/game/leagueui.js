// The English League on the start screen: each team button shows its team's live Ulti for the
// student's grade (hidden until the League has answered), and the LEAGUE button opens the four team
// pools with their strength in the Battle Arena and the rules, built only from the League's settings.
import { CONFIG } from '../config.js';
import { emblemSVG } from '../emblems.js';
import { strengthLabel, hoursLabel, LEAGUE_TEAMS, ULTI_MIN_RELAXED, ULTI_MIN_STARS } from '../league.mjs';
import { STAGES } from './stages.mjs';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const teamName = id => CONFIG.teams[id]?.name || id;

// the team buttons' little Ulti pills (only once the League has answered at least once)
export function showTeamUlti(snap) {
  for (const b of document.querySelectorAll('.team-btn')) {
    let pill = b.querySelector('.tb-ulti'); if (!pill) { pill = document.createElement('small'); pill.className = 'tb-ulti'; b.appendChild(pill); }
    const t = snap?.enabled && snap.known && snap.updatedAt ? snap.teams.find(x => x.id === b.dataset.team) : null;
    pill.hidden = !t; if (t) pill.innerHTML = `${Math.round(t.points)} <i>ULTI</i>`;
  }
}

// the rules, from the League's own settings only (never invented numbers)
export function rulesHtml(snap) {
  const g = snap.game;
  if (!snap.known) return '<p class="lg-note">Waiting for the English League…</p>';
  if (!g) return '<p class="lg-note">The English League has not switched SnowPax on yet. Your wins will count as soon as it does.</p>';
  const line = pts => STAGES.map((s, i) => Number.isFinite(pts?.[i]) ? `${esc(s.title)} <b>+${pts[i]}</b>` : null).filter(Boolean).join(' · ');
  const out = [];
  if (g.points?.relaxed) out.push(`<p>${line(g.points.relaxed)}.</p>`);
  if (g.points?.challenge) out.push(`<p>On Challenge pace: ${line(g.points.challenge)}.</p>`);
  const small = [];
  if (Number.isFinite(g.deviceDailyWins)) small.push(`Your first ${g.deviceDailyWins} win${g.deviceDailyWins === 1 ? '' : 's'} each day count on this device.`);
  small.push(`Points last ${hoursLabel(snap.hours)}.`);
  small.push(`A win counts when you take the stage with ${Math.round(ULTI_MIN_RELAXED * 100)}% of tasks right first time on Relaxed, or ${ULTI_MIN_STARS} stars on Challenge.`);
  out.push(`<p class="lg-small">${small.join(' ')}</p>`);
  return out.join('');
}

export function leaguePanel({ league, grade, team, onClose }) {
  const el = document.createElement('div'); el.className = 'league-sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', `English League, Grade ${grade}`);
  const draw = (snap, state = '') => {
    const cap = snap.capacity || 100;
    el.innerHTML = `<div class="lg-card">
      <img class="lg-man" src="img/saymaz/cheer.webp" alt="" draggable="false">
      <small class="lg-kicker">English League · Battle Arena</small>
      <h2>Ulti · Grade ${grade}</h2>
      <p class="lg-intro">Stages you win with good English add Ulti points to your grade's team in Mr. Saymaz's English League. Stronger teams hit harder in the Battle Arena.</p>
      <div class="lg-teams">${LEAGUE_TEAMS.map(id => { const t = snap.teams.find(x => x.id === id), me = id === team, w = Math.min(100, (t.points / cap) * 100);
        return `<div class="lg-team${me ? ' me' : ''}" style="--c:${CONFIG.teams[id]?.color || '#888'}">${emblemSVG(id, 30)}<span class="lg-name">${esc(teamName(id))}${me ? ' · YOU' : ''}</span><b class="lg-str">${snap.updatedAt ? strengthLabel(t.strength) : '–'}</b>
          <span class="lg-bar"><i style="width:${snap.updatedAt ? w.toFixed(1) : 0}%"></i></span><span class="lg-pts">${snap.updatedAt ? `${Math.round(t.points)} / ${cap}` : '–'}</span></div>`; }).join('')}</div>
      <div class="lg-rules">${rulesHtml(snap)}</div>
      <p class="lg-live">${state === 'online' ? 'Live from the English League.' : state === 'offline' ? (snap.updatedAt ? 'Offline: the last numbers the League sent.' : "Can't reach the English League right now.") : 'Asking the English League…'}</p>
      <button type="button" class="play-btn lg-close">Back to the snow</button></div>`;
    el.querySelector('.lg-close').onclick = close;
  };
  const close = () => { el.remove(); removeEventListener('keydown', key); onClose?.(); };
  const key = e => { if (e.key === 'Escape') close(); };
  el.addEventListener('click', e => { if (e.target === el) close(); });
  addEventListener('keydown', key);
  document.body.appendChild(el);
  draw(league.snapshot(grade));
  league.refresh(grade).then(s => { if (el.isConnected) draw(s, s.online ? 'online' : 'offline'); }).catch(() => { if (el.isConnected) draw(league.snapshot(grade), 'offline'); });
  el.querySelector('.lg-close')?.focus();
  return { close };
}
