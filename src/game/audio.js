// Small synthesized sound effects (no downloaded audio). Audio starts after the first tap.
let ctx = null, master = null, noiseBuf = null, enabled = true;

export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export function setSound(on) { enabled = on; if (musicBus) musicBus.gain.value = on ? MUSIC_VOL : 0; }

function noise(dur, f0, f1, gain, type = 'bandpass') {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = 1.2;
  const g = ctx.createGain(), t = ctx.currentTime;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur);
}
function tone(freq, dur, gain, type = 'sine', slide = 1) {
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
  o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur);
}

export function play(type, { near = 1, freq = 660 } = {}) {
  if (!ctx || !enabled || near <= 0.05) return;
  const v = Math.min(1, near);
  switch (type) {
    case 'throw': noise(0.18, 900, 2600, 0.25 * v); break;
    case 'splat': noise(0.16, 1400, 300, 0.45 * v, 'lowpass'); tone(110, 0.12, 0.25 * v, 'sine', 0.6); break;
    case 'hit': noise(0.12, 2000, 500, 0.5 * v, 'lowpass'); tone(330, 0.1, 0.12 * v, 'triangle', 0.7); break;
    case 'freeze': [880, 660, 440].forEach((f, i) => setTimeout(() => tone(f, 0.25, 0.15 * v, 'triangle', 0.98), i * 90)); break;
    case 'shake': noise(0.35, 400, 1800, 0.3 * v); tone(220, 0.3, 0.12 * v, 'square', 1.8); break;
    case 'pickup': noise(0.1, 600, 1200, 0.3 * v); break;
    case 'dodge': noise(0.2, 3000, 800, 0.18 * v, 'highpass'); break;
    case 'poof': noise(0.25, 2400, 3600, 0.12 * v, 'highpass'); break;
    case 'tap': tone(660, 0.06, 0.1, 'sine'); break;
    case 'swish': noise(0.22, 700, 3200, 0.2, 'bandpass'); break; // a throw in a task station
    case 'thunk': tone(150, 0.12, 0.3, 'triangle', 0.6); noise(0.08, 1800, 400, 0.3, 'lowpass'); break; // an arrow sticks
    case 'gull': [0, 230].forEach(d => setTimeout(() => tone(1500, 0.18, 0.06, 'sawtooth', 0.62), d)); break;
    case 'pop': noise(0.3, 3000, 600, 0.3, 'lowpass'); setTimeout(() => noise(0.6, 5000, 2500, 0.06, 'highpass'), 60); break; // a firework
    case 'fanfare': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, i > 3 ? 0.4 : 0.16, 0.13, 'triangle'), [0, 110, 220, 330, 520, 640][i])); break;
    case 'note': tone(freq, 0.5, 0.13, 'triangle', 1); tone(freq * 2, 0.35, 0.04, 'sine', 1); break; // a bell note (task scenes)
    case 'super': noise(0.5, 300, 1200, 0.5 * v, 'lowpass'); tone(110, 0.45, 0.3 * v, 'sawtooth', 0.5); break;
    case 'superReady': [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.16, 0.14, 'triangle'), i * 70)); break;
    case 'sparkle': [1319, 1568, 2093].forEach((f, i) => setTimeout(() => tone(f, 0.12, 0.08 * v, 'sine'), i * 45)); break;
    case 'slurp': tone(392, 0.12, 0.12 * v, 'sine', 1.4); setTimeout(() => tone(523, 0.16, 0.1 * v, 'sine', 1.2), 110); break;
    case 'sled': noise(0.9, 500, 2200, 0.22 * v, 'bandpass'); break;
    case 'whoosh': noise(1.6, 300, 900, 0.18, 'bandpass'); break;
    case 'flump': noise(0.4, 1200, 200, 0.4 * v, 'lowpass'); break;
    case 'bell': [1046, 1318].forEach((f, i) => setTimeout(() => tone(f, 0.9, 0.12, 'sine', 0.995), i * 30)); break;
    // a snowball on the sled track: a little bell, a step higher while you keep collecting (freq)
    case 'chime': bellAt(ctx.currentTime, freq, 0.07 * v, 0.45); break;
    // a golden word snowflake: a sparkling run up and a warm glow under it
    case 'flake': [1, 1.25, 1.5, 2, 2.5, 3].forEach((m, i) => bellAt(ctx.currentTime + i * 0.055, 784 * m, 0.06, 0.6)); tone(392, 0.5, 0.07, 'triangle', 1.5); noise(0.5, 5000, 9000, 0.05, 'highpass'); break;
    // the team cheers: a burst of voices (filtered noise that swells and fades) and a whistle
    case 'cheer': for (const [d, f] of [[0, 900], [60, 1300], [140, 700]]) setTimeout(() => noise(1.1, f, f * 1.6, 0.16, 'bandpass'), d); setTimeout(() => tone(1800, 0.25, 0.05, 'sine', 1.35), 250); break;
    case 'capture': [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 0.16, 'triangle'), i * 110)); break;
  }
}

// a bell: a sine with a bright partial and a quick ring-off, at time t
function bellAt(t, f, gain, dur = 0.5, dest = master) {
  for (const [m, g, d] of [[1, 1, 1], [2.01, 0.35, 0.55], [3.0, 0.14, 0.25]]) {
    const o = ctx.createOscillator(), e = ctx.createGain(); o.type = 'sine'; o.frequency.value = f * m;
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(gain * g, t + 0.006); e.gain.exponentialRampToValueAtTime(0.0001, t + dur * d);
    o.connect(e); e.connect(dest); o.start(t); o.stop(t + dur * d + 0.02);
  }
}

