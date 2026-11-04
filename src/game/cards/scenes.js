// Which scene a task step is shown in: a landmark scene where one exists (the task wired into
// that place), otherwise the default card layout for its kind. Add a landmark scene by writing a
// scene function (see basic.js for the contract) and listing it here under its theme.
import { choiceScene, listenScene, matchScene, sortScene, orderScene, spellScene } from './basic.js';
import { castleOrderScene, castleSpellScene } from './castle.js';

export const DEFAULT_SCENES = { choice: choiceScene, listen: listenScene, match: matchScene, sort: sortScene, order: orderScene, spell: spellScene };

// theme (the outpost's card theme) → kind → scene
export const LANDMARK_SCENES = {
  sururi: { order: castleOrderScene, spell: castleSpellScene }, // the Snow Castle: build the wall
};

let basicOnly = false;
export const useBasicScenes = on => { basicOnly = !!on; }; // ?scenes=basic, for comparing

export function sceneFor(kind, theme) {
  return (!basicOnly && LANDMARK_SCENES[theme]?.[kind]) || DEFAULT_SCENES[kind] || null;
}
