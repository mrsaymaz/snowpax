// Saves in localStorage under a versioned key, with migration and an export/import backup code.
// Every storage access is wrapped: private windows, blocked storage or full quotas never crash
// the game (it keeps playing from memory).
import { CONFIG, TEAM_IDS } from './config.js';

export const SAVE_VERSION = 1;
export const SAVE_KEY = `${CONFIG.game.saveKey}.v${SAVE_VERSION}`;
const BROKEN_KEY = `${CONFIG.game.saveKey}.broken`;

export function defaultSave(now = Date.now()) {
  return {
    v: SAVE_VERSION,
    created: now,
    updated: now,
    team: null,               // chosen on first launch
    pace: 'relaxed',
    welcomed: false,
    tutorialDone: false,
    settings: { readAloud: true, sound: true, music: true, quality: 'auto' },
    coachSeen: {},            // sub-task id → true after its first instructions
    units: {},                // unit id → progress (src/rules/progress.mjs)
    cards: [],                // landmark card ids collected
    snowflakes: 0,            // glowing snowflakes collected in the snow, all time
    league: { outbox: [], claimed: [] },
    accessOk: false,
  };
}

// Upgrades older saves step by step. Version 1 is the first release, so the only step today
// fills in missing fields; later versions add a function here (from → from + 1).
const MIGRATIONS = {
  // 0: save => ({ ...save, v: 1 }),
};

export function migrate(raw) {
  if (!raw || typeof raw !== 'object') return null;
  let save = { ...raw };
  let v = Number.isInteger(save.v) ? save.v : 0;
  if (v > SAVE_VERSION) return null; // made by a newer game; never overwrite it with an older shape
  while (v < SAVE_VERSION) {
    const step = MIGRATIONS[v];
    save = step ? step(save) : { ...save, v: v + 1 };
    v = save.v;
  }
  const base = defaultSave(save.created || Date.now());
  const out = { ...base, ...save, settings: { ...base.settings, ...(save.settings || {}) }, league: { ...base.league, ...(save.league || {}) } };
  if (out.team && !TEAM_IDS.includes(out.team)) out.team = null;
  if (!['relaxed', 'challenge'].includes(out.pace)) out.pace = 'relaxed';
  if (typeof out.units !== 'object' || Array.isArray(out.units) || !out.units) out.units = {};
  if (!Array.isArray(out.cards)) out.cards = [];
  if (!Number.isFinite(out.snowflakes) || out.snowflakes < 0) out.snowflakes = 0;
  return out;
}

// ---------- storage ----------
function storage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}
let memory = null; // used when storage is unavailable

export function loadSave(store = storage()) {
  let text = null;
  try { text = store ? store.getItem(SAVE_KEY) : null; } catch { text = null; }
  if (text == null) return memory ? migrate(memory) : defaultSave();
  try {
    const save = migrate(JSON.parse(text));
    if (save) return save;
  } catch { /* fall through */ }
  // Unreadable or from a newer version: keep a copy, start fresh.
  try { store.setItem(BROKEN_KEY, text); } catch { /* ignore */ }
  return defaultSave();
}

export function writeSave(save, store = storage()) {
  save.updated = Date.now();
  memory = JSON.parse(JSON.stringify(save));
  try { if (store) { store.setItem(SAVE_KEY, JSON.stringify(save)); return true; } } catch { /* quota or blocked */ }
  return false;
}

// ---------- backup code ----------
// "SNOW1-" + base64url(JSON) + "-" + checksum. Pasted on another device to move progress.
const PREFIX = 'SNOW1';
function checksum(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36).padStart(7, '0').slice(-6);
}
const toB64 = s => {
  const bytes = new TextEncoder().encode(s);
  let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64 = s => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
};

export function exportCode(save) {
  const { league, accessOk, ...rest } = save; // the outbox and access flag stay on this device
  const body = toB64(JSON.stringify(rest));
  return `${PREFIX}-${body}-${checksum(body)}`;
}

export function importCode(code) {
  const text = String(code || '').replace(/\s+/g, '');
  const m = /^SNOW1-([A-Za-z0-9_-]+)-([0-9a-z]{6})$/.exec(text);
  if (!m) return { ok: false, error: 'This is not a SnowPax backup code.' };
  if (checksum(m[1]) !== m[2]) return { ok: false, error: 'The code is not complete. Copy all of it and try again.' };
  try {
    const save = migrate(JSON.parse(fromB64(m[1])));
    if (!save) return { ok: false, error: 'This code is from a newer version of the game.' };
    return { ok: true, save };
  } catch {
    return { ok: false, error: 'The code could not be read.' };
  }
}
