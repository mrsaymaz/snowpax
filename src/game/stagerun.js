// Arena 1 (Kasımpaşa) as a stage: the arena card → the sled ride in (snowballs, and rare word
// snowflakes: the first ❄) → the outpost: camp (recruits), the Snow Shop, the opening round,
// Part 1 of the English, the shop, "They strike back!", Part 2, the shop, the Final Showdown with
// the rival captain → results. Three lives: a crash on the sled costs one (in the fights a freeze
// never does); with none left the stage starts again (English answers already given still count).
// See stages.mjs for the stage, fights.mjs for the plan and waves.mjs for the waves.
import { CONFIG } from '../config.js';
import { STAGES, stageById, Lives, stageState, isUnlocked, nextStage, finishStage, totalStars, UNLOCK, PLACE_OF, PLACE_ID } from './stages.mjs';
import { FAMILIES } from '../tasks/subtasks.mjs';
import { WAVES, RIVAL_INFO, minionList, stageWall, setWall, entryPoints } from './waves.mjs';
import { flakeWords } from './visit.mjs';
import { FIGHT_PLANS, WordHunt, Armoury, ROLES, KID_NAMES, SHOP } from './fights.mjs';
import { makeLook } from './looks.mjs';
import { SledRun } from './sledrun.js';
import { CINEMA } from './render/cinema.js';
import { THEME_ICON } from './taskcard.js';
import { speech } from './speech.js';
import { music, stopMusic, duckMusic, hasMusic } from './audio.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FIGHT_MAX = 14; // seconds of the opening fight at most
const FIELD_MAX = 45; // on a battlefield: beat the rival team, or after this long they run back to camp
const FAMILY_NAME = Object.fromEntries(FAMILIES.map(f => [f.id, f.name]));
const STAR = n => '★'.repeat(n) + '☆'.repeat(3 - n);
const ICON = { kasimpasa: 'kizilay', 'golden-horn': 'waterfront', downtown: 'tram' };

export class StageRunner {
  constructor({ match, flow, unit, unitProgress, save, writeSave, pace, rng, team, kit, reduceMotion, ui }) {
    Object.assign(this, { match, sim: match.sim, flow, unit, up: unitProgress, save, writeSave, pace, rng, team, kit, reduceMotion, ui });
    this.mode = 'map'; this.lives = new Lives(); this.wall = []; this.waves = []; this.runFlakes = 0; this.runBalls = 0; this.ridesDone = 0;
    flow.ui.onCaptured = z => this.captured(z); flow.ui.onHeld = z => this.held(z); flow.ui.onHalf = z => this.startBuild('strike', () => this.startStrike(z)); flow.ui.onStar = () => this.addFlake(); flow.ui.onRecruit = (id, right) => this.recruitAnswer(id, right);
    flow.ui.onExtraDone = () => this.startBuild('final', () => this.startShowdown());
    flow.ui.onPlaceStart = f => { const k = this.seatOf(f); if (k >= 0) this.ui.carousel?.face(k); const id = this.cur?.places?.[f]?.id; if (id && hasMusic(id)) music(id, { level: 0.7 }); }; // the place's own theme as its task opens
    flow.ui.onPlaceDone = f => { const k = this.seatOf(f); if (k >= 0 && !this.lit.includes(k)) { this.lit.push(k); this.ui.carousel?.light(k); } };
    this.bindInput();
    // rival kids wait off the field until their wave
    for (const c of this.sim.chars) if (c.side === 'rival') this.bench(c);
  }
  get stage() { return this.cur; }
  // the carousel seat of a place's task family (the seats ride in the order the tasks are played)
  seatOf(f) { return this.cur?.parts ? this.cur.parts.flat().indexOf(f) : -1; }
  bench(c) { c.guard = null; c.benched = true; c.x = -999; c.z = -999; c.vx = c.vz = 0; c.travel = null; }

  // ---------- the stage map ----------
  showMap() {
    this.mode = 'map'; document.body.classList.remove('sledding'); $('#hud').hidden = true;
    setTimeout(() => { if (this.mode === 'map') this.prepareRide(nextStage(this.up) || STAGES[0]); }, 400); // the next ride gets ready while the map is up
    const st = stageState(this.up), next = nextStage(this.up), run = this.up.arenas[0].run, acc = run?.total ? Math.round(run.firstTry / run.total * 100) : null;
    const nodes = STAGES.map((s, i) => {
      const open = isUnlocked(this.up, s.id), done = st[s.id]?.done, cls = done ? 'done' : open ? 'open' : 'locked';
      return `<button type="button" class="sm-node ${cls} ${next === s ? 'next' : ''}" data-id="${s.id}" style="--i:${i}" ${open ? '' : 'disabled'}>
        <span class="sm-icon">${THEME_ICON[ICON[s.id]] || ''}</span><b>Arena ${s.arena || i + 1} · ${esc(s.title)}</b><span class="sm-stars">${done ? STAR(st[s.id].stars) : open ? 'Play!' : '🔒'}</span></button>`;
    }).join('');
    const tipOf = s => Object.values(s.places || {}).map(p => p.title), go = next || STAGES[0], places = tipOf(go);
    $('#stagemap').innerHTML = `<div class="sm-card"><h2>Your arenas</h2><p class="sm-sub">${esc(this.unit.title)} · ★ ${totalStars(this.up)} of ${STAGES.length * 3}${acc !== null ? ` · Right first time ${acc}% (need ${Math.round(UNLOCK * 100)}%)` : ''}</p>
      <div class="sm-path">${nodes}</div><p class="sm-tip">Sled into ${esc(go.title)} and take its outpost from the rival team: English at ${esc(places.slice(0, -1).join(', '))} and ${esc(places.at(-1) || '')} earns ❄ for boosts. You will need them for the Final Showdown!</p></div>`;
    $('#stagemap').hidden = false;
    setTimeout(() => { if (this.mode === 'map') this.ui.guide?.('welcome'); }, 500); // the very first time: Mr. Saymaz says hello
    $('#stagemap').onclick = e => { const b = e.target.closest('.sm-node'); if (b && !b.disabled) this.start(stageById(b.dataset.id)); };
  }

