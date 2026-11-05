// Arena 1 as stages: the stage map → a sled journey → a stand at the outpost against rival
// waves while answering → results → the next stage; the sixth stage is the ride home and the
// Schoolyard Showdown (five banners, the rival captain, the giant snowball, the school bell). Three lives per stage: a crash on the sled
// or a freeze at the outpost costs one; with none left the stage starts again (English answers
// already given still count). See stages.mjs for the order and waves.mjs for the waves.
import { CONFIG } from '../config.js';
import { STAGES, stageById, Lives, stageState, isUnlocked, nextStage, finishStage, totalStars, UNLOCK } from './stages.mjs';
import { WAVES, RIVAL_INFO, BANNERS, minionList, stageWall, setWall, entryPoints, schoolyardSpot } from './waves.mjs';
import { flakeWords } from './visit.mjs';
import { FIGHT_PLANS, WordHunt, supplySpot } from './fights.mjs';
import { SledRun } from './sledrun.js';
import { THEME_ICON } from './taskcard.js';
import { speech } from './speech.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FIGHT_MAX = 14; // seconds of the opening fight at most
const FIELD_MAX = 45; // on a battlefield: beat the rival team, or after this long they run back to camp
const STAR = n => '★'.repeat(n) + '☆'.repeat(3 - n);
const ICON = { boulevard: 'boulevard', archery: 'archery', kizilay: 'kizilay', sururi: 'sururi', waterfront: 'waterfront', showdown: 'schoolyard' };

export class StageRunner {
  constructor({ match, flow, unit, unitProgress, save, writeSave, pace, rng, team, kit, reduceMotion, ui }) {
    Object.assign(this, { match, sim: match.sim, flow, unit, up: unitProgress, save, writeSave, pace, rng, team, kit, reduceMotion, ui });
    this.mode = 'map'; this.lives = new Lives(); this.wall = []; this.waves = []; this.runFlakes = 0; this.ridesDone = 0;
    flow.ui.onCaptured = z => this.captured(z); flow.ui.onHeld = z => this.held(z); flow.ui.onHalf = z => this.startStrike(z);
    this.bindInput();
    // rival kids wait off the field until their wave
    for (const c of this.sim.chars) if (c.side === 'rival') this.bench(c);
  }
  get stage() { return this.cur; }
  bench(c) { c.guard = null; c.benched = true; c.x = -999; c.z = -999; c.vx = c.vz = 0; c.travel = null; }

  // ---------- the stage map ----------
  showMap() {
    this.mode = 'map'; document.body.classList.remove('sledding'); $('#hud').hidden = true;
    const st = stageState(this.up), next = nextStage(this.up), run = this.up.arenas[0].run, acc = run?.total ? Math.round(run.firstTry / run.total * 100) : null;
    const nodes = STAGES.map((s, i) => {
      const open = isUnlocked(this.up, s.id), done = st[s.id]?.done, cls = done ? 'done' : open ? 'open' : 'locked';
      return `<button type="button" class="sm-node ${cls} ${next === s ? 'next' : ''}" data-id="${s.id}" style="--i:${i}" ${open ? '' : 'disabled'}>
        <span class="sm-icon">${THEME_ICON[ICON[s.id]] || ''}</span><b>${i + 1}. ${esc(s.title)}</b><span class="sm-stars">${done ? STAR(st[s.id].stars) : open ? 'Play!' : '🔒'}</span></button>`;
    }).join('');
    $('#stagemap').innerHTML = `<div class="sm-card"><h2>Arena 1 · Home Turf</h2><p class="sm-sub">${esc(this.unit.title)} · ★ ${totalStars(this.up)} of 18${acc !== null ? ` · Right first time ${acc}% (need ${Math.round(UNLOCK * 100)}%)` : ''}</p>
      <div class="sm-path">${nodes}</div><p class="sm-tip">Sled from outpost to outpost, nearest first. Seize each one with English while your team holds off the rival waves!</p></div>`;
    $('#stagemap').hidden = false;
    $('#stagemap').onclick = e => { const b = e.target.closest('.sm-node'); if (b && !b.disabled) this.start(stageById(b.dataset.id)); };
  }

