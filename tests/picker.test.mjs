// "Who are you?" (English League v11.7.0): the roster request, its checks and cache, the student
// field on start, the credited grade and team in the win line, and the picker's steps. Every name
// here is made up; the real class lists come from the League at play time.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../src/league.mjs';
import * as P from '../src/game/picker.js';

const memoryStorage = () => { const data = {}; return { getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data }; };
function endpoint(handler) {
  const calls = [];
  const fetchImpl = async (url, init) => { const body = JSON.parse(init.body); calls.push(body); const r = await handler(body); if (r instanceof Error) throw r; return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body }; };
  return { calls, fetchImpl };
}
const ok = body => ({ status: 200, body: { status: 'success', ...body } });
const ROSTER = { rosterVersion: 1, grade: 5, classes: ['5-A', '5-C'], students: [
  { id: '5-A:slytherin:0', name: 'Zehra', className: '5-A', team: 'slytherin' },
  { id: '5-A:slytherin:1', name: 'Çınar', className: '5-A', team: 'slytherin' },
  { id: '5-A:slytherin:2', name: 'Cem', className: '5-A', team: 'slytherin' },
  { id: '5-A:slytherin:3', name: 'Ömür', className: '5-A', team: 'slytherin' },
  { id: '5-A:slytherin:4', name: 'Ilgın', className: '5-A', team: 'slytherin' },
  { id: '5-A:slytherin:5', name: 'İpek', className: '5-A', team: 'slytherin' },
  { id: '5-A:slytherin:6', name: 'Şule', className: '5-A', team: 'slytherin' },
  { id: '5-A:slytherin:7', name: 'Selin', className: '5-A', team: 'slytherin' },
  { id: '5-C:slytherin:0', name: 'Ufuk', className: '5-C', team: 'slytherin' },
  { id: '5-A:ravenclaw:0', name: 'Arda', className: '5-A', team: 'ravenclaw' },
  { id: '5-C:hufflepuff:0', name: '<b>Ece</b>', className: '5-C', team: 'hufflepuff' },
  // dropped: a bad id, a bad class, another grade, a bad team, an empty name, a duplicate id
  { id: 'bad id!', name: 'X', className: '5-A', team: 'slytherin' },
  { id: '5-Z:slytherin:9', name: 'X', className: '5a', team: 'slytherin' },
  { id: '6-C:slytherin:0', name: 'X', className: '6-C', team: 'slytherin' },
  { id: '5-A:wizards:0', name: 'X', className: '5-A', team: 'wizards' },
  { id: '5-A:slytherin:8', name: '  ', className: '5-A', team: 'slytherin' },
  { id: '5-A:slytherin:0', name: 'Twice', className: '5-A', team: 'slytherin' },
] };

test('roster: a public request (only the action and grade), checked, cached per grade, offline from the cache', async () => {
  const storage = memoryStorage(); let online = true;
  const e = endpoint(b => !online ? new Error('offline') : b.action === 'roster' ? (b.grade === 5 ? ok(ROSTER) : b.grade === 6 ? ok({ grade: 6, classes: ['6-C'], students: [{ id: '6-C:slytherin:0', name: 'Deniz', className: '6-C', team: 'slytherin' }] }) : { status: 400, body: { status: 'error' } }) : ok({}));
  const league = L.createLeague({ storage, fetchImpl: e.fetchImpl });
  const r5 = await league.roster(5);
  assert.deepEqual(e.calls[0], { action: 'roster', grade: 5 }, 'only the action and grade: no key, PIN or device');
  assert.equal(r5.online, true); assert.deepEqual(r5.classes, ['5-A', '5-C']);
  assert.equal(r5.students.length, 11, 'bad ids, classes, teams, other grades, empty names and duplicates are dropped');
  assert(r5.students.every(s => Object.keys(s).sort().join() === 'className,id,name,team'), 'only the four roster fields are kept');
  assert.equal(r5.students.find(s => s.id === '5-A:slytherin:0').name, 'Zehra', 'the first entry for an id wins');
  assert.equal(await league.roster(9), null, 'grades are 5–8 only'); assert.equal(await league.roster('x'), null);
  assert.equal(await league.roster(7), null, '{status:"error"} with nothing cached gives null');
  await league.roster(6);
  online = false;
  const again = L.createLeague({ storage, fetchImpl: e.fetchImpl });
  assert.equal(again.cachedRoster(5).students.length, 11); assert.equal(again.cachedRoster(5).online, false);
  const off5 = await again.roster(5); assert.equal(off5.online, false); assert.deepEqual(off5.classes, ['5-A', '5-C']);
  assert.equal((await again.roster(6)).students[0].name, 'Deniz', 'each grade has its own cache');
  assert.equal(await again.roster(8), null, 'offline and never cached: null (the picker says the list cannot load)');
  const off = L.createLeague({ api: '', storage: memoryStorage(), fetchImpl: async () => { throw new Error('no calls'); } });
  assert.equal(await off.roster(5), null, 'with the League off there is no roster request');
});

