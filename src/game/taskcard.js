// The task card: slides in from the right over about half the screen, so the fight stays
// visible on the left. It shows one step at a time from the task generators (src/tasks) and
// reports every item: right first time or not. A wrong answer gets kind feedback, shows the right
// answer and the task carries on, so nobody gets stuck. On the Challenge pace each step has a
// timer, which pauses while the voice is speaking.
//
// The card is a shell: header, progress bar, timer, read-aloud, coach line and the scoring of
// items. What sits in its body is a scene (cards/scenes.js): a landmark scene where the task is
// wired into the place (build the Snow Castle's wall …) or the default layout for the task kind.
import { speech } from './speech.js';
import { esc, wait } from './cards/util.js';
import { sceneFor, worldSceneFor } from './cards/scenes.js';

// Little drawings for each outpost's card (inline SVG, no downloads)
export const THEME_ICON = {
  tram: '<svg viewBox="0 0 48 48"><path d="M24 4 L24 10" stroke="#2b2f45" stroke-width="2"/><rect x="8" y="10" width="32" height="28" rx="5" fill="#c8302e"/><rect x="8" y="24" width="32" height="5" fill="#f3ead8"/><rect x="12" y="14" width="10" height="8" rx="1.5" fill="#ffd98a"/><rect x="26" y="14" width="10" height="8" rx="1.5" fill="#ffd98a"/><circle cx="15" cy="41" r="3.5" fill="#2b2f45"/><circle cx="33" cy="41" r="3.5" fill="#2b2f45"/></svg>',
  recruit: '<svg viewBox="0 0 48 48"><path d="M8 10 H40 a4 4 0 0 1 4 4 V30 a4 4 0 0 1 -4 4 H22 L13 42 V34 H8 a4 4 0 0 1 -4 -4 V14 a4 4 0 0 1 4 -4 Z" fill="#fff"/><circle cx="16" cy="22" r="3" fill="#1f6fb2"/><circle cx="24" cy="22" r="3" fill="#1f6fb2"/><circle cx="32" cy="22" r="3" fill="#1f6fb2"/></svg>',
  schoolyard: '<svg viewBox="0 0 48 48"><rect x="8" y="8" width="4" height="34" rx="2" fill="#8a5a3c"/><rect x="36" y="8" width="4" height="34" rx="2" fill="#8a5a3c"/><rect x="6" y="6" width="36" height="5" rx="2" fill="#a86f4d"/><path d="M16 30 Q16 15 24 15 Q32 15 32 30 Z" fill="#f2c14e"/><rect x="14" y="29" width="20" height="4" rx="2" fill="#d19a2a"/><circle cx="24" cy="36" r="3" fill="#d19a2a"/><path d="M38 20 l5 -3 M38 25 h6 M38 30 l5 3" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
  archery: '<svg viewBox="0 0 48 48"><path d="M10 6 Q38 24 10 42" fill="none" stroke="#e8b84a" stroke-width="4" stroke-linecap="round"/><path d="M10 6 L10 42" stroke="#fff3d6" stroke-width="1.5"/><path d="M6 24 H42" stroke="#7a5a46" stroke-width="3"/><path d="M42 24 l-7 -5 v10 z" fill="#c8443c"/><path d="M6 24 l4 -4 M6 24 l4 4" stroke="#fff" stroke-width="2"/></svg>',
  waterfront: '<svg viewBox="0 0 48 48"><path d="M14 30 Q14 12 24 12 Q34 12 34 30 Z" fill="#d9a640"/><rect x="11" y="30" width="26" height="4" rx="2" fill="#b98a2e"/><circle cx="24" cy="37" r="3" fill="#3d4a6b"/><rect x="22" y="7" width="4" height="6" rx="2" fill="#b98a2e"/><path d="M38 16 q4 4 0 8 M41 13 q6 7 0 14" stroke="#fff" stroke-width="2" fill="none"/></svg>',
  kizilay: '<svg viewBox="0 0 48 48"><path d="M10 22 Q24 2 38 22 Z" fill="#8a96b8"/><rect x="6" y="21" width="36" height="4" rx="2" fill="#6b4e5e"/><rect x="11" y="25" width="26" height="15" fill="#2d6fb5"/><circle cx="18" cy="32" r="3.5" fill="#35b0b0"/><circle cx="30" cy="32" r="3.5" fill="#35b0b0"/><rect x="22" y="31" width="4" height="9" fill="#bfeeff"/><circle cx="24" cy="5" r="2" fill="#e8b84a"/></svg>',
  boulevard: '<svg viewBox="0 0 48 48"><rect x="20" y="24" width="8" height="20" fill="#a4968c"/><circle cx="14" cy="16" r="9" fill="#fff"/><circle cx="34" cy="15" r="10" fill="#fff"/><circle cx="24" cy="10" r="9" fill="#f4f7ff"/><rect x="13" y="20" width="22" height="3" fill="#b9845a"/><rect x="17" y="13" width="12" height="8" fill="#c8584a"/><path d="M16 13 L23 7 L30 13 Z" fill="#4f5a86"/><path d="M30 23 V40 M33 23 V40" stroke="#d9c08a" stroke-width="1.5"/></svg>',
  sururi: '<svg viewBox="0 0 48 48"><rect x="10" y="20" width="28" height="22" fill="#f2f6ff" stroke="#c9d3ee"/><rect x="6" y="14" width="9" height="28" fill="#f2f6ff" stroke="#c9d3ee"/><rect x="33" y="14" width="9" height="28" fill="#f2f6ff" stroke="#c9d3ee"/><path d="M5 14 L10.5 5 L16 14 Z" fill="#7cc4f0"/><path d="M32 14 L37.5 5 L43 14 Z" fill="#f3a6c8"/><path d="M20 42 V33 Q24 28 28 33 V42 Z" fill="#2b3556"/><rect x="18" y="22" width="6" height="6" fill="#fff" stroke="#2d6fb5"/><text x="21" y="27" font-size="5" font-weight="900" fill="#2d6fb5" text-anchor="middle">A</text></svg>',
  cocoa: '<svg viewBox="0 0 48 48"><path d="M12 18 H34 L31 40 H15 Z" fill="#e0463c"/><rect x="11" y="22" width="24" height="4" fill="#fff"/><ellipse cx="23" cy="18" rx="11" ry="3" fill="#6b3b22"/><path d="M34 22 q8 1 7 8 q-1 5 -9 4" stroke="#e0463c" stroke-width="3" fill="none"/><path d="M18 12 q-3 -4 0 -8 M24 12 q-3 -4 0 -8 M30 12 q-3 -4 0 -8" stroke="#fff" stroke-width="2" fill="none"/></svg>',
};

