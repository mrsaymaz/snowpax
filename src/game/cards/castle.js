// The Snow Castle (Sururi Park): Builder tasks build the castle. Sentence blocks are snow bricks
// laid one at a time, in order, along the top of the castle wall; each right brick flies into
// place and rings a note, and the finished sentence raises the castle's flag. Spelling drops ice
// letters into the mould over the gate the same way. A wrong brick wobbles and slides back, the
// right one glows, and the step goes on (first-try credit is lost, as on every card).
import { esc, shuffle, blockOrder } from './util.js';

const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1567.98, 1760]; // C D E G A, up the scale

function castleHTML(slots, kind) {
  return `<div class="cs-stage ${kind}" aria-hidden="false">
    <div class="cs-sky"><i class="f1"></i><i class="f2"></i><i class="f3"></i></div>
    <div class="cs-castle">
      <div class="cs-tower l"><span class="cren"></span><span class="win"></span></div>
      <div class="cs-mid"><div class="cs-course" role="list" aria-label="${kind === 'spell' ? 'The word' : 'The sentence'}">${slots}</div><div class="cs-gate"></div></div>
      <div class="cs-tower r"><span class="cren"></span><span class="win"></span><div class="cs-pole"><div class="cs-flag"></div></div></div>
    </div>
    <div class="cs-ground"></div>
  </div>`;
}

// fly a copy of el from where it is to where `to` is, then call done (instant with reduced motion)
function fly(ctx, el, to, done) {
  if (ctx.reduceMotion || !el.getBoundingClientRect) { done(); return; }
  const a = el.getBoundingClientRect(), b = to.getBoundingClientRect(), ghost = el.cloneNode(true);
  ghost.classList.add('cs-ghost'); ghost.classList.remove('show', 'wrong');
  Object.assign(ghost.style, { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px' });
  document.body.appendChild(ghost);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  ghost.animate([{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${dx * 0.5}px, ${dy - 46}px) rotate(-8deg)`, offset: 0.55 }, { transform: `translate(${dx}px, ${dy}px) rotate(0)` }], { duration: 420, easing: 'cubic-bezier(.3,.7,.4,1)' }).onfinish = () => { ghost.remove(); done(); };
}

// a builder scene for a list of pieces that must go in a fixed order
function buildScene(ctx, { pieces, expected, kind, prompt, sayAtEnd, revealText, revealTr, onWrongCoach }) {
  const { body } = ctx;
  const slots = expected.map((p, i) => `<span class="cs-slot${p.given ? ' set given' : ''}" role="listitem" data-i="${i}">${p.given ? esc(p.text) : ''}</span>`).join('');
  body.innerHTML = `${prompt}${castleHTML(slots, kind)}<div class="cs-pile"></div>`;
  const stage = body.querySelector('.cs-stage'), course = body.querySelector('.cs-course'), pile = body.querySelector('.cs-pile');
  let next = expected.findIndex(p => !p.given), tried = false, done = false;
  if (next < 0) next = expected.length;
  const bricks = shuffle(pieces, ctx.rng).map(p => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'cs-brick ' + kind; b.textContent = p.text; b.dataset.k = p.key;
    pile.appendChild(b); b.onclick = () => tap(b, p); return b;
  });
  const glowNext = () => { for (const b of bricks) b.classList.toggle('show', !b.disabled && b.dataset.k === expected[next]?.key); };
  const complete = right => {
    done = true; stage.classList.add('done'); ctx.sound('capture');
    ctx.item(ctx.step.sourceIds?.[0], right);
    ctx.reveal(revealText, revealTr); if (sayAtEnd) ctx.speech.say(sayAtEnd);
    ctx.finish(right ? 1700 : 2100);
  };
  const lay = (b, i) => {
    b.disabled = true; b.classList.remove('show');
    const slot = course.children[i];
    fly(ctx, b, slot, () => { slot.textContent = expected[i].text; slot.classList.add('set'); slot.classList.remove('drop'); void slot.offsetWidth; slot.classList.add('drop'); }); // measures b first
    b.classList.add('used'); // then it leaves the pile, and the rest close up
  };
  const tap = (b, p) => {
    if (ctx.busy || done || b.disabled) return;
    if (p.key === expected[next].key) {
      ctx.sound('note', { freq: NOTES[Math.min(next, NOTES.length - 1)] });
      lay(b, next); next++;
      while (next < expected.length && expected[next].given) next++;
      if (tried) glowNext();
      if (next >= expected.length) ctx.later(() => complete(!tried), ctx.reduceMotion ? 50 : 460);
    } else {
      b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong'); ctx.sound('tap');
      if (!tried) { tried = true; ctx.coach(onWrongCoach); }
      glowNext();
    }
  };
  ctx.onTimeUp(() => { // lay the rest, show the answer
    if (done) return; tried = true;
    for (let i = next; i < expected.length; i++) { if (expected[i].given) continue; const b = bricks.find(x => !x.disabled && x.dataset.k === expected[i].key); if (b) lay(b, i); }
    next = expected.length; ctx.coach("Time's up! Here it is."); ctx.later(() => complete(false), 500);
  });
}

// Builder · put the blocks in order → bricks along the castle wall
export function castleOrderScene(ctx) {
  const st = ctx.step, order = blockOrder(st.blocks), key = b => b.text.trim().toLowerCase();
  buildScene(ctx, {
    kind: 'order',
    pieces: st.blocks.map(b => ({ text: b.text, key: key(b) })),
    expected: order.map(b => ({ text: b.text, key: key(b) })),
    prompt: `<div class="tc-prompt">${esc(st.prompt || 'Build the sentence.')} <small>Build the wall, brick by brick!</small></div>${st.hintTr ? `<div class="tc-tr">${esc(st.hintTr)}</div>` : ''}`,
    sayAtEnd: st.text, revealText: st.text, revealTr: st.meaningTr,
    onWrongCoach: 'Not that brick yet. Which block comes next? Look for the glowing one!',
  });
}
castleOrderScene.cls = 'k-castle';

// Builder · spell the word → ice letters into the mould over the gate
export function castleSpellScene(ctx) {
  const st = ctx.step, ans = st.answerText, given = st.given || '';
  buildScene(ctx, {
    kind: 'spell',
    pieces: st.tiles.map(t => ({ text: t, key: t.toLowerCase() })),
    expected: [...ans].map((ch, i) => ({ text: ch, key: ch.toLowerCase(), given: i < given.length })),
    prompt: `<div class="tc-prompt">${st.pic ? `<img class="tc-pic" src="${esc(st.pic)}" alt="">` : ''}<span ${st.promptLang === 'tr' ? 'lang="tr"' : ''}>${esc(st.prompt)}</span></div>`,
    sayAtEnd: ans, revealText: ans, revealTr: null,
    onWrongCoach: `Not that letter yet. The glowing ice block is next!`,
  });
}
castleSpellScene.cls = 'k-castle';
