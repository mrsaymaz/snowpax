// SnowPax arena feel test: Schoolyard Snow Day. 3-vs-3 snowball brawl around Our School with
// a capture zone (outpost) in the street. In the full game, seizing the outpost opens the
// English task card while teammates guard you.
import { WebGLRenderer, Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, Color, Vector3, Vector2, Raycaster, Plane, PCFSoftShadowMap, Fog } from 'three';
import { CONFIG, TEAM_IDS } from '../config.js';
import { emblemSVG } from '../emblems.js';
import { loadSave, writeSave } from '../save.mjs';
import { createMatch } from './match.mjs';
import { buildTileArena } from './tilemap.mjs';
import { SCHOOLYARD } from './arenas/schoolyard.mjs';
import { GRID } from './grid.mjs';
import { buildVillage, LIGHTING } from './render/village.js';
import { Kid } from './render/kids.js';
import { BrawlFx } from './render/brawlfx.js';
import { CUT } from './render/cutout.js';
import { AutoQuality, guessLevel, LEVELS } from './quality.js';
import { Sticks } from './sticks.js';
import { unlockAudio, play, setSound } from './audio.js';

const $ = s => document.querySelector(s);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const save = loadSave();
const KITS = CONFIG.kits;
const KIT_ICON = { thrower: '⚡', lobber: '🌙', sprayer: '💥' };
const KIT_TEXT = { thrower: 'Fast, straight throws', lobber: 'Throws over walls', sprayer: 'Three at once, close up' };

