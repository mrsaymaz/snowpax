// Mr. Saymaz's English League (the tally system): a stage won with good English adds Ulti points
// to the student's (grade, team) pool in the League's Battle Arena. The League decides every point
// value, how long points last and the daily limits from game + arena + pace; SnowPax only says which
// win it claims. It never sends a points value and holds no key. Ulti points live only in the League:
// this browser keeps just the League's last reply (settings and pools, to show offline), the start
// tickets of runs in progress and an outbox of wins waiting to be sent.
// An empty ultiApi (public/config.js) switches all of this off: no requests at all.
// (Adapted from Wordramp's league.js; the student picker, step 2, is not here yet.)
export const LEAGUE_GAME = 'snowpax';
export const LEAGUE_URL = 'https://mrsaymaz.netlify.app/api/ulti';
export const LEAGUE_TEAMS = Object.freeze(['gryffindor', 'hufflepuff', 'slytherin', 'ravenclaw']);
export const LEAGUE_GRADES = Object.freeze([5, 6, 7, 8]);
// The only fallback defaults, to draw pools before the League has ever answered. Point values are
// never invented: without the League's settings the panel says so instead of showing numbers.
export const LEAGUE_FALLBACK = Object.freeze({ capacity: 100, maxStrength: 2, hours: 72 });
const STORE = 'snowpax-league.v1', TICKET_MS = 48 * 3600000, OUTBOX_MS = 47 * 3600000;

// config.js may be missing (the League URL) or set ultiApi: '' (fully off)
export function leagueApi(config) { return config && typeof config.ultiApi === 'string' ? config.ultiApi.trim() : LEAGUE_URL; }
export function livePoints(entries, hours, now = Date.now()) {
  const after = now - hours * 3600000;
  return (Array.isArray(entries) ? entries : []).reduce((n, [minute, points]) => (minute * 60000 > after && Number.isFinite(points) ? n + points : n), 0);
}
export function strength(points, capacity, maxStrength) {
  if (!(capacity > 0)) return 1;
  return 1 + (maxStrength - 1) * Math.sqrt(Math.min(Math.max(points, 0), capacity) / capacity);
}
export const strengthLabel = v => '×' + v.toFixed(2);
// SnowPax's League settings, or null while the League has not switched it on
export function gameSettings(settings) {
  const game = settings?.games?.[LEAGUE_GAME];
  return settings && settings.enabled !== false && game && game.enabled !== false ? game : null;
}
export function hoursLabel(hours) { return hours % 24 === 0 ? `${hours / 24} day${hours === 24 ? '' : 's'}` : `${hours} hours`; }
export const gradeOfUnit = id => { const g = Number(/^g(\d+)/.exec(String(id || ''))?.[1]); return LEAGUE_GRADES.includes(g) ? g : 5; };

function randomId(length = 24) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', bytes = new Uint8Array(length);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes); else for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}
export function newRunId() {
  const id = globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return 'run-' + id;
}

