// The task card: slides in from the right over about half the screen, so the fight stays
// visible on the left. It shows one step at a time from the task generators (src/tasks) and
// reports every item: right first time or not. A wrong answer gets kind feedback, shows the right
// answer and the task carries on, so nobody gets stuck. On the Challenge pace each step has a
// timer, which pauses while the voice is speaking.
import { speech } from './speech.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = (a, rng = Math.random) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const wait = ms => new Promise(r => setTimeout(r, ms));

// Little drawings for each outpost's card (inline SVG, no downloads)
export const THEME_ICON = {
  archery: '<svg viewBox="0 0 48 48"><path d="M10 6 Q38 24 10 42" fill="none" stroke="#e8b84a" stroke-width="4" stroke-linecap="round"/><path d="M10 6 L10 42" stroke="#fff3d6" stroke-width="1.5"/><path d="M6 24 H42" stroke="#7a5a46" stroke-width="3"/><path d="M42 24 l-7 -5 v10 z" fill="#c8443c"/><path d="M6 24 l4 -4 M6 24 l4 4" stroke="#fff" stroke-width="2"/></svg>',
  waterfront: '<svg viewBox="0 0 48 48"><path d="M14 30 Q14 12 24 12 Q34 12 34 30 Z" fill="#d9a640"/><rect x="11" y="30" width="26" height="4" rx="2" fill="#b98a2e"/><circle cx="24" cy="37" r="3" fill="#3d4a6b"/><rect x="22" y="7" width="4" height="6" rx="2" fill="#b98a2e"/><path d="M38 16 q4 4 0 8 M41 13 q6 7 0 14" stroke="#fff" stroke-width="2" fill="none"/></svg>',
  kizilay: '<svg viewBox="0 0 48 48"><path d="M10 22 Q24 2 38 22 Z" fill="#8a96b8"/><rect x="6" y="21" width="36" height="4" rx="2" fill="#6b4e5e"/><rect x="11" y="25" width="26" height="15" fill="#2d6fb5"/><circle cx="18" cy="32" r="3.5" fill="#35b0b0"/><circle cx="30" cy="32" r="3.5" fill="#35b0b0"/><rect x="22" y="31" width="4" height="9" fill="#bfeeff"/><circle cx="24" cy="5" r="2" fill="#e8b84a"/></svg>',
  boulevard: '<svg viewBox="0 0 48 48"><rect x="20" y="24" width="8" height="20" fill="#a4968c"/><circle cx="14" cy="16" r="9" fill="#fff"/><circle cx="34" cy="15" r="10" fill="#fff"/><circle cx="24" cy="10" r="9" fill="#f4f7ff"/><rect x="13" y="20" width="22" height="3" fill="#b9845a"/><rect x="17" y="13" width="12" height="8" fill="#c8584a"/><path d="M16 13 L23 7 L30 13 Z" fill="#4f5a86"/><path d="M30 23 V40 M33 23 V40" stroke="#d9c08a" stroke-width="1.5"/></svg>',
  sururi: '<svg viewBox="0 0 48 48"><rect x="10" y="20" width="28" height="22" fill="#f2f6ff" stroke="#c9d3ee"/><rect x="6" y="14" width="9" height="28" fill="#f2f6ff" stroke="#c9d3ee"/><rect x="33" y="14" width="9" height="28" fill="#f2f6ff" stroke="#c9d3ee"/><path d="M5 14 L10.5 5 L16 14 Z" fill="#7cc4f0"/><path d="M32 14 L37.5 5 L43 14 Z" fill="#f3a6c8"/><path d="M20 42 V33 Q24 28 28 33 V42 Z" fill="#2b3556"/><rect x="18" y="22" width="6" height="6" fill="#fff" stroke="#2d6fb5"/><text x="21" y="27" font-size="5" font-weight="900" fill="#2d6fb5" text-anchor="middle">A</text></svg>',
  cocoa: '<svg viewBox="0 0 48 48"><path d="M12 18 H34 L31 40 H15 Z" fill="#e0463c"/><rect x="11" y="22" width="24" height="4" fill="#fff"/><ellipse cx="23" cy="18" rx="11" ry="3" fill="#6b3b22"/><path d="M34 22 q8 1 7 8 q-1 5 -9 4" stroke="#e0463c" stroke-width="3" fill="none"/><path d="M18 12 q-3 -4 0 -8 M24 12 q-3 -4 0 -8 M30 12 q-3 -4 0 -8" stroke="#fff" stroke-width="2" fill="none"/></svg>',
};

