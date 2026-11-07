// English read-aloud with the browser's own speech voice (no network). Listening tasks use it;
// when the device has no English voice, the task card shows the words instead (reading support).
let voice = null, ready = false;
const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;

function pickVoice() {
  if (!synth) return;
  const vs = synth.getVoices().filter(v => /^en(-|_|$)/i.test(v.lang));
  voice = vs.find(v => /en-GB/i.test(v.lang) && v.localService) || vs.find(v => /en-GB/i.test(v.lang)) || vs.find(v => v.localService) || vs[0] || null;
  ready = true;
}
if (synth) { pickVoice(); synth.addEventListener?.('voiceschanged', pickVoice); }

// Words the voice gets wrong because they are spelled like another word (a homograph): spoken from
// a respelling, written as they are. In the units, "lead" is always the "leed" of a leader (önderlik
// etmek) or of a dog's lead (gezdirme kayışı), never the metal; "live" on its own is the verb (yaşamak).
export function spoken(text) {
  let t = String(text ?? '').replace(/\blead\b/gi, m => (m[0] === 'L' ? 'Leed' : 'leed')).replace(/\bleads\b/gi, m => (m[0] === 'L' ? 'Leeds' : 'leeds'));
  if (/^\s*live\s*[.!?]?\s*$/i.test(t)) t = 'liv';
  return t;
}
export const speech = {
  get available() { return !!(synth && voice); },
  get checked() { return ready; },
  speaking: false,
  // Speak `text` slowly and clearly. onend runs when done (or at once if there is no voice).
  say(text, { rate = 0.85, onend = null } = {}) {
    if (!synth || !voice) { onend?.(); return false; }
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(spoken(text));
      u.voice = voice; u.lang = voice.lang; u.rate = rate; u.pitch = 1.05;
      this.speaking = true;
      const done = () => { this.speaking = false; onend?.(); };
      u.onend = done; u.onerror = done;
      synth.speak(u);
      setTimeout(() => { if (this.speaking && !synth.speaking) done(); }, 400 + text.length * 120); // some browsers never fire onend
      return true;
    } catch { this.speaking = false; onend?.(); return false; }
  },
  stop() { try { synth?.cancel(); } catch { /* ignore */ } this.speaking = false; },
};