// ---------- music: small synthesized pieces (no downloaded audio) ----------
// The sled ride has a looping sleigh-ride tune; each place's scene on the way has its own short
// theme, played over the ride's tune turned down. Notes are scheduled a little ahead on the
// audio clock, so the timing stays steady on a busy phone.
const MUSIC_VOL = 0.55, hz = n => 440 * 2 ** ((n - 69) / 12);
let musicBus = null, timer = null;
const playing = new Map(); // name → { def, gain, step, nextT, loop, level }
function synth(t, f, dur, { type = 'triangle', gain = 0.08, attack = 0.01, release = 0.12, cutoff = 0, dest }) {
  const o = ctx.createOscillator(), e = ctx.createGain(); o.type = type; o.frequency.value = f;
  let node = o; if (cutoff) { const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = cutoff; o.connect(flt); node = flt; }
  e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(gain, t + attack); e.gain.setValueAtTime(gain, t + Math.max(attack, dur - release)); e.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
  node.connect(e); e.connect(dest); o.start(t); o.stop(t + dur + release + 0.05);
}
function hit(t, { f0, f1, dur, gain, type = 'bandpass', dest }) {
  const s2 = ctx.createBufferSource(); s2.buffer = noiseBuf; const flt = ctx.createBiquadFilter(); flt.type = type; flt.Q.value = 1; const e = ctx.createGain();
  flt.frequency.setValueAtTime(f0, t); flt.frequency.exponentialRampToValueAtTime(f1, t + dur); e.gain.setValueAtTime(gain, t); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s2.connect(flt); flt.connect(e); e.connect(dest); s2.start(t); s2.stop(t + dur + 0.02);
}
function thump(t, f, gain, dest, dur = 0.22) { const o = ctx.createOscillator(), e = ctx.createGain(); o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.5, t + dur); e.gain.setValueAtTime(gain, t); e.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(e); e.connect(dest); o.start(t); o.stop(t + dur + 0.02); }

// "Kasımpaşa sleigh ride": D major, 132 bpm, eight bars (D Bm G A twice), sleigh bells on the
// eighths, a soft drum, bass, warm chords and a toy-flute tune
const RIDE_MELODY = [[0, 74, 2], [2, 74, 2], [4, 78, 2], [6, 76, 2], [8, 74, 4], [12, 69, 4], [16, 71, 2], [18, 74, 2], [20, 78, 4], [24, 76, 2], [26, 74, 2], [28, 73, 4],
  [32, 71, 2], [34, 74, 2], [36, 79, 4], [40, 78, 2], [42, 76, 2], [44, 74, 4], [48, 73, 2], [50, 76, 2], [52, 81, 4], [56, 79, 2], [58, 78, 2], [60, 76, 4],
  [64, 74, 2], [66, 78, 2], [68, 81, 2], [70, 78, 2], [72, 74, 4], [76, 69, 4], [80, 71, 2], [82, 74, 2], [84, 78, 2], [86, 74, 2], [88, 71, 4], [92, 73, 4],
  [96, 74, 2], [98, 76, 2], [100, 78, 2], [102, 79, 2], [104, 81, 4], [108, 79, 2], [110, 78, 2], [112, 76, 4], [116, 73, 4], [120, 74, 8]];
const RIDE_CHORDS = [[62, 66, 69], [59, 62, 66], [55, 59, 62], [57, 61, 64]], RIDE_BASS = [38, 47, 43, 45];
// the Archery Ground theme (about 7 s): a saz-like tune in Hicaz over a drone, a frame drum (düm tek)
const ARCHERY_MELODY = [[0, 69, 2], [2, 70, 2], [4, 69, 2], [6, 67, 2], [8, 66, 4], [12, 67, 2], [14, 69, 2], [16, 70, 2], [18, 72, 2], [20, 74, 4], [24, 72, 2], [26, 70, 2], [28, 69, 4],
  [32, 67, 2], [34, 66, 2], [36, 63, 2], [38, 66, 2], [40, 62, 8]];
// the other places' themes (about 7 s each, 100 bpm, three bars)
const at = (list, k) => list.filter(([n]) => n === k);
const BOULEVARD = { mel: [[0, 67, 2], [2, 71, 2], [4, 74, 2], [6, 79, 2], [8, 78, 4], [12, 74, 4], [16, 76, 2], [18, 74, 2], [20, 71, 2], [22, 74, 2], [24, 72, 4], [28, 69, 4], [32, 71, 2], [34, 74, 2], [36, 79, 4], [40, 78, 2], [42, 79, 6]], bass: [[0, 43], [8, 50], [16, 48], [24, 50], [32, 43], [40, 50]] };
const KIZILAY = { mel: [[0, 69, 2], [2, 71, 2], [4, 72, 2], [6, 74, 2], [8, 76, 4], [12, 74, 2], [14, 72, 2], [16, 71, 2], [18, 72, 2], [20, 74, 4], [24, 72, 2], [26, 71, 2], [28, 69, 4], [32, 68, 2], [34, 69, 2], [36, 71, 2], [38, 68, 2], [40, 69, 8]], bass: [[0, 45], [8, 52], [16, 50], [24, 52], [32, 44], [40, 45]] };
const SURURI = { mel: [[0, 72, 1], [2, 76, 1], [4, 79, 1], [6, 76, 1], [8, 77, 2], [10, 76, 1], [12, 74, 2], [16, 72, 1], [18, 76, 1], [20, 79, 1], [22, 84, 1], [24, 81, 2], [28, 79, 2], [32, 77, 1], [34, 76, 1], [36, 74, 1], [38, 71, 1], [40, 72, 6]], bass: [[0, 36], [4, 43], [8, 36], [12, 43], [16, 41], [20, 36], [24, 43], [28, 36], [32, 41], [36, 43], [40, 36]] };
const PIER = { mel: [[4, 76, 4], [12, 80, 4], [20, 78, 4], [28, 73, 4], [36, 75, 4], [42, 76, 6]], chords: [[0, [64, 68, 71]], [12, [61, 64, 68]], [24, [57, 61, 64]], [36, [59, 63, 66]]] };
// the arrival at the carousel: a cheeky fairground waltz in D minor on a little organ (oom-pah-pah)
const CAROUSEL = [[0, 69, 3], [3, 70, 3], [6, 69, 3], [9, 65, 3], [12, 62, 6], [18, 65, 3], [21, 69, 3], [24, 74, 6], [30, 73, 3], [33, 70, 3],
  [36, 69, 3], [39, 70, 3], [42, 69, 3], [45, 64, 3], [48, 61, 6], [54, 64, 3], [57, 67, 3], [60, 73, 6], [66, 70, 3], [69, 69, 3], [72, 74, 12]];
