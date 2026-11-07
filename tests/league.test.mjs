// The English League connection, with a mocked endpoint: no real network calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as L from '../src/league.mjs';

const memoryStorage = () => { const data = {}; return { getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data }; };
function endpoint(handler) {
  const calls = [];
  const fetchImpl = async (url, init) => { const body = JSON.parse(init.body); calls.push({ url, body, init }); const r = await handler(body, calls.length, init); if (r instanceof Error) throw r; return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body }; };
  return { calls, fetchImpl };
}
const ok = body => ({ status: 200, body: { status: 'success', ...body } });
const settings = { capacity: 100, maxStrength: 2, hours: 168, teamDailyCap: 60, enabled: true, games: { snowpax: { enabled: true, points: { relaxed: [6, 8, 10], challenge: [9, 11, 13] }, deviceDailyWins: 4, minSeconds: 300 } } };
const minute = t => Math.floor(t / 60000);

test('config: the League URL by default, public/config.js points at it, an empty ultiApi makes no requests at all', async () => {
  assert.equal(L.leagueApi(undefined), L.LEAGUE_URL); assert.equal(L.leagueApi({}), L.LEAGUE_URL); assert.equal(L.leagueApi({ ultiApi: '' }), '');
  const cfg = readFileSync(new URL('../public/config.js', import.meta.url), 'utf8');
  assert.match(cfg, /window\.SNOWPAX_CONFIG\s*=\s*\{\s*ultiApi:\s*'https:\/\/mrsaymaz\.netlify\.app\/api\/ulti'/);
  let called = 0; const off = L.createLeague({ api: '', storage: memoryStorage(), fetchImpl: async () => { called++; throw new Error('no calls'); } });
  assert.equal(off.enabled, false);
  assert.equal(await off.start({ runId: 'r', grade: 5, team: 'ravenclaw', arena: 0, pace: 'relaxed' }), null);
  assert.deepEqual(await off.claim('r'), { state: 'off' }); assert.deepEqual(await off.flush(), []); await off.refresh(5);
  assert.equal(called, 0, 'ultiApi "" makes no calls at all');
});

test('device id: 24 characters, made once and kept', () => {
  const storage = memoryStorage(), e = endpoint(() => ok({}));
  const id = L.createLeague({ storage, fetchImpl: e.fetchImpl }).device();
  assert.match(id, /^[A-Za-z0-9_-]{24}$/); assert.equal(L.createLeague({ storage, fetchImpl: e.fetchImpl }).device(), id);
});

test('start, claim outcomes, the outbox and pools', async () => {
  const storage = memoryStorage(); let t = Date.UTC(2026, 10, 9, 9); const now = () => t;
  let mode = 'ok';
  const e = endpoint(body => {
    if (body.action === 'start') return mode === 'offline' ? new Error('offline') : ok({ ticket: 'T-' + body.arena + '-' + body.pace });
    if (body.action === 'pools') return ok({ settings, pools: { 5: { ravenclaw: { players: 3, entries: [[minute(t - 3600000), 20], [minute(t - 169 * 3600000), 50]] }, gryffindor: { players: 2, entries: [[minute(t - 60000), 130]] } } } });
    if (body.action === 'claim') {
      if (mode === 'offline') return new Error('offline'); if (mode === '5xx') return { status: 503, body: { status: 'error' } }; if (mode === 'retry') return { status: 200, body: { status: 'error', retry: true } };
      if (mode === 'too-fast' || mode === 'expired') return { status: 400, body: { status: 'error', reason: mode } };
      const replies = { ok: { points: 8, requested: 8, deviceWins: 1, grade: 5, team: 'ravenclaw' }, team: { points: 2, requested: 8, deviceWins: 2, reason: 'team-limit' }, device: { points: 0, requested: 8, deviceWins: 4, reason: 'device-limit' }, off: { points: 0, requested: 8, deviceWins: 0, reason: 'off' }, dup: { points: 8, requested: 8, deviceWins: 1, duplicate: true } };
      return ok({ ...replies[mode], settings, pools: {} });
    }
    return { status: 400, body: { status: 'error' } };
  });
  const league = L.createLeague({ storage, fetchImpl: e.fetchImpl, now });
  // start: exactly these fields, the game is 'snowpax', never a points value; one ticket per run
  const ticket = await league.start({ runId: 'run-1', grade: 5, team: 'ravenclaw', arena: 1, pace: 'relaxed', unit: 'g5u1' });
  assert.equal(ticket, 'T-1-relaxed'); assert.equal(league.ticketFor('run-1'), ticket);
  const sent = e.calls.at(-1); assert.equal(sent.url, L.LEAGUE_URL); assert.equal(sent.init.method, 'POST'); assert.equal(sent.init.headers['Content-Type'], 'application/json');
  assert.deepEqual(Object.keys(sent.body).sort(), ['action', 'arena', 'device', 'game', 'grade', 'pace', 'team', 'unit']);
  assert.equal(sent.body.game, 'snowpax'); assert.equal(sent.body.unit, 'g5u1');
  assert.equal(await league.start({ runId: 'run-1', grade: 5, team: 'ravenclaw', arena: 1, pace: 'relaxed' }), ticket, 'a run keeps one ticket');
  assert.equal(e.calls.filter(c => c.body.action === 'start').length, 1);
  // claim outcomes
  const claimWith = async (m, run) => { mode = 'ok'; await league.start({ runId: run, grade: 5, team: 'ravenclaw', arena: 2, pace: 'challenge' }); mode = m; return league.claim(run); };
  let r = await claimWith('ok', 'c-ok'); assert.deepEqual([r.state, r.points, r.reason, r.grade, r.team], ['counted', 8, null, 5, 'ravenclaw']); assert.equal(e.calls.at(-1).body.ticket, 'T-2-challenge');
  r = await claimWith('team', 'c-team'); assert.deepEqual([r.state, r.points, r.requested, r.reason], ['counted', 2, 8, 'team-limit']);
  r = await claimWith('device', 'c-dev'); assert.deepEqual([r.points, r.reason], [0, 'device-limit']);
  r = await claimWith('off', 'c-off'); assert.deepEqual([r.points, r.reason], [0, 'off']);
  r = await claimWith('dup', 'c-dup'); assert.equal(r.duplicate, true);
  r = await claimWith('too-fast', 'c-fast'); assert.deepEqual(r, { state: 'refused', reason: 'too-fast' });
  r = await claimWith('expired', 'c-exp'); assert.deepEqual(r, { state: 'refused', reason: 'expired' });
  assert.equal(league.outbox().length, 0, 'a 400 refusal is final, never queued');
  assert.deepEqual(await league.claim('never-started'), { state: 'no-ticket' });
  assert.deepEqual(await league.claim('c-ok'), { state: 'no-ticket' }, 'a ticket is claimed once');
  assert(!e.calls.some(c => 'points' in c.body), 'the game never sends a points value');
  // outbox: network errors, 5xx and retry:true queue the win; it is resent later
  for (const m of ['offline', '5xx', 'retry']) assert.deepEqual(await claimWith(m, 'q-' + m), { state: 'queued' });
  assert.equal(league.outbox().length, 3);
  mode = 'ok'; const sentBack = await league.flush(); assert.equal(sentBack.length, 3); assert(sentBack.every(x => x.state === 'counted')); assert.equal(league.outbox().length, 0);
  // the 47-hour drop
  await claimWith('offline', 'q-old'); assert.equal(league.outbox().length, 1);
  t += 48 * 3600000; mode = 'ok'; assert.deepEqual(await league.flush(), []); assert.equal(league.outbox().length, 0, 'outbox items older than 47 hours are dropped');
  // a ticket older than 48 h is dropped when the next run starts
  await league.start({ runId: 'old-run', grade: 5, team: 'ravenclaw', arena: 0, pace: 'relaxed' }); t += 49 * 3600000;
  await league.start({ runId: 'new-run', grade: 5, team: 'ravenclaw', arena: 0, pace: 'relaxed' });
  assert.equal(league.ticketFor('old-run'), null); assert.ok(league.ticketFor('new-run'));
  // forget: a run that will not be claimed
  league.forget('new-run'); assert.equal(league.ticketFor('new-run'), null);
  // offline at the start: no ticket (the game asks again at the next checkpoint)
  mode = 'offline'; assert.equal(await league.start({ runId: 'off-run', grade: 5, team: 'ravenclaw', arena: 0, pace: 'relaxed' }), null);
  mode = 'ok'; assert.ok(await league.start({ runId: 'off-run', grade: 5, team: 'ravenclaw', arena: 0, pace: 'relaxed' }));
  // pools: live points within the League's hours, strength, cached for offline
  const snap = await league.refresh(5);
  assert.equal(snap.online, true); assert.equal(snap.known, true); assert.equal(snap.game.deviceDailyWins, 4);
  const rc = snap.teams.find(x => x.id === 'ravenclaw'), gr = snap.teams.find(x => x.id === 'gryffindor');
  assert.equal(rc.points, 20, 'entries older than the League hours are not live'); assert.equal(gr.points, 130);
  assert.ok(Math.abs(rc.strength - (1 + Math.sqrt(0.2))) < 1e-9); assert.equal(gr.strength, 2, 'points past capacity give the full strength');
  const offline = L.createLeague({ storage, fetchImpl: async () => { throw new Error('offline'); }, now });
  const cached = await offline.refresh(5); assert.equal(cached.online, false); assert.equal(cached.known, true); assert.equal(cached.teams.find(x => x.id === 'ravenclaw').points, 20, 'the last reply shows offline');
});

test('requests time out (8 s by default) and are retried later', async () => {
  const league = L.createLeague({ storage: memoryStorage(), timeoutMs: 30, fetchImpl: (url, init) => new Promise((res, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted')))) });
  assert.equal(await league.start({ runId: 'slow', grade: 5, team: 'hufflepuff', arena: 0, pace: 'relaxed' }), null);
});

test('settings: SnowPax switched off or missing in the League shows no numbers; strength and hours labels', () => {
  assert.equal(L.gameSettings(null), null); assert.equal(L.gameSettings({ games: {} }), null);
  assert.equal(L.gameSettings({ enabled: false, games: { snowpax: { points: {} } } }), null);
  assert.equal(L.gameSettings({ games: { snowpax: { enabled: false } } }), null);
  assert.ok(L.gameSettings(settings));
  assert.equal(L.strength(0, 100, 2), 1); assert.equal(L.strength(100, 100, 2), 2); assert.equal(L.strength(50, 0, 2), 1);
  assert.equal(L.hoursLabel(168), '7 days'); assert.equal(L.hoursLabel(24), '1 day'); assert.equal(L.hoursLabel(36), '36 hours');
  assert.equal(L.gradeOfUnit('g7u3'), 7); assert.equal(L.gradeOfUnit('x'), 5);
});

test('the win rule: a stage won with real English; never a lost run or one without a team', () => {
  const W = o => L.ultiWinStatus({ won: true, pace: 'relaxed', firstTry: 9, total: 15, stars: 1, team: 'slytherin', ...o });
  assert.equal(W({}), 'qualified', 'Relaxed: 60% right first time (9 of 15)');
  assert.equal(W({ firstTry: 8 }), 'accuracy', 'Relaxed below 60%');
  assert.equal(W({ pace: 'challenge', stars: 2 }), 'qualified', 'Challenge: 2 stars');
  assert.equal(W({ pace: 'challenge', stars: 1, firstTry: 10 }), 'accuracy', 'Challenge needs the stars, not only 60%');
  assert.equal(W({ won: false }), 'none'); assert.equal(W({ team: null }), 'none'); assert.equal(W({ team: 'wordramp' }), 'none');
});

test('messages: every outcome has a short line, with the grade and team the League credited', () => {
  const m = r => L.ultiMessage(r, 5, 'Slytherin')?.text;
  assert.equal(m({ state: 'counted', points: 8 }), '+8 Ulti for Grade 5 Slytherin!');
  assert.match(m({ state: 'counted', points: 2, requested: 8, reason: 'team-limit' }), /counted 2 of 8/);
  assert.match(m({ state: 'counted', points: 0, reason: 'device-limit' }), /on this device are used/);
  assert.match(m({ state: 'counted', points: 0, reason: 'team-limit' }), /today's Ulti limit/);
  assert.match(m({ state: 'counted', points: 0, reason: 'off' }), /switched off/);
  assert.match(m({ state: 'counted', points: 8, duplicate: true }), /already counted/);
  assert.match(m({ state: 'queued' }), /offline/); assert.match(m({ state: 'refused', reason: 'too-fast' }), /faster than/);
  assert.match(m({ state: 'refused', reason: 'expired' }), /expired/); assert.match(m({ state: 'no-ticket' }), /could not reach/);
});

test('this game only ever sends its own League id', () => {
  assert.equal(L.LEAGUE_GAME, 'snowpax');
  const src = readFileSync(new URL('../src/league.mjs', import.meta.url), 'utf8');
  assert(!/['"]wordramp['"]|['"]solmaxima['"]/.test(src), 'no other game id in the client');
});