  // ---------- one stage ----------
  start(stage) {
    $('#stagemap').hidden = true; $('#results').hidden = true; $('#outoflives').hidden = true;
    this.cur = stage; this.lives.reset(); this.t0 = performance.now(); this.runFlakes = 0;
    this.ride();
  }
  ride() {
    const st = this.cur, words = flakeWords(this.unit, 6, this.up.missed, this.rng);
    const spellPool = this.unit.words.filter(w => /^[a-z]{3,7}$/i.test(w.en)), spell = st.ride.spell && spellPool.length ? spellPool[Math.floor(this.rng() * spellPool.length)] : null;
    this.sled?.dispose();
    this.sled = new SledRun({ theme: st.ride.theme, seconds: st.ride.seconds, pace: this.pace, team: this.team, kit: this.kit, look: this.match.player.look, words, spell, lives: this.lives, rng: this.rng, first: this.ridesDone === 0, reduceMotion: this.reduceMotion,
      on: {
        crash: lost => { this.ui.play('hit'); const left = this.lives.lose(); this.drawRunHud(); this.toast(lost ? `Ouch! −${lost} ❄` : 'Ouch!'); if (!left) this.outOfLives(); },
        flakes: () => this.drawRunHud(), sound: k => this.ui.play(k),
        word: w => { this.toast(`${w.en} = ${w.tr}`, 'word'); speech.say(w.en); },
        spell: (sofar, right) => { this.drawRunHud(); if (sofar.length === spell.en.length) { const ok = !this.sled.missedLetters; this.toast(ok ? `You spelled ${spell.en.toUpperCase()}! +10 ❄` : `The word was ${spell.en.toUpperCase()} (${spell.tr})`, 'word'); if (ok) this.sled.flakes += 10; speech.say(spell.en); } },
        hint: text => this.ui.banner(text, 'super', 1.1),
        progress: p => { const bar = $('#runhud .rh-prog i'); if (bar) bar.style.width = Math.round(p * 100) + '%'; },
        done: r => { this.runFlakes = r.flakes; this.ridesDone++; setTimeout(() => this.arrive(), 700); },
      } });
    this.sled.resize(innerWidth, innerHeight);
    this.mode = 'sled'; document.body.classList.add('sledding'); $('#hud').hidden = true; $('#runhud').hidden = false;
    $('#runhud').innerHTML = `<div class="rh-top"><span class="rh-lives"></span><div class="rh-prog"><i></i><span class="rh-dest">${THEME_ICON[ICON[st.id]] || ''}</span></div><span class="rh-flakes">❄ <b>0</b></span></div>
      <div class="rh-spell" ${spell ? '' : 'hidden'}><small>Spell: <span lang="tr">${esc(spell?.tr || '')}</span></small><div class="rh-slots"></div></div><div class="rh-toast"></div>
      <div class="rh-btns"><button type="button" data-k="left" aria-label="Left">◀</button><button type="button" data-k="duck" aria-label="Duck">▼</button><button type="button" data-k="jump" aria-label="Jump">▲</button><button type="button" data-k="right" aria-label="Right">▶</button></div>`;
    this.spell = spell; this.drawRunHud();
    if (this.ridesDone === 0) this.ui.coach('Sled to the outpost! Swipe left and right to steer, up to jump, down to duck. Collect the golden snowflakes!', 6);
    else this.ui.coach(`Next stop: ${st.title}!`, 3);
  }
  drawRunHud() {
    const h = $('#runhud'); if (!h || h.hidden || !this.sled) return;
    h.querySelector('.rh-lives').innerHTML = Array.from({ length: this.lives.max }, (_, i) => `<i class="${i < this.lives.left ? 'on' : ''}">♥</i>`).join('');
    h.querySelector('.rh-flakes b').textContent = this.sled.flakes;
    if (this.spell) h.querySelector('.rh-slots').innerHTML = [...this.spell.en].map((c, i) => `<span class="${i < this.sled.spelled.length ? 'on' : ''}">${i < this.sled.spelled.length ? esc(this.sled.spelled[i]) : ''}</span>`).join('');
  }
  toast(text, cls = '') { const t = $('#runhud .rh-toast') || $('#stagetoast'); if (!t) return; t.className = (t.id === 'stagetoast' ? '' : 'rh-toast ') + 'show ' + cls; t.textContent = text; clearTimeout(this.toastT); this.toastT = setTimeout(() => { t.className = t.id === 'stagetoast' ? '' : 'rh-toast'; }, 1800); }

