import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sceneFor, worldSceneFor, DEFAULT_SCENES, LANDMARK_SCENES, useBasicScenes } from '../src/game/cards/scenes.js';
import { castleWorldOrder, castleWorldSpell } from '../src/game/cards/castle3d.js';
import { castleOrderScene, castleSpellScene } from '../src/game/cards/castle.js';
import { blockOrder } from '../src/game/cards/util.js';
import { makeRound, makeRng, FAMILIES } from '../src/tasks/subtasks.mjs';
import { flatten } from '../src/game/visit.mjs';

const units = JSON.parse(readFileSync(new URL('../content/grade5.json', import.meta.url), 'utf8')).units;

test('every step kind Arena 1 deals has a scene, at every landmark', () => {
  const kinds = new Set();
  for (const unit of units) for (const f of FAMILIES) for (let s = 1; s <= 3; s++) { const r = makeRound(unit, f.id, 1, { rng: makeRng(s), speech: true }); if (r) for (const st of flatten(r.steps)) kinds.add(st.kind); }
  for (const k of kinds) for (const theme of ['boulevard', 'archery', 'kizilay', 'sururi', 'waterfront', 'schoolyard', 'cocoa']) assert.ok(sceneFor(k, theme), `${k} at ${theme}`);
});

test('the Snow Castle builds Builder tasks; ?scenes=basic brings the plain cards back', () => {
  assert.equal(sceneFor('order', 'sururi'), castleOrderScene); assert.equal(sceneFor('spell', 'sururi'), castleSpellScene);
  assert.equal(sceneFor('order', 'boulevard'), DEFAULT_SCENES.order); assert.equal(sceneFor('choice', 'sururi'), DEFAULT_SCENES.choice);
  useBasicScenes(true); assert.equal(sceneFor('order', 'sururi'), DEFAULT_SCENES.order); useBasicScenes(false);
  for (const [theme, m] of Object.entries(LANDMARK_SCENES)) for (const [kind, fn] of Object.entries(m)) assert.equal(typeof fn, 'function', `${theme}.${kind}`);
});

test('sentence blocks come back in sentence order', () => {
  for (const unit of units.slice(0, 12)) {
    const r = makeRound(unit, 'build', 1, { rng: makeRng(4) }); if (!r) continue;
    for (const st of flatten(r.steps).filter(s => s.kind === 'order')) assert.equal(blockOrder(st.blocks).map(b => b.text).join(' ').replace(/\s+/g, ' ').trim().toLowerCase(), st.text.replace(/\s+/g, ' ').trim().toLowerCase());
  }
});

test('every outpost plays its own task family as a 3D station; other kinds fall back to cards', async () => {
  const st = await import('../src/game/cards/stations.js');
  assert.equal(worldSceneFor('order', 'sururi'), castleWorldOrder); assert.equal(worldSceneFor('spell', 'sururi'), castleWorldSpell);
  assert.equal(worldSceneFor('choice', 'boulevard'), st.treehouseChoice); assert.equal(worldSceneFor('sort', 'archery'), st.archerySort);
  assert.equal(worldSceneFor('match', 'kizilay'), st.fountainMatch); assert.equal(worldSceneFor('listen', 'waterfront'), st.bellListen);
  assert.equal(worldSceneFor('choice', 'sururi'), null); assert.equal(worldSceneFor('order', 'boulevard'), null); assert.equal(worldSceneFor('choice', 'cocoa'), null);
  useBasicScenes(true); assert.equal(worldSceneFor('order', 'sururi'), null); useBasicScenes(false);
});
