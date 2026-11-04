// Arena 1 as stages: the stage map → a sled journey → a stand at the outpost against rival
// waves while answering → results → the next stage. Three lives per stage: a crash on the sled
// or a freeze at the outpost costs one; with none left the stage starts again (English answers
// already given still count). See stages.mjs for the order and waves.mjs for the waves.
import { CONFIG } from '../config.js';
import { STAGES, stageById, Lives, stageState, isUnlocked, nextStage, finishStage, totalStars, UNLOCK } from './stages.mjs';
import { WAVES, RIVAL_INFO, minionList, stageWall, setWall, entryPoints } from './waves.mjs';
import { flakeWords } from './visit.mjs';
import { SledRun } from './sledrun.js';
import { THEME_ICON } from './taskcard.js';
import { speech } from './speech.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STAR = n => '★'.repeat(n) + '☆'.repeat(3 - n);
const ICON = { boulevard: 'boulevard', archery: 'archery', kizilay: 'kizilay', sururi: 'sururi', waterfront: 'waterfront', showdown: 'cocoa' };

export class StageRunner {
  constructor({ match, flow, unit, unitProgress, save, writeSave, pace, rng, team, kit, reduceMotion, ui }) {
    Object.assign(this, { match, sim: match.sim, flow, unit, up: unitProgress, save, writeSave, pace, rng, team, kit, reduceMotion, ui });
    this.mode = 'map'; this.lives = new Lives(); this.wall = []; this.waves = []; this.runFlakes = 0; this.ridesDone = 0;
    flow.ui.onCaptured = z => this.captured(z); flow.ui.onHeld = z => this.held(z);
    this.bindInput();
    // rival kids wait off the field until their wave
    for (const c of this.sim.chars) if (c.side === 'rival') this.bench(c);
  }
  get stage() { return this.cur; }
  bench(c) { c.benched = true; c.x = -999; c.z = -999; c.vx = c.vz = 0; c.travel = null; }

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
    if (stage.final) { this.showdownSoon(); return; }
    this.ride();
  }
  ride() {
    const st = this.cur, words = flakeWords(this.unit, 6, this.up.missed, this.rng);
    const spellPool = this.unit.words.filter(w => /^[a-z]{3,7}$/i.test(w.en)), spell = st.ride.spell && spellPool.length ? spellPool[Math.floor(this.rng() * spellPool.length)] : null;
    this.sled?.dispose();
    this.sled = new SledRun({ theme: st.ride.theme, seconds: st.ride.seconds, pace: this.pace, team: this.team, kit: this.kit, words, spell, lives: this.lives, rng: this.rng, first: this.ridesDone === 0, reduceMotion: this.reduceMotion,
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
    const st = this.cur, sim = this.sim, z = sim.zones.find(q => q.id === st.outpost), grid = this.match.grid;
    this.save.snowflakes = (this.save.snowflakes || 0) + this.runFlakes; this.writeSave(this.save);
    this.ui.rebuildWorld?.(z); // v2 look: build only this stage's area
    this.mode = 'outpost'; document.body.classList.remove('sledding'); $('#runhud').hidden = true; $('#hud').hidden = false;
    this.zone = z; this.tStand = 0; this.waveIdx = 0; this.waves = []; this.finalT = null;
    // close the stage with snowbanks, find where the waves come in
    this.wall = stageWall(grid, z); setWall(grid, this.wall, true); this.ui.showWall?.(this.wall);
    this.entries = entryPoints(grid, z);
    sim.held.rival = this.entries.map(e => ({ x: e.x, z: e.z })); sim.spawns.rival = sim.held.rival.slice();
    if (z.owner !== 'home') { z.owner = null; z.progress = 0; }
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
    sim.held.home = [{ x: home[0].x, z: home[0].z }]; sim.spawns.home = sim.held.home.slice();
    this.ui.snapCamera?.();
    this.flow.setStage(z); this.drawLives();
    this.ui.banner(st.title.toUpperCase(), 'go', 1.6);
    if (st.newRival && RIVAL_INFO[st.newRival]) this.newRival(st.newRival);
    setTimeout(() => { if (this.mode === 'outpost' && !this.flow.busy) this.flow.begin(z); }, 900);
  }
  newRival(type) {
    const info = RIVAL_INFO[type], el = $('#newrival');
    el.innerHTML = `<b>New rivals!</b><span class="nr-name">${esc(info.name)}</span><small>${esc(info.tip)}</small>`; el.hidden = false; el.classList.add('show');
    clearTimeout(this.nrT); this.nrT = setTimeout(() => { el.classList.remove('show'); setTimeout(() => { el.hidden = true; }, 300); }, 6000);
  }
  spawnWave(i) {
    const w = WAVES[this.cur.id][i], z = this.zone; if (!w) return;
    const members = [];
    minionList(w).forEach((type, k) => { const e = this.entries[k % this.entries.length], j = Math.floor(k / this.entries.length); members.push(this.match.addMinion(type, e.x + Math.cos(e.a) * (j * 0.9 - 0.4), e.z - Math.sin(e.a) * (j * 0.9 - 0.4), z)); });
    const kids = this.sim.chars.filter(c => c.side === 'rival' && c.role !== 'minion');
    for (let k = 0; k < Math.min(w.kids, kids.length); k++) { const c = kids[k], e = this.entries[(k + 1) % this.entries.length]; Object.assign(c, { benched: false, x: e.x, z: e.z, frozen: 0, thaw: 0, warmth: c.maxWarmth, ammo: CONFIG.fight.ammoMax, shield: 0.5 }); members.push(c); }
    this.waves[i] = { members, t: 0, cleared: false, final: !!w.final };
    this.waveIdx = i + 1;
    this.ui.banner(`WAVE ${i + 1}: ${w.name.toUpperCase()}`, w.final ? 'lose' : 'super', 1.8); this.ui.play('whoosh');
  }
  alive(wave) { return wave.members.filter(c => !c.gone && !c.frozen && !c.thaw && !(c.role !== 'minion' && c.benched)).length; }

  captured(z) { // the bar is full: the final wave comes, then the refill round
    if (this.mode !== 'outpost') return;
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
    const z = this.zone; this.flow.abort(); this.flow.setStage(null);
    setWall(this.match.grid, this.wall, false); this.ui.showWall?.(null); this.wall = [];
    this.match.clearMinions(); this.ui.onGone?.();
    for (const c of this.sim.chars) if (c.side === 'rival') this.bench(c);
    this.sim.balls = [];
    if (lost && z && z.owner !== 'home') { z.owner = null; z.progress = 0; z.seizing = false; }
    this.zone = null;
  }
  showdownSoon() {
    $('#outoflives').innerHTML = `<div class="rs-card"><h2>Schoolyard Showdown</h2><p>All five outposts are yours! The final battle at Our School comes in the next update.</p><div class="rs-btns"><button type="button" class="menu-btn" data-go="map">Stage map</button></div></div>`;
    $('#outoflives').hidden = false; $('#outoflives').onclick = e => { if (e.target.closest('[data-go]')) { $('#outoflives').hidden = true; this.showMap(); } };
  }

  // ---------- every frame ----------
  update(dt) {
    if (this.mode === 'sled') { this.sled.update(dt); return; }
    if (this.mode !== 'outpost') return;
    this.tStand += dt;
    const gone = this.match.removeGone(); if (gone.length) this.ui.onGone?.(gone);
    const v = this.flow.visits.get(this.zone.id);
    if (this.waveIdx === 0 && this.tStand > 2) this.spawnWave(0);
    if (this.waveIdx === 1 && ((v && v.done >= 3 && this.alive(this.waves[0]) <= 1) || this.waves[0].t > 30) && !this.zone.owner) this.spawnWave(1);
    for (const w of this.waves) { if (!w || w.cleared) continue; w.t += dt; if (!this.alive(w)) { w.cleared = true; if (!w.final) { this.ui.banner('WAVE CLEAR!', 'win', 1.3); this.ui.play('superReady'); } } }
    // after the final wave (or 30 s of it) the refill round opens
    if (this.finalT !== null) { this.finalT += dt; const fw = this.waves[2]; if ((fw && fw.cleared) || this.finalT > 20) { this.flow.waveT = 0; this.finalT = null; if (fw && !fw.cleared) this.ui.banner('HOLD ON!', 'super', 1.2); } }
  }
  onEvent(e) {
    if (this.mode !== 'outpost') return;
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
