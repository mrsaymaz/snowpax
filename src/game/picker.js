// "Who are you?" (English League v11.7.0): with the League on, a student taps their name from the
// League's class list once on this device, so every Ulti win says who earned it. They have already
// chosen a team and a lesson (its grade) on the start screen, so the list is that grade's classes
// and, in a class, only that team's names; a grade with one class goes straight to the names. "Not
// here? Show everyone" opens every grade and team; "Not on the list? Play without a name" plays as
// before and is remembered. A named student's wins go to their own class grade and League team.
// The names come from the League at play time (cached on this device); none are in this code.
import { CONFIG } from '../config.js';
import { validStudentId, LEAGUE_GRADES, LEAGUE_TEAMS } from '../league.mjs';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const teamName = id => CONFIG.teams[id]?.name || '';
const teamColour = id => CONFIG.teams[id]?.color || '#9aa6c4';
// Turkish alphabet order: Ç after C, İ/I, Ö after O, Ş after S, Ü after U
export const collateNames = (a, b) => a.localeCompare(b, 'tr', { sensitivity: 'base' });
export const sortStudents = list => list.slice().sort((a, b) => collateNames(a.name, b.name) || a.id.localeCompare(b.id));

// ask on Play only when the League is on and this device has neither chosen a name nor "Play without a name"
export const needsStudent = ({ enabled, student, skip }) => !!enabled && !validStudentId(student?.id) && !skip;
// the saved form of a chosen roster entry
export const studentRecord = s => ({ id: s.id, name: s.name, className: s.className, team: s.team, grade: Number(s.className.charAt(0)) });
// a saved student, or null when it is missing or damaged
export function savedStudent(value) {
  const s = value && typeof value === 'object' ? value : null;
  if (!s || !validStudentId(s.id) || typeof s.name !== 'string' || !s.name.trim() || !/^[5-8]-[A-Z]$/.test(s.className) || !LEAGUE_TEAMS.includes(s.team)) return null;
  return studentRecord(s);
}
// the students listed: the chosen team only, unless "everyone" is on
export const teammates = (students = [], team = '', all = false) => students.filter(p => all || !team || p.team === team);
// the classes worth a button: those with at least one listed student
export function pickerClasses(classes = [], students = [], team = '', all = false) {
  const listed = new Set(teammates(students, team, all).map(p => p.className));
  return classes.filter(c => listed.has(c));
}
// which screen the picker shows; p: { grade, team, all, className, studentId, roster, loading, offline }
export function pickerStep(p) {
  const students = p.roster?.students || [], chosen = p.studentId && students.find(s => s.id === p.studentId);
  if (chosen) return { step: 'confirm', student: chosen };
  if (p.className) return { step: 'names', className: p.className, auto: !!p.auto };
  if (!students.length) return { step: p.loading ? 'loading' : p.offline ? 'offline' : 'empty' };
  const classes = pickerClasses(p.roster.classes, students, p.team, p.all);
  if (!classes.length) return { step: p.loading ? 'loading' : 'empty' };
  if (!p.all && classes.length === 1) return { step: 'names', className: classes[0], auto: true }; // a one-class grade: the names straight away
  return { step: 'classes', classes };
}

