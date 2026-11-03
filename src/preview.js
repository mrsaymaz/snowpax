// M0 task preview: shows rounds the game's task generators make for any unit, arena and outpost.
// The isometric game itself starts in M1; this page stays as a teacher review tool.
import { CONFIG, TEAM_IDS } from './config.js';
import { FAMILIES, subtasksOf, statusOf, makeRng, makeRound, SUBTASK } from './tasks/subtasks.mjs';
import { emblemSVG } from './emblems.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cache = {};
let seed = Date.now() % 100000;

$('teams').innerHTML = TEAM_IDS.map(id => `<span class="team">${emblemSVG(id, 36)}${esc(CONFIG.teams[id].name)} · ${esc(CONFIG.teams[id].element)}</span>`).join('');
$('family').innerHTML = FAMILIES.map(f => `<option value="${f.id}">${f.letter} · ${esc(f.outpost)}</option>`).join('');

async function loadGrade(g) {
  if (!cache[g]) cache[g] = fetch(`content/grade${g}.json`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  return cache[g];
}
const current = async () => (await loadGrade($('grade').value)).units.find(u => u.id === $('unit').value);

async function fillUnits() {
  const data = await loadGrade($('grade').value);
  $('unit').innerHTML = data.units.map(u => `<option value="${u.id}">${esc(u.id)} · ${esc(u.title)}</option>`).join('');
}
function fillSubs(unit) {
  const arena = Number($('arena').value), keep = $('sub').value;
  const rows = subtasksOf($('family').value).map(s => ({ s, st: statusOf(s, unit, arena) }));
  $('sub').innerHTML = '<option value="">Any (as the game would pick)</option>' + rows.map(({ s, st }) =>
    `<option value="${s.id}" ${st.status === 'locked' || st.status === 'none' ? 'disabled' : ''}>${s.id} ${esc(s.title)} (${st.status === 'locked' ? 'from arena ' + s.minArena : st.status})</option>`).join('');
  if ([...$('sub').options].some(o => o.value === keep && !o.disabled)) $('sub').value = keep;
  $('status').innerHTML = rows.filter(r => r.st.status !== 'locked').map(({ s, st }) => `${s.id}: <b class="${st.status}">${st.status}</b> (${st.cap} items, ${st.need} per visit)`).join(' · ');
}

const mark = (opts, right) => `<ul class="opts">${opts.map((o, i) => `<li class="${right.includes(i) ? 'right' : ''}">${right.includes(i) ? '✓ ' : ''}${esc(o)}</li>`).join('')}</ul>`;
const tile = t => (t.pic ? `<img class="pic" src="${esc(t.pic)}" alt="${esc(t.alt)}">` : t.speak ? `🔊 <i>${esc(t.speak)}</i>` : esc(t.text));
function renderStep(st, n) {
  let body = '';
  switch (st.kind) {
    case 'choice': case 'listen':
      body = `${st.context ? `<div class="context">${esc(st.context)}</div>` : ''}<div class="prompt">${st.speak ? '🔊 says: <i>' + esc(st.speak) + '</i><br>' : ''}${esc(st.prompt)}</div>${st.hintTr ? `<div class="tr">${esc(st.hintTr)}</div>` : ''}${mark(st.options, [st.answer])}${st.explain ? `<div class="note">${esc(st.explain)}</div>` : ''}`;
      break;
    case 'match':
      body = `<div class="prompt">${esc(st.prompt)}</div><div class="pairs">${st.left.map(l => `<div>${tile(l)}</div><div class="arrow">↔</div><div>${tile(st.right.find(r => r.id === st.pairs[l.id]))}</div>`).join('')}</div><div class="note">The game shuffles the right column.</div>`;
      break;
    case 'sort':
      body = `<div class="prompt">${esc(st.prompt)}</div>${st.categories.map((c, i) => `<div><b>${esc(c.title)}</b>${c.titleTr ? ` <span class="tr">(${esc(c.titleTr)})</span>` : ''}: ${st.cards.filter(x => x.cat === i).map(x => esc(x.text)).join(', ') || '—'}</div>`).join('')}`;
      break;
    case 'fix':
      body = `<div class="prompt">${esc(st.prompt)}</div><div>${st.tokens.map((t, i) => (i === st.wrong ? `<span class="wrong-word">${esc(t)}</span>` : esc(t))).join(' ')}</div>${mark(st.options, [st.options.indexOf(st.answerText)])}`;
      break;
    case 'order':
      body = `<div class="prompt">${esc(st.prompt)}</div>${mark(st.blocks.map(b => b.text), [])}<div class="note">✓ ${esc(st.text)}${st.meaningTr ? ` · <span class="tr">${esc(st.meaningTr)}</span>` : ''}</div>`;
      break;
    case 'order-pair':
      return st.steps.map((s, i) => renderStep(s, `${n}${'ab'[i]}`)).join('');
    case 'spell':
      body = `<div class="prompt">${st.pic ? `<img class="pic" src="${esc(st.pic)}" alt="">` : ''} ${esc(st.prompt)}</div><div>Given: <b>${esc(st.given || '—')}</b> · Tiles: ${st.tiles.map(esc).join(' ')}</div><div class="note">✓ ${esc(st.answerText)}</div>`;
      break;
    case 'multi':
      body = `<div class="prompt">🔊 says: <i>${esc(st.speak)}</i><br>${esc(st.prompt)}</div>${mark(st.options, st.answers)}`;
      break;
    case 'sequence':
      body = `<div class="prompt">${esc(st.prompt)}</div>${mark(st.options, st.answer)}<div class="note">Order: ${esc(st.answerText)}</div>`;
      break;
  }
  return `<article class="step"><h3>Item ${n}${st.dialogue ? ' · conversation: ' + esc(st.dialogue) : ''}</h3>${body}</article>`;
}

async function show() {
  const unit = await current();
  if (!unit) return;
  fillSubs(unit);
  const arena = Number($('arena').value), sub = $('sub').value;
  const ctx = { rng: makeRng(++seed) };
  const round = sub ? { subtask: sub, title: SUBTASK[sub].title, coach: SUBTASK[sub].coach, steps: SUBTASK[sub].round(unit, arena, ctx) } : makeRound(unit, $('family').value, arena, ctx);
  $('round').innerHTML = !round || !round.steps ? '<article class="step">This unit cannot fill this outpost here.</article>'
    : `<article class="step"><h3>${esc(round.subtask)} · ${esc(round.title)}</h3><div>Coach: “${esc(round.coach)}”</div></article>` + round.steps.map((s, i) => renderStep(s, i + 1)).join('');
}

$('grade').addEventListener('change', async () => { await fillUnits(); show(); });
for (const id of ['unit', 'arena', 'family']) $(id).addEventListener('change', () => { $('sub').value = ''; show(); });
$('sub').addEventListener('change', show);
$('again').addEventListener('click', show);
fillUnits().then(show).catch(e => { $('round').textContent = 'Could not load the lesson bank: ' + e.message; });
