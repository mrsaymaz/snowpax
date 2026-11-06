// Which scene a task step is shown in: a landmark scene where one exists (the task wired into
// that place), otherwise the default card layout for its kind. Add a landmark scene by writing a
// scene function (see basic.js for the contract) and listing it here under its theme.
import { choiceScene, listenScene, matchScene, sortScene, orderScene, spellScene } from './basic.js';
import { castleOrderScene, castleSpellScene } from './castle.js';
import { castleWorldOrder, castleWorldSpell } from './castle3d.js';
import { treehouseChoice, archerySort, fountainMatch, bellListen } from './stations.js';
import { recruitTalk } from './talk.js';
import { karakoyListen, bankalarSort, tersaneOrder, tersaneSpell, aynalikavakChoice, miniaturkMatch } from './golden.js';

export const DEFAULT_SCENES = { choice: choiceScene, listen: listenScene, match: matchScene, sort: sortScene, order: orderScene, spell: spellScene };

// theme (the outpost's card theme) → kind → scene
export const LANDMARK_SCENES = {
  sururi: { order: castleOrderScene, spell: castleSpellScene }, // the Snow Castle: build the wall
};

// task stations (render/worldtask.js): a staged 3D set per outpost for its own task family; the
// flat scene above is the fallback (cocoa questions, other kinds, the card lab, ?scenes=basic)
export const WORLD_SCENES = {
  sururi: { order: castleWorldOrder, spell: castleWorldSpell },
  boulevard: { choice: treehouseChoice },
  archery: { sort: archerySort },
  kizilay: { match: fountainMatch },
  waterfront: { listen: bellListen },
  recruit: { choice: recruitTalk }, // a neighbourhood child asks you face to face (the camp)
  // Arena 2, the Golden Horn (golden.js)
  karakoy: { listen: karakoyListen },
  bankalar: { sort: bankalarSort },
  tersane: { order: tersaneOrder, spell: tersaneSpell },
  aynalikavak: { choice: aynalikavakChoice },
  miniaturk: { match: miniaturkMatch },
};

let basicOnly = false;
export const useBasicScenes = on => { basicOnly = !!on; }; // ?scenes=basic, for comparing

export function sceneFor(kind, theme) {
  return (!basicOnly && LANDMARK_SCENES[theme]?.[kind]) || DEFAULT_SCENES[kind] || null;
}

export const hasWorldTheme = theme => !!WORLD_SCENES[theme];
export function worldSceneFor(kind, theme) { return (!basicOnly && WORLD_SCENES[theme]?.[kind]) || null; }
