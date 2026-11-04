// The English tasks at the outposts (brief §9), hot-cocoa questions and snowflake words.
//
// REACH an outpost, step into its circle and the task card opens (SEIZE): the student stays put
// while the two bot teammates guard; every right answer fires a volley from the outpost and fills
// the bar; rival snowballs that get through only chill the bar for a moment, they never close or
// rush the card. When the bar is full the outpost is yours, then the rivals counterattack
// (DEFEND): after the wave, one short round refills everyone's snowballs. Then it is HELD.
// Every item counts toward the arena's first-try accuracy (the 80% rule) and missed words come
// back more often.
import { BANNERS } from './waves.mjs';
import { CONFIG } from '../config.js';
import { FAMILIES } from '../tasks/subtasks.mjs';
import { recordItem, holdOutpost, accuracyOf } from '../rules/progress.mjs';
import { Visit, stepSeconds, cocoaQuestion, flakeWords } from './visit.mjs';
import { TaskCard } from './taskcard.js';
import { speech } from './speech.js';

export const OUTPOST_THEME = {
  archery: { theme: 'archery', name: "Archers' Lodge" },
  waterfront: { theme: 'waterfront', name: "The Admiral's Bell" },
  kizilay: { theme: 'kizilay', name: 'Kızılay Fountain' },
  boulevard: { theme: 'boulevard', name: 'The Treehouse' },
  sururi: { theme: 'sururi', name: 'The Snow Castle' },
  schoolyard: { theme: 'schoolyard', name: 'Schoolyard Showdown' },
};
const FAMILY_NAME = Object.fromEntries(FAMILIES.map(f => [f.id, f.name]));
const T = CONFIG.timing;

// Glowing snowflakes carry words from this unit (missed words first). Called before the world
// is drawn, so each flake can show its word.
export function assignFlakeWords(sim, unit, missed, rng) {
  const flakes = sim.pickups.filter(p => p.kind === 'flake');
  flakeWords(unit, flakes.length, missed, rng).forEach((w, k) => { flakes[k].word = w; });
}

export class OutpostFlow {
  constructor({ sim, player, unit, unitProgress, save, writeSave, pace, rng, root, ui, familyOverride = null }) {
    Object.assign(this, { sim, player, unit, up: unitProgress, save, writeSave, pace, rng, ui, familyOverride });
    this.visits = new Map(); this.history = []; this.mode = null; this.zone = null; this.shown = 0; this.chillT = 0; this.waveT = 0; this.waveZone = null; this.outside = new Set();
    this.card = new TaskCard(root, {
      rng, coach: text => this.card.setCoach(text),
      timerFor: pace === 'challenge' ? st => stepSeconds(st, pace) : null,
      onItem: r => this.onItem(r), onStepDone: () => this.onStepDone(),
      sound: (name, opt) => this.ui.play?.(name, opt),
    });
    this.card.onLeave = () => this.leave();
  }
  get busy() { return !!this.mode; }
  get accuracy() { const run = this.up.arenas[0].run; return { firstTry: run?.firstTry || 0, total: run?.total || 0, pct: Math.round(accuracyOf(run) * 100) }; }

  familyOf(z) { return this.familyOverride || z.family; }
  plant(on) { this.player.planted = on; this.player.guarding = on; document.body.classList.toggle('reading', on); }

  // ---------- seize ----------
  begin(z) {
    const fam = this.familyOf(z);
    let v = this.visits.get(z.id);
    if (!v) { v = new Visit({ unit: this.unit, family: fam, arena: 1, rng: this.rng, history: this.history, speech: speech.available || !speech.checked, families: z.showdown ? BANNERS.map(b => b.family) : null, perFamily: 2 }); this.visits.set(z.id, v); }
    this.mode = 'seize'; this.zone = z; z.seizing = true; this.shown = Math.max(0, z.progress); this.plant(true);
    const th = OUTPOST_THEME[z.id] || { theme: 'kizilay', name: z.label };
    this.card.open({ theme: th.theme, title: z.showdown ? `${th.name} · Raise the banners!` : `${th.name} · ${FAMILY_NAME[fam]}`, coach: '' });
    this.card.setProgress(v.progress);
    if (z.showdown) this.ui.coach('Every task raises a banner. Raise all five for the giant snowball!', 5);
    else if (!this.seenSeize) { this.seenSeize = true; this.ui.coach('Answer the questions to seize the outpost. Your team will guard you!', 5); }
    this.showNext();
  }
  showNext() {
    const v = this.mode === 'defend' ? this.defendVisit : this.visits.get(this.zone?.id);
    const step = v.next();
    if (!step) { this.onStepDone(true); return; }
    const b = v.families && BANNERS[v.famIdx];
    this.card.setCoach(b ? `🚩 ${b.name} banner (${v.famIdx + 1} of ${BANNERS.length}) · ${FAMILY_NAME[v.family]}${v.coach ? ': ' + v.coach : ''}` : v.coach || ''); this.card.show(step, b ? { theme: b.outpost } : undefined); // Showdown: each banner in its own outpost's scene
  }
  leave() {
    if (this.mode !== 'seize') return;
    this.card.close(); this.plant(false); this.zone.seizing = false; this.outside.delete(this.zone.id); this.mode = null; this.zone = null;
  }