const links = all => `<div class="wp-links">${all ? '' : '<button type="button" class="wp-link" data-wp="all">Not here? Show everyone</button>'}<button type="button" class="wp-link" data-wp="skip">Not on the list? Play without a name</button></div>`;
// one step of the picker
export function pickerMarkup(p) {
  const view = pickerStep(p), team = teamName(p.team), grade = p.grade;
  const man = pose => `<img class="wp-man" src="img/saymaz/${pose}.webp" alt="" draggable="false">`;
  const head = (kicker, pose = 'point') => `<div class="wp-head">${pose ? man(pose) : ''}<div><small class="wp-kicker">${kicker}</small><h2 id="wp-title">Who are you?</h2></div><button type="button" class="wp-x" data-wp="close" aria-label="Close">✕</button></div>`;
  const kicker = p.all ? 'English League · everyone' : `English League · Grade ${esc(grade)}${team ? ' ' + esc(team) : ''}`;
  if (view.step === 'confirm') {
    const s = view.student, name = teamName(s.team), g = s.className.charAt(0);
    return `${head('English League', 'smile')}<p class="wp-ask">Are you ${esc(s.name)}?</p><div class="wp-card" style="--team:${teamColour(s.team)}"><b>${esc(s.name)}</b><span>${esc(s.className)} · Team ${esc(name)}</span><small>Your wins add Ulti to Grade ${esc(g)} ${esc(name)}.</small></div>
      <div class="wp-actions"><button type="button" class="menu-btn" data-wp="back-names">No, go back</button><button type="button" class="play-btn" data-wp="confirm">Yes, that's me!</button></div>`;
  }
  if (view.step === 'names') {
    const list = sortStudents(teammates(p.roster?.students || [], p.team, p.all).filter(s => s.className === view.className));
    const hello = p.all || !team ? `Hello, ${esc(view.className)}!` : `Hello, ${esc(view.className)} ${esc(team)}!`;
    const back = view.auto ? '' : '<button type="button" class="menu-btn wp-back" data-wp="back">◀ Classes</button>';
    return `${head(kicker, null)}<p class="wp-ask">${hello} Tap your name.</p><div class="wp-names">${list.map(s => `<button type="button" class="wp-name" data-wp="pick" data-value="${esc(s.id)}" style="--team:${teamColour(s.team)}"><i aria-hidden="true"></i><span>${esc(s.name)}</span></button>`).join('') || '<p class="wp-note">No names in this class yet.</p>'}</div>${back}${links(p.all)}`;
  }
  const tabs = p.all ? `<div class="wp-grades" role="group" aria-label="Grade">${LEAGUE_GRADES.map(g => `<button type="button" data-wp="grade" data-value="${g}" aria-pressed="${g === grade}">Grade ${g}</button>`).join('')}</div>` : '';
  if (view.step === 'classes') {
    const q = p.all || !team ? 'Which class are you in?' : `Grade ${esc(grade)} ${esc(team)}! Which class are you in?`;
    return `${head(kicker, p.all ? null : 'point')}<p class="wp-ask">${q}</p>${tabs}<div class="wp-classes">${view.classes.map(c => `<button type="button" class="wp-class" data-wp="class" data-value="${esc(c)}">${esc(c)}</button>`).join('')}</div>${links(p.all)}`;
  }
  const note = view.step === 'loading' ? '<p class="wp-note" role="status">Loading the class list…</p>'
    : view.step === 'offline' ? `<p class="wp-note" role="status">The class list can't be loaded right now.</p><button type="button" class="menu-btn wp-retry" data-wp="retry">Try again</button>`
    : `<p class="wp-note">No names are on the list for Grade ${esc(grade)}${p.all || !team ? '' : ' ' + esc(team)} yet.</p>`;
  return `${head(kicker, p.all ? null : 'think')}<p class="wp-ask">Find your name to collect Ulti for your team.</p>${tabs}${note}${links(p.all)}`;
}
// the pill on the start screen: who is playing, and a way to change (shared tablets)
export function studentPillMarkup(student) {
  if (!student) return '<span class="wp-pill-name">Who are you?</span><small>Choose</small>';
  return `<i class="wp-dot" style="--team:${teamColour(student.team)}" aria-hidden="true"></i><span class="wp-pill-name"><em>Playing as </em><b>${esc(student.name)}</b> · ${esc(student.className)}</span><small>Change</small>`;
}
export const studentPillLabel = s => (s ? `Playing as ${s.name}, ${s.className}. Change` : 'Who are you? Choose your name');

// the sheet itself: opens at once with the cached list, refreshes it in the background, never waits
// on the League. done(result): { student } when chosen, { skip: true } for "Play without a name",
// null when closed (× or Escape: Play asks again next time)
export function openPicker({ league, grade, team, sound = () => {}, done }) {
  const el = document.createElement('div'); el.className = 'who-sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'wp-title');
  el.innerHTML = '<div class="wp-card-wrap"></div>'; document.body.appendChild(el);
  const box = el.firstChild, p = { grade, team, all: false, className: null, studentId: null, auto: false, roster: null, loading: true, offline: false };
  const draw = () => { box.innerHTML = pickerMarkup(p); box.querySelector('[data-wp="confirm"], .wp-name, .wp-class, .wp-x')?.focus({ preventScroll: true }); };
  const load = () => {
    const g = p.grade; p.roster = league.cachedRoster(g); p.loading = true; p.offline = false; draw();
    league.roster(g).catch(() => null).then(fresh => {
      if (!el.isConnected || p.grade !== g) return;
      p.loading = false; if (fresh?.online) p.roster = fresh; p.offline = !fresh?.online && !p.roster?.students?.length; draw();
    });
  };
  const finish = result => { el.remove(); removeEventListener('keydown', key); done?.(result); };
  const key = e => { if (e.key === 'Escape') { e.preventDefault(); finish(null); } };
  addEventListener('keydown', key);
  el.addEventListener('click', e => {
    if (e.target === el) return finish(null);
    const b = e.target.closest('[data-wp]'); if (!b) return; const a = b.dataset.wp, v = b.dataset.value; sound('tap');
    if (a === 'close') return finish(null);
    if (a === 'skip') return finish({ skip: true });
    if (a === 'confirm') { const s = p.roster?.students?.find(x => x.id === p.studentId); if (s) finish({ student: studentRecord(s) }); return; }
    if (a === 'retry') return load();
    if (a === 'grade') { const g = Number(v); if (g === p.grade || !LEAGUE_GRADES.includes(g)) return; Object.assign(p, { grade: g, className: null, studentId: null }); return load(); }
    if (a === 'all') Object.assign(p, { all: true, className: null, studentId: null, auto: false });
    else if (a === 'class') Object.assign(p, { className: v, auto: false });
    else if (a === 'pick') p.studentId = v;
    else if (a === 'back') Object.assign(p, { className: null, studentId: null });
    else if (a === 'back-names') p.studentId = null;
    draw();
  });
  load();
  return { close: () => finish(null) };
}
