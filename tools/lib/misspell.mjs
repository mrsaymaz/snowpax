// Procedural misspellings for the "spot the misspelled word" task (Growbloom's Weeding idea),
// made at import time so the full list can be reviewed in content/COVERAGE.md.
// A misspelling is rejected when it is a real word from any bank, a British/American
// spelling variant (colour/color, centre/center, travelling/traveling, grey/gray),
// or a rude word.

// ROT13 so the list does not sit in plain text in the repo.
const rot13 = s => s.replace(/[a-z]/g, c => String.fromCharCode((c.charCodeAt(0) - 97 + 13) % 26 + 97));
const BLOCKED = new Set(['shpx', 'fuvg', 'qnza', 'uryy', 'pengl', 'nff', 'obbo', 'obbof', 'gvg', 'gvgf', 'cvff', 'pbpx', 'qvpx', 'chffl', 'fyhg', 'juber', 'onfgneq', 'ovgpu', 'phag', 'jnax', 'cbb', 'fpuvg', 'fvx', 'lnenx', 'bebfch', 'nzpvx', 'fvxgve', 'frk', 'fhpx', 'gheq', 'cevpx', 'ancr', 'xvyy', 'qvr', 'qrnq', 'thaf', 'tha', 'oybbq', 'snt']
  .map(rot13));
const isBlocked = w => w.split(' ').some(part => BLOCKED.has(part) || [...BLOCKED].some(b => b.length >= 4 && part.includes(b)));

const variant = w => w.toLowerCase()
  .replace(/our/g, 'or').replace(/re\b/g, 'er').replace(/ll/g, 'l').replace(/is(e|es|ed|ing|ation)\b/g, 'iz$1')
  .replace(/ys(e|ed|ing)\b/g, 'yz$1').replace(/grey/g, 'gray').replace(/ogue\b/g, 'og').replace(/ae/g, 'e').replace(/oe/g, 'e')
  .replace(/mme\b/g, 'm').replace(/mm/g, 'm');

// Deterministic per word, so re-importing gives the same list.
function seeded(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let s = (h >>> 0) || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function makeMisspelling(word, dictionary = new Set()) {
  const rand = seeded(word.toLowerCase());
  const parts = word.split(' ');
  const i = parts.reduce((bi, p, k) => (p.length > parts[bi].length ? k : bi), 0);
  const w = parts[i];
  if (w.length < 4) return null;
  const V = 'aeiou';
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  const ops = [
    // swap two neighbouring letters (not the first)
    () => { const k = 1 + Math.floor(rand() * (w.length - 2)); return w[k] === w[k + 1] ? null : w.slice(0, k) + w[k + 1] + w[k] + w.slice(k + 2); },
    // drop a letter (not the first)
    () => { const k = 1 + Math.floor(rand() * (w.length - 1)); return w.slice(0, k) + w.slice(k + 1); },
    // double a letter
    () => { const k = 1 + Math.floor(rand() * (w.length - 2)); return /[a-z]/i.test(w[k]) ? w.slice(0, k) + w[k] + w.slice(k) : null; },
    // change a vowel
    () => { const idx = [...w].map((c, k) => (k > 0 && V.includes(c.toLowerCase()) ? k : -1)).filter(k => k >= 0); if (!idx.length) return null; const k = pick(idx); return w.slice(0, k) + pick([...V].filter(v => v !== w[k].toLowerCase())) + w.slice(k + 1); },
  ];
  for (let t = 0; t < 24; t++) {
    const r = pick(ops)();
    if (!r || r.toLowerCase() === w.toLowerCase()) continue;
    if (dictionary.has(r.toLowerCase())) continue;          // a real word, not a misspelling
    if (variant(r) === variant(w)) continue;                 // British/American variant or double-letter variant
    const out = [...parts]; out[i] = r;
    const result = out.join(' ');
    if (isBlocked(result.toLowerCase())) continue;
    return result;
  }
  return null;
}
