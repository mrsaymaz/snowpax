// Card lab (cards.html): try every task family in every landmark's scene, outside the game.
// ?family=build&theme=sururi&unit=g5u1&seed=3&auto=1 (auto answers right, for screenshots)
import { TaskCard } from './game/taskcard.js';
import { useBasicScenes } from './game/cards/scenes.js';
import { makeRound, makeRng } from './tasks/subtasks.mjs';
import { flatten, stepSeconds } from './game/visit.mjs';
import { unlockAudio, play } from './game/audio.js';

const $ = s => document.querySelector(s), params = new URLSearchParams(location.search);
const log = t => { $('#log').textContent = t + '\n' + $('#log').textContent; };
let bank = null, rng = makeRng(+(params.get('seed') || 1)), card = null, queue = [];

async function loadBank() {
  bank = await (await fetch('content/grade5.json')).json();
  $('#unit').innerHTML = bank.units.map(u => `<option value="${u.id}">${u.id} · ${u.title}</option>`).join('');
  for (const k of ['family', 'theme', 'unit']) if (params.get(k)) $('#' + k).value = params.get(k);
  if (params.get('basic')) $('#basic').checked = true;
}
function newRound() {
  useBasicScenes($('#basic').checked);
  const unit = bank.units.find(u => u.id === $('#unit').value), fam = $('#family').value, theme = $('#theme').value;
  const round = makeRound(unit, fam, 1, { rng, speech: true });
  if (!round) { log('No round for this unit and family.'); return; }
  queue = flatten(round.steps);
  card = new TaskCard($('#taskcard'), {
    rng, coach: t => card.setCoach(t), timerFor: $('#timer').checked ? st => stepSeconds(st, 'challenge') : null,
    onItem: r => log(`item ${r.itemId}: ${r.correctFirstTry ? 'right first time' : 'missed'}`),
    onStepDone: () => next(), sound: (n, o) => play(n, o),
  });
  card.onLeave = () => card.close();
  card.open({ theme, title: `${round.title} · ${round.subtask}`, coach: round.coach });
  log(`— ${round.subtask} ${round.title} (${queue.length} steps)`);
  next();
}
function next() { const st = queue.shift(); if (!st) { card.setCoach('Round done! Press "New round".'); log('round done'); return; } card.show(st); }

let last = performance.now();
const tick = now => { card?.tick((now - last) / 1000); last = now; requestAnimationFrame(tick); };
requestAnimationFrame(tick);
addEventListener('pointerdown', unlockAudio, { once: true });
$('#go').onclick = () => newRound();
for (const id of ['family', 'theme', 'unit', 'basic', 'timer']) $('#' + id).onchange = () => newRound();
loadBank().then(newRound);
globalThis.__cardlab = { get card() { return card; } };
