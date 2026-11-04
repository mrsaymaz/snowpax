// The default task scenes: the plain card layouts every task kind has. Landmark scenes
// (scenes.js) replace them where one exists; these stay as the fallback.
// A scene gets a ctx from the card shell (taskcard.js) and must report every item exactly once
// with ctx.item(id, rightFirstTry), then call ctx.finish(delay) when the step is done.
import { esc, shuffle } from './util.js';

// one answer out of 3 (clue → word, sentence ending, fill the gap …)
export function choiceScene(ctx) {
  const { step: st, body } = ctx;
  body.innerHTML = `${st.context ? `<div class="tc-context">${esc(st.context)}</div>` : ''}<div class="tc-prompt" ${st.promptLang === 'tr' ? 'lang="tr"' : ''}>${esc(st.prompt)}</div>${st.hintTr ? `<div class="tc-tr">${esc(st.hintTr)}</div>` : ''}<div class="tc-opts"></div>`;
  options(ctx, body.querySelector('.tc-opts'), st.options.map(o => ({ html: esc(o) })), () => { if (st.readback) ctx.speech.say(st.readback); });
}

// hear a word, pick it (with pictures when the bank has them)
export function listenScene(ctx) {
  const { step: st, body, speech } = ctx, voice = speech.available;
  body.innerHTML = `<button type="button" class="tc-play" aria-label="Listen again">🔊<span>${voice ? 'Listen' : esc(st.fallbackText || st.speak)}</span></button><div class="tc-prompt">${esc(st.prompt)}</div><div class="tc-opts"></div>`;
  const play = () => speech.say(st.speak);
  body.querySelector('.tc-play').onclick = play;
  if (voice) ctx.later(play, 350); else ctx.note('No English voice on this device: read the word instead.');
  options(ctx, body.querySelector('.tc-opts'), st.options.map((o, i) => ({ html: st.pics?.[i] ? `<img src="${esc(st.pics[i])}" alt=""><span>${esc(o)}</span>` : esc(o) })));
}

// buttons for a one-of-n step; a wrong tap shows the right one glowing
export function options(ctx, box, opts, onRight = null) {
  const st = ctx.step; let tried = false;
  opts.forEach((o, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tc-opt'; b.innerHTML = o.html; box.appendChild(b);
    b.onclick = () => {
      if (ctx.busy) return;
      if (i === st.answer) { b.classList.add('right'); ctx.item(st.sourceIds?.[0], !tried); onRight?.(); ctx.reveal(st.readback || st.answerText || st.options[st.answer]); ctx.finish(tried ? 900 : 700); }
      else { b.classList.add('wrong'); if (!tried) { tried = true; ctx.coach(`Not quite. It's "${st.options[st.answer]}".`); } box.children[st.answer].classList.add('show'); }
    };
  });
  ctx.onTimeUp(() => { if (!tried) ctx.item(st.sourceIds?.[0], false); box.children[st.answer].classList.add('show', 'right'); ctx.coach(`Time's up! It's "${st.options[st.answer]}".`); ctx.finish(1500); });
}