  // ---------- one stage ----------
  start(stage) {
    $('#stagemap').hidden = true; $('#results').hidden = true; $('#outoflives').hidden = true;
    this.cur = stage; this.lives.reset(); this.t0 = performance.now(); this.runFlakes = 0; this.runBalls = 0;
    this.ride();
  }
  // the ride for a stage: its track, its things and its places' scenes (not started)
  makeRide(st, views = null) {
    const words = flakeWords(this.unit, st.ride.flakes || 5, this.up.missed, this.rng);
    const spellPool = this.unit.words.filter(w => /^[a-z]{3,7}$/i.test(w.en)), spell = st.ride.spell && spellPool.length ? spellPool[Math.floor(this.rng() * spellPool.length)] : null;
    // the places on the way, in the order their tasks are played: a scene where the camera turns to each
    const cinema = (st.parts || []).flatMap((fams, p) => fams.map(f => ({ id: st.places?.[f]?.id || PLACE_ID[f], title: st.places?.[f]?.title || PLACE_OF[f], task: FAMILY_NAME[f], part: p + 1 })));
    const sled = new SledRun({ theme: st.ride.theme, seconds: st.ride.seconds, pace: this.pace, team: this.team, kit: this.kit, look: this.match.player.look, words, spell, views, lives: this.lives, rng: this.rng, first: this.ridesDone === 0, reduceMotion: this.reduceMotion, cinema,
      on: {
        cinema: e => this.cinema(e),
        crash: lost => { this.ui.play('hit'); const left = this.lives.lose(); this.drawRunHud(); this.toast(lost ? `Ouch! −${lost} snowballs` : 'Ouch!'); if (!left) this.outOfLives(); },
        count: () => this.drawRunHud(), sound: (k, o) => this.ui.play(k, o),
        word: w => { this.toast(`+1 ❄  ${w.en} = ${w.tr}`, 'word'); speech.say(w.en); },
        spell: (sofar, right) => { this.drawRunHud(); if (sofar.length === spell.en.length) { const ok = !this.sled.missedLetters; this.toast(ok ? `You spelled ${spell.en.toUpperCase()}! +1 ❄` : `The word was ${spell.en.toUpperCase()} (${spell.tr})`, 'word'); if (ok) this.sled.flakes += 1; speech.say(spell.en); } },
        hint: text => this.rideBanner(text, '', 1.3),
        look: () => this.rideBanner('LOOK TO THE LEFT! ←', 'look', 2.6),
        fast: on => document.body.classList.toggle('sled-fast', on), // empty lanes ahead: a place's view is coming
        bonus: text => { this.toast(text, 'bonus'); this.ui.play('chime', { freq: 1046.5 }); this.drawRunHud(); },
        progress: p => { const bar = $('#runhud .rh-prog i'); if (bar) bar.style.width = Math.round(p * 100) + '%'; },
        done: r => { this.runFlakes = r.flakes; this.runBalls = r.snowballs; this.ridesDone++; setTimeout(() => this.arrive(), 700); },
      } });
    return sled;
  }
  // Get a stage's ride ready ahead (while the map is shown): its places' scenes are built one per
  // frame (the map stays smooth), then the GPU compiles every shader and takes every shape and
  // picture once (ui.warm), so the ride and its scenes never stutter on a phone.
  prepareRide(st) {
    if (this.next?.id === st.id) return this.next.promise;
    const old = this.next; if (old) { old.cancel = true; old.promise.then(s2 => s2?.dispose()); }
    const next = this.next = { id: st.id, cancel: false };
    const frame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
    next.promise = (async () => {
      const ids = [...new Set((st.parts || []).flat().map(f => st.places?.[f]?.id || PLACE_ID[f]).filter(id => CINEMA[id]))], views = new Map();
      for (const id of ids) { await frame(); if (next.cancel) return null; try { views.set(id, CINEMA[id].build({})); } catch (err) { console.warn('scene', id, err); } }
      await frame(); if (next.cancel) return null;
      const sled = this.makeRide(st, views);
      await frame(); if (next.cancel) { sled.dispose(); return null; }
      try { await this.ui.warm?.(sled); } catch (err) { console.warn('warm', err); }
      next.done = true; return next.cancel ? (sled.dispose(), null) : sled;
    })();
    return next.promise;
  }
  async ride() {
    const st = this.cur; this.mode = 'loading';
    if (this.next?.id !== st.id || !this.next.done) this.ui.coach?.('Getting the sleds ready…');
    const sled = await this.prepareRide(st); this.next = null;
    if (this.cur !== st || !sled) { sled?.dispose(); return; }
    this.sled?.dispose(); this.sled = sled; const spell = sled.spell;
    this.sled.resize(innerWidth, innerHeight);
    this.mode = 'sled'; document.body.classList.add('sledding'); $('#hud').hidden = true; $('#runhud').hidden = false;
    $('#runhud').innerHTML = `<div class="rh-top"><span class="rh-lives"></span><div class="rh-prog"><i></i><span class="rh-dest">${THEME_ICON[ICON[st.id]] || ''}</span></div><span class="rh-balls" aria-label="Snowballs">⚪ <b>0</b></span><span class="rh-flakes" aria-label="Snowflakes for the Snow Shop">❄ <b>0</b></span></div>
      <div class="rh-spell" ${spell ? '' : 'hidden'}><small>Spell: <span lang="tr">${esc(spell?.tr || '')}</span></small><div class="rh-slots"></div></div><div class="rh-toast"></div>
      <div class="rh-lines" aria-hidden="true"></div><div class="rh-banner"></div><div class="rh-cine" hidden><small></small><b></b><span class="rh-skip" hidden>Tap to skip</span></div>
      <div class="rh-btns"><button type="button" data-k="left" aria-label="Left">◀</button><button type="button" data-k="duck" aria-label="Duck">▼</button><button type="button" data-k="jump" aria-label="Jump">▲</button><button type="button" data-k="right" aria-label="Right">▶</button></div>`;
    this.spell = spell; this.drawRunHud();
    this.rideTune = hasMusic('sled-' + st.id) ? 'sled-' + st.id : 'sled'; music(this.rideTune); // the ride's tune (the arena's own, if it has one), all the way in
    if (this.ui.guided?.('sled') !== false) this.ui.coach(`Sled into ${st.title}! Catch the purple snowflakes for the Snow Shop!`, 4);
    this.ui.guide?.('sled', { spell: !!spell }); // the first ride: how to steer, jump, duck (the ride waits)
  }
  // a place on the way: no bars, its name card (seen, not read aloud)
  cinema(e) {
    const h = $('#runhud'), card = h?.querySelector('.rh-cine'); if (!card) return;
    if (e.phase === 'start') {
      document.body.classList.add('cinema'); card.querySelector('b').textContent = e.title; card.querySelector('small').textContent = `${e.task} · Part ${e.part}`;
      card.querySelector('.rh-skip').hidden = !this.seenCinema?.has(e.id); card.hidden = true;
      clearTimeout(this.cineT); this.cineT = setTimeout(() => { card.hidden = false; card.classList.remove('show'); void card.offsetWidth; card.classList.add('show'); this.cineT = setTimeout(() => { card.hidden = true; }, 3400); }, 900); // the name card, then the scene alone
      // the name is on the card only: places are not announced aloud
      this.ui.play('whoosh');
      if (hasMusic(e.id)) { duckMusic(this.rideTune, 0.18, 0.6); music(e.id); } // the place's own theme over the ride's tune, turned down
      return;
    }
    // the camera swings back ('ready', also on a skip), then the ride goes on ('end')
    card.hidden = true; card.classList.remove('show'); clearTimeout(this.cineT); document.body.classList.remove('cinema'); (this.seenCinema ||= new Set()).add(e.id);
    if (e.phase === 'ready') stopMusic(e.id, 0.8);
    if (e.phase === 'end') duckMusic(this.rideTune, 1, 1.2);
  }
  drawRunHud() {
    const h = $('#runhud'); if (!h || h.hidden || !this.sled) return;
    h.querySelector('.rh-lives').innerHTML = Array.from({ length: this.lives.max }, (_, i) => `<i class="${i < this.lives.left ? 'on' : ''}">♥</i>`).join('');
    h.querySelector('.rh-flakes b').textContent = this.sled.flakes; h.querySelector('.rh-balls b').textContent = this.sled.snowballs;
    if (this.spell) h.querySelector('.rh-slots').innerHTML = [...this.spell.en].map((c, i) => `<span class="${i < this.sled.spelled.length ? 'on' : ''}">${i < this.sled.spelled.length ? esc(this.sled.spelled[i]) : ''}</span>`).join('');
  }
  // the ride's own banner (the fight HUD, with its banner, is hidden on the ride)
  rideBanner(text, cls = '', sec = 1.4) { const b = $('#runhud .rh-banner'); if (!b) return; b.textContent = text; b.className = 'rh-banner show ' + cls; clearTimeout(this.rbT); this.rbT = setTimeout(() => { b.className = 'rh-banner'; }, sec * 1000); }
  toast(text, cls = '') { const t = $('#runhud .rh-toast') || $('#stagetoast'); if (!t) return; t.className = (t.id === 'stagetoast' ? '' : 'rh-toast ') + 'show ' + cls; t.textContent = text; clearTimeout(this.toastT); this.toastT = setTimeout(() => { t.className = t.id === 'stagetoast' ? '' : 'rh-toast'; }, 1800); }

