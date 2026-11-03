import test from 'node:test';
import assert from 'node:assert/strict';
import { SAVE_KEY, defaultSave, loadSave, writeSave, migrate, exportCode, importCode } from '../src/save.mjs';
import { ensureUnit } from '../src/rules/progress.mjs';
import { makeRng } from '../src/tasks/subtasks.mjs';

const memStore = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m }; };
const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } };

test('the save key is versioned', () => assert.equal(SAVE_KEY, 'snowPax.save.v1'));

test('saves round-trip through storage', () => {
  const store = memStore();
  const s = { ...defaultSave(), team: 'ravenclaw', pace: 'challenge' };
  ensureUnit(s, 'g5u1', makeRng(1));
  assert.equal(writeSave(s, store), true);
  const back = loadSave(store);
  assert.equal(back.team, 'ravenclaw');
  assert.deepEqual(back.units.g5u1.rivals, s.units.g5u1.rivals);
});

test('blocked storage never crashes the game', () => {
  assert.equal(writeSave({ ...defaultSave(), team: 'gryffindor' }, throwing), false);
  assert.equal(loadSave(throwing).v, 1);
});

test('broken save data is kept aside and a fresh save starts', () => {
  const store = memStore();
  store.setItem(SAVE_KEY, '{not json');
  assert.equal(loadSave(store).team, null);
  assert.equal(store.getItem('snowPax.save.broken'), '{not json');
});

test('migration fills new fields, fixes bad values, keeps progress, refuses newer saves', () => {
  const old = { v: 1, team: 'slytherin', units: { g5u1: { rivals: ['a', 'b', 'c'] } }, settings: { sound: false }, pace: 'turbo' };
  const m = migrate(old);
  assert.equal(m.settings.sound, false);
  assert.equal(m.settings.readAloud, true);
  assert.equal(m.pace, 'relaxed');
  assert.deepEqual(m.units.g5u1.rivals, ['a', 'b', 'c']);
  assert.ok(Array.isArray(m.league.outbox));
  assert.equal(migrate({ v: 0, team: 'hufflepuff' }).v, 1, 'unversioned saves upgrade');
  assert.equal(migrate({ v: 2, team: 'hufflepuff' }), null, 'a newer save is never overwritten');
  assert.equal(migrate({ v: 1, team: 'house-elves' }).team, null);
});

test('backup code moves progress to another device', () => {
  const s = { ...defaultSave(), team: 'hufflepuff', cards: ['piyale-pasa'] };
  ensureUnit(s, 'g8u2', makeRng(4));
  s.league.outbox.push({ id: 'claim-1' });
  const code = exportCode(s);
  assert.match(code, /^SNOW1-[A-Za-z0-9_-]+-[0-9a-z]{6}$/);
  const r = importCode('  ' + code.slice(0, 20) + '\n' + code.slice(20) + ' ');
  assert.equal(r.ok, true);
  assert.equal(r.save.team, 'hufflepuff');
  assert.deepEqual(r.save.units.g8u2.rivals, s.units.g8u2.rivals);
  assert.deepEqual(r.save.league.outbox, [], 'pending League claims stay on the first device');
});

test('a damaged or foreign backup code is refused kindly', () => {
  const code = exportCode({ ...defaultSave(), team: 'ravenclaw' });
  assert.equal(importCode(code.slice(0, -8) + 'AAAA' + code.slice(-4)).ok, false);
  assert.equal(importCode('hello').ok, false);
  assert.match(importCode('hello').error, /not a SnowPax backup code/);
});