// connect pairs: tap one side, then the other
export function matchScene(ctx) {
  const { step: st, body } = ctx;
  const tile = t => (t.pic ? `<img src="${esc(t.pic)}" alt="${esc(t.alt || '')}">` : `<span ${t.lang === 'tr' ? 'lang="tr"' : ''}>${esc(t.text)}</span>`);
  body.innerHTML = `<div class="tc-prompt">${esc(st.prompt)}</div><div class="tc-match"><div class="col l"></div><div class="col r"></div></div>`;
  const L = body.querySelector('.col.l'), R = body.querySelector('.col.r'), right = shuffle(st.right, ctx.rng);
  const missed = new Set(), done = new Set(), els = new Map(); let sel = null;
  const mk = (t, side, box) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tc-tile'; b.innerHTML = tile(t); b.dataset.id = t.id; box.appendChild(b); els.set(t.id, b); b.onclick = () => pick(t.id, side); };
  st.left.forEach(t => mk(t, 'L', L)); right.forEach(t => mk(t, 'R', R));
  const partnerOf = id => (id.startsWith('L') ? st.pairs[id] : Object.keys(st.pairs).find(k => st.pairs[k] === id));
  const srcOf = lid => st.sourceIds?.[st.left.findIndex(l => l.id === lid)];
  const pick = (id, side) => {
    if (ctx.busy || done.has(id.startsWith('L') ? id : partnerOf(id))) return;
    if (!sel || sel.side === side) { if (sel) els.get(sel.id).classList.remove('sel'); sel = { id, side }; els.get(id).classList.add('sel'); return; }
    const lid = side === 'L' ? id : sel.id, rid = side === 'R' ? id : sel.id;
    els.get(sel.id).classList.remove('sel'); sel = null;
    if (st.pairs[lid] === rid) {
      done.add(lid); for (const x of [lid, rid]) els.get(x).classList.add('right', 'locked'); els.get(rid).classList.remove('show');
      ctx.item(srcOf(lid), !missed.has(lid));
      if (done.size === st.left.length) ctx.finish(600);
    } else {
      for (const x of [lid, rid]) { els.get(x).classList.remove('wrong'); void els.get(x).offsetWidth; els.get(x).classList.add('wrong'); }
      if (!missed.has(lid)) { missed.add(lid); ctx.coach('Not that one. Look for the glowing match!'); }
      els.get(st.pairs[lid]).classList.add('show');
    }
  };
  ctx.onTimeUp(() => { for (const l of st.left) if (!done.has(l.id)) { done.add(l.id); ctx.item(srcOf(l.id), false); els.get(l.id).classList.add('right'); els.get(st.pairs[l.id]).classList.add('right'); } ctx.coach("Time's up! Here are the matches."); ctx.finish(1600); });
}