  // ---------- arriving at the outpost ----------
  arrive() {
    const st = this.cur, sim = this.sim, z = st.final ? this.schoolyard() : sim.zones.find(q => q.id === st.outpost), grid = this.match.grid;
    this.save.snowflakes = (this.save.snowflakes || 0) + this.runFlakes; this.writeSave(this.save);
    this.ui.rebuildWorld?.(z); // v2 look: build only this stage's area
    this.mode = 'outpost'; document.body.classList.remove('sledding'); $('#runhud').hidden = true; $('#hud').hidden = false;
    this.zone = z; this.tStand = 0; this.waveIdx = 0; this.waves = []; this.finalT = null;
    // longer fights with English inside them (fights.mjs): the stage's plan, two halves of English
    this.plan = st.fights ? FIGHT_PLANS[st.fights] : null; z.halves = st.halves || null;
    this.score = 0; this.hunt = null; this.huntT = 0; this.trickleT = 0; this.crateT = 0; this.toldFrozen = false;
    if (this.plan) { this.huntNext = this.plan.hunt.first; this.crateNext = this.plan.crate.first; this.words = this.words || new WordHunt(this.unit, this.rng, this.plan.hunt.size); }
    // close the stage with snowbanks, find where the waves come in
    this.wall = stageWall(grid, z); setWall(grid, this.wall, true); this.ui.showWall?.(this.wall);
    this.entries = entryPoints(grid, z);
    sim.held.rival = this.entries.map(e => ({ x: e.x, z: e.z })); sim.spawns.rival = sim.held.rival.slice();
    if (z.owner !== 'home') { z.owner = null; z.progress = 0; }
    z.stand = true;
    if (sim.weather) { sim.weather.kind = 'clear'; sim.weather.next = Infinity; } // no blizzards or sun bursts in a stand: the light stays steady
    // the team arrives on the circle, facing the landmark
    const far = this.entries.reduce((s, e) => s + e.a, 0) / this.entries.length + Math.PI; // away from where the rivals come in
    const tries = [far, far + 0.6, far - 0.6, far + 1.4, far - 1.4, 0, Math.PI / 2, -Math.PI / 2, Math.PI];
    const ang = tries.find(a => grid.freeCircle(z.x + Math.sin(a) * (z.r - 0.6), z.z + Math.cos(a) * (z.r - 0.6), 0.4)) ?? 0;
    const home = sim.chars.filter(c => c.side === 'home');
    home.forEach((c, k) => {
      const rr = k === 0 ? z.r - 0.6 : z.r + 0.2, o = k === 0 ? 0 : (k === 1 ? -1.3 : 1.3);
      let x = z.x + Math.sin(ang) * rr + Math.cos(ang) * o, zz = z.z + Math.cos(ang) * rr - Math.sin(ang) * o;
      if (!grid.freeCircle(x, zz, 0.36)) { x = z.x + Math.sin(ang) * (z.r - 0.6); zz = z.z + Math.cos(ang) * (z.r - 0.6); }
      Object.assign(c, { x, z: zz, vx: 0, vz: 0, frozen: 0, thaw: 0, warmth: c.maxWarmth, ammo: CONFIG.fight.ammoMax, travel: null, face: ang + Math.PI, sled: null });
    });
    // the fight yard: the team arrives at its far end, the first wave comes to them there
    const yd = z.yard != null ? [Math.cos(z.yard * Math.PI / 180), Math.sin(z.yard * Math.PI / 180)] : this.openDir(z);
    this.yardGoal = null;
    if (z.battlefield) this.setupField(z, home);
    else if (yd) {
      const px = -yd[1], pz = yd[0], R = [10.5, 10, 9.5, 9, 8.5].find(r => grid.freeCircle(z.x + yd[0] * r, z.z + yd[1] * r, 0.45)) ?? 8;
      const face = Math.atan2(-yd[0], -yd[1]); // facing the outpost
      home.forEach((c, k) => {
        const o = k === 0 ? 0 : k === 1 ? -1.4 : 1.4, rr = k === 0 ? R : R + 0.4; let x = z.x + yd[0] * rr + px * o, zz = z.z + yd[1] * rr + pz * o;
        if (!grid.freeCircle(x, zz, 0.36)) { x = z.x + yd[0] * R; zz = z.z + yd[1] * R; }
        Object.assign(c, { x, z: zz, face });
      });
      this.yardGoal = { id: z.id + '-yard', x: z.x + yd[0] * 6.8, z: z.z + yd[1] * 6.8, r: 2.6 };
      // the first wave walks in from the far side, not from the yard itself
      this.firstEntries = this.entries.filter(e => Math.sin(e.a) * yd[0] + Math.cos(e.a) * yd[1] < 0.5);
    }
    sim.held.home = [{ x: home[0].x, z: home[0].z }]; sim.spawns.home = sim.held.home.slice();
    this.ui.snapCamera?.();
    this.flow.setStage(z); this.drawLives();
    this.ui.banner(st.title.toUpperCase(), 'go', 1.6);
    if (st.final) { this.bannersUp = 0; this.giant = null; this.ui.showdown?.start(z, BANNERS); this.ui.coach(z.battlefield ? 'Home at last! The rivals have taken the schoolyard. Beat them, raise all five banners with English, then roll the giant snowball!' : 'Home at last! The rivals want Our School. Raise all five banners with English, then roll the giant snowball!', 6); }
    if (st.newRival && RIVAL_INFO[st.newRival]) this.newRival(st.newRival);
    // first a fight: clear the first wave of snowmen, then seize the outpost with English
    this.phase = 'fight'; this.tFight = 0; this.flow.stageHold = true;
    if (z.battlefield && !st.final) { this.ui.markRival?.(z); setTimeout(() => { if (this.phase === 'fight') this.ui.coach(this.plan ? `The rival team holds ${z.label}! Freeze ${this.plan.open.goal} rivals to break their line. They keep coming back, so keep throwing!` : `The rival team holds ${z.label}! Beat them in a snowball fight, then seize it with English.`, 6); }, 1700); }
    if (!this.toldTap) { this.toldTap = true; setTimeout(() => { if (this.phase === 'fight') this.ui.coach('Snowmen! Tap a rival to throw a snowball at it, or tap yourself to throw at the nearest one.', 6); }, 1800); }
  }
  // A battlefield (a 22 × 34 field with the rivals' outpost at the north end): the team starts
  // at the south end; the rival team waits on its line in front of the outpost and comes out to
  // meet them in the middle. Later waves come round the outpost from the rivals' camp behind it.
  setupField(z, home) {
    const sim = this.sim, { front } = z.battlefield, pt = (v, d, a = 0) => ({ x: z.x + v, z: z.z + d, a });
    home.forEach((c, k) => { const o = k === 0 ? 0 : k === 1 ? -1.6 : 1.6; Object.assign(c, { x: z.x + o, z: z.z + front - 2.5 + (k ? 0.6 : 0), face: Math.PI }); }); // facing north, up the field
    this.homeSpawn = { x: z.x, z: z.z + front - 2.5 };
    this.firstEntries = [pt(-3, 7.5), pt(0, 8), pt(3, 7.5)];        // the rival line, in front of their outpost
    this.yardGoal = { id: z.id + '-field', x: z.x, z: z.z + 12, r: 4 }; // the snowmen come out to the middle of the field
    this.entries = [pt(-8, -3.5), pt(8, -3.5), pt(-9.5, 4), pt(9.5, 4)]; // reinforcements: round the outpost from the camp behind it
    sim.held.rival = this.entries.map(e => ({ x: e.x, z: e.z })); sim.spawns.rival = sim.held.rival.slice();
  }
  newRival(type) {
    const info = RIVAL_INFO[type], el = $('#newrival');
    el.innerHTML = `<b>New rivals!</b><span class="nr-name">${esc(info.name)}</span><small>${esc(info.tip)}</small>`; el.hidden = false; el.classList.add('show');
    clearTimeout(this.nrT); this.nrT = setTimeout(() => { el.classList.remove('show'); setTimeout(() => { el.hidden = true; }, 300); }, 6000);
  }
  spawnWave(i) {
    const w = WAVES[this.cur.id][i], z = this.zone; if (!w) return;
    const members = [];
    const first = i === 0 && this.yardGoal, ents = first && this.firstEntries?.length ? this.firstEntries : this.entries, goal = first ? this.yardGoal : z; // the first wave comes to the yard
    minionList(w).forEach((type, k) => { const e = ents[k % ents.length], j = Math.floor(k / ents.length); members.push(this.match.addMinion(type, e.x + Math.cos(e.a) * (j * 0.9 - 0.4), e.z - Math.sin(e.a) * (j * 0.9 - 0.4), goal)); });
    const kids = this.sim.chars.filter(c => c.side === 'rival' && c.role !== 'minion');
    const kidEnts = first && this.zone.battlefield ? ents : this.entries;
    for (let k = 0; k < Math.min(w.kids, kids.length); k++) { const c = kids[k], e = kidEnts[(k + 1) % kidEnts.length]; Object.assign(c, { benched: false, x: e.x, z: e.z, frozen: 0, thaw: 0, warmth: c.maxWarmth, ammo: CONFIG.fight.ammoMax, shield: 0.5, guard: null }); members.push(c);
      if (first && this.zone.battlefield) c.guard = { x: e.x, z: e.z + 1.5, r: 1.6, leash: 11 }; // the rival team holds its line, and comes out to meet anyone within 11 m of it
    }
    this.waves[i] = { members, t: 0, cleared: false, final: !!w.final };
    this.waveIdx = i + 1;
    this.ui.banner(`WAVE ${i + 1}: ${w.name.toUpperCase()}`, w.final ? 'lose' : 'super', 1.8); this.ui.play('whoosh');
  }
  // ---------- the longer fights (fights.mjs) ----------
  // a snowman walks out of the rivals' camp (round the outpost) toward `goal`
  spawnSnowman(type, goal, word = null) {
    const e = this.entries[Math.floor(this.rng() * this.entries.length)], c = this.match.addMinion(type, e.x + (this.rng() - 0.5), e.z + (this.rng() - 0.5), goal);
    if (word) c.word = word; return c;
  }
  // the opening round and the strike-back: snowmen keep coming, word snowmen and supply crates
  updateExtras(dt) {
    const P = this.plan, z = this.zone, fighting = this.phase === 'fight' || this.phase === 'strike';
    const goal = this.phase === 'fight' ? this.yardGoal : z;
    if (fighting) {
      this.trickleT += dt;
      const live = this.sim.chars.filter(c => c.role === 'minion' && !c.gone && !c.word && !c.frozen).length;
      if (this.trickleT >= P.open.trickle && live < P.open.snowmen) { this.trickleT = 0; const types = minionList(WAVES[this.cur.id][0]); this.spawnSnowman(types[Math.floor(this.rng() * types.length)], goal); }
      // supply crates: one at a time on the field
      this.crateT += dt;
      if (this.crateT >= this.crateNext && !this.sim.pickups.some(p => p.kind === 'supply')) {
        const at = supplySpot(this.match.grid, z, this.rng, [this.match.player]); this.crateT = 0; this.crateNext = P.crate.every;
        if (at) { this.sim.dropSupply(at.x, at.z); if (!this.toldCrate) { this.toldCrate = true; this.ui.coach('A supply crate! Run onto it and answer a question: snowballs for the whole team.', 5); } }
      }
    }
    // word snowmen: find the English word for the Turkish one
    if (this.hunt) {
      this.huntT += dt;
      if (this.huntT > P.hunt.seconds) { const t = this.words.timeout(); this.endHunt(); if (t) this.ui.coach(`Time! The word was "${t.en}" (${t.tr}).`, 3.5); }
    } else if (fighting || this.finalT !== null) {
      this.huntNext -= dt;
      if (this.huntNext <= 0 && this.words.ready && !this.flow.busy) {
        const h = this.words.next(); this.huntT = 0; this.huntNext = P.hunt.every;
        this.hunt = h.words.map(w => this.spawnSnowman('waddler', goal, { id: w.id, en: w.en, tr: w.tr }));
        this.ui.hunt?.(h.target); this.ui.play('whoosh');
        if (!this.toldHunt) { this.toldHunt = true; this.ui.coach('Word snowmen! Read their signs and freeze the one that means the word at the top. Tap it to throw at it.', 6); }
      }
    }
  }
  endHunt() { for (const c of this.hunt || []) if (!c.frozen && !c.thaw) c.gone = true; this.hunt = null; this.ui.hunt?.(null); }
  // everyone still standing runs back to camp (the end of a fight)
  retreat(text) {
    if (text) this.ui.banner(text, 'win', 1.4);
    this.endHunt(); this.match.clearMinions(); this.ui.onGone?.();
    for (const c of this.sim.chars) if (c.side === 'rival') this.bench(c);
    this.sim.removeSupply();
  }
  // "They strike back!" between the two halves: hold the circle until the clock runs out (it
  // stops while rivals stand in the circle with nobody of ours)
  startStrike(z) {
    if (this.mode !== 'outpost' || z !== this.zone) return;
    this.phase = 'strike'; this.flow.stageHold = true; this.tStrike = 0; this.strikeLeft = this.plan ? this.plan.strike.seconds : 20; this.trickleT = 0;
    this.ui.banner('THEY STRIKE BACK!', 'lose', 1.6); this.ui.play('whoosh');
    this.ui.coach(`Half of ${z.label} is yours! Now hold the circle for ${Math.round(this.strikeLeft)} seconds. Freeze anyone who steps in.`, 5);
    this.spawnWave(1);
  }
  updateStrike(dt) {
    const z = this.zone; this.tStrike += dt;
    this.strikeHeld = !(z.rival > 0 && z.home === 0);
    if (this.strikeHeld) this.strikeLeft -= dt;
    else if (!this.toldIn || this.tStrike - this.toldIn > 8) { this.toldIn = this.tStrike; this.ui.coach('Rivals are in the circle! Freeze them to keep the clock going.', 3); }
    if (this.strikeLeft > 0 && this.tStrike < (this.plan?.strike.max ?? 40)) return;
    this.retreat('YOU HELD IT!'); this.toldIn = 0;
    this.phase = 'seize'; this.begun = false; this.flow.stageHold = false; this.tSeize = 0;
    this.ui.play('superReady'); this.ui.seizeButton?.(true);
    this.ui.coach('Part 2! Walk into the circle to finish taking the outpost (or tap ▶ Seize).', 4);
  }
  // the HUD line for the fights (null: the usual one)
  fightText() {
    if (this.mode !== 'outpost' || !this.plan) return null;
    if (this.phase === 'fight') return `freeze rivals ${Math.min(this.score, this.plan.open.goal)} / ${this.plan.open.goal}`;
    if (this.phase === 'strike') return this.strikeHeld === false ? 'rivals in the circle!' : `hold it ${Math.max(0, Math.ceil(this.strikeLeft))}s`;
    if (this.finalT !== null) return `final wave ${Math.max(0, Math.ceil(this.plan.final - this.finalT))}s`;
    return null;
  }
  fightBar() {
    if (this.mode !== 'outpost' || !this.plan) return null;
    if (this.phase === 'fight') return Math.min(1, this.score / this.plan.open.goal);
    if (this.phase === 'strike') return Math.max(0, this.strikeLeft / this.plan.strike.seconds);
    return null;
  }
  alive(wave) { return wave.members.filter(c => !c.gone && !c.frozen && !c.thaw && !(c.role !== 'minion' && c.benched)).length; }