const CAROUSEL_BASS = [50, 50, 46, 45, 50, 50, 45, 50], CAROUSEL_CH = [[62, 65, 69], [62, 65, 69], [58, 62, 65], [57, 61, 64], [62, 65, 69], [62, 65, 69], [57, 61, 64], [62, 65, 69]];
// the Golden Horn's sled ride: a lilting sea song in 6/8 (D minor), sleigh bells on every eighth, an accordion's chords
const HORN_RIDE = [[0, 69, 2], [2, 74, 1], [3, 74, 2], [5, 76, 1], [6, 77, 2], [8, 76, 1], [9, 74, 3], [12, 70, 2], [14, 74, 1], [15, 74, 2], [17, 72, 1], [18, 73, 3], [21, 69, 3],
  [24, 69, 2], [26, 74, 1], [27, 77, 2], [29, 76, 1], [30, 77, 2], [32, 79, 1], [33, 81, 3], [36, 79, 2], [38, 77, 1], [39, 76, 2], [41, 73, 1], [42, 74, 6]].map(([a, n, l]) => [a * 2, n, l * 2]);
const HORN_CH = [[62, 65, 69], [62, 65, 69], [62, 67, 70], [61, 64, 69], [62, 65, 69], [60, 65, 69], [60, 64, 67], [61, 64, 69]], HORN_BASS = [50, 50, 43, 45, 50, 41, 48, 45];
// the arrival at the Golden Horn: a ferry's horn, then a stately harbour waltz on brass (D major), the great chain clinking
const HORN_ARRIVE = [[0, 62, 6], [6, 66, 3], [9, 69, 3], [12, 74, 9], [21, 73, 3], [24, 71, 6], [30, 74, 3], [33, 71, 3], [36, 69, 9], [45, 66, 3], [48, 67, 3], [51, 69, 3], [54, 71, 3], [57, 73, 3], [60, 74, 12]];
const HORN_ARRIVE_BASS = [50, 50, 43, 45, 43, 50], HORN_ARRIVE_CH = [[62, 66, 69], [62, 66, 69], [59, 62, 67], [61, 64, 69], [59, 62, 67], [62, 66, 69]];
// ---------- Downtown (about 7 s each), an evening loop through Beyoğlu ----------
// Galata Tower: a sweet bakery waltz on a music box over a plucked bass (F major, 3/4)
const GALATA = [[0, 72, 3], [3, 76, 3], [6, 79, 3], [9, 77, 3], [12, 76, 6], [18, 74, 3], [21, 72, 3], [24, 74, 3], [27, 77, 3], [30, 81, 3], [33, 79, 3], [36, 77, 9], [45, 72, 3]];
const GALATA_BASS = [41, 41, 46, 48], GALATA_CH = [[65, 69, 72], [65, 69, 72], [65, 70, 74], [64, 67, 72]];
// İstiklal Avenue: the tram's bell, then a swing tune on a muted trumpet over a walking bass (B flat)
const ISTIKLAL = [[4, 70, 2], [6, 74, 1], [7, 77, 3], [10, 75, 2], [12, 74, 4], [18, 72, 2], [20, 70, 2], [22, 72, 1], [23, 74, 3], [26, 77, 2], [28, 79, 4], [34, 77, 2], [36, 74, 2], [38, 72, 2], [40, 70, 8]];
const WALK = [46, 50, 53, 55, 51, 55, 58, 57, 46, 50, 53, 50];
// Taksim Square: a city bus's horn, then a soaring aria line over warm strings (C major)
const TAKSIM = [[6, 72, 4], [10, 76, 2], [12, 79, 6], [18, 77, 2], [20, 76, 2], [22, 74, 2], [24, 76, 6], [30, 84, 4], [34, 83, 2], [36, 81, 2], [38, 79, 4], [42, 84, 6]];
const TAKSIM_CH = [[0, [60, 64, 67]], [12, [57, 60, 64]], [24, [53, 57, 60]], [36, [55, 59, 62]]];
// Cihangir: a lazy café bossa on a soft piano (A minor), brushes, and a cat's meow at the end
const CIHANGIR = [[2, 76, 2], [5, 74, 1], [6, 72, 2], [9, 71, 3], [14, 72, 2], [17, 74, 1], [18, 76, 4], [26, 77, 2], [29, 76, 1], [30, 74, 2], [33, 72, 3], [38, 69, 6]];
const CIHANGIR_CH = [[0, [57, 60, 64, 67]], [12, [62, 65, 69, 72]], [24, [55, 59, 62, 65]], [36, [57, 60, 64, 67]]];
// Tophane: night by the water: the clock tower's chimes, lapping water, a slow clarinet tune (D minor)
const TOPHANE_CHIME = [[0, 76], [4, 72], [8, 74], [12, 67]], TOPHANE = [[18, 69, 4], [22, 70, 2], [24, 72, 4], [28, 70, 2], [30, 69, 2], [32, 67, 4], [36, 65, 2], [38, 64, 2], [40, 62, 8]];
// the Downtown sled ride: an upbeat swing with sleigh bells, a walking bass, a clarinet's tune (F major)
const DT_RIDE = [[0, 72, 3], [3, 74, 1], [4, 77, 4], [8, 76, 2], [10, 74, 2], [12, 72, 4], [16, 69, 3], [19, 70, 1], [20, 72, 4], [24, 74, 2], [26, 72, 2], [28, 70, 4],
  [32, 72, 3], [35, 74, 1], [36, 77, 4], [40, 79, 2], [42, 81, 2], [44, 79, 4], [48, 77, 3], [51, 76, 1], [52, 74, 4], [56, 72, 2], [58, 76, 2], [60, 77, 4]].flatMap(([a, n, l]) => [[a, n, l], [a + 64, n + (a >= 48 ? -2 : 0), l]]);
