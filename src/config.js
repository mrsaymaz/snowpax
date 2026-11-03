// SnowPax: every setting lives here. Change a value, run `npm run build`, redeploy.
// Plain data only (no imports), so tools and tests can read it too.

export const CONFIG = {
  game: {
    title: 'SnowPax',
    id: 'snowpax',                 // also the English League game ID
    saveKey: 'snowPax.save',       // a version suffix is added by src/save.mjs (e.g. snowPax.save.v1)
  },

  // Optional class access code. '' = off (anyone can play). If set, the game asks once per device.
  accessCode: '',

  // English League (Ulti points). '' = off. Set to the League's Ulti endpoint to switch on.
  league: {
    endpoint: '',
    minAccuracy: 0.8,
    pointsPerArena: [1, 2, 3],
  },

  // Four teams. Emblems are our own simple element symbols (never the film crests).
  teams: {
    hufflepuff: { name: 'Hufflepuff', element: 'air',    emblem: 'swirl', color: '#f5b616', dark: '#8a5a00', style: 'flanker' },
    gryffindor: { name: 'Gryffindor', element: 'fire',   emblem: 'flame', color: '#e5383b', dark: '#7a1416', style: 'rusher'  },
    ravenclaw:  { name: 'Ravenclaw',  element: 'water',  emblem: 'wave',  color: '#2f8fe8', dark: '#0f3f7a', style: 'sniper'  },
    slytherin:  { name: 'Slytherin',  element: 'nature', emblem: 'leaf',  color: '#23a55a', dark: '#0c5a2c', style: 'builder' },
  },

  // Bot play styles (rivals and teammates). Numbers are multipliers on the base bot.
  styles: {
    flanker: { speed: 1.25, range: 0.9, throwRate: 1.0, wallChance: 0.0, flank: 0.8 },
    rusher:  { speed: 1.1,  range: 0.85, throwRate: 1.35, wallChance: 0.0, flank: 0.1 },
    sniper:  { speed: 0.95, range: 1.4, throwRate: 0.85, wallChance: 0.1, flank: 0.2, highGround: true },
    builder: { speed: 0.9,  range: 1.0, throwRate: 0.9, wallChance: 0.6, flank: 0.0 },
  },

  arenas: [
    { id: 'home-turf',   name: 'Home Turf',   area: 'Kaptanpaşa and Kasımpaşa', finale: 'Schoolyard Showdown',
      // Team base and final battle. Shown only as "Our School" (confirmed by Mr. Saymaz, OSM point).
      base: { label: 'Our School', lat: 41.0395384, lng: 28.9648511 } },
    { id: 'golden-horn', name: 'The Golden Horn', area: 'Hasköy and Sütlüce',   finale: 'The Giants of Miniatürk' },
    { id: 'big-city',    name: 'The Big City', area: 'Pera, Taksim and Galata', finale: 'Battle for Galata Tower' },
  ],

  // Task demand per arena (index 0 = Arena 1). A round is a set of 3 items.
  demand: {
    itemsPerRound: 3,
    seizeRounds: [2, 3, 4],
    defendRounds: [1, 1, 1],
    defendSpeed: [1, 1, 1.25],
    sentenceBlocks: [[3, 3], [4, 4], [5, 6]], // min/max blocks for the Builder outpost
    spellFirstLetter: [true, true, false],
    sortCategories: [2, 3, 3],
    unlockAccuracy: 0.8,                   // first-try accuracy needed to unlock the next arena
  },

  // Sled runs.
  sled: {
    wordLength: [[3, 5], [5, 7], [6, 9]],
    lanes: [2, 3, 3],
    rowEverySeconds: [2.5, 2.5, 2.0],
    firstLetterGiven: [true, true, false],
  },

  // Pace: Relaxed or Challenge.
  pace: {
    relaxed:   { taskTime: 1.5, autoAim: 0.9, rivalSpeed: 0.8, rivalThrowRate: 0.7, tapToMove: true },
    challenge: { taskTime: 1.0, autoAim: 0.6, rivalSpeed: 1.0, rivalThrowRate: 1.0, tapToMove: false },
  },

  // Timing targets in seconds (the time simulation checks the total lands in 10–12 minutes).
  timing: {
    briefing: 20,
    reach: 30,
    seizePerItem: 8,
    defendWave: 20,
    finalBattle: 150,
    victory: 30,
    frozenSeconds: 3,
    meaningRevealSeconds: 2,
  },

  // Snowball fight numbers.
  fight: {
    warmth: 100,
    hitWarmth: 25,
    bigHitWarmth: 50,
    ammoMax: 8,
    throwRange: 9,
    bigChargeSeconds: 0.8,
  },

  // Text budget for the task card at the smallest screen (640 × 360).
  // The card covers about half the screen; at 16 px roughly this many characters fit per line.
  layout: {
    minFontPx: 16,
    minTargetPx: 44,
    card: { charsPerLine: 34, promptLines: 6, optionLines: 2 },
    matchTile: { charsPerLine: 15, lines: 3 },       // short side (words, numerals)
    matchTileWide: { charsPerLine: 20, lines: 4 },   // long side (definitions, answers, endings)
    block: { charsPerLine: 15, lines: 2 },           // a sentence block tile
  },

  // Words that sound the same are never offered together in listening tasks.
  homophones: [
    ['sea', 'see'], ['son', 'sun'], ['pair', 'pear'], ['four', 'for'], ['two', 'too', 'to'],
    ['right', 'write'], ['meet', 'meat'], ['hear', 'here'], ['know', 'no'], ['one', 'won'],
    ['flower', 'flour'], ['week', 'weak'], ['road', 'rode'], ['buy', 'by', 'bye'], ['eye', 'I'],
    ['their', 'there'], ['wear', 'where'], ['hole', 'whole'], ['mail', 'male'], ['plane', 'plain'],
    ['tail', 'tale'], ['night', 'knight'], ['blue', 'blew'], ['eight', 'ate'], ['piece', 'peace'],
  ],
};

export const TEAM_IDS = Object.keys(CONFIG.teams);