  captured(z) { // the bar is full: the final wave comes, and decides the stand
    if (this.mode !== 'outpost') return;
    if (this.cur.final) { this.giantSnowball(); return; }
    setTimeout(() => { if (this.mode === 'outpost') { this.spawnWave(2); this.finalT = 0; } }, 1200);
  }
  held(z) {
    const st = this.cur, stats = this.flow.stageStats(z), seconds = Math.round((performance.now() - this.t0) / 1000);
    const r = finishStage(this.up, st.id, { ...stats, flakes: this.runFlakes, seconds }); this.writeSave(this.save);
    this.cleanup(false);
    const next = nextStage(this.up);
    $('#results').innerHTML = `<div class="rs-card"><div class="rs-icon">${THEME_ICON[ICON[st.id]] || ''}</div><h2>${esc(st.title)} is yours!</h2>
      <div class="rs-stars">${[0, 1, 2].map(i => `<span class="${i < r.stars ? 'on' : ''}" style="--d:${i * 0.25}s">★</span>`).join('')}</div>
      <p>Right first time: <b>${stats.firstTry} of ${stats.total}</b></p><p>Snowflakes: <b>❄ ${this.runFlakes}</b> · Time: <b>${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}</b></p>
      <div class="rs-btns">${next && !next.final ? `<button type="button" class="play-btn" data-go="next">Next: ${esc(next.title)} ▶</button>` : next?.final ? `<button type="button" class="play-btn" data-go="next">Home for the Showdown ▶</button>` : ''}<button type="button" class="menu-btn" data-go="map">Stage map</button></div></div>`;
    $('#results').hidden = false; this.mode = 'results'; $('#hud').hidden = true; this.drawLives();
    this.ui.play('capture');
    $('#results').onclick = e => { const b = e.target.closest('[data-go]'); if (!b) return; $('#results').hidden = true; if (b.dataset.go === 'next' && next) this.start(next); else this.showMap(); };
  }
  outOfLives() {
    const was = this.mode; this.mode = 'out';
    if (was === 'outpost') this.cleanup(true);
    $('#outoflives').innerHTML = `<div class="rs-card"><h2>Out of lives!</h2><p>No problem: your English answers still count. Let's try ${esc(this.cur.title)} again!</p><div class="rs-btns"><button type="button" class="play-btn" data-go="again">Try again</button><button type="button" class="menu-btn" data-go="map">Stage map</button></div></div>`;
    $('#outoflives').hidden = false; $('#hud').hidden = true; $('#runhud').hidden = true;
    $('#outoflives').onclick = e => { const b = e.target.closest('[data-go]'); if (!b) return; $('#outoflives').hidden = true; if (b.dataset.go === 'again') this.start(this.cur); else this.showMap(); };
  }
  cleanup(lost) {
    this.phase = null; this.flow.stageHold = false; this.ui.seizeButton?.(false); if (this.zone) this.zone.stand = false;
    const z = this.zone; this.flow.abort(); this.flow.setStage(null);
    setWall(this.match.grid, this.wall, false); this.ui.showWall?.(null); this.wall = [];
    this.match.clearMinions(); this.ui.onGone?.();
    for (const c of this.sim.chars) if (c.side === 'rival') this.bench(c);
    this.sim.balls = [];
    if (lost && z && z.owner !== 'home') { z.owner = null; z.progress = 0; z.seizing = false; }
    if (z) z.halves = null; this.endHunt(); this.sim.removeSupply(); this.plan = null;
    if (this.yard) { const i = this.sim.zones.indexOf(this.yard); if (i >= 0) this.sim.zones.splice(i, 1); this.ui.showdown?.stop(); clearTimeout(this.giantT); this.giant = null; }
    this.zone = null;
  }
  // ---------- the Schoolyard Showdown ----------
  // The circle in the schoolyard, in the sim's zones only while the Showdown is on.
  schoolyard() {
    if (!this.yard) { const f = this.match.arena?.schoolyard, spot = f || schoolyardSpot(this.match.grid, this.match.base); this.yard = { id: 'schoolyard', label: 'Our School', family: 'mixed', showdown: true, x: spot.x, z: spot.z, r: spot.r, battlefield: f?.battlefield || null }; }
    Object.assign(this.yard, { progress: 0, owner: null, home: 0, rival: 0, seizing: false, contested: false });
    if (!this.sim.zones.includes(this.yard)) this.sim.zones.push(this.yard);
    return this.yard;
  }
  raiseBanner(k) {
    const b = BANNERS[k]; if (!b) return;
    this.ui.showdown?.raise(k); this.ui.play('capture');
    this.ui.banner(`${b.name.toUpperCase()} BANNER UP!`, 'win', 1.3);
    this.sim.blast(this.match.player, this.zone, 4, 34); // each banner fires a volley
  }
  // All five banners up: the giant snowball rolls out of the schoolyard at the rival captain.
  giantSnowball() {
    if (this.giant) return;
    this.giant = { t: 0 };
    if (this.waveIdx < 2) this.spawnWave(Math.max(1, this.waveIdx)); // the captain always comes for the finale
    this.ui.banner('GIANT SNOWBALL!', 'super', 1.8); this.ui.play('superReady');
    this.ui.coach('All five banners are up! Here comes the giant snowball!', 3);
    this.giantT = setTimeout(() => {
      if (this.mode !== 'outpost') return;
      const sim = this.sim, P = this.match.player, z = this.zone;
      const rivals = sim.chars.filter(c => c.side === 'rival' && !c.benched && !c.gone && !c.frozen);
      const target = rivals.find(c => c.minion === 'captain') || rivals.sort((a, b) => Math.hypot(a.x - z.x, a.z - z.z) - Math.hypot(b.x - z.x, b.z - z.z))[0] || { x: z.x, z: z.z + 6 };
      const from = { x: z.x - (target.x - z.x) * 0.6, z: z.z - (target.z - z.z) * 0.6 };
      const roll = 1.4;
      this.ui.showdown?.giantBall(from, { x: target.x, z: target.z }, roll); this.ui.play('whoosh');
      this.giantT = setTimeout(() => {
        if (this.mode !== 'outpost') return;
        const dx = target.x - from.x, dz = target.z - from.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
        for (const c of sim.chars) { // everything in its path or near the end is frozen
          if (c.side !== 'rival' || c.benched || c.gone || c.frozen) continue;
          const px = c.x - from.x, pz = c.z - from.z, along = px * ux + pz * uz, off = Math.abs(px * uz - pz * ux);
          if ((along > -1 && along < L + 1 && off < 2.4) || Math.hypot(c.x - target.x, c.z - target.z) < 3.5) { c.shield = 0; sim.hit(c, { dmg: 9999, owner: P.id, kind: 'super', vx: ux * 10, vz: uz * 10, x: c.x - ux, z: c.z - uz }); }
        }
        this.ui.showdown?.burst(target); this.ui.play('hit');
        this.giantT = setTimeout(() => this.victory(), 1300);
      }, roll * 1000);
    }, 1500);
  }
  victory() {
    if (this.mode !== 'outpost') return;
    const st = this.cur, z = this.zone, stats = this.flow.stageStats(z), seconds = Math.round((performance.now() - this.t0) / 1000);
    // the rivals give up: snowmen melt, rival kids go home; the school bell rings
    this.match.clearMinions(); this.ui.onGone?.(); for (const c of this.sim.chars) if (c.side === 'rival') this.bench(c);
    this.ui.banner('THE RIVALS GIVE UP!', 'win', 2);
    this.ui.showdown?.ring(); [0, 450, 900].forEach(d => setTimeout(() => this.ui.play('bell'), d)); this.ui.fireworks?.(z);
    finishStage(this.up, st.id, { ...stats, flakes: this.runFlakes, seconds }); this.writeSave(this.save);
    setTimeout(() => this.arenaResults(stats, seconds), 2600);
  }
  arenaResults(stats, seconds) {
    this.cleanup(false);
    const sts = stageState(this.up), run = this.up.arenas[0].run, acc = run?.total ? run.firstTry / run.total : 0, pass = acc >= UNLOCK;
    const total = STAGES.reduce((s, x) => s + (sts[x.id]?.seconds || 0), 0), mmss = t => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    const rows = STAGES.map(s => `<li><span>${THEME_ICON[ICON[s.id]] || ''}</span><b>${esc(s.title)}</b><i>${STAR(sts[s.id]?.stars || 0)}</i></li>`).join('');
    $('#results').innerHTML = `<div class="rs-card rs-arena"><div class="rs-icon">${THEME_ICON.schoolyard}</div><h2>Our School is safe!</h2><p class="rs-sub">Arena 1 · Home Turf complete</p>
      <ul class="rs-stages">${rows}</ul>
      <p>Stars: <b>★ ${totalStars(this.up)} of ${STAGES.length * 3}</b> · Showdown: <b>${stats.firstTry} of ${stats.total}</b> right first time</p>
      <p>Right first time in Arena 1: <b>${Math.round(acc * 100)}%</b> ${pass ? '· You reached the 80% goal! 🎉' : `· The goal is ${Math.round(UNLOCK * 100)}%. Replay stages for more!`}</p>
      <p>Snowflakes: <b>❄ ${this.save.snowflakes || 0}</b> · Arena time: <b>${mmss(total)}</b></p>
      <div class="rs-btns"><button type="button" class="menu-btn" data-go="map">Stage map</button></div></div>`;
    $('#results').hidden = false; this.mode = 'results'; $('#hud').hidden = true; this.drawLives();
    $('#results').onclick = e => { if (e.target.closest('[data-go]')) { $('#results').hidden = true; this.showMap(); } };
  }