const DT_WALK = [41, 45, 48, 50, 46, 50, 53, 52, 48, 52, 55, 53, 41, 45, 48, 45];
// the arrival Downtown: the tram's bell twice, then a jaunty jazz fanfare (F major)
const DT_ARRIVE = [[8, 65, 2], [10, 69, 2], [12, 72, 4], [16, 70, 2], [18, 69, 2], [20, 72, 4], [24, 74, 2], [26, 76, 2], [28, 77, 4], [32, 79, 2], [34, 77, 2], [36, 76, 2], [38, 74, 2], [40, 72, 4], [44, 76, 4], [48, 77, 12]];
const TRACKS = {
  'galata-tower': { bpm: 100, steps: 48, loop: false, step(k, t, sp, dest) {
    const bar = Math.floor(k / 12) % 4, inBar = k % 12;
    if (inBar === 0) synth(t, hz(GALATA_BASS[bar]), sp * 3, { gain: 0.1, attack: 0.004, release: 0.2, dest });
    if (inBar === 4 || inBar === 8) for (const n of GALATA_CH[bar]) synth(t, hz(n), sp * 1.5, { gain: 0.016, attack: 0.004, release: 0.12, dest });
    for (const [, n, len] of at(GALATA, k)) { bellAt(t, hz(n + 12), 0.065, 0.4 + len * 0.1, dest); bellAt(t, hz(n), 0.015, 0.5, dest); }
  } },
  istiklal: { bpm: 104, steps: 48, loop: false, step(k, t, sp, dest) {
    if (k === 0 || k === 2) bellAt(t, hz(88), 0.06, 0.5, dest); // the tram's bell: ding-ding
    if (k % 4 === 0 && k >= 4) synth(t, hz(WALK[(k / 4) % WALK.length]), sp * 3.4, { gain: 0.1, attack: 0.004, release: 0.12, dest });
    if (k % 4 === 2 && k >= 4) hit(t, { f0: 6000, f1: 8000, dur: 0.07, gain: 0.03, type: 'highpass', dest }); // brushes on the offbeat
    for (const [, n, len] of at(ISTIKLAL, k)) synth(t, hz(n), sp * len * 0.85, { type: 'sawtooth', gain: 0.04, attack: 0.03, release: 0.12, cutoff: 1300, dest });
  } },
  taksim: { bpm: 100, steps: 48, loop: false, step(k, t, sp, dest) {
    if (k === 0) { synth(t, 220, 0.5, { type: 'square', gain: 0.03, attack: 0.02, release: 0.1, cutoff: 900, dest }); synth(t, 277, 0.5, { type: 'square', gain: 0.025, attack: 0.02, release: 0.1, cutoff: 900, dest }); } // the bus's horn
    for (const [at0, ch] of TAKSIM_CH) if (at0 === k) for (const n of ch) synth(t, hz(n), sp * 12, { type: 'sawtooth', gain: 0.012, attack: 0.25, release: 0.5, cutoff: 1100, dest });
    for (const [, n, len] of at(TAKSIM, k)) { synth(t, hz(n), sp * len * 0.95, { type: 'sine', gain: 0.06, attack: 0.08, release: 0.25, dest }); synth(t, hz(n) * 2.003, sp * len * 0.9, { type: 'sine', gain: 0.012, attack: 0.1, release: 0.2, dest }); }
    if (k % 12 === 0) thump(t, 70, 0.1, dest);
  } },
  cihangir: { bpm: 96, steps: 48, loop: false, step(k, t, sp, dest) {
    for (const [at0, ch] of CIHANGIR_CH) for (const off of [0, 3, 6, 10]) if (at0 + off === k) for (const n of ch) synth(t, hz(n), sp * 1.6, { gain: 0.014, attack: 0.005, release: 0.2, dest }); // bossa chords
    if ([0, 3, 6, 8].includes(k % 12)) synth(t, hz([45, 50, 43, 45][Math.floor(k / 12) % 4] + (k % 12 === 6 ? 7 : 0)), sp * 2, { gain: 0.09, attack: 0.004, release: 0.15, dest });
    if (k % 2 === 1) hit(t, { f0: 5000, f1: 7000, dur: 0.06, gain: 0.018, type: 'highpass', dest });
    for (const [, n, len] of at(CIHANGIR, k)) { synth(t, hz(n), sp * len * 0.8, { gain: 0.05, attack: 0.004, release: 0.3, dest }); bellAt(t, hz(n + 12), 0.008, 0.3, dest); }
    if (k === 46) { const ac = dest.context, o = ac.createOscillator(), e = ac.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(700, t); o.frequency.linearRampToValueAtTime(1000, t + 0.12); o.frequency.linearRampToValueAtTime(600, t + 0.4); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(0.03, t + 0.05); e.gain.linearRampToValueAtTime(0, t + 0.42); o.connect(e); e.connect(dest); o.start(t); o.stop(t + 0.45); } // meow
  } },
  tophane: { bpm: 96, steps: 48, loop: false, step(k, t, sp, dest) {
    for (const [at0, n] of TOPHANE_CHIME) if (at0 === k) bellAt(t, hz(n), 0.075, 1.2, dest); // the clock tower's chimes
    if (k % 6 === 3) hit(t, { f0: 480, f1: 240, dur: 0.6, gain: 0.035, type: 'lowpass', dest }); // the water lapping
    if (k === 16) for (const n of [50, 57, 62]) synth(t, hz(n), sp * 32, { gain: 0.022, attack: 0.6, release: 0.8, cutoff: 900, dest });
    for (const [, n, len] of at(TOPHANE, k)) synth(t, hz(n), sp * len * 0.9, { type: 'square', gain: 0.045, attack: 0.06, release: 0.2, cutoff: 1000, dest });
  } },
  'sled-downtown': { bpm: 140, steps: 128, loop: true, step(k, t, sp, dest) {
    if (k % 2 === 0) hit(t, { f0: 7000, f1: 9000, dur: 0.05, gain: k % 4 === 0 ? 0.045 : 0.025, type: 'highpass', dest }); // sleigh bells
    if (k % 8 === 4) hit(t, { f0: 1800, f1: 1200, dur: 0.07, gain: 0.032, dest }); // a snap on two and four
    if (k % 4 === 0) synth(t, hz(DT_WALK[(k / 4) % DT_WALK.length]), sp * 3.4, { gain: 0.1, attack: 0.004, release: 0.12, dest });
    for (const [at0, n, len] of DT_RIDE) if (at0 === k) synth(t, hz(n), sp * len * 0.9, { type: 'square', gain: 0.035, attack: 0.02, release: 0.1, cutoff: 1900, dest });
    if (k % 32 === 0) for (const n of [[65, 69, 72], [65, 70, 74], [64, 67, 72], [65, 69, 72]][(k / 32) % 4]) synth(t, hz(n), sp * 28, { gain: 0.016, attack: 0.1, release: 0.3, cutoff: 1600, dest });
  } },
  'arrive-downtown': { bpm: 132, steps: 64, loop: false, step(k, t, sp, dest) {
    if (k === 0 || k === 2) bellAt(t, hz(88), 0.07, 0.6, dest); // the tram's bell
    if (k >= 8 && k % 4 === 0) synth(t, hz(DT_WALK[(k / 4) % DT_WALK.length]), sp * 3.4, { gain: 0.11, attack: 0.004, release: 0.12, dest });
    if (k >= 8 && k % 4 === 2) hit(t, { f0: 6000, f1: 8000, dur: 0.07, gain: 0.035, type: 'highpass', dest });
    for (const [, n, len] of at(DT_ARRIVE, k)) { synth(t, hz(n), sp * len * 0.85, { type: 'sawtooth', gain: 0.04, attack: 0.03, release: 0.15, cutoff: 1500, dest }); synth(t, hz(n - 12), sp * len * 0.85, { type: 'triangle', gain: 0.03, attack: 0.02, release: 0.15, dest }); }
    if (k === 48) bellAt(t, hz(89), 0.05, 1.2, dest);
  } },

  'sled-golden-horn': { bpm: 100, steps: 96, loop: true, step(k, t, sp, dest) {
    const bar = Math.floor(k / 12) % 8, inBar = k % 12;
    if (k % 2 === 0) hit(t, { f0: 7000, f1: 9000, dur: 0.05, gain: inBar % 6 === 0 ? 0.05 : 0.028, type: 'highpass', dest }); // sleigh bells
    if (inBar === 0 || inBar === 6) { thump(t, 92, 0.14, dest); synth(t, hz(HORN_BASS[bar] + (inBar === 6 ? 7 : 0)), sp * 4, { gain: 0.1, attack: 0.005, release: 0.2, dest }); }
    if ([2, 4, 8, 10].includes(inBar)) for (const n of HORN_CH[bar]) synth(t, hz(n), sp * 1.6, { type: 'square', gain: 0.011, attack: 0.01, release: 0.08, cutoff: 1500, dest }); // the accordion's chords
    for (const [at0, n, len] of HORN_RIDE) if (at0 === k) { synth(t, hz(n), sp * len * 0.9, { type: 'square', gain: 0.03, attack: 0.03, release: 0.15, cutoff: 2000, dest }); synth(t, hz(n) * 1.005, sp * len * 0.9, { type: 'square', gain: 0.022, attack: 0.03, release: 0.15, cutoff: 2000, dest }); } // two reeds a hair apart
    if (k === 60) synth(t, 1500, 0.2, { type: 'sawtooth', gain: 0.018, attack: 0.01, release: 0.1, cutoff: 3000, dest }); // a gull
  } },
  'arrive-golden-horn': { bpm: 120, steps: 72, loop: false, step(k, t, sp, dest) {
    if (k === 0) { synth(t, 98, 1.1, { type: 'sawtooth', gain: 0.05, attack: 0.06, release: 0.4, cutoff: 380, dest }); synth(t, 147, 1.1, { type: 'sawtooth', gain: 0.025, attack: 0.06, release: 0.4, cutoff: 500, dest }); } // the ferry's horn
    const bar = Math.floor(k / 12), inBar = k % 12;
    if (inBar === 0) { synth(t, hz(HORN_ARRIVE_BASS[bar] - 12), sp * 4, { gain: 0.12, attack: 0.005, release: 0.2, dest }); hit(t, { f0: 3200, f1: 2400, dur: 0.06, gain: 0.05, type: 'bandpass', dest }); bellAt(t, hz(91), 0.012, 0.3, dest); } // the chain clinks on the downbeat
    if (inBar === 4 || inBar === 8) for (const n of HORN_ARRIVE_CH[bar]) synth(t, hz(n), sp * 2, { type: 'sawtooth', gain: 0.012, attack: 0.01, release: 0.1, cutoff: 1200, dest });
    for (const [at0, n, len] of HORN_ARRIVE) if (at0 === k) { synth(t, hz(n), sp * len * 0.85, { type: 'sawtooth', gain: 0.04, attack: 0.04, release: 0.2, cutoff: 1600, dest }); synth(t, hz(n - 12), sp * len * 0.85, { type: 'triangle', gain: 0.04, attack: 0.02, release: 0.2, dest }); } // brass, an octave below
    if (k === 60) bellAt(t, hz(86), 0.04, 1.2, dest);
  } },

  carousel: { bpm: 150, steps: 84, loop: false, step(k, t, sp, dest) {
    const bar = Math.floor(k / 12) % 8, inBar = k % 12;
    if (inBar === 0) synth(t, hz(CAROUSEL_BASS[bar] - 12), sp * 3, { gain: 0.12, attack: 0.005, release: 0.15, dest });
    if (inBar === 4 || inBar === 8) for (const n of CAROUSEL_CH[bar]) synth(t, hz(n), sp * 2, { type: 'square', gain: 0.014, attack: 0.005, release: 0.08, cutoff: 1600, dest });
    for (const [at0, n, len] of CAROUSEL) if (at0 === k) { synth(t, hz(n + 12), sp * len * 0.85, { type: 'square', gain: 0.035, attack: 0.01, release: 0.12, cutoff: 2600, dest }); synth(t, hz(n), sp * len * 0.85, { type: 'triangle', gain: 0.04, attack: 0.01, release: 0.12, dest }); }
    if (inBar === 0 && bar % 2 === 0) bellAt(t, hz(86), 0.02, 0.4, dest); // a little bell on the turn
  } },
  // Boulevard Park: a music box over a soft plucked bass (G major)
  boulevard: { bpm: 100, steps: 48, loop: false, step(k, t, sp, dest) {
    for (const [, n, len] of at(BOULEVARD.mel, k)) { bellAt(t, hz(n + 12), 0.05, 0.4 + len * 0.12, dest); bellAt(t, hz(n), 0.018, 0.5, dest); }
    for (const [, n] of at(BOULEVARD.bass, k)) synth(t, hz(n), sp * 3, { gain: 0.1, attack: 0.005, release: 0.2, dest });
    if (k === 0) for (const n of [55, 59, 62]) synth(t, hz(n), sp * 44, { gain: 0.016, attack: 0.5, release: 0.8, cutoff: 1500, dest });
  } },
  // Kızılay Square: a café tune in Nihavend (A minor) on a plucked string, a tambourine on the offbeats
  kizilay: { bpm: 100, steps: 48, loop: false, step(k, t, sp, dest) {
    for (const [, n, len] of at(KIZILAY.mel, k)) synth(t, hz(n), sp * len * 0.7, { type: 'sawtooth', gain: 0.055, attack: 0.004, release: 0.22, cutoff: 2000, dest });
    for (const [, n] of at(KIZILAY.bass, k)) synth(t, hz(n), sp * 3, { gain: 0.1, attack: 0.005, release: 0.18, dest });
    if (k % 4 === 2) hit(t, { f0: 8000, f1: 10000, dur: 0.06, gain: 0.04, type: 'highpass', dest });
    if (k % 8 === 0) thump(t, 90, 0.12, dest);
  } },
  // Sururi Park: a bouncy xylophone (C major), claps on two and four
  sururi: { bpm: 100, steps: 48, loop: false, step(k, t, sp, dest) {
    for (const [, n, len] of at(SURURI.mel, k)) { synth(t, hz(n), sp * len * 0.5, { gain: 0.07, attack: 0.002, release: 0.12, dest }); bellAt(t, hz(n + 12), 0.015, 0.25, dest); }
    for (const [, n] of at(SURURI.bass, k)) synth(t, hz(n), sp * 1.5, { gain: 0.11, attack: 0.004, release: 0.1, dest });
    if (k % 16 === 4 || k % 16 === 12) hit(t, { f0: 1600, f1: 1100, dur: 0.08, gain: 0.07, dest });
  } },
  // the Pier: a ferry's horn, then warm chords at sunset and a slow bell tune (E major)
  pier: { bpm: 100, steps: 48, loop: false, step(k, t, sp, dest) {
    if (k === 0) synth(t, 98, 1.3, { type: 'sawtooth', gain: 0.05, attack: 0.08, release: 0.5, cutoff: 420, dest });
    for (const [at0, ch] of PIER.chords) if (at0 === k) for (const n of ch) synth(t, hz(n), sp * 12, { gain: 0.022, attack: 0.3, release: 0.6, cutoff: 1400, dest });
    for (const [, n, len] of at(PIER.mel, k)) bellAt(t, hz(n), 0.05, 0.6 + len * 0.15, dest);
  } },
  sled: { bpm: 132, steps: 128, loop: true, step(k, t, sp, dest) {
    if (k % 2 === 0) hit(t, { f0: 7000, f1: 9000, dur: 0.05, gain: k % 4 === 0 ? 0.05 : 0.03, type: 'highpass', dest }); // sleigh bells
    if (k % 8 === 0) thump(t, 95, 0.16, dest);
    const bar = Math.floor(k / 16) % 4, inBar = k % 16;
    if (inBar === 0 || inBar === 8) synth(t, hz(RIDE_BASS[bar] + (inBar === 8 ? 7 : 0)), sp * 3, { gain: 0.11, dest });
    if (inBar === 0) for (const n of RIDE_CHORDS[bar]) synth(t, hz(n), sp * 15, { gain: 0.022, attack: 0.08, release: 0.3, cutoff: 1800, dest });
    for (const [at, n, len] of RIDE_MELODY) if (at === k) { synth(t, hz(n), sp * len * 0.9, { type: 'square', gain: 0.045, cutoff: 2400, dest }); if (len >= 4) bellAt(t, hz(n + 12), 0.018, 0.5, dest); }
  } },
  archery: { bpm: 100, steps: 48, loop: false, step(k, t, sp, dest) {
    const inBar = k % 16;
    if (inBar === 0 || inBar === 8) thump(t, 85, 0.22, dest, 0.3); // düm
    if ([4, 6, 12, 14].includes(inBar)) hit(t, { f0: 1100, f1: 700, dur: 0.07, gain: 0.08, dest }); // tek
    if (k === 0) { synth(t, hz(50), sp * 46, { type: 'sawtooth', gain: 0.02, attack: 0.4, release: 0.6, cutoff: 600, dest }); synth(t, hz(57), sp * 46, { type: 'sawtooth', gain: 0.014, attack: 0.4, release: 0.6, cutoff: 600, dest }); }
    for (const [at, n, len] of ARCHERY_MELODY) if (at === k) { synth(t, hz(n), sp * len * 0.7, { type: 'sawtooth', gain: 0.06, attack: 0.004, release: 0.25, cutoff: 2200, dest }); synth(t, hz(n + 12), sp * len * 0.4, { type: 'triangle', gain: 0.02, attack: 0.004, release: 0.2, dest }); }
  } },
};
// ---------- the Golden Horn's places (about 7 s each) ----------
// Karaköy: a ferry's horn, then a lilting 6/8 tune on an accordion-like reed in D minor over lapping water
const KARAKOY = [[4, 74, 3], [7, 72, 1.5], [8.5, 70, 1.5], [10, 69, 4], [16, 70, 2], [18, 72, 2], [20, 74, 2], [22, 77, 4], [28, 76, 2], [30, 74, 2], [32, 72, 3], [35, 70, 1.5], [36.5, 69, 1.5], [38, 67, 2], [40, 69, 8]];
// Bankers Street: a stately march in B flat: brass chords, a tuba, coins clinking on the beat
const BANK_CH = [[0, [58, 62, 65]], [8, [55, 58, 63]], [16, [53, 58, 62]], [24, [53, 57, 60]], [32, [55, 58, 63]], [40, [58, 62, 65, 70]]];
const BANK_MEL = [[0, 70, 3], [3, 70, 1], [4, 72, 4], [8, 74, 3], [11, 72, 1], [12, 70, 4], [16, 74, 3], [19, 75, 1], [20, 77, 4], [24, 76, 3], [27, 74, 1], [28, 72, 4], [32, 75, 3], [35, 74, 1], [36, 72, 2], [38, 70, 2], [40, 70, 8]];
// Tersane: a shipyard work song in A minor: hammer on anvil, a low pulse, a confident whistle
const TERS_MEL = [[2, 76, 2], [4, 76, 1], [5, 77, 1], [6, 79, 2], [10, 76, 2], [12, 74, 4], [18, 74, 2], [20, 74, 1], [21, 76, 1], [22, 77, 2], [26, 74, 2], [28, 72, 4], [34, 72, 2], [36, 74, 2], [38, 76, 2], [40, 81, 6]];
// Aynalıkavak: a ney-like reed in Uşşak (A, B half-flat, C, D …) over a drone, mirror shimmers
const AYN_MEL = [[0, 69, 6], [6, 70.5, 2], [8, 72, 4], [12, 74, 4], [16, 72, 2], [18, 70.5, 2], [20, 69, 6], [26, 67, 2], [28, 69, 4], [32, 70.5, 3], [35, 72, 1], [36, 70.5, 4], [40, 69, 8]];
// Miniatürk: a little toy parade in G: piccolo and glockenspiel, a clockwork tick, a toy drum
const MINI_MEL = [[0, 79, 1], [1, 81, 1], [2, 83, 2], [4, 86, 2], [6, 83, 2], [8, 84, 2], [10, 81, 2], [12, 79, 4], [16, 81, 1], [17, 83, 1], [18, 84, 2], [20, 88, 2], [22, 86, 2], [24, 84, 2], [26, 83, 2], [28, 81, 4], [32, 79, 1], [33, 81, 1], [34, 83, 2], [36, 84, 2], [38, 81, 2], [40, 79, 6]];
const breath = (t, f, dur, gain, dest) => { // a breathy reed: a soft tone with vibrato and a little air
  const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), e = ctx.createGain(), flt = ctx.createBiquadFilter();
  o.type = 'triangle'; o.frequency.value = f; lfo.frequency.value = 5.2; lg.gain.value = f * 0.008; lfo.connect(lg); lg.connect(o.frequency); flt.type = 'lowpass'; flt.frequency.value = 2400;
  e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(gain, t + 0.12); e.gain.setValueAtTime(gain, t + Math.max(0.12, dur - 0.2)); e.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
  o.connect(flt); flt.connect(e); e.connect(dest); o.start(t); lfo.start(t); o.stop(t + dur + 0.2); lfo.stop(t + dur + 0.2);
  hit(t, { f0: 1800, f1: 2600, dur: Math.min(0.4, dur), gain: gain * 0.25, dest }); // the air at the start of the note
};
Object.assign(TRACKS, {
  karakoy: { bpm: 100, steps: 48, loop: false, step(k, t, sp, dest) {
    if (k === 0) { synth(t, 98, 1.0, { type: 'sawtooth', gain: 0.05, attack: 0.06, release: 0.4, cutoff: 380, dest }); synth(t, 147, 1.0, { type: 'sawtooth', gain: 0.025, attack: 0.06, release: 0.4, cutoff: 500, dest }); } // the ferry's horn
    if (k % 6 === 4) hit(t, { f0: 500, f1: 260, dur: 0.5, gain: 0.04, type: 'lowpass', dest }); // the water lapping
    if (k % 6 === 4) synth(t, hz(k < 28 ? 50 : 46), sp * 2.5, { gain: 0.08, attack: 0.01, release: 0.2, dest });
    if (k % 6 === 1 || k % 6 === 3) for (const n of (k < 28 ? [62, 65, 69] : [58, 62, 65])) synth(t, hz(n), sp, { type: 'square', gain: 0.012, cutoff: 1500, dest });
    for (const [at0, n, len] of KARAKOY) if (Math.floor(at0) === k) { const tt = t + (at0 - k) * sp; synth(tt, hz(n), sp * len * 0.9, { type: 'square', gain: 0.03, attack: 0.03, release: 0.15, cutoff: 1800, dest }); synth(tt, hz(n) * 1.005, sp * len * 0.9, { type: 'square', gain: 0.022, attack: 0.03, release: 0.15, cutoff: 1800, dest }); } // two reeds a hair apart, like an accordion
    if (k === 30) synth(t, 1500, 0.2, { type: 'sawtooth', gain: 0.02, attack: 0.01, release: 0.1, cutoff: 3000, dest }); // a gull
  } },
  bankalar: { bpm: 100, steps: 48, loop: false, step(k, t, sp, dest) {
    for (const [at0, ch] of BANK_CH) if (at0 === k) { for (const n of ch) synth(t, hz(n), sp * 7, { type: 'sawtooth', gain: 0.018, attack: 0.05, release: 0.3, cutoff: 1300, dest }); synth(t, hz(ch[0] - 24), sp * 1.6, { gain: 0.12, attack: 0.01, release: 0.15, dest }); }
    if (k % 8 === 4) synth(t, hz((BANK_CH.find(([a0]) => a0 <= k && k < a0 + 8) || BANK_CH[0])[1][0] - 17), sp * 1.6, { gain: 0.1, attack: 0.01, release: 0.15, dest }); // oom-pah tuba
    for (const [at0, n, len] of BANK_MEL) if (at0 === k) synth(t, hz(n), sp * len * 0.85, { type: 'sawtooth', gain: 0.04, attack: 0.02, release: 0.12, cutoff: 2400, dest }); // the trumpet
    if (k % 4 === 0) thump(t, 110, 0.12, dest, 0.15);
    if (k % 8 === 6) { bellAt(t, 2637, 0.03, 0.18, dest); bellAt(t + 0.06, 3136, 0.025, 0.16, dest); } // coins clinking
  } },
  tersane: { bpm: 96, steps: 48, loop: false, step(k, t, sp, dest) {
    if (k % 4 === 0) { thump(t, 70, 0.18, dest, 0.25); } // the low pulse of the yard
    if (k % 8 === 2 || k % 8 === 3) { bellAt(t, k % 8 === 2 ? 1180 : 1580, 0.05, 0.3, dest); hit(t, { f0: 3500, f1: 2000, dur: 0.06, gain: 0.06, type: 'bandpass', dest }); } // hammer on anvil, clang-clang
    if (k % 8 === 0) synth(t, hz(k < 24 ? 45 : 43), sp * 3.5, { type: 'sawtooth', gain: 0.05, attack: 0.01, release: 0.2, cutoff: 600, dest });
    for (const [at0, n, len] of TERS_MEL) if (at0 === k) { synth(t, hz(n), sp * len * 0.85, { gain: 0.06, attack: 0.02, release: 0.1, dest }); synth(t, hz(n + 12), sp * len * 0.85, { gain: 0.015, attack: 0.02, release: 0.1, dest }); } // the whistle
  } },
  aynalikavak: { bpm: 92, steps: 48, loop: false, step(k, t, sp, dest) {
    if (k === 0) { synth(t, hz(45), sp * 46, { type: 'sawtooth', gain: 0.022, attack: 0.6, release: 0.8, cutoff: 500, dest }); synth(t, hz(52), sp * 46, { type: 'triangle', gain: 0.02, attack: 0.6, release: 0.8, dest }); } // the drone
    for (const [at0, n, len] of AYN_MEL) if (at0 === k) breath(t, hz(n), sp * len * 0.92, 0.07, dest);
    if (k % 12 === 6) [0, 1, 2, 3].forEach(j => bellAt(t + j * 0.07, [2349, 2794, 3136, 3729][j], 0.018, 0.5, dest)); // a mirror catching the light
    if (k % 8 === 0) thump(t, 80, 0.07, dest, 0.3);
  } },
  miniaturk: { bpm: 108, steps: 48, loop: false, step(k, t, sp, dest) {
    if (k % 2 === 0) hit(t, { f0: 6000, f1: 5000, dur: 0.025, gain: 0.03, type: 'highpass', dest }); // the clockwork tick
    if (k % 4 === 0) hit(t, { f0: 1600, f1: 900, dur: 0.09, gain: 0.05, dest }); if (k % 8 === 7) hit(t, { f0: 1600, f1: 900, dur: 0.06, gain: 0.035, dest }); // a toy drum
    for (const [at0, n, len] of MINI_MEL) if (at0 === k) { synth(t, hz(n), sp * len * 0.7, { gain: 0.05, attack: 0.01, release: 0.08, dest }); bellAt(t, hz(n + 12), 0.02, 0.35, dest); } // piccolo and glockenspiel
    if (k % 4 === 0) synth(t, hz([43, 50, 48, 50][(k / 4) % 4]), sp * 1.5, { gain: 0.09, attack: 0.005, release: 0.1, dest });
  } },
});
function schedule() {
  if (!ctx) return;
  const ahead = ctx.currentTime + 0.15;
  for (const [name, p] of playing) {
    const sp = 60 / p.def.bpm / 4;
    while (p.nextT < ahead) {
      if (p.step >= p.def.steps) { if (!p.def.loop) { const g = p.gain; setTimeout(() => g.disconnect(), 1500); playing.delete(name); break; } p.step = 0; }
      if (enabled) p.def.step(p.step, p.nextT, sp, p.gain);
      p.step++; p.nextT += sp;
    }
  }
  if (!playing.size) { clearInterval(timer); timer = null; }
}
// start a piece (again from the top); level: its own loudness, 0..1
export function music(name, { level = 1 } = {}) {
  const def = TRACKS[name]; if (!ctx || !def) return;
  if (!musicBus) { musicBus = ctx.createGain(); musicBus.gain.value = enabled ? MUSIC_VOL : 0; musicBus.connect(master); }
  stopMusic(name, 0.05);
  const gain = ctx.createGain(); gain.gain.value = level; gain.connect(musicBus);
  playing.set(name, { def, gain, step: 0, nextT: ctx.currentTime + 0.06, level });
  if (!timer) timer = setInterval(schedule, 25); schedule();
}
// fade a piece out (all pieces when no name)
export function stopMusic(name = null, fade = 0.6) {
  if (!ctx) return;
  for (const [n, p] of [...playing]) { if (name && n !== name) continue; const t = ctx.currentTime; p.gain.gain.cancelScheduledValues(t); p.gain.gain.setValueAtTime(p.gain.gain.value, t); p.gain.gain.linearRampToValueAtTime(0, t + fade); playing.delete(n); const g = p.gain; setTimeout(() => g.disconnect(), fade * 1000 + 200); }
}
// turn a playing piece down or back up (a scene's theme over the ride's tune)
export function duckMusic(name, level, time = 0.5) { const p = playing.get(name); if (!ctx || !p) return; const t = ctx.currentTime; p.gain.gain.cancelScheduledValues(t); p.gain.gain.setValueAtTime(p.gain.gain.value, t); p.gain.gain.linearRampToValueAtTime(level, t + time); }
export const hasMusic = name => !!TRACKS[name];

