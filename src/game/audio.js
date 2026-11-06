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
const TRACKS = {
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