  onItem({ itemId, correctFirstTry }) {
    if (this.mode === 'cocoa') { this.cocoaRight = correctFirstTry; return; }
    const v = this.mode === 'defend' ? this.defendVisit : this.visits.get(this.zone.id);
    v.answer(correctFirstTry);
    recordItem(this.up, 0, { correctFirstTry, itemId }); this.writeSave(this.save);
    this.card.setProgress(v.progress);
    if (correctFirstTry) {
      this.ui.play('sparkle'); this.streak = (this.streak || 0) + 1;
      if (this.stageZone) this.sim.blast(this.player, this.zone, this.mode === 'seize' ? 3 : 4); // the landmark's (or the banners') attack
      else if (this.mode === 'seize') this.sim.volley(this.player, this.zone, 2);
      if (this.mode === 'defend') { this.sim.refillTeam('home'); if (!this.stageZone) this.sim.volley(this.player, this.zone, 3); }
      if (this.zone?.id === 'waterfront') this.ui.play('bell');
      if (this.streak === 3) this.ui.banner('3 IN A ROW!', 'good', 1.2); else if (this.streak === 6) this.ui.banner('ON FIRE!', 'super', 1.2);
    } else this.streak = 0;
  }
  onStepDone(empty = false) {
    if (this.mode === 'cocoa') return this.finishCocoa();
    const v = this.mode === 'defend' ? this.defendVisit : this.visits.get(this.zone.id);
    if (!v.finished && !empty) return this.showNext();
    if (this.mode === 'seize') { this.card.setCoach('Great work! Hold on…'); this.mode = 'seize-fill'; } // the bar catches up, then the outpost is yours
    else if (this.mode === 'defend') this.finishDefend();
  }

  // ---------- defend ----------
  startDefend(z) {
    this.card.close(); this.plant(false); z.seizing = false; this.mode = null; this.zone = null;
    this.waveZone = z; this.waveT = this.stageZone ? Infinity : Math.min(14, T.defendWave * 0.7); // stages: the final wave decides
    this.ui.onCaptured?.(z);
    if (z.showdown) return; // the Showdown ends with the giant snowball instead
    this.ui.banner('DEFEND!', 'lose', 1.6); this.ui.coach('The rivals are coming back! Throw snowballs to keep your outpost.', 4.5);
  }
  openDefendTask(z) {
    this.toldBack = false;
    this.defendVisit = new Visit({ unit: this.unit, family: this.familyOf(z), arena: 1, rng: this.rng, history: this.history, speech: speech.available || !speech.checked, phase: 'defend' });
    this.mode = 'defend'; this.zone = z; this.plant(true);
    const th = OUTPOST_THEME[z.id] || { theme: 'kizilay', name: z.label };
    this.card.open({ theme: th.theme, title: `${th.name} · Snowball refill`, coach: '', leave: false });
    this.card.setProgress(0); this.ui.coach('Each right answer refills everyone\'s snowballs!', 3.5);
    this.showNext();
  }
  finishDefend() { const z = this.zone; this.card.close(); this.plant(false); this.mode = null; this.zone = null; this.held(z); }
  // stage mode: only this outpost opens a card, and the stage runner decides when the final wave ends
  setStage(z) { this.stageZone = z; if (z) { this.visits.delete(z.id); this.defendVisit = null; this.waveZone = null; this.mode = null; this.zone = null; this.streak = 0; } }
  stageStats(z) { const v = this.visits.get(z.id), d = this.defendVisit; return { firstTry: (v?.firstTry || 0) + (d?.firstTry || 0), total: (v?.done || 0) + (d?.done || 0) }; }
  abort() { if (this.mode) { this.card.close(); this.plant(false); if (this.zone) this.zone.seizing = false; } this.mode = null; this.zone = null; this.waveZone = null; }
  held(z) {
    holdOutpost(this.up, 0, this.familyOf(z)); this.writeSave(this.save); this.waveZone = null;
    if (this.stageZone) { this.ui.onHeld?.(z); return; }
    this.ui.banner('OUTPOST HELD!', 'win', 2.2); this.ui.play('capture'); this.ui.fireworks?.(z);
    const a = this.accuracy; this.ui.coach(`${z.label} is yours for good! Right first time so far: ${a.firstTry} of ${a.total} (${a.pct}%).`, 5);
  }