export class TaskCard {
  constructor(root, { onItem, onStepDone, timerFor = null, rng = Math.random, coach = () => {} } = {}) {
    this.root = root; this.onItem = onItem; this.onStepDone = onStepDone; this.timerFor = timerFor; this.rng = rng; this.coach = coach;
    root.innerHTML = `<div class="tc-head"><div class="tc-icon"></div><div class="tc-titles"><div class="tc-title"></div><div class="tc-coach"></div></div><div class="tc-timer" hidden><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" class="bg"/><circle cx="18" cy="18" r="15" class="fg"/></svg><b></b></div></div>
      <div class="tc-bar"><i></i></div><div class="tc-body"></div>
      <div class="tc-foot"><button type="button" class="tc-say" aria-label="Read it aloud">🔊</button><span class="tc-note"></span><button type="button" class="tc-leave">Step out</button></div>`;
    this.$ = sel => root.querySelector(sel);
    this.$('.tc-say').onclick = () => this.readAloud();
    this.$('.tc-leave').onclick = () => this.onLeave?.();
    this.timeLeft = 0; this.timeTotal = 0; this.busy = false;
  }

  open({ theme, title, coach, leave = true }) {
    this.root.className = 'taskcard theme-' + theme; this.root.hidden = false;
    this.$('.tc-icon').innerHTML = THEME_ICON[theme] || '';
    this.$('.tc-title').textContent = title; this.$('.tc-coach').textContent = coach || '';
    this.$('.tc-leave').hidden = !leave;
    requestAnimationFrame(() => this.root.classList.add('in'));
  }
  setCoach(text) { this.$('.tc-coach').textContent = text; }
  setProgress(p) { this.$('.tc-bar i').style.width = Math.round(Math.min(1, p) * 100) + '%'; }
  chill() { this.root.classList.remove('chill'); void this.root.offsetWidth; this.root.classList.add('chill'); }
  close() { this.root.classList.remove('in'); speech.stop(); this.step = null; clearTimeout(this.hideT); this.hideT = setTimeout(() => { if (!this.root.classList.contains('in')) this.root.hidden = true; }, 260); }
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
  show(step) {
    this.step = step; this.busy = false; this.timeUp = null;
    const body = this.$('.tc-body'); body.innerHTML = ''; body.className = 'tc-body k-' + step.kind;
    this.$('.tc-note').textContent = '';
    const fn = this['r_' + step.kind.replace('-', '_')];
    if (!fn) { this.finish(); return; } // a kind this arena never uses
    fn.call(this, step, body);
    this.startTimer(step);
  }
  item(id, ok) { this.onItem?.({ itemId: id, correctFirstTry: ok }); }
  async finish(delay = 0) { this.busy = true; this.timeTotal = 0; this.$('.tc-timer').hidden = true; if (delay) await wait(delay); if (this.step) { this.step = null; this.onStepDone?.(); } }
  reveal(text, tr = null) { this.$('.tc-note').innerHTML = `✓ ${esc(text)}${tr ? ` <span class="tr">${esc(tr)}</span>` : ''}`; }