export function createLeague({ api = LEAGUE_URL, storage = globalThis.localStorage, fetchImpl = globalThis.fetch?.bind(globalThis), now = () => Date.now(), timeoutMs = 8000 } = {}) {
  const enabled = !!api;
  let memory = {};
  const load = () => { try { const raw = storage?.getItem(STORE); if (raw) { const data = JSON.parse(raw); if (data && typeof data === 'object') return data; } } catch { /* private mode */ } return memory; };
  const save = data => { memory = data; try { storage?.setItem(STORE, JSON.stringify(data)); } catch { /* private mode */ } };
  const state = () => { const s = load(); s.pools ||= {}; s.outbox ||= []; s.tickets ||= {}; return s; };
  function device() {
    const s = state();
    if (typeof s.device !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(s.device)) { s.device = randomId(); save(s); }
    return s.device;
  }
  // ok: 2xx with status 'success'; refused: 4xx or a non-retryable failure; retry: a network error,
  // the timeout, 5xx or retry: true
  async function request(body) {
    if (!enabled || !fetchImpl) return { kind: 'off' };
    const controller = typeof AbortController === 'function' ? new AbortController() : null, timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const res = await fetchImpl(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller?.signal });
      let data = null; try { data = await res.json(); } catch { /* not JSON */ }
      if (res.status >= 500 || data?.retry === true) return { kind: 'retry', status: res.status, data };
      if (res.ok && data?.status === 'success') return { kind: 'ok', data };
      return { kind: 'refused', status: res.status, data };
    } catch { return { kind: 'retry' }; } finally { if (timer) clearTimeout(timer); }
  }
  function remember(data) {
    const s = state();
    if (data?.settings && typeof data.settings === 'object') s.settings = data.settings;
    if (data?.pools && typeof data.pools === 'object') for (const [grade, pool] of Object.entries(data.pools)) s.pools[grade] = { at: now(), pool };
    save(s);
  }
  // the last known settings and this grade's pools, with live totals and strengths
  function snapshot(grade) {
    const s = state(), settings = s.settings || null, base = { ...LEAGUE_FALLBACK, ...(settings || {}) }, pool = s.pools[grade]?.pool || {}, t = now();
    const teams = LEAGUE_TEAMS.map(id => { const points = livePoints(pool[id]?.entries, base.hours, t); return { id, points, players: pool[id]?.players || 0, strength: strength(points, base.capacity, base.maxStrength) }; });
    return { enabled, known: !!settings, settings, game: gameSettings(settings), capacity: base.capacity, maxStrength: base.maxStrength, hours: base.hours, teams, updatedAt: s.pools[grade]?.at || null };
  }
  async function refresh(grade) {
    if (!enabled) return snapshot(grade);
    const reply = await request({ action: 'pools', grade });
    if (reply.kind === 'ok') remember(reply.data);
    return { ...snapshot(grade), online: reply.kind === 'ok' };
  }
  function forgetOld(s) {
    const t = now();
    for (const [runId, entry] of Object.entries(s.tickets)) if (!entry || t - entry.at > TICKET_MS) delete s.tickets[runId];
    s.outbox = s.outbox.filter(item => item && t - item.at <= OUTBOX_MS);
  }
  // a ticket when a stage run begins (kept under its run, so a reloaded game can still claim); null offline
  async function start({ runId, grade, team, arena, pace, unit = '' }) {
    if (!enabled || !runId) return null;
    const existing = state().tickets[runId]; if (existing) return existing.ticket;
    const reply = await request({ action: 'start', game: LEAGUE_GAME, grade, team, arena, pace, unit: String(unit).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24), device: device() });
    if (reply.kind !== 'ok' || typeof reply.data.ticket !== 'string') return null;
    const s = state(); forgetOld(s); s.tickets[runId] = { ticket: reply.data.ticket, at: now(), grade, team }; save(s);
    return reply.data.ticket;
  }
  const ticketFor = runId => state().tickets[runId]?.ticket || null;
  async function send(ticket) {
    const reply = await request({ action: 'claim', ticket, device: device() });
    if (reply.kind === 'ok') {
      remember(reply.data); const d = reply.data;
      return { state: 'counted', points: d.points || 0, requested: d.requested, deviceWins: d.deviceWins, reason: d.reason || null, duplicate: !!d.duplicate, ...(LEAGUE_GRADES.includes(d.grade) ? { grade: d.grade } : {}), ...(LEAGUE_TEAMS.includes(d.team) ? { team: d.team } : {}) };
    }
    if (reply.kind === 'refused') return { state: 'refused', reason: reply.data?.reason || 'refused' };
    return { state: 'retry' };
  }
  // claim only after a win that counts; a network or server failure queues it, a refusal is final
  async function claim(runId) {
    if (!enabled) return { state: 'off' };
    const s = state(), entry = s.tickets[runId];
    if (!entry) return { state: 'no-ticket' };
    delete s.tickets[runId]; save(s);
    const result = await send(entry.ticket);
    if (result.state === 'retry') { const q = state(); q.outbox.push({ ticket: entry.ticket, at: entry.at, grade: entry.grade, team: entry.team }); forgetOld(q); save(q); return { state: 'queued' }; }
    return result;
  }
  // a run that will not be claimed (lost, abandoned): its ticket is dropped
  function forget(runId) { const s = state(); if (s.tickets[runId]) { delete s.tickets[runId]; save(s); } }
  // resend queued wins (on launch and after the next win); items older than 47 hours are dropped
  async function flush() {
    if (!enabled) return [];
    const s = state(); forgetOld(s); save(s); const results = [];
    for (const item of s.outbox.slice()) {
      const result = await send(item.ticket);
      if (result.state !== 'retry') { const q = state(); q.outbox = q.outbox.filter(x => x.ticket !== item.ticket); save(q); }
      results.push({ ...item, ...result });
    }
    return results;
  }
  const outbox = () => state().outbox.slice();
  return { enabled, device, refresh, snapshot, start, ticketFor, claim, forget, flush, outbox };
}

// ---------- which wins SnowPax claims ----------
// A stage won (its outpost held after the Final Showdown) with real English: on Relaxed at least 60%
// of its tasks right first time, on Challenge 2 or more stars (70%+). A run lost to zero lives, an
// abandoned run or one without a team is never claimed.
export const ULTI_MIN_RELAXED = 0.6, ULTI_MIN_STARS = 2;
export function ultiWinStatus({ won, pace, firstTry, total, stars, team }) {
  if (!won || !LEAGUE_TEAMS.includes(team)) return 'none';
  const acc = total ? firstTry / total : 0;
  return (pace === 'challenge' ? stars >= ULTI_MIN_STARS : acc >= ULTI_MIN_RELAXED - 1e-9) ? 'qualified' : 'accuracy';
}
// what the student reads after a claim (plain English for Grades 5–8)
export function ultiMessage(result, grade, teamName) {
  const name = teamName || 'your team';
  if (!result) return null;
  if (result.state === 'counted') {
    if (result.duplicate) return { text: 'This win was already counted in the English League.', good: true };
    if (result.points > 0) return { text: `+${result.points} Ulti for Grade ${grade} ${name}!${result.reason === 'team-limit' ? ` ${name} reached today's team limit, so this win counted ${result.points} of ${result.requested}.` : ''}`, good: true };
    if (result.reason === 'device-limit') return { text: "Today's Ulti wins on this device are used. Tomorrow they count again." };
    if (result.reason === 'team-limit') return { text: `${name} reached today's Ulti limit for Grade ${grade}. Tomorrow wins count again.` };
    if (result.reason === 'off') return { text: 'Ulti points are switched off in the English League right now.' };
    return { text: 'This win added no Ulti points.' };
  }
  if (result.state === 'queued') return { text: "You're offline. This win will be sent to the English League when you're online." };
  if (result.state === 'refused') return { text: result.reason === 'too-fast' ? 'That win was faster than the English League allows, so it did not count.' : result.reason === 'expired' ? 'This stage ticket expired before it could be sent.' : 'The English League did not accept this win.' };
  if (result.state === 'no-ticket') return { text: 'This stage could not reach the English League when it started, so it cannot count.' };
  return null;
}