  // ---------- hot cocoa ----------
  openCocoa(pickupId) {
    if (this.mode) { this.sim.pickups.find(p => p.id === pickupId).asking = false; return; }
    this.mode = 'cocoa'; this.cocoaId = pickupId; this.cocoaRight = false; this.plant(true);
    this.card.open({ theme: 'cocoa', title: 'Hot cocoa!', coach: '', leave: false }); this.card.setProgress(0);
    this.card.show(cocoaQuestion(this.unit, this.rng)); this.card.setCoach('Answer right for a hot cup: full warmth, full snowballs and super power!');
  }
  finishCocoa() {
    const right = this.cocoaRight;
    this.card.close(); this.plant(false); this.mode = null;
    this.sim.cocoaResult(this.cocoaId, this.player, right);
    if (right) { this.ui.banner('WARM AND READY!', 'win', 1.4); this.ui.play('slurp'); }
    else this.ui.coach('Not this time. The cocoa will be back soon. Try again later!', 3.5);
  }

  // ---------- every frame ----------
  update(dt) {
    const sim = this.sim, P = this.player;
    this.card.tick(dt);
    if (this.chillT > 0) this.chillT -= dt;
    // seize bar: eases up to the answers given; a rival hit chills it for a moment
    if ((this.mode === 'seize' || this.mode === 'seize-fill') && this.zone) {
      const v = this.visits.get(this.zone.id);
      if (this.chillT <= 0) this.shown = Math.min(v.progress, this.shown + dt * 0.6);
      sim.seizeProgress(this.zone, this.shown);
      if (this.mode === 'seize-fill' && this.shown >= v.progress - 1e-6 && v.finished) { const z = this.zone; sim.capture(z, 'home'); this.startDefend(z); }
    }
    // defend wave countdown, then the refill round
    if (this.waveZone && !this.mode) {
      this.waveT -= dt; const z = this.waveZone;
      if (this.waveT <= 0) {
        const ready = !P.frozen && !P.thaw && !P.sled && Math.hypot(P.x - z.x, P.z - z.z) <= z.r + 4;
        if (ready) this.openDefendTask(z);
        else if (this.waveT < -30) this.held(z); // never came back: it is held anyway
        else if (!this.toldBack) { this.toldBack = true; this.ui.coach(`The wave is over! Go back to ${z.label} to refill your snowballs.`, 4); }
      }
    }
    // step into a circle that is not yours yet: the card opens
    if (!this.mode && !P.frozen && !P.thaw && !P.sled) {
      for (const z of sim.zones) {
        const inside = Math.hypot(P.x - z.x, P.z - z.z) <= z.r;
        if (!inside) { this.outside.add(z.id); continue; }
        if (z.owner === 'home' || !this.outside.has(z.id) || this.waveZone || (this.stageZone && z !== this.stageZone) || this.stageHold) continue;
        this.outside.delete(z.id); this.begin(z); break;
      }
    }
  }
  onEvent(e) {
    if (e.type === 'plantedHit' && e.id === this.player.id && (this.mode === 'seize' || this.mode === 'seize-fill')) { this.chillT = 1.2; this.card.chill(); }
    if (e.type === 'cocoaAsk' && e.id === this.player.id) this.openCocoa(e.pickup);
    if (e.type === 'collect' && e.kind === 'flake') {
      const p = this.sim.pickups.find(q => q.id === e.pickup), w = p?.word;
      if (w) { this.ui.fx.number(e.x, e.z, `${w.en} = ${w.tr}`, 'word'); speech.say(w.en); }
    }
  }
}