  // one answer out of 3 (clue → word, sentence ending, fill the gap …)
  r_choice(st, body) {
    body.innerHTML = `${st.context ? `<div class="tc-context">${esc(st.context)}</div>` : ''}<div class="tc-prompt" ${st.promptLang === 'tr' ? 'lang="tr"' : ''}>${esc(st.prompt)}</div>${st.hintTr ? `<div class="tc-tr">${esc(st.hintTr)}</div>` : ''}<div class="tc-opts"></div>`;
    this.options(st, body.querySelector('.tc-opts'), st.options.map(o => ({ html: esc(o) })), () => { if (st.readback) speech.say(st.readback); });
  }
  // hear a word, pick it (with pictures when the bank has them)
  r_listen(st, body) {
    const voice = speech.available;
    body.innerHTML = `<button type="button" class="tc-play" aria-label="Listen again">🔊<span>${voice ? 'Listen' : esc(st.fallbackText || st.speak)}</span></button><div class="tc-prompt">${esc(st.prompt)}</div><div class="tc-opts"></div>`;
    const play = () => speech.say(st.speak);
    body.querySelector('.tc-play').onclick = play;
    if (voice) setTimeout(play, 350); else this.$('.tc-note').textContent = 'No English voice on this device: read the word instead.';
    this.options(st, body.querySelector('.tc-opts'), st.options.map((o, i) => ({ html: st.pics?.[i] ? `<img src="${esc(st.pics[i])}" alt=""><span>${esc(o)}</span>` : esc(o) })));
  }
  options(st, box, opts, onRight = null) {
    let tried = false;
    opts.forEach((o, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tc-opt'; b.innerHTML = o.html; box.appendChild(b);
      b.onclick = () => {
        if (this.busy) return;
        if (i === st.answer) { b.classList.add('right'); this.item(st.sourceIds?.[0], !tried); onRight?.(); this.reveal(st.readback || st.answerText || st.options[st.answer]); this.finish(tried ? 900 : 700); }
        else { b.classList.add('wrong'); if (!tried) { tried = true; this.coach(`Not quite. It's "${st.options[st.answer]}".`); } box.children[st.answer].classList.add('show'); }
      };
    });
    this.timeUp = () => { if (!tried) this.item(st.sourceIds?.[0], false); box.children[st.answer].classList.add('show', 'right'); this.coach(`Time's up! It's "${st.options[st.answer]}".`); this.finish(1500); };
  }

  // connect pairs: tap one side, then the other
  r_match(st, body) {
    const tile = t => (t.pic ? `<img src="${esc(t.pic)}" alt="${esc(t.alt || '')}">` : `<span ${t.lang === 'tr' ? 'lang="tr"' : ''}>${esc(t.text)}</span>`);
    body.innerHTML = `<div class="tc-prompt">${esc(st.prompt)}</div><div class="tc-match"><div class="col l"></div><div class="col r"></div></div>`;
    const L = body.querySelector('.col.l'), R = body.querySelector('.col.r'), right = shuffle(st.right, this.rng);
    const missed = new Set(), done = new Set(); let sel = null;
    const els = new Map();
    const mk = (t, side, box) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tc-tile'; b.innerHTML = tile(t); b.dataset.id = t.id; box.appendChild(b); els.set(t.id, b); b.onclick = () => pick(t.id, side); };
    st.left.forEach(t => mk(t, 'L', L)); right.forEach(t => mk(t, 'R', R));
    const partnerOf = id => (id.startsWith('L') ? st.pairs[id] : Object.keys(st.pairs).find(k => st.pairs[k] === id));
    const srcOf = lid => st.sourceIds?.[st.left.findIndex(l => l.id === lid)];
    const pick = (id, side) => {
      if (this.busy || done.has(id.startsWith('L') ? id : partnerOf(id))) return;
      if (!sel || sel.side === side) { if (sel) els.get(sel.id).classList.remove('sel'); sel = { id, side }; els.get(id).classList.add('sel'); return; }
      const lid = side === 'L' ? id : sel.id, rid = side === 'R' ? id : sel.id;
      els.get(sel.id).classList.remove('sel'); sel = null;
      if (st.pairs[lid] === rid) {
        done.add(lid); for (const x of [lid, rid]) els.get(x).classList.add('right', 'locked'); els.get(rid).classList.remove('show');
        this.item(srcOf(lid), !missed.has(lid));
        if (done.size === st.left.length) this.finish(600);
      } else {
        for (const x of [lid, rid]) { els.get(x).classList.remove('wrong'); void els.get(x).offsetWidth; els.get(x).classList.add('wrong'); }
        if (!missed.has(lid)) { missed.add(lid); this.coach('Not that one. Look for the glowing match!'); }
        els.get(st.pairs[lid]).classList.add('show');
      }
    };
    this.timeUp = () => { for (const l of st.left) if (!done.has(l.id)) { done.add(l.id); this.item(srcOf(l.id), false); els.get(l.id).classList.add('right'); els.get(st.pairs[l.id]).classList.add('right'); } this.coach("Time's up! Here are the matches."); this.finish(1600); };
  }