  // ---------- arriving at the outpost ----------
  arrive() {
    const st = this.cur, sim = this.sim, z = sim.zones.find(q => q.id === st.outpost), grid = this.match.grid;
    this.save.snowflakes = (this.save.snowflakes || 0) + this.runFlakes; this.writeSave(this.save); stopMusic(null, 1.2);
    this.ui.rebuildWorld?.(z); // v2 look: build only this stage's area
    this.lit = []; this.seatT = 2; this.seatK = 0; this.ui.carousel?.reset();
    this.mode = 'outpost'; document.body.classList.remove('sledding', 'sled-fast'); $('#runhud').hidden = true; $('#hud').hidden = false;
    this.zone = z; this.tStand = 0; this.waveIdx = 0; this.waves = []; this.finalT = null; sim.activeZone = z;
    // longer fights with English inside them (fights.mjs): the stage's plan, two parts of English
    this.plan = st.fights ? FIGHT_PLANS[st.fights] : null; z.parts = st.parts || null; z.places = st.places || null; z.perFamily = this.plan?.perFamily || null;
    this.score = 0; this.hunt = null; this.huntT = 0; this.trickleT = 0; this.toldFrozen = false; this.showTries = 0;
    if (this.plan) { this.huntNext = this.plan.hunt.first; this.words = this.words || new WordHunt(this.unit, this.rng, this.plan.hunt.size); this.arm = new Armoury(this.plan.recruits); this.arm.earn(this.runFlakes); } // the sled ride's snowflakes come along
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
    // the finale of the ride in: the camera arrives at the carousel first, the rival team lined up in front of it
    const lineUp = this.plan && z.battlefield ? this.sim.chars.filter(c => c.side === 'rival' && c.role !== 'minion').slice(0, 3) : [];
    lineUp.forEach((c, k) => Object.assign(c, { benched: false, x: z.x + (k - 1) * 2.3, z: z.z + 6.4 + (k === 1 ? 0.5 : 0), face: 0, frozen: 0, thaw: 0, vx: 0, vz: 0, travel: null }));
    const wait = this.ui.intro ? this.ui.intro(z, { title: st.title, kicker: `Arena ${st.arena || 1} · The outpost`, line: `Welcome to ${st.title}! Let's take it back!`, tune: hasMusic('arrive-' + st.id) ? 'arrive-' + st.id : 'carousel', onDone: () => { for (const c of lineUp) this.bench(c); } }) || 0 : 0;
    this.introWait = wait;
    setTimeout(() => { if (this.mode === 'outpost') this.ui.banner(st.title.toUpperCase(), 'go', 1.6); }, wait);
    this.ui.hush?.(); // a calm arrival: nothing left over from the ride
    if (st.newRival && RIVAL_INFO[st.newRival]) { if (this.plan) this.pendingRival = st.newRival; else this.newRival(st.newRival); } // with a plan: shown at the first build moment, before the fight
    // first a fight: clear the first wave of snowmen, then seize the outpost with English (with a
    // fight plan: first the camp, then building, then the fight)
    this.phase = 'fight'; this.tFight = 0; this.flow.stageHold = true;
    if (this.plan) this.startCamp(z);
    if (z.battlefield) { this.ui.markRival?.(z); setTimeout(() => { if (this.phase === 'fight') this.ui.coach(this.plan ? `The rival team holds ${z.label}! Freeze ${this.plan.open.goal} rivals to break their line. They keep coming back, so keep throwing!` : `The rival team holds ${z.label}! Beat them in a snowball fight, then seize it with English.`, 6); }, 1700); }
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
    if (!this.plan) this.ui.banner(`WAVE ${i + 1}: ${w.name.toUpperCase()}`, w.final ? 'lose' : 'super', 1.8); this.ui.play('whoosh');
  }
  // ---------- the longer fights (fights.mjs) ----------
  // a snowman walks out of the rivals' camp (round the outpost) toward `goal`
  spawnSnowman(type, goal, word = null) {
    const e = this.entries[Math.floor(this.rng() * this.entries.length)], c = this.match.addMinion(type, e.x + (this.rng() - 0.5), e.z + (this.rng() - 0.5), goal);
    if (word) c.word = word; return c;
  }
  // ---------- preparing for the fights (fights.mjs): camp, recruits, stars, building ----------
  // Camp: neighbourhood children wait at the home end in plain coats; answer one's question and they
  // join the team. No rivals on the field yet.
  startCamp(z) {
    this.phase = 'camp'; this.tCamp = 0; this.ui.wallet?.(this.arm.flakes);
    const taken = new Set();
    this.plan.camp.kids.forEach(([v, d, role], k) => { // on the planned spot, or the nearest open one
      const near = [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.6], [0, -0.6], [1, 0], [-1, 0], [0.8, 0.8], [-0.8, 0.8]].map(([a, b]) => [z.x + v + a * Math.sign(v || 1), z.z + d + b]);
      const at = near.find(([x, zz]) => this.match.grid.freeCircle(x, zz, 0.5)); if (!at) return;
      const gender = (k + (this.rng() < 0.5 ? 0 : 1)) % 2 ? 'girl' : 'boy', names = KID_NAMES[gender].filter(n => !taken.has(n)), name = names[Math.floor(this.rng() * names.length)]; taken.add(name);
      this.sim.addRecruitSpot({ id: 'k' + k, role, name, look: makeLook(gender, this.rng), x: at[0], z: at[1] });
    });
    setTimeout(() => { if (this.phase !== 'camp') return; if (this.ui.guided?.('camp') === false) this.ui.guide('camp'); else this.ui.coach('Walk up to each kid and answer their question. Right first time and they join!', 5); }, 1600 + (this.introWait || 0)); // after the arrival: the first time, Mr. Saymaz shows how
  }
  updateCamp(dt) {
    this.tCamp += dt;
    for (const p of this.sim.pickups) if (p.kind === 'recruit' && p.cd > 0) { p.cd -= dt; if (p.cd <= 0) { p.cd = 0; p.asking = false; } } // ready to be asked again
    const left = this.sim.pickups.filter(p => p.kind === 'recruit').length;
    if ((left === 0 || this.tCamp > this.plan.camp.max) && !this.flow.busy) { this.sim.removeRecruitSpot(); this.startBuild('field', () => this.beginFight()); }
  }
  // a child's question was answered: right (first time) and they join; wrong and they wait a moment
  recruitAnswer(pickupId, right) {
    const p = this.sim.pickups.find(q => q.id === pickupId); if (!p) return;
    if (right && this.arm.join(p.role)) { this.sim.removeRecruitSpot(p.id); this.joinTeam(p.role, p.name, p.look, p.x, p.z); }
    else { p.cd = this.plan.camp.retry; this.ui.coach(`${p.name} says: "Nearly! Ask me again in a moment."`, 3); }
  }
  joinTeam(role, name, look, x, z) {
    const R = ROLES[role], c = this.match.addRecruit({ kit: R.kit, style: R.style, look, name, x, z });
    this.ui.recruited?.(c, R); this.ui.banner(`${name.toUpperCase()} JOINS!`, 'win', 1.3); this.ui.play('fanfare');
    return c;
  }
  addFlake() { if (!this.arm) return; this.arm.earn(1); this.ui.wallet?.(this.arm.flakes, true); }
  // Build: the Snow Shop, where ❄ buy boosts; then the fight starts (Fight! or 35 s).
  startBuild(kind, next) {
    if (this.mode !== 'outpost' || !this.plan) { next(); return; }
    this.phase = 'build'; this.buildKind = kind; this.buildNext = next; this.tBuild = 0; this.flow.stageHold = true; this.ui.seizeButton?.(false);
    this.ui.build?.open(this.buildInfo());
    setTimeout(() => { if (this.phase === 'build') this.ui.guide?.('shop'); }, 700); // the first Snow Shop
    if (this.pendingRival) { this.newRival(this.pendingRival); this.pendingRival = null; } // who you will meet in the fight
  }
  buildInfo() { return { kind: this.buildKind, flakes: this.arm.flakes, boosts: this.arm.boosts, next: this.arm.next, left: Math.max(0, Math.ceil(this.plan.build - this.tBuild)) }; }
  updateBuild(dt) { this.tBuild += dt; if (this.tBuild > this.plan.build) this.endBuild(); }
  buyBoost(id) {
    if (this.phase !== 'build' || !this.arm.buyBoost(id)) return false;
    const P = this.match.player; if (id === 'gloves') { P.ammoMax = CONFIG.fight.ammoMax + 1; P.ammo = P.ammoMax; } if (id === 'quick') P.reloadMul = 1.45;
    this.ui.play('sparkle'); this.ui.wallet?.(this.arm.flakes); this.ui.build?.refresh(this.buildInfo(), id); return true;
  }
  endBuild() {
    if (this.phase !== 'build') return;
    this.ui.build?.close(); const next = this.buildNext; this.buildNext = null;
    const P = this.match.player, use = this.arm.takeFight(); // the boosts, for this fight
    if (use.has('super')) P.super = Math.max(P.super, 0.5);
    if (use.has('coat')) P.coat = 1;
    P.gear = new Set(use); // the student's kid wears it in the fight
    next?.();
  }
  beginFight() {
    this.phase = 'fight'; this.tFight = 0; this.flow.stageHold = true; this.spawnWave(0);
    const z = this.zone; this.ui.coach(`The rival team holds ${z.label}! Freeze ${this.plan.open.goal} rivals to break their line. They keep coming back, so keep throwing!`, 5);
    setTimeout(() => { if (this.phase === 'fight') this.ui.guide?.('fight'); }, 400); // the first fight: move, throw, super
  }
  // the opening round and the strike-back: snowmen keep coming; word snowmen walk out in a tidy row
  updateExtras(dt) {
    if (this.phase === 'camp') return this.updateCamp(dt);
    if (this.phase === 'build') return this.updateBuild(dt);
    const P = this.plan, z = this.zone, fighting = this.phase === 'fight' || this.phase === 'strike' || this.phase === 'showdown';
    const goal = this.phase === 'fight' ? this.yardGoal : z;
    if (this.phase === 'showdown') this.updateShowdown(dt);
    if (fighting && this.lit.length) { // the lit landmarks on the carousel throw snowballs at the rivals (never at the captain or a word snowman)
      this.seatT -= dt;
      if (this.seatT <= 0) {
        this.seatT = 3.2 / this.lit.length; const k = this.lit[this.seatK++ % this.lit.length], from = this.ui.carousel?.seatPos(k) || { x: z.x, z: z.z };
        const t = this.sim.chars.filter(c => c.side === 'rival' && !c.benched && !c.gone && !c.frozen && !c.thaw && !c.captain && !c.word && Math.hypot(c.x - from.x, c.z - from.z) < 14).sort((a, b) => Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z))[0];
        if (t) { const P0 = this.match.player; this.sim.lobAt(from, t, P0.side, P0.team); }
      }
    }
    if (fighting) {
      this.trickleT += dt;
      const live = this.sim.chars.filter(c => c.role === 'minion' && !c.gone && !c.word && !c.frozen).length;
      if (this.trickleT >= P.open.trickle && live < P.open.snowmen + this.arm.team.length * P.recruits.extraSnowmen) { /* more friends, a few more snowmen */ this.trickleT = 0; const types = minionList(WAVES[this.cur.id][0]); this.spawnSnowman(types[Math.floor(this.rng() * types.length)], goal); }
    }
    // word snowmen: find the English word for the Turkish one
    if (this.hunt) {
      this.huntT += dt;
      if (this.huntT > P.hunt.seconds) { const t = this.words.timeout(); this.endHunt(); if (t) { this.ui.hunt?.({ tr: `It was: ${t.en}`, pic: t.pic, reveal: true }); clearTimeout(this.huntRevealT); this.huntRevealT = setTimeout(() => { if (!this.hunt) this.ui.hunt?.(null); }, 2500); } }
    } else if (fighting) {
      this.huntNext -= dt;
      if (this.huntNext <= 0 && this.words.ready && !this.flow.busy) {
        const h = this.words.next(); this.huntT = 0; this.huntNext = P.hunt.every;
        // a tidy row, side by side: from the rival line toward the team in the opening round, from
        // the field toward the circle later; they walk slowly in their own lane and never throw
        const fromD = this.phase === 'fight' ? 7 : 13, toD = this.phase === 'fight' ? 15 : 6.5, n = h.words.length;
        this.hunt = h.words.map((w, k) => {
          let v = (k - (n - 1) / 2) * P.hunt.gap; const g = this.match.grid;
          for (const dv of [0, 0.5, -0.5, 1, -1]) if (g.freeCircle(z.x + v + dv, z.z + fromD, 0.45)) { v += dv; break; }
          const c = this.match.addMinion('waddler', z.x + v, z.z + fromD, goal);
          c.word = { id: w.id, en: w.en, tr: w.tr }; c.march = { x: z.x + v, z: z.z + toD }; c.face = toD > fromD ? 0 : Math.PI; return c;
        });
        this.ui.hunt?.(h.target); this.ui.play('whoosh');
      }
    }
  }
  endHunt() { for (const c of this.hunt || []) if (!c.frozen && !c.thaw) c.gone = true; this.hunt = null; this.ui.hunt?.(null); }
  // everyone still standing runs back to camp (the end of a fight)
  retreat(text) {
    if (text) this.ui.banner(text, 'win', 1.4);
    this.endHunt(); this.match.clearMinions(); this.ui.onGone?.();
    for (const c of this.sim.chars) if (c.side === 'rival') this.bench(c);
  }
  // "They strike back!" between the two halves: hold the circle until the clock runs out (it
  // stops while rivals stand in the circle with nobody of ours)
  startStrike(z) {
    if (this.mode !== 'outpost' || z !== this.zone) return;
    this.ui.carousel?.face(-1); // turning again
    this.phase = 'strike'; this.flow.stageHold = true; this.tStrike = 0; this.strikeLeft = this.plan ? this.plan.strike.seconds : 20; this.trickleT = 0;
    this.ui.banner('THEY STRIKE BACK!', 'lose', 1.6); this.ui.play('whoosh');
    this.ui.coach(`Part 1 is done! Now hold the circle for ${Math.round(this.strikeLeft)} seconds. Freeze anyone who steps in.`, 5);
    setTimeout(() => { if (this.phase === 'strike') this.ui.guide?.('strike'); }, 900);
    this.spawnWave(1);
  }
  updateStrike(dt) {
    const z = this.zone; this.tStrike += dt;
    this.strikeHeld = !(z.rival > 0 && z.home === 0);
    if (this.strikeHeld) this.strikeLeft -= dt;
    if (this.strikeLeft > 0 && this.tStrike < (this.plan?.strike.max ?? 40)) return;
    this.retreat('YOU HELD IT!'); this.toldIn = 0;
    this.phase = 'seize'; this.begun = false; this.flow.stageHold = false; this.tSeize = 0;
    this.ui.play('superReady'); this.ui.seizeButton?.(true);
    this.ui.coach('Part 2! Walk into the circle to finish taking the outpost (or tap ▶ Seize).', 4);
  }
  // the HUD line for the fights (null: the usual one)
  fightText() {
    if (this.mode !== 'outpost' || !this.plan) return null;
    if (this.phase === 'camp') { const n = this.plan.camp.kids.length, left = this.sim.pickups.filter(p => p.kind === 'recruit').length; return `friends joined ${n - left} / ${n}`; }
    if (this.phase === 'build') return `build time ${Math.max(0, Math.ceil(this.plan.build - this.tBuild))}s`;
    if (this.phase === 'fight') return `freeze rivals ${Math.min(this.score, this.plan.open.goal)} / ${this.plan.open.goal}`;
    if (this.phase === 'strike') return this.strikeHeld === false ? 'rivals in the circle!' : `hold it ${Math.max(0, Math.ceil(this.strikeLeft))}s`;
    if (this.phase === 'showdown') return `freeze the captain! ${Math.max(0, Math.ceil(this.plan.showdown.seconds - this.tShow))}s`;
    return null;
  }
  fightBar() {
    if (this.mode !== 'outpost' || !this.plan) return null;
    if (this.phase === 'fight') return Math.min(1, this.score / this.plan.open.goal);
    if (this.phase === 'strike') return Math.max(0, this.strikeLeft / this.plan.strike.seconds);
    if (this.phase === 'showdown' && this.captain) return Math.max(0, 1 - this.captain.warmth / this.captain.maxWarmth); // how far the captain is frozen
    return null;
  }
  alive(wave) { return wave.members.filter(c => !c.gone && !c.frozen && !c.thaw && !(c.role !== 'minion' && c.benched)).length; }

  captured(z) { // Part 2 is done: the shop, then the Final Showdown
    if (this.mode !== 'outpost') return;
    if (this.plan) { this.pendingRival = 'captain'; setTimeout(() => { if (this.mode === 'outpost') this.startBuild('final', () => this.startShowdown()); }, 1000); return; }
    setTimeout(() => { if (this.mode === 'outpost') { this.spawnWave(2); this.finalT = 0; } }, 1200);
  }
  // ---------- the Final Showdown ----------
  // The rival captain comes with the whole rival team. The captain is tough and warms up again
  // after a moment without a hit, so it takes steady throwing (the boosts) to freeze it in time.
  startShowdown() {
    const S = this.plan.showdown, z = this.zone;
    this.ui.carousel?.face(-1);
    this.phase = 'showdown'; this.tShow = 0; this.ui.hush?.(); this.flow.stageHold = true; this.trickleT = 0; this.ui.seizeButton?.(false);
    this.waves[2] = null; this.spawnWave(2);
    this.captain = this.waves[2].members.find(c => c.minion === 'captain') || null;
    if (this.captain) { const c = this.captain; c.maxWarmth = c.warmth = Math.round(c.maxWarmth * S.captainWarmth * S.tired ** (this.showTries || 0)); /* a little weaker on each try, so nobody is stuck */ c.duel = { id: this.match.player.id, others: S.others }; this.capWarm = c.warmth; this.capCalm = 0; }
    this.ui.banner('FINAL SHOWDOWN!', 'lose', 1.8); this.ui.play('whoosh');
    this.ui.coach(`The rival captain wants ${z.label} back! Only your snowballs can freeze the captain: your team keeps the others busy. You have ${S.seconds} seconds, and the captain warms up fast, so keep hitting. Your boosts help!`, 7);
    setTimeout(() => { if (this.phase === 'showdown') this.ui.guide?.('showdown'); }, 1200);
  }
  updateShowdown(dt) {
    const S = this.plan.showdown, c = this.captain; this.tShow += dt;
    if (c && !c.frozen && !c.gone) { // the captain warms up again after a moment without a hit
      if (c.warmth < this.capWarm - 0.01) this.capCalm = 0; else this.capCalm += dt;
      if (this.capCalm > S.regenDelay) c.warmth = Math.min(c.maxWarmth, c.warmth + S.regenRate * dt);
      this.capWarm = c.warmth;
    }
    if (c && (c.frozen || c.thaw || c.gone)) { // the captain is frozen: the rivals give up
      this.phase = 'seize'; this.captain = null;
      this.retreat('THE RIVALS GIVE UP!'); this.ui.play('capture'); [0, 450, 900].forEach(d => setTimeout(() => this.ui.play('bell'), d)); this.ui.fireworks?.(this.zone);
      setTimeout(() => { if (this.mode === 'outpost') this.flow.held(this.zone); }, 1600);
      return;
    }
    if (this.tShow < S.seconds && c) return;
    // time is up: a short snowflake round of English, the shop, and the Showdown again (straight
    // back in when every boost is already yours); the captain is a little more tired each time
    this.phase = 'seize'; this.captain = null; this.showTries = (this.showTries || 0) + 1; this.retreat('THE CAPTAIN HOLDS ON!');
    const all = Object.keys(SHOP.boosts).every(id => this.arm.boosts.has(id));
    this.ui.coach(all ? 'So close! The captain is getting tired. Try again!' : 'So close! The captain is getting tired. Earn more ❄ with English, buy what you need, and try again!', 5);
    setTimeout(() => { if (this.mode !== 'outpost') return; if (all) this.startShowdown(); else this.flow.startExtra(this.zone, S.retryItems); }, all ? 3500 : 1800);
  }
  held(z) {
    const st = this.cur, stats = this.flow.stageStats(z), seconds = Math.round((performance.now() - this.t0) / 1000), earned = this.arm?.earned || 0;
    const r = finishStage(this.up, st.id, { ...stats, flakes: this.runFlakes, seconds }); this.writeSave(this.save);
    this.cleanup(false);
    const run = this.up.arenas[0].run, acc = run?.total ? run.firstTry / run.total : 0, pass = acc >= UNLOCK, next = nextStage(this.up);
    $('#results').innerHTML = `<div class="rs-card"><div class="rs-icon">${THEME_ICON[ICON[st.id]] || ''}</div><h2>${esc(st.title)} is yours!</h2>
      <div class="rs-stars">${[0, 1, 2].map(i => `<span class="${i < r.stars ? 'on' : ''}" style="--d:${i * 0.25}s">★</span>`).join('')}</div>
      <p>Right first time: <b>${stats.firstTry} of ${stats.total}</b> · In ${esc(this.unit.title)}: <b>${Math.round(acc * 100)}%</b>${pass ? ' 🎉' : ` (the goal is ${Math.round(UNLOCK * 100)}%)`}</p>
      <p>Snowballs: <b>⚪ ${this.runBalls}</b> · Snowflakes earned: <b>❄ ${earned}</b> · Time: <b>${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}</b></p>
      <div class="rs-btns">${next ? `<button type="button" class="play-btn" data-go="next">Next: ${esc(next.title)} ▶</button>` : `<button type="button" class="play-btn" data-go="again">Play again ▶</button>`}<button type="button" class="menu-btn" data-go="map">Arena</button></div></div>`;
    $('#results').hidden = false; this.mode = 'results'; $('#hud').hidden = true; this.drawLives();
    this.ui.play('capture');
    $('#results').onclick = e => { const b = e.target.closest('[data-go]'); if (!b) return; $('#results').hidden = true; if (b.dataset.go === 'next' && next) this.start(next); else if (b.dataset.go === 'again') this.start(st); else this.showMap(); };
  }
  outOfLives() {
    const was = this.mode; this.mode = 'out'; stopMusic(null, 0.6);
    if (was === 'outpost') this.cleanup(true);
    $('#outoflives').innerHTML = `<div class="rs-card"><h2>Out of lives!</h2><p>No problem: your English answers still count. Let's try ${esc(this.cur.title)} again!</p><div class="rs-btns"><button type="button" class="play-btn" data-go="again">Try again</button><button type="button" class="menu-btn" data-go="map">Arena</button></div></div>`;
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
    this.sim.activeZone = null; this.pendingRival = null; this.endHunt(); this.sim.removeSupply(); this.plan = null;
    this.match.clearRecruits(); this.sim.removeRecruitSpot(); this.ui.onGone?.(); this.ui.build?.close(); this.ui.wallet?.(null); this.buildNext = null; this.captain = null;
    { const P = this.match.player; P.ammoMax = 0; P.reloadMul = 1; P.coat = 0; P.gear = null; } // boosts last one stage
    if (z) { z.parts = null; z.perFamily = null; }
    this.zone = null;
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
    if (this.waveIdx === 0 && this.tStand > 2 && !this.plan) this.spawnWave(0);
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
    this.ui.banner('SEIZE IT!', 'go', 1.3); this.ui.play('superReady');
    this.ui.coach(field ? 'The rival team is beaten! Run up to the glowing circle and seize it (or tap ▶ Seize).' : 'The yard is clear! Walk into the glowing circle to seize it (or tap ▶ Seize).', 4);
    this.ui.seizeButton?.(true);
  }
  onEvent(e) {
    if (this.mode !== 'outpost') return;
    if (e.type === 'coat' && e.id === this.match.player.id && this.match.player.gear) { const P = this.match.player; P.gear = new Set([...P.gear].filter(g => g !== 'coat')); } // the warm coat has done its job
    if (this.plan && e.type === 'freeze') { // the fights: rivals frozen count, word snowmen are checked, and our kids never lose a life
      const c = this.sim.chars.find(q => q.id === e.id);
      if (c && c.side === 'rival') {
        if (this.phase === 'fight') this.score++;
        if (c.word && this.hunt?.includes(c)) {
          const r = this.words.frozen(c.word);
          if (e.by === this.match.player.id) { this.ui.fx?.number(c.x, c.z, `${c.word.en} = ${c.word.tr}`, 'word'); speech.say(c.word.en); } // the word, when you froze it
          if (r === 'right') {
            const P = this.match.player; if (this.phase === 'fight') this.score += this.plan.hunt.bonus;
            const before = P.super; P.super = Math.min(1, P.super + 0.35); if (before < 1 && P.super >= 1) this.sim.emit('superReady', { id: P.id });
            this.ui.fx?.number(c.x, c.z + 0.6, 'RIGHT WORD! +2', 'big'); this.ui.play('sparkle'); this.endHunt();
          }
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
      else if (k === 'arrowup' || k === 'w' || k === ' ') { if (!this.sled.trick()) this.sled.jump(); } else if (k === 'arrowdown' || k === 's') this.sled.duck(); else if (k === 't' || k === 'enter') this.sled.trick(); else return; // up in the air: a spin
      e.preventDefault();
    });
    let sx = 0, sy = 0, st = 0;
    const sw = $('#swipe');
    sw.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; st = performance.now(); });
    sw.addEventListener('pointerup', e => {
      if (this.mode !== 'sled' || !this.sled) return;
      if (this.sled.cine) { if (this.seenCinema?.has(this.sled.cine.q.id)) this.sled.skipCine(); return; } // a scene you have seen: a tap skips it
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) { this.sled.trick(); return; } // a tap in the air: a spin
      if (Math.abs(dx) > Math.abs(dy)) this.sled.move(dx > 0 ? 1 : -1); else if (dy < 0) { if (!this.sled.trick()) this.sled.jump(); } else this.sled.duck();
    });
    $('#runhud').addEventListener('pointerdown', e => { const b = e.target.closest('[data-k]'); if (!b || !this.sled) return; e.preventDefault(); ({ left: () => this.sled.move(-1), right: () => this.sled.move(1), jump: () => { if (!this.sled.trick()) this.sled.jump(); }, duck: () => this.sled.duck() })[b.dataset.k](); });
  }
}