// ---------- start screen ----------
function startScreen() {
  let team = save.team || null, kit = save.kit || 'thrower', pace = save.pace || 'relaxed';
  $('#teams').innerHTML = TEAM_IDS.map(id => `<button type="button" class="pick team-btn" data-team="${id}" style="--c:${CONFIG.teams[id].color}">${emblemSVG(id, 48)}<b>${CONFIG.teams[id].name}</b></button>`).join('');
  $('#kits').innerHTML = Object.entries(KITS).map(([id, k]) => `<button type="button" class="pick kit-btn" data-kit="${id}"><span class="ico">${KIT_ICON[id]}</span><b>${k.name}</b><small>${KIT_TEXT[id]}</small></button>`).join('');
  const refresh = () => {
    document.querySelectorAll('.team-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.team === team)));
    document.querySelectorAll('.kit-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kit === kit)));
    document.querySelectorAll('.pace-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pace === pace)));
    $('#play').disabled = !team; $('#play').textContent = team ? 'PLAY!' : 'Pick your team';
  };
  $('#teams').onclick = e => { const b = e.target.closest('.team-btn'); if (b) { team = b.dataset.team; refresh(); } };
  $('#kits').onclick = e => { const b = e.target.closest('.kit-btn'); if (b) { kit = b.dataset.kit; refresh(); } };
  document.querySelectorAll('.pace-btn').forEach(b => { b.onclick = () => { pace = b.dataset.pace; refresh(); }; });
  $('#play').onclick = async () => {
    unlockAudio(); save.team = team; save.kit = kit; save.pace = pace; writeSave(save);
    $('#start').hidden = true;
    try { await startGame(team, kit, pace); } catch (err) { $('#loading').hidden = false; $('#loading').textContent = 'Sorry, the game could not start: ' + err.message; throw err; }
  };
  refresh();
  if (params.has('autostart')) { team = params.get('team') || team || 'hufflepuff'; kit = params.get('kit') || kit; pace = params.get('pace') || pace; refresh(); $('#play').click(); }
}

// ---------- the game ----------
async function startGame(myTeam, kit, pace) {
  // Arena 1 world (five outposts) by default; the small schoolyard feel test with ?arena=schoolyard
  const worldDef = params.get('arena') === 'schoolyard' ? null : await (await fetch('arenas/arena1.json')).json();
  const arena = buildTileArena(worldDef || SCHOOLYARD);
  const others = TEAM_IDS.filter(t => t !== myTeam);
  const rivalTeam = others.includes(params.get('rival')) ? params.get('rival') : others[Math.floor(Math.random() * others.length)];
  let s = Number(params.get('seed')) || (Date.now() % 100000); const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const match = createMatch({ arena, myTeam, rivalTeam, pace, rng, playerKit: kit });
  const { sim, player } = match;
  const myCol = CONFIG.teams[myTeam].color, rivCol = CONFIG.teams[rivalTeam].color;
  // test helper: ?at=<outpost id> starts the student and teammates beside that outpost
  const atZone = sim.zones.find(zz => zz.id === params.get('at'));
  if (atZone) { sim.zone = atZone; sim.chars.filter(c => c.side === 'home').forEach((c, k) => { c.x = atZone.x - 1.2 + k * 1.2; c.z = atZone.z + atZone.r + 0.6; }); }

  // renderer, scene, lights
  const canvas = $('#scene');
  const level = params.has('quality') ? Math.max(0, LEVELS.findIndex(l => l.name === params.get('quality'))) : guessLevel();
  const renderer = new WebGLRenderer({ canvas, antialias: level >= 1, powerPreference: 'high-performance' });
  renderer.shadowMap.type = PCFSoftShadowMap;
  const scene = new Scene(); scene.background = new Color(LIGHTING.sky); scene.fog = new Fog(LIGHTING.fog[0], LIGHTING.fog[1], LIGHTING.fog[2]);
  scene.add(new HemisphereLight(LIGHTING.hemi[0], LIGHTING.hemi[1], LIGHTING.hemi[2]));
  const sun = new DirectionalLight(LIGHTING.sun[0], LIGHTING.sun[1]); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 4;
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 }); sun.shadow.bias = -0.0006; scene.add(sun, sun.target);

  const world = buildVillage(arena, { rivalTeam, homeTeam: myTeam, quality: LEVELS[level].name }); scene.add(world.group);
  const kids = new Map(sim.chars.map(c => [c.id, new Kid(c, { isPlayer: c === player })]));
  for (const k of kids.values()) scene.add(k.root);
  const camera = new PerspectiveCamera(24, innerWidth / innerHeight, 0.5, 140); // restrained perspective
  const fx = new BrawlFx(scene, $('#fx-layer'), camera);

  // steep follow camera looking north
  // about 50° down: kids show their faces, the arena reads like a stage
  const off = new Vector3(0, 17.6, 16.0); let zoom = 1, shake = 0;
  const focus = new Vector3(player.x, 0, player.z - 1.2);
  function resize() {
    const w = innerWidth, h = innerHeight; camera.aspect = w / h;
    zoom = Math.min(1.35, Math.max(1, Math.min(w, h) / 390)) * (w / h < 1.5 ? 1.12 : 1) * (Number(params.get('zoom')) || 1);
    camera.updateProjectionMatrix(); renderer.setSize(w, h, false);
    const dist = off.length() * zoom; scene.fog.near = dist * 1.25; scene.fog.far = dist * 2.9; // haze only beyond the arena
  }
  const quality = new AutoQuality(level, L => { renderer.setPixelRatio(Math.min(devicePixelRatio || 1, L.maxDpr)); renderer.shadowMap.enabled = L.name !== 'low'; sun.castShadow = L.name !== 'low'; resize(); scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); }, { forced: params.has('quality') ? level : null });
  addEventListener('resize', resize); resize();

  const ray = new Raycaster(), ground = new Plane(new Vector3(0, 1, 0), 0), hp = new Vector3();
  const groundAt = (x, y) => { ray.setFromCamera(new Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), camera); return ray.ray.intersectPlane(ground, hp) ? { x: hp.x, z: hp.z } : null; };

  // controls + HUD
  const sticks = new Sticks({
    surface: canvas, attackBtn: $('#attack'), superBtn: $('#super'), joyBase: $('#joy-base'), joyKnob: $('#joy-knob'), groundAt,
    tapToMove: CONFIG.pace[pace].tapToMove, onTapGround: p => { if (sim.travelTo(player, p.x, p.z)) play('tap'); },
    onKey: k => { if (k === 'pause') pause(!paused); },
  });
  $('#hud').hidden = false;
  $('#zone-bar .home').style.background = myCol; $('#zone-bar .rival').style.background = rivCol;
  $('#score .home').innerHTML = emblemSVG(myTeam, 22); $('#score .rival').innerHTML = emblemSVG(rivalTeam, 22);
  $('#super').style.setProperty('--c', '#ffd23f');
  const touch = matchMedia('(pointer: coarse)').matches;
  const coach = (text, sec = 4.5) => { $('#coach .line').textContent = text; $('#coach').hidden = false; clearTimeout(coach.t); coach.t = setTimeout(() => { $('#coach').hidden = true; }, sec * 1000); };
  const banner = (text, cls = '', sec = 1.6) => { const b = $('#banner'); b.textContent = text; b.className = 'show ' + cls; clearTimeout(banner.t); banner.t = setTimeout(() => { b.className = ''; }, sec * 1000); };
  const feed = (html) => { const li = document.createElement('div'); li.className = 'feed-item'; li.innerHTML = html; $('#feed').prepend(li); setTimeout(() => li.remove(), 3500); while ($('#feed').children.length > 3) $('#feed').lastChild.remove(); };

  // mini-map (top left) and the big map: tap a place to walk there
  const FAM = { answer: 'B', sort: 'C', match: 'A', listen: 'E', build: 'D' };
  const mapImg = document.createElement('canvas'), MP = 4; mapImg.width = arena.w * MP; mapImg.height = arena.h * MP;
  const TILE_COL = { H: '#5e6888', S: '#d9cfa6', K: '#f4f8ff', Q: '#a99bd2', C: '#8e86b8', W: '#9cc3e6', G: '#b98a6a', O: '#24304f', c: '#7c84a8', t: '#2d5a5d', '_': '#ffffff', '=': '#eef0fa', '+': '#e3dcf6', q: '#ece6fb', P: '#d5c79c', f: '#d5c79c', '#': '#d5c79c', d: '#ffffff', Y: '#eadfc0', h: '#eadfc0', r: '#f4f8ff', j: '#b98a6a', p: '#dfeee3', '.': '#e7edf8' };
  function drawMap() {
    const g = mapImg.getContext('2d');
    for (let j = 0; j < arena.h; j++) for (let i = 0; i < arena.w; i++) { g.fillStyle = TILE_COL[arena.rows[j][i]] || '#e7edf8'; g.fillRect(i * MP, j * MP, MP, MP); }
  }
  drawMap();
  const toMap = (x, z, s, cx, cz, W2, H2) => [W2 + (x - cx) * s, H2 + (z - cz) * s];
  function drawMarks(g, s, cx, cz, W2, H2, big) {
    for (const zz of sim.zones) {
      const [x, y] = toMap(zz.x, zz.z, s, cx, cz, W2, H2), col = zz.owner === 'home' ? myCol : zz.owner === 'rival' ? rivCol : '#ffffff';
      g.beginPath(); g.arc(x, y, big ? 13 : 7, 0, 7); g.fillStyle = col; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#1c2340'; g.stroke();
      g.fillStyle = '#1c2340'; g.font = `900 ${big ? 14 : 9}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(FAM[zz.family] || '★', x, y + 0.5);
      if (big) { g.font = '800 14px system-ui'; g.fillText(zz.label, x, y - 22); }
    }
    const base = arena.places.find(pl => pl.kind === 'base'); { const [x, y] = toMap(base.x, base.z, s, cx, cz, W2, H2); g.fillStyle = '#e5383b'; g.fillRect(x - 5, y - 5, 10, 10); if (big) { g.fillStyle = '#1c2340'; g.font = '800 14px system-ui'; g.fillText('Our School', x, y - 16); } }
    for (const c of sim.chars) { if (c.frozen || (c.side === 'rival' && !sim.canSee(player, c))) continue; const [x, y] = toMap(c.x, c.z, s, cx, cz, W2, H2); g.beginPath(); g.arc(x, y, c === player ? 5 : 3.5, 0, 7); g.fillStyle = CONFIG.teams[c.team].color; g.fill(); if (c === player) { g.lineWidth = 2.5; g.strokeStyle = '#fff'; g.stroke(); } }
  }
  const mini = $('#minimap'), big = $('#bigmap');
  mini.hidden = !arena.world; $('#map-btn').hidden = !arena.world;
  function drawMini() {
    if (!arena.world) return;
    const dpr = Math.min(2, devicePixelRatio || 1), W2 = mini.clientWidth, H2 = mini.clientHeight;
    if (mini.width !== Math.round(W2 * dpr)) { mini.width = Math.round(W2 * dpr); mini.height = Math.round(H2 * dpr); }
    const g = mini.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); const s = W2 / 36;
    g.save(); g.beginPath(); g.arc(W2 / 2, H2 / 2, W2 / 2 - 1, 0, 7); g.clip(); g.fillStyle = '#e7edf8'; g.fillRect(0, 0, W2, H2);
    g.imageSmoothingEnabled = false;
    g.drawImage(mapImg, (player.x - arena.x0) * MP - (W2 / 2) / s * MP, (player.z - arena.z0) * MP - (H2 / 2) / s * MP, W2 / s * MP, H2 / s * MP, 0, 0, W2, H2);
    drawMarks(g, s, player.x, player.z, W2 / 2, H2 / 2, false); g.restore();
    g.beginPath(); g.arc(W2 / 2, H2 / 2, W2 / 2 - 1, 0, 7); g.lineWidth = 3; g.strokeStyle = '#1c2340'; g.stroke();
    if (!$('#bigmap-wrap').hidden) drawBig();
  }
  const bigScale = () => Math.min(big.clientWidth / arena.w, big.clientHeight / arena.h);
  function drawBig() {
    const dpr = Math.min(2, devicePixelRatio || 1), W2 = big.clientWidth, H2 = big.clientHeight;
    if (big.width !== Math.round(W2 * dpr)) { big.width = Math.round(W2 * dpr); big.height = Math.round(H2 * dpr); }
    const g = big.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); const s = bigScale(); g.clearRect(0, 0, W2, H2);
    g.imageSmoothingEnabled = false; g.drawImage(mapImg, W2 / 2 - arena.w * s / 2, H2 / 2 - arena.h * s / 2, arena.w * s, arena.h * s);
    drawMarks(g, s, arena.x0 + arena.w / 2, arena.z0 + arena.h / 2, W2 / 2, H2 / 2, true);
  }
  const travel = (x, z) => { if (sim.travelTo(player, x, z)) { play('tap'); coach('On my way! Move the stick to take over.', 2.5); } };
  mini.addEventListener('pointerup', e => { e.stopPropagation(); const r = mini.getBoundingClientRect(), s = r.width / 36; travel(player.x + (e.clientX - r.left - r.width / 2) / s, player.z + (e.clientY - r.top - r.height / 2) / s); });
  mini.addEventListener('pointerdown', e => e.stopPropagation());
  $('#map-btn').onclick = () => { $('#bigmap-wrap').hidden = false; drawBig(); };
  big.addEventListener('pointerup', e => { e.stopPropagation(); const r = big.getBoundingClientRect(), s = bigScale(); const x = arena.x0 + arena.w / 2 + (e.clientX - r.left - r.width / 2) / s, z = arena.z0 + arena.h / 2 + (e.clientY - r.top - r.height / 2) / s; $('#bigmap-wrap').hidden = true; travel(x, z); });
  $('#bigmap-wrap').addEventListener('pointerup', e => { if (e.target.id === 'bigmap-wrap') $('#bigmap-wrap').hidden = true; });
  // pause
  let paused = false;
  function pause(on) { paused = on; $('#pause-menu').hidden = !on; $('#q-level').textContent = quality.forced === null ? `Auto (${LEVELS[quality.level].name})` : LEVELS[quality.level].name; }
  $('#pause').onclick = () => pause(true); $('#resume').onclick = () => pause(false);
  $('#q-cycle').onclick = () => { const n = quality.forced === null ? 0 : quality.forced + 1; if (n >= LEVELS.length) quality.auto(); else quality.set(n); pause(true); };
  $('#sound').onclick = () => { save.settings.sound = !save.settings.sound; setSound(save.settings.sound); writeSave(save); $('#sound').textContent = `Sound: ${save.settings.sound ? 'on' : 'off'}`; };
  $('#sound').textContent = `Sound: ${save.settings.sound ? 'on' : 'off'}`; setSound(save.settings.sound);
  $('#restart').onclick = () => location.reload();
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });

  // round flow: countdown, then play; capturing the zone celebrates and resets it
  const pose = params.has('pose');
  let countdown = pose ? 0 : 3.2, lastCount = 4, resetZoneAt = 0, score = { home: 0, rival: 0 };
  if (!pose) coach(arena.world ? (touch ? 'Snow day in Kasımpaşa! Five outposts to seize. Tap the map to walk to one, or use your left thumb.' : 'Snow day in Kasımpaşa! Five outposts to seize. Click the map to walk there, or use WASD.') : (touch ? 'Move with your left thumb. Tap the snowball to throw, or drag it to aim. Take the outpost in the street!' : 'Move with WASD. Aim with the mouse and click to throw. Take the outpost in the street!'), 6);
  const name = c => (c === player ? 'You' : c.side === 'home' ? `Your ${KITS[c.kit].name}` : `${CONFIG.teams[c.team].name} ${KITS[c.kit].name}`);

  if (pose) arrangePose();
  function arrangePose() {
    const home = sim.chars.filter(c => c.side === 'home'), riv = sim.chars.filter(c => c.side === 'rival'), z = sim.zone;
    const put = (c, x, zz) => { c.x = x; c.z = zz; };
    put(player, z.x - 0.5, z.z + 2.6); put(home[1], z.x - 3.6, z.z + 3.4); put(home[2], z.x + 2.6, z.z + 3.9);
    put(riv[0], z.x + 0.8, z.z - 2.7); put(riv[1], z.x - 3.2, z.z - 3.5); put(riv[2], z.x + 3.4, z.z - 1.2);
    riv[2].frozen = 999; riv[0].warmth = 38; player.warmth = 74; player.super = 1; player.ammo = 2.4; home[2].warmth = 52;
    for (const c of home) c.face = Math.atan2(riv[0].x - c.x, riv[0].z - c.z); for (const c of riv) c.face = Math.atan2(player.x - c.x, player.z - c.z);
    sim.attack(player, riv[0].x, riv[0].z); sim.attack(home[1], riv[1].x, riv[1].z); sim.attack(riv[1], player.x, player.z);
    for (let i = 0; i < 14; i++) sim.stepBalls(1 / 60);
    sim.zone.progress = 0.62;
    fx.emit(riv[0].x, 1.1, riv[0].z, 26, '#ffffff', 3, 9); fx.number(riv[0].x, riv[0].z, '-26');
    kids.get(player.id).onEvent('throw'); kids.get(player.id).throwT = 0.12;
    focus.set(player.x, 0, player.z - 1.6);
  }

  let last = performance.now(); const zoneKeys = {}, held = new Set();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    requestAnimationFrame(frame); quality.tick(dt);
    if (paused) { renderer.render(scene, camera); return; }
    const live = !pose && countdown <= 0;
    if (!pose && countdown > 0) {
      countdown -= dt; const n = Math.ceil(countdown);
      if (n !== lastCount) { lastCount = n; if (n > 0) { banner(String(n), 'count', 0.9); play('tap'); } else { banner('SNOW!', 'go', 1.1); play('superReady'); } }
    }

    // input → simulation
    const r = sticks.read();
    const inp = { mx: r.sx, mz: -r.sy };
    const kitInfo = KITS[player.kit];
    const shotTarget = (cmd, isSuper) => {
      const range = isSuper ? CONFIG.superBoulder.range : kitInfo.range;
      if (cmd.mouse) { const m = r.mouse && groundAt(r.mouse.x, r.mouse.y); return m ? { x: m.x, z: m.z, manual: true } : null; }
      if (cmd.auto) { const t = sim.autoTarget(player, isSuper ? range : null); return t ? { x: t.x, z: t.z } : { x: player.x + Math.sin(player.face) * range, z: player.z + Math.cos(player.face) * range, manual: true }; }
      const d = range * (0.3 + 0.7 * cmd.mag); return { x: player.x + cmd.sx * d, z: player.z - cmd.sy * d, manual: true };
    };
    if (live && r.attack) { const t = shotTarget(r.attack, false); if (t) { if (player.ammo < 1) { $('#attack').classList.add('empty-flash'); setTimeout(() => $('#attack').classList.remove('empty-flash'), 250); } inp.attack = t; inp.manual = !!t.manual; } }
    if (live && r.super) { if (player.super >= 1) { const t = shotTarget(r.super, true); if (t) { inp.super = t; inp.manual = !!t.manual; } } }
    if (live && r.dodge) inp.dodge = { dx: inp.mx, dz: inp.mz };
    if (live) match.step(dt, inp); else for (const c of sim.chars) c.moving = 0;

    // aim indicator while dragging (or always the mouse on desktop)
    let aimKind = null, aimTo = null;
    if (r.aiming) {
      const isSuper = r.aiming.kind === 'super', cmd = r.aiming.auto ? { auto: true } : r.aiming, t = shotTarget(cmd, isSuper);
      aimKind = isSuper ? 'super' : kitInfo.shot; aimTo = t;
    }
    fx.aim(aimKind, player, aimTo || player, myCol, aimKind === 'super' ? CONFIG.superBoulder.range : kitInfo.range, kitInfo.spreadDeg || 0);

    // events → effects, sounds, HUD
    for (const e of sim.drainEvents()) {
      fx.onEvent(e, sim);
      const k = e.id !== undefined ? kids.get(e.id) : null; if (k) k.onEvent(e.type);
      const near = e.x !== undefined ? Math.max(0, 1 - Math.hypot(e.x - player.x, e.z - player.z) / 18) : 1;
      if (['throw', 'hit', 'pickup', 'poof', 'dodge'].includes(e.type)) play(e.type, { near: e.id === player.id ? 1 : near });
      if (e.type === 'splat' && e.wall) play('splat', { near: near * 0.6 });
      if (e.type === 'super') { play('super', { near }); if (!reduceMotion) shake = Math.max(shake, 0.25); }
      if (e.type === 'superReady' && e.id === player.id) { play('superReady'); banner('SUPER READY!', 'super', 1.2); coach('Your super is ready! Press the gold button to roll a giant snowball.', 4); }
      if (e.type === 'hit' && e.id === player.id && !reduceMotion) shake = Math.max(shake, 0.18);
      if (e.type === 'freeze') {
        const v = sim.chars.find(c => c.id === e.id), by = sim.chars.find(c => c.id === e.by);
        play('freeze', { near: e.id === player.id ? 1 : near });
        if (v) { score[v.side === 'home' ? 'rival' : 'home']++; feed(`<b style="color:${CONFIG.teams[by?.team || v.team].dark}">${by ? name(by) : 'Someone'}</b> froze <b style="color:${CONFIG.teams[v.team].dark}">${name(v) === 'You' ? 'you' : name(v)}</b> ❄`); }
        if (e.id === player.id) { $('#frozen').hidden = false; coach('Brrr! You are a snowman. Shake it off and you are back at Our School.', 3.5); }
        if (by === player) banner('FROZEN ONE!', 'good', 1.1);
      }
      if (e.type === 'respawn' && e.id === player.id) $('#frozen').hidden = true;
      if (e.type === 'noThrowZone' && e.id === player.id) coach('Quiet zone: no snowballs near the mosque.', 3);
      if (e.type === 'zoneCaptured') {
        const zc = sim.zones.find(zz => zz.id === e.zone) || sim.zone;
        if (e.side === 'home') { banner('OUTPOST SEIZED!', 'win', 2.6); play('capture'); fx.emit(zc.x, 0.5, zc.z, 90, myCol, 6, 1.2); fx.emit(zc.x, 0.5, zc.z, 60, '#ffffff', 5, 1.2); coach(arena.world ? `${zc.label} is yours! It is now a respawn and snowball point. In the full game, the English task card opens here.` : 'Great teamwork! In the full game, the English task card opens here while your team guards you.', 5); }
        else { banner('Rivals took the outpost!', 'lose', 2.2); play('freeze'); coach('Take it back! Stand in the circle with your team.', 4); }
        if (arena.world) { sim.held[e.side].push({ x: zc.x, z: zc.z + zc.r - 0.6 }); held.add(zc.id + ':' + e.side); drawMap(); }
        else resetZoneAt = sim.t + 4;
      }
    }
    if (resetZoneAt && sim.t > resetZoneAt) { sim.resetZone(); resetZoneAt = 0; }
    if (!player.frozen && !player.thaw) $('#frozen').hidden = true; else $('#frozen .count').textContent = Math.max(1, Math.ceil(player.frozen + player.thaw)).toString();

    // views
    for (const [id, k] of kids) {
      const c = k.c, visible = c.side === 'home' || sim.canSee(player, c) || c.frozen;
      k.update(dt, { visible, reduceMotion });
    }
    sim.drifts.forEach((d, i) => { const t = 1 - d.cd / 6; if (d.lt !== t) { d.lt = t; world.updateDrift(i, Math.max(0.2, t)); } });
    fx.update(pose ? 0 : dt, sim);
    for (const zz of sim.zones) { const key = `${zz.progress.toFixed(3)}|${zz.contested}`; if (key !== zoneKeys[zz.id] || zz.contested) { zoneKeys[zz.id] = key; world.setZone(zz.progress, myCol, rivCol, zz.contested, now / 1000, zz.id); } }
    const z = sim.nearestZone(player.x, player.z);

    // camera
    const tx = player.x, tz = player.z - 1.2;
    focus.x += (tx - focus.x) * Math.min(1, dt * 5); focus.z += (tz - focus.z) * Math.min(1, dt * 5);
    const halfW = Math.tan(12 * Math.PI / 180) * off.length() * zoom * camera.aspect, lim = params.has('zoom') ? 0 : Math.max(0, arena.w / 2 - halfW + 0.5);
    focus.x = Math.max(-lim, Math.min(lim, focus.x));
    if (!params.has('zoom')) focus.z = Math.max(arena.z0 + 5, Math.min(arena.z0 + arena.h - 3.5, focus.z));
    shake = Math.max(0, shake - dt);
    const j = shake > 0 ? shake * 0.6 : 0;
    camera.position.set(focus.x + off.x * zoom + (Math.random() - 0.5) * j, off.y * zoom, focus.z + off.z * zoom + (Math.random() - 0.5) * j);
    camera.lookAt(focus.x, 0, focus.z); camera.updateMatrixWorld();
    sun.position.set(focus.x + LIGHTING.sunDir[0], LIGHTING.sunDir[1], focus.z + LIGHTING.sunDir[2]); sun.target.position.set(focus.x, 0, focus.z - 2); sun.target.updateMatrixWorld();
    world.tick(dt, focus, reduceMotion, camera);
    // see-through: anything between the camera and the player dissolves
    const pv = new Vector3(player.x, 1, player.z), pr = renderer.getPixelRatio(), ndc = pv.clone().project(camera);
    CUT.center.value.set((ndc.x + 1) / 2 * innerWidth * pr, (ndc.y + 1) / 2 * innerHeight * pr);
    CUT.radius.value = Math.min(innerWidth, innerHeight) * 0.13 * pr;   // just around the player
    CUT.depth.value = pv.applyMatrix4(camera.matrixWorldInverse).z + 1.8; // only things in front of the student

    // HUD
    const p = Math.round(Math.abs(z.progress) * 100);
    $('#zone-bar .home').style.width = (z.progress > 0 ? p : 0) + '%'; $('#zone-bar .rival').style.width = (z.progress < 0 ? p : 0) + '%';
    $('#zone-label').textContent = `${z.label}: ` + (z.owner === 'home' ? 'yours!' : z.owner === 'rival' ? 'rivals hold it' : z.contested ? 'contested!' : z.home ? `seizing… ${p}%` : z.rival ? `rivals seizing… ${p}%` : `${Math.round(Math.hypot(z.x - player.x, z.z - player.z))} steps away`);
    drawMini();
    $('#zone').classList.toggle('contested', !!z.contested);
    $('#score .h').textContent = score.home; $('#score .r').textContent = score.rival;
    $('#super').classList.toggle('ready', player.super >= 1); $('#super').style.setProperty('--p', Math.round(player.super * 100));
    $('#attack .pips').innerHTML = Array.from({ length: CONFIG.fight.ammoMax }, (_, i) => `<i style="--f:${Math.max(0, Math.min(1, player.ammo - i))}"></i>`).join('');
    $('#attack').classList.toggle('empty', player.ammo < 1);
    $('#attack').classList.toggle('quiet', sim.grid.has(player.x, player.z, GRID.ZONE));
    if (params.has('debug')) $('#debug').textContent = `${quality.fps.toFixed(0)} fps · ${LEVELS[quality.level].name}`;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  globalThis.__snowpax = { match, sim, player, quality, renderer };
}

startScreen();