  // sort cards into 2–3 groups: tap a card, then its group
  r_sort(st, body) {
    body.innerHTML = `<div class="tc-prompt">${esc(st.prompt)}</div><div class="tc-cards"></div><div class="tc-bins"></div>`;
    const cards = body.querySelector('.tc-cards'), bins = body.querySelector('.tc-bins');
    let sel = null; const missed = new Set(); let left = st.cards.length;
    const binEls = st.categories.map((c, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tc-bin'; b.innerHTML = `<b>${esc(c.title)}</b>${c.titleTr ? `<span class="tr">${esc(c.titleTr)}</span>` : ''}<div class="in"></div>`; bins.appendChild(b); b.onclick = () => drop(i); return b; });
    const cardEls = new Map();
    shuffle(st.cards, this.rng).forEach(c => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tc-card'; b.textContent = c.text; cards.appendChild(b); cardEls.set(c.id, b); b.onclick = () => { if (this.busy || b.classList.contains('placed')) return; if (sel) cardEls.get(sel.id).classList.remove('sel'); sel = c; b.classList.add('sel'); }; });
    const place = (c, ok) => { const b = cardEls.get(c.id); b.classList.remove('sel', 'wrong'); b.classList.add('placed', ok ? 'right' : 'fixed'); binEls[c.cat].querySelector('.in').appendChild(b); left--; if (!left) this.finish(700); };
    const drop = i => {
      if (this.busy || !sel) return; const c = sel; sel = null;
      if (c.cat === i) { this.item(c.id, !missed.has(c.id)); place(c, true); }
      else { const b = cardEls.get(c.id); b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong'); binEls[i].classList.add('no'); setTimeout(() => binEls[i].classList.remove('no'), 400);
        if (!missed.has(c.id)) { missed.add(c.id); this.item(c.id, false); this.coach(`"${c.text}" goes in "${st.categories[c.cat].title}".`); setTimeout(() => place(c, false), 900); } }
    };
    this.timeUp = () => { for (const c of st.cards) { const b = cardEls.get(c.id); if (!b.classList.contains('placed')) { if (!missed.has(c.id)) this.item(c.id, false); missed.add(c.id); place(c, false); } } this.coach("Time's up! Look where they go."); };
  }

  // build a sentence: tap the blocks in order (tap a placed block to take it back)
  r_order(st, body) {
    body.innerHTML = `<div class="tc-prompt">${esc(st.prompt || 'Build the sentence.')}</div>${st.hintTr ? `<div class="tc-tr">${esc(st.hintTr)}</div>` : ''}<div class="tc-line"></div><div class="tc-blocks"></div>`;
    const line = body.querySelector('.tc-line'), pool = body.querySelector('.tc-blocks'), placed = []; let tried = false;
    const norm = s => s.replace(/\s+/g, ' ').trim().toLowerCase();
    shuffle(st.blocks, this.rng).forEach(bk => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tc-block'; b.textContent = bk.text; pool.appendChild(b);
      b.onclick = () => { if (this.busy) return; if (b.parentNode === pool) { line.appendChild(b); placed.push(bk); check(); } else { pool.appendChild(b); placed.splice(placed.indexOf(bk), 1); } }; });
    const check = () => {
      if (placed.length < st.blocks.length) return;
      if (norm(placed.map(b => b.text).join(' ')) === norm(st.text)) { line.classList.add('right'); this.item(st.sourceIds?.[0], !tried); this.reveal(st.text, st.meaningTr); speech.say(st.text); this.finish(1800); }
      else { line.classList.remove('wrong'); void line.offsetWidth; line.classList.add('wrong');
        if (!tried) { tried = true; this.item(st.sourceIds?.[0], false); this.coach('Almost! Here is the sentence.'); this.reveal(st.text, st.meaningTr); setTimeout(() => this.finish(), 2200); } }
    };
    this.timeUp = () => { if (!tried) this.item(st.sourceIds?.[0], false); tried = true; this.reveal(st.text, st.meaningTr); this.coach("Time's up! Here is the sentence."); this.finish(2200); };
  }
  r_order_pair(st, body) { // two sentences, one after the other
    const steps = st.steps.slice(); const run = () => { const s = steps.shift(); if (!s) { this.finish(); return; } const done = this.onStepDone; this.onStepDone = () => { this.onStepDone = done; this.step = st; run(); }; this.step = s; body.innerHTML = ''; this.r_order(s, body); this.step = s; };
    run();
  }

  // spell a word with letter tiles
  r_spell(st, body) {
    body.innerHTML = `<div class="tc-prompt">${st.pic ? `<img class="tc-pic" src="${esc(st.pic)}" alt="">` : ''}<span ${st.promptLang === 'tr' ? 'lang="tr"' : ''}>${esc(st.prompt)}</span></div><div class="tc-word"></div><div class="tc-letters"></div><button type="button" class="tc-back" aria-label="Take back a letter">⌫</button>`;
    const word = body.querySelector('.tc-word'), letters = body.querySelector('.tc-letters'), ans = st.answerText; let typed = st.given || '', tried = false;
    const draw = () => { word.innerHTML = [...ans].map((ch, i) => `<span class="${i < typed.length ? 'on' : ''}">${i < typed.length ? esc(typed[i]) : ''}</span>`).join(''); };
    const used = [];
    shuffle(st.tiles, this.rng).forEach(t => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tc-letter'; b.textContent = t; letters.appendChild(b);
      b.onclick = () => { if (this.busy || b.disabled) return; typed += t; b.disabled = true; used.push(b); draw(); check(); }; });
    body.querySelector('.tc-back').onclick = () => { if (this.busy || typed.length <= (st.given || '').length) return; typed = typed.slice(0, -1); used.pop().disabled = false; draw(); };
    const check = () => {
      if (typed.length < ans.length) return;
      if (typed.toLowerCase() === ans.toLowerCase()) { word.classList.add('right'); this.item(st.sourceIds?.[0], !tried); speech.say(ans); this.reveal(ans); this.finish(1000); }
      else { word.classList.remove('wrong'); void word.offsetWidth; word.classList.add('wrong'); if (!tried) { tried = true; this.item(st.sourceIds?.[0], false); this.coach(`It's spelled ${ans.toUpperCase().split('').join('-')}.`); }
        typed = ans; draw(); this.finish(1800); }
    };
    draw();
    this.timeUp = () => { if (!tried) this.item(st.sourceIds?.[0], false); tried = true; typed = ans; draw(); this.coach(`Time's up! It's spelled ${ans.toUpperCase().split('').join('-')}.`); this.finish(1800); };
  }
}
