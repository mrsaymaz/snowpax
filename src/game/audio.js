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
export function setSound(on) { enabled = on; }

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
    case 'capture': [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 0.16, 'triangle'), i * 110)); break;
  }
}