test('start: the student field only when it is a valid Student ID; the claim reply names the credited grade and team', async () => {
  const e = endpoint(b => b.action === 'start' ? ok({ ticket: 'T' + e.calls.length }) : ok({ points: 8, requested: 8, deviceWins: 1, grade: 6, team: 'gryffindor', student: { id: '6-C:gryffindor:2', name: 'Deniz', className: '6-C' } }));
  const league = L.createLeague({ storage: memoryStorage(), fetchImpl: e.fetchImpl });
  await league.start({ runId: 'a', grade: 5, team: 'slytherin', arena: 0, pace: 'relaxed', unit: 'g5u1', student: '5-A:slytherin:0' });
  assert.equal(e.calls.at(-1).student, '5-A:slytherin:0'); assert.equal(e.calls.at(-1).game, 'snowpax');
  await league.start({ runId: 'b', grade: 5, team: 'slytherin', arena: 0, pace: 'relaxed', student: 'not valid!' });
  assert(!('student' in e.calls.at(-1)), 'an invalid id is never sent');
  await league.start({ runId: 'c', grade: 5, team: 'slytherin', arena: 0, pace: 'relaxed' });
  assert.deepEqual(Object.keys(e.calls.at(-1)).sort(), ['action', 'arena', 'device', 'game', 'grade', 'pace', 'team', 'unit'], 'without a student the start is exactly as before');
  const r = await league.claim('a');
  assert.deepEqual([r.grade, r.team], [6, 'gryffindor']);
  assert.equal(L.ultiMessage(r, r.grade ?? 5, 'Gryffindor').text, '+8 Ulti for Grade 6 Gryffindor!', 'the win line uses the grade and team the League credited');
});

test('the picker asks once, only with the League on; the saved student is checked', () => {
  const zehra = P.studentRecord(ROSTER.students[0]);
  assert.deepEqual(zehra, { id: '5-A:slytherin:0', name: 'Zehra', className: '5-A', team: 'slytherin', grade: 5 });
  assert.equal(P.needsStudent({ enabled: false }), false, 'ultiApi "": no picker at all');
  assert.equal(P.needsStudent({ enabled: true }), true);
  assert.equal(P.needsStudent({ enabled: true, student: zehra }), false);
  assert.equal(P.needsStudent({ enabled: true, skip: true }), false, '"Play without a name" is remembered');
  assert.deepEqual(P.savedStudent(zehra), zehra);
  for (const bad of [null, 'x', { ...zehra, id: 'bad id!' }, { ...zehra, className: '9-A' }, { ...zehra, team: 'wizards' }, { ...zehra, name: ' ' }]) assert.equal(P.savedStudent(bad), null);
});

test('the steps: the team only, a one-class team goes straight to the names, everyone, Turkish order, escaping', () => {
  const roster = L.cleanRoster(ROSTER, 5), base = { grade: 5, team: 'slytherin', all: false, className: null, studentId: null, roster, loading: false, offline: false };
  // Slytherin has names in 5-A and 5-C: the class step
  assert.deepEqual(P.pickerStep(base), { step: 'classes', classes: ['5-A', '5-C'] });
  // Ravenclaw only in 5-A: the names straight away (like the one-class grades 6-C, 7-A, 8-B)
  assert.deepEqual(P.pickerStep({ ...base, team: 'ravenclaw' }), { step: 'names', className: '5-A', auto: true });
  // a class shows only the chosen team's names, in Turkish order (C, Ç, I, İ, O, Ö, S, Ş, Z)
  const names = P.sortStudents(P.teammates(roster.students, 'slytherin').filter(s => s.className === '5-A')).map(s => s.name);
  assert.deepEqual(names, ['Cem', 'Çınar', 'Ilgın', 'İpek', 'Ömür', 'Selin', 'Şule', 'Zehra']);
  assert(!P.teammates(roster.students, 'slytherin').some(s => s.team !== 'slytherin'));
  // "Show everyone": every team, and the class step with grade tabs
  assert.equal(P.teammates(roster.students, 'slytherin', true).length, 11);
  const all = P.pickerMarkup({ ...base, all: true });
  assert.match(all, /data-wp="grade" data-value="8"/); assert(!/Show everyone/.test(all), 'no "Show everyone" link once everyone is shown');
  assert.match(P.pickerMarkup(base), /Not on the list\? Play without a name/);
  // the confirmation card
  const c = P.pickerMarkup({ ...base, studentId: '5-A:slytherin:1' });
  assert.match(c, /Are you Çınar\?/); assert.match(c, /Your wins add Ulti to Grade 5 Slytherin\./); assert.match(c, /No, go back/); assert.match(c, /Yes, that's me!/);
  // names are text: escaped everywhere
  const h = P.pickerMarkup({ ...base, team: 'hufflepuff', className: '5-C' });
  assert(h.includes('&lt;b&gt;Ece&lt;/b&gt;') && !h.includes('<b>Ece</b>'), 'a name is never HTML');
  assert(P.studentPillMarkup({ name: '<i>x</i>', className: '5-A', team: 'slytherin' }).includes('&lt;i&gt;x&lt;/i&gt;'));
  // loading, offline and empty
  assert.equal(P.pickerStep({ ...base, roster: null, loading: true }).step, 'loading');
  assert.match(P.pickerMarkup({ ...base, roster: null, offline: true }), /The class list can't be loaded right now\.[\s\S]*Try again/);
  assert.equal(P.pickerStep({ ...base, team: 'gryffindor' }).step, 'empty');
  // the pill
  assert.match(P.studentPillMarkup(null), /Who are you\?.*Choose/);
  assert.match(P.studentPillMarkup(P.studentRecord(ROSTER.students[0])), /Playing as .*Zehra.*5-A.*Change/);
});