export class TaskCard {
  constructor(root, { onItem, onStepDone, timerFor = null, rng = Math.random, coach = () => {}, sound = () => {}, world = null, worldColor = null } = {}) {
    this.root = root; this.onItem = onItem; this.onStepDone = onStepDone; this.timerFor = timerFor; this.rng = rng; this.coach = coach; this.sound = sound; this.world = world; this.worldColor = worldColor;
    root.innerHTML = `<div class="tc-head"><div class="tc-icon"></div><div class="tc-titles"><div class="tc-title"></div><div class="tc-coach"></div></div><div class="tc-timer" hidden><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" class="bg"/><circle cx="18" cy="18" r="15" class="fg"/></svg><b></b></div></div>
      <div class="tc-bar"><i></i></div><div class="tc-body"></div>
      <div class="tc-foot"><button type="button" class="tc-say" aria-label="Read it aloud">🔊</button><span class="tc-note"></span><button type="button" class="tc-leave">Step out</button></div>`;
    this.$ = sel => root.querySelector(sel);
    this.$('.tc-say').onclick = () => this.readAloud();
    this.$('.tc-leave').onclick = () => this.onLeave?.();
    this.timeLeft = 0; this.timeTotal = 0; this.busy = false;
  }

  open({ theme, title, coach, leave = true }) {
    this.theme = theme; this.root.className = 'taskcard theme-' + theme; this.root.hidden = false;
    this.$('.tc-icon').innerHTML = THEME_ICON[theme] || '';
    this.$('.tc-title').textContent = title; this.$('.tc-coach').textContent = coach || '';
    this.$('.tc-leave').hidden = !leave;
    requestAnimationFrame(() => this.root.classList.add('in'));
  }
  setCoach(text) { this.$('.tc-coach').textContent = text; }
  setProgress(p) { this.$('.tc-bar i').style.width = Math.round(Math.min(1, p) * 100) + '%'; }
  chill() { this.root.classList.remove('chill'); void this.root.offsetWidth; this.root.classList.add('chill'); }
  close() { this.endScene(); this.leaveWorld(); this.root.classList.remove('in'); speech.stop(); this.step = null; clearTimeout(this.hideT); this.hideT = setTimeout(() => { if (!this.root.classList.contains('in')) this.root.hidden = true; }, 260); }
  get open_() { return !this.root.hidden && this.root.classList.contains('in'); }