// sort cards into 2–3 groups: tap a card, then its group
export function sortScene(ctx) {
  const { step: st, body } = ctx;
  body.innerHTML = `<div class="tc-prompt">${esc(st.prompt)}</div><div class="tc-cards"></div><div class="tc-bins"></div>`;
  const cards = body.querySelector('.tc-cards'), bins = body.querySelector('.tc-bins');
  let sel = null, left = st.cards.length; const missed = new Set();
  const binEls = st.categories.map((c, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tc-bin'; b.innerHTML = `<b>${esc(c.title)}</b>${c.titleTr ? `<span class="tr">${esc(c.titleTr)}</span>` : ''}<div class="in"></div>`; bins.appendChild(b); b.onclick = () => drop(i); return b; });
  const cardEls = new Map();
  shuffle(st.cards, ctx.rng).forEach(c => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tc-card'; b.textContent = c.text; cards.appendChild(b); cardEls.set(c.id, b); b.onclick = () => { if (ctx.busy || b.classList.contains('placed')) return; if (sel) cardEls.get(sel.id).classList.remove('sel'); sel = c; b.classList.add('sel'); }; });
  const place = (c, ok) => { const b = cardEls.get(c.id); b.classList.remove('sel', 'wrong'); b.classList.add('placed', ok ? 'right' : 'fixed'); binEls[c.cat].querySelector('.in').appendChild(b); left--; if (!left) ctx.finish(700); };
  const drop = i => {
    if (ctx.busy || !sel) return; const c = sel; sel = null;
    if (c.cat === i) { ctx.item(c.id, !missed.has(c.id)); place(c, true); }
    else {
      const b = cardEls.get(c.id); b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong'); binEls[i].classList.add('no'); ctx.later(() => binEls[i].classList.remove('no'), 400);
      if (!missed.has(c.id)) { missed.add(c.id); ctx.item(c.id, false); ctx.coach(`"${c.text}" goes in "${st.categories[c.cat].title}".`); ctx.later(() => place(c, false), 900); }
    }
  };
  ctx.onTimeUp(() => { for (const c of st.cards) { const b = cardEls.get(c.id); if (!b.classList.contains('placed')) { if (!missed.has(c.id)) ctx.item(c.id, false); missed.add(c.id); place(c, false); } } ctx.coach("Time's up! Look where they go."); });
}

// build a sentence: tap the blocks in order (tap a placed block to take it back)
export function orderScene(ctx) {
  const { step: st, body } = ctx;
  body.innerHTML = `<div class="tc-prompt">${esc(st.prompt || 'Build the sentence.')}</div>${st.hintTr ? `<div class="tc-tr">${esc(st.hintTr)}</div>` : ''}<div class="tc-line"></div><div class="tc-blocks"></div>`;
  const line = body.querySelector('.tc-line'), pool = body.querySelector('.tc-blocks'), placed = []; let tried = false;
  const norm = s => s.replace(/\s+/g, ' ').trim().toLowerCase();
  shuffle(st.blocks, ctx.rng).forEach(bk => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tc-block'; b.textContent = bk.text; pool.appendChild(b);
    b.onclick = () => { if (ctx.busy) return; if (b.parentNode === pool) { line.appendChild(b); placed.push(bk); check(); } else { pool.appendChild(b); placed.splice(placed.indexOf(bk), 1); } };
  });
  const check = () => {
    if (placed.length < st.blocks.length) return;
    if (norm(placed.map(b => b.text).join(' ')) === norm(st.text)) { line.classList.add('right'); ctx.item(st.sourceIds?.[0], !tried); ctx.reveal(st.text, st.meaningTr); ctx.speech.say(st.text); ctx.finish(1800); }
    else {
      line.classList.remove('wrong'); void line.offsetWidth; line.classList.add('wrong');
      if (!tried) { tried = true; ctx.item(st.sourceIds?.[0], false); ctx.coach('Almost! Here is the sentence.'); ctx.reveal(st.text, st.meaningTr); ctx.later(() => ctx.finish(), 2200); }
    }
  };
  ctx.onTimeUp(() => { if (!tried) ctx.item(st.sourceIds?.[0], false); tried = true; ctx.reveal(st.text, st.meaningTr); ctx.coach("Time's up! Here is the sentence."); ctx.finish(2200); });
}

// spell a word with letter tiles
export function spellScene(ctx) {
  const { step: st, body } = ctx;
  body.innerHTML = `<div class="tc-prompt">${st.pic ? `<img class="tc-pic" src="${esc(st.pic)}" alt="">` : ''}<span ${st.promptLang === 'tr' ? 'lang="tr"' : ''}>${esc(st.prompt)}</span></div><div class="tc-word"></div><div class="tc-letters"></div><button type="button" class="tc-back" aria-label="Take back a letter">⌫</button>`;
  const word = body.querySelector('.tc-word'), letters = body.querySelector('.tc-letters'), ans = st.answerText; let typed = st.given || '', tried = false;
  const draw = () => { word.innerHTML = [...ans].map((ch, i) => `<span class="${i < typed.length ? 'on' : ''}">${i < typed.length ? esc(typed[i]) : ''}</span>`).join(''); };
  const used = [];
  shuffle(st.tiles, ctx.rng).forEach(t => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tc-letter'; b.textContent = t; letters.appendChild(b);
    b.onclick = () => { if (ctx.busy || b.disabled) return; typed += t; b.disabled = true; used.push(b); draw(); check(); };
  });
  body.querySelector('.tc-back').onclick = () => { if (ctx.busy || typed.length <= (st.given || '').length) return; typed = typed.slice(0, -1); used.pop().disabled = false; draw(); };
  const check = () => {
    if (typed.length < ans.length) return;
    if (typed.toLowerCase() === ans.toLowerCase()) { word.classList.add('right'); ctx.item(st.sourceIds?.[0], !tried); ctx.speech.say(ans); ctx.reveal(ans); ctx.finish(1000); }
    else {
      word.classList.remove('wrong'); void word.offsetWidth; word.classList.add('wrong'); if (!tried) { tried = true; ctx.item(st.sourceIds?.[0], false); ctx.coach(`It's spelled ${ans.toUpperCase().split('').join('-')}.`); }
      typed = ans; draw(); ctx.finish(1800);
    }
  };
  draw();
  ctx.onTimeUp(() => { if (!tried) ctx.item(st.sourceIds?.[0], false); tried = true; typed = ans; draw(); ctx.coach(`Time's up! It's spelled ${ans.toUpperCase().split('').join('-')}.`); ctx.finish(1800); });
}