// Render a piece offline (no speakers) and measure it: its length and its loudness, to balance
// the places' themes against each other. For checks only (the browser test harness).
export async function measureTrack(name) {
  const def = TRACKS[name], OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext; if (!def || !OAC) return null;
  const sp = 60 / def.bpm / 4, secs = def.steps * sp + 2.5, off = new OAC(1, Math.ceil(secs * 44100), 44100);
  const saved = { ctx, noiseBuf, master }; ctx = off; master = off.createGain(); master.gain.value = 0.5; master.connect(off.destination);
  noiseBuf = off.createBuffer(1, off.sampleRate * 0.5, off.sampleRate); { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const bus = off.createGain(); bus.gain.value = MUSIC_VOL; bus.connect(master);
  try { for (let k = 0; k < def.steps; k++) def.step(k, 0.05 + k * sp, sp, bus); } finally { ({ ctx, noiseBuf, master } = saved); }
  const buf = await off.startRendering(), d = buf.getChannelData(0); let peak = 0, sum = 0, last = 0;
  for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += d[i] * d[i]; if (v > 0.002) last = i; }
  return { seconds: +(last / 44100).toFixed(2), peak: +peak.toFixed(3), rms: +Math.sqrt(sum / Math.max(1, last)).toFixed(4) };
}