  // ---------- timer (Challenge pace) ----------
  startTimer(step) {
    const t = this.timerFor ? this.timerFor(step) : 0;
    this.timeTotal = this.timeLeft = t; this.$('.tc-timer').hidden = !t; this.drawTimer();
  }
  drawTimer() {
    if (!this.timeTotal) return;
    const f = Math.max(0, this.timeLeft / this.timeTotal);
    this.$('.tc-timer .fg').style.strokeDashoffset = String(94.2 * (1 - f));
    this.$('.tc-timer b').textContent = Math.ceil(this.timeLeft);
    this.$('.tc-timer').classList.toggle('low', f < 0.3);
  }
  tick(dt) {
    if (!this.step || !this.timeTotal || this.busy || speech.speaking) return;
    this.timeLeft -= dt; this.drawTimer();
    if (this.timeLeft <= 0) { this.timeTotal = 0; this.timeUp?.(); }
  }

  readAloud() {
    const st = this.step; if (!st) return;
    const text = st.kind === 'listen' || st.kind === 'multi' ? st.speak : st.readAloud || st.prompt;
    if (text && (!st.promptLang || st.promptLang === 'en')) speech.say(text.replace(/…/g, ' '));
  }

  // ---------- one step ----------
  // theme: which landmark's scene to use (defaults to the card's theme; the Showdown passes the
  // outpost each banner belongs to)
  show(step, { theme = this.theme } = {}) {
    this.endScene();
    this.step = step; this.busy = false; this.timeUp = null;
    const body = this.$('.tc-body'); body.innerHTML = ''; body.className = 'tc-body k-' + step.kind;
    this.$('.tc-note').textContent = '';
    if (step.kind === 'order-pair') { this.showPair(step, theme); return; }
    // a task station (a staged 3D set) when this landmark has one for this kind of step
    const ws = this.world && worldSceneFor(step.kind, theme), session = ws ? this.world.open(theme) : null;
    if (session) {
      this.root.classList.add('world'); session.clearStep();
      const ctx = this.sceneCtx(step, body, theme); ctx.world = session; ctx.worldColor = this.worldColor;
      const end = ws(ctx); this.sceneEnd = typeof end === 'function' ? end : null; this.startTimer(step); this.world.tour(); this.onScene?.(theme, step); return;
    }
    this.leaveWorld();
    const scene = sceneFor(step.kind, theme);
    if (!scene) { this.finish(); return; } // a kind this arena never uses
    if (scene.cls) body.classList.add(scene.cls);
    const end = scene(this.sceneCtx(step, body, theme));
    this.sceneEnd = typeof end === 'function' ? end : null;
    this.startTimer(step);
  }
  // what a scene may use; timers it starts with later() are cleared when the step ends
  sceneCtx(step, body, theme) {
    const card = this, timers = this.sceneTimers = [];
    return {
      step, body, theme, rng: this.rng, speech, root: this.root,
      get busy() { return card.busy; },
      item: (id, ok) => this.item(id, ok),
      finish: (delay = 0) => this.finish(delay),
      reveal: (text, tr) => this.reveal(text, tr),
      coach: text => this.coach(text),
      note: text => { this.$('.tc-note').textContent = text; },
      sound: (name, opt) => this.sound(name, opt),
      onTimeUp: fn => { this.timeUp = fn; },
      later: (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; },
      reduceMotion: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false,
    };
  }
  get inWorld() { return this.root.classList.contains('world'); }
  leaveWorld() { if (this.inWorld) { this.world?.close(); this.root.classList.remove('world'); } }
  endScene() { for (const t of this.sceneTimers || []) clearTimeout(t); this.sceneTimers = []; this.sceneEnd?.(); this.sceneEnd = null; }
  showPair(st, theme) { // two sentences, one after the other
    const steps = st.steps.slice(), outer = this.onStepDone;
    const run = () => {
      const s = steps.shift();
      if (!s) { this.onStepDone = outer; this.step = st; this.finish(); return; }
      this.onStepDone = () => run();
      this.show(s, { theme });
    };
    run();
  }
  item(id, ok) { this.onItem?.({ itemId: id, correctFirstTry: ok }); if (this.inWorld) this.world.reward(ok); }
  async finish(delay = 0) { this.busy = true; this.timeTotal = 0; this.$('.tc-timer').hidden = true; if (delay) await wait(delay); if (this.step) { this.step = null; this.onStepDone?.(); } }
  reveal(text, tr = null) { const html = `✓ ${esc(text)}${tr ? ` <span class="tr">${esc(tr)}</span>` : ''}`; this.$('.tc-note').innerHTML = html; if (this.inWorld) this.world.session?.say(html); }
}