  // ---------- every frame ----------
  update(dt) {
    if (this.mode === 'sled') { this.sled.update(dt); return; }
    if (this.mode !== 'outpost') return;
    this.tStand += dt;
    const gone = this.match.removeGone(); if (gone.length) this.ui.onGone?.(gone);
    const v = this.flow.visits.get(this.zone.id);
    if (this.plan) this.updateExtras(dt);
    if (this.phase === 'fight') this.updateFight(dt);
    else if (this.phase === 'strike') this.updateStrike(dt);
    else if (this.phase === 'seize' && !this.flow.busy && !this.zone.owner && !this.begun) { // walk into the circle to start seizing (after 8 s the kid walks in by itself)
      const P = this.match.player, inside = Math.hypot(P.x - this.zone.x, P.z - this.zone.z) <= this.zone.r;
      this.tSeize += dt; if (this.tSeize > 8 && !P.travel && !inside) this.walkIn();
      if ((inside || this.tSeize > 14) && !P.frozen && !P.thaw) { this.begun = true; this.ui.seizeButton?.(false); this.flow.begin(this.zone); } // never stuck outside
    }
    if (this.cur.final) { this.updateShowdown(dt, v); return; }
    if (this.waveIdx === 0 && this.tStand > 2) this.spawnWave(0);
    if (this.waveIdx === 1 && !this.plan && this.phase !== 'fight' && ((v && v.done >= 3 && this.alive(this.waves[0]) <= 1) || this.waves[0].t > 30) && !this.zone.owner) this.spawnWave(1);
    for (const w of this.waves) { if (!w || w.cleared) continue; w.t += dt; if (!this.alive(w)) { w.cleared = true; if (!w.final && !this.plan) { this.ui.banner('WAVE CLEAR!', 'win', 1.3); this.ui.play('superReady'); } } }
    // the final wave decides: beaten (or 8 s of it held off) and the outpost is yours
    if (this.finalT !== null) { this.finalT += dt; const fw = this.waves[2]; if ((fw && fw.cleared) || this.finalT > (this.plan ? this.plan.final : 8)) { this.finalT = null; if (this.plan) this.retreat(); if (fw && !fw.cleared) this.ui.banner('THEY GIVE UP!', 'win', 1.2); setTimeout(() => { if (this.mode === 'outpost') this.flow.held(this.zone); }, fw?.cleared ? 600 : 1200); } }
  }
  // walk into the circle: to a free spot just inside its edge, nearest the player (the middle is the landmark)
  walkIn() {
    const z = this.zone, P = this.match.player, g = this.match.grid; if (!z || P.frozen) return;
    const a0 = Math.atan2(P.x - z.x, P.z - z.z);
    for (const da of [0, 0.4, -0.4, 0.8, -0.8, 1.3, -1.3, 2, -2, Math.PI]) for (const rr of [z.r - 0.7, z.r - 1.1]) {
      const x = z.x + Math.sin(a0 + da) * rr, zz = z.z + Math.cos(a0 + da) * rr;
      if (g.freeCircle(x, zz, 0.4) && this.sim.travelTo(P, x, zz)) return;
    }
  }
  // the most open direction round a circle (the schoolyard has no fight yard in the map)
  openDir(z) {
    const g = this.match.grid; let best = null;
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, d = [Math.cos(a), Math.sin(a)]; let n = 0; for (let r = 4; r <= 10; r += 1) for (const o of [-1.5, 0, 1.5]) if (g.freeCircle(z.x + d[0] * r - d[1] * o, z.z + d[1] * r + d[0] * o, 0.45)) n++; if (!best || n > best.n) best = { d, n }; }
    return best?.n > 12 ? best.d : null;
  }
  // The opening fight: when the first wave is (nearly) cleared, or after FIGHT_MAX seconds, the
  // landmark opens for seizing.
  // On a battlefield the whole rival team has to be beaten (frozen rivals go back to their camp);
  // after FIELD_MAX seconds the ones still standing run back to camp, so nobody is stuck.
  // With a fight plan: a round against a rival team that keeps coming back; freeze `goal` rivals.
  updateFight(dt) {
    this.tFight += dt; const w0 = this.waves[0], field = !!this.zone.battlefield;
    if (!w0) return;
    if (this.plan) {
      const won = this.score >= this.plan.open.goal;
      if (!won && this.tFight <= this.plan.open.max) return;
      this.retreat(won ? 'RIVAL LINE BROKEN!' : 'THEY RUN BACK TO CAMP!');
    }
    const beaten = this.plan || (field ? this.alive(w0) === 0 && this.tFight > 3 : this.alive(w0) <= 1 && this.tFight > 6);
    if (!beaten && this.tFight <= (field ? FIELD_MAX : FIGHT_MAX)) return;
    for (const c of w0.members) c.guard = null;
    if (field && !beaten) { for (const c of w0.members) { if (c.role === 'minion') c.gone = true; else this.bench(c); } this.ui.banner('THEY RUN BACK TO CAMP!', 'win', 1.3); }
    this.phase = 'seize'; this.begun = false; this.flow.stageHold = false; this.tSeize = 0; w0.t = 0; // the next wave counts from now
    if (field) { const z = this.zone; this.sim.held.home = [{ x: z.x, z: z.z + 6.5 }]; this.sim.spawns.home = this.sim.held.home.slice(); } // now the team gets back in quickly
    this.ui.banner(this.cur.final ? 'RAISE THE BANNERS!' : 'SEIZE IT!', 'go', 1.3); this.ui.play('superReady');
    this.ui.coach(field ? 'The rival team is beaten! Run up to the glowing circle and seize it (or tap ▶ Seize).' : 'The yard is clear! Walk into the glowing circle to seize it (or tap ▶ Seize).', 4);
    this.ui.seizeButton?.(true);
  }
  // Showdown waves come with the banners: the captain after two, everyone after four.
  updateShowdown(dt, v) {
    if (this.waveIdx === 0 && this.tStand > 2) this.spawnWave(0);
    const up = v ? v.bannersUp : 0;
    while (this.bannersUp < up) this.raiseBanner(this.bannersUp++);
    if (this.waveIdx === 1 && (up >= 2 || (this.tStand > 45 && this.alive(this.waves[0]) <= 1))) this.spawnWave(1);
    if (this.waveIdx === 2 && up >= 4) this.spawnWave(2);
    for (const w of this.waves) { if (!w || w.cleared) continue; w.t += dt; if (!this.alive(w)) { w.cleared = true; if (!this.giant) { this.ui.banner('WAVE CLEAR!', 'win', 1.3); this.ui.play('superReady'); } } }
  }
  onEvent(e) {
    if (this.mode !== 'outpost') return;
    if (this.plan && e.type === 'freeze') { // the fights: rivals frozen count, word snowmen are checked, and our kids never lose a life
      const c = this.sim.chars.find(q => q.id === e.id);
      if (c && c.side === 'rival') {
        if (this.phase === 'fight') this.score++;
        if (c.word && this.hunt?.includes(c)) {
          const r = this.words.frozen(c.word);
          this.ui.fx?.number(c.x, c.z, `${c.word.en} = ${c.word.tr}`, 'word'); speech.say(c.word.en);
          if (r === 'right') {
            const P = this.match.player; if (this.phase === 'fight') this.score += this.plan.hunt.bonus;
            const before = P.super; P.super = Math.min(1, P.super + 0.35); if (before < 1 && P.super >= 1) this.sim.emit('superReady', { id: P.id });
            this.ui.banner('RIGHT WORD!', 'good', 1.2); this.ui.play('sparkle'); this.endHunt();
          } else if (r === 'wrong') this.ui.coach(`That one says "${c.word.en}" (${c.word.tr}). Find: ${this.words.cur.target.tr}`, 3);
        }
      }
      if (c && c === this.match.player) { if (!this.toldFrozen) { this.toldFrozen = true; this.ui.coach('Frozen! You are back at the start in a moment. In a fight you never lose a life.', 4); } return; }
    }
    if (e.type === 'respawn' && this.phase === 'fight' && this.zone?.battlefield && !this.plan) { const c = this.sim.chars.find(q => q.id === e.id); if (c && c.side === 'rival' && c.role !== 'minion') this.bench(c); return; } // frozen rivals go back to camp
    if (e.type === 'freeze' && e.id === this.match.player.id) { const left = this.lives.lose(); this.ui.banner(left ? `${left} ${left === 1 ? 'LIFE' : 'LIVES'} LEFT` : 'NO LIVES LEFT', 'lose', 1.4); this.drawLives(); if (!left) setTimeout(() => this.outOfLives(), 900); }
  }
  drawLives() { const el = $('#lives'); if (el) { el.hidden = this.mode !== 'outpost'; el.innerHTML = Array.from({ length: this.lives.max }, (_, i) => `<i class="${i < this.lives.left ? 'on' : ''}">♥</i>`).join(''); } }

  bindInput() {
    addEventListener('keydown', e => {
      if (this.mode !== 'sled' || !this.sled) return;
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') this.sled.move(-1); else if (k === 'arrowright' || k === 'd') this.sled.move(1);
      else if (k === 'arrowup' || k === 'w' || k === ' ') this.sled.jump(); else if (k === 'arrowdown' || k === 's') this.sled.duck(); else return;
      e.preventDefault();
    });
    let sx = 0, sy = 0, st = 0;
    const sw = $('#swipe');
    sw.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; st = performance.now(); });
    sw.addEventListener('pointerup', e => {
      if (this.mode !== 'sled' || !this.sled) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) this.sled.move(dx > 0 ? 1 : -1); else if (dy < 0) this.sled.jump(); else this.sled.duck();
    });
    $('#runhud').addEventListener('pointerdown', e => { const b = e.target.closest('[data-k]'); if (!b || !this.sled) return; e.preventDefault(); ({ left: () => this.sled.move(-1), right: () => this.sled.move(1), jump: () => this.sled.jump(), duck: () => this.sled.duck() })[b.dataset.k](); });
  }
}
