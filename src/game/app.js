// SnowPax M1: the movement slice. A snowy block around Our School, the student plus two
// teammates against three rivals, joystick/keyboard, throwing, freezing, see-through
// buildings, mini-map travel and automatic quality.
import {
  WebGLRenderer, Scene, OrthographicCamera, HemisphereLight, DirectionalLight, Color, Vector3, Raycaster, Vector2, Plane, PCFSoftShadowMap,
} from 'three';
import { CONFIG, TEAM_IDS } from '../config.js';
import { emblemSVG } from '../emblems.js';
import { loadSave, writeSave } from '../save.mjs';
import { createMatch } from './match.mjs';
import { GRID } from './grid.mjs';
import { buildWorld } from './render/world.js';
import { CharacterView } from './render/characters.js';
import { Fx } from './render/fx.js';
import { CUT } from './render/cutout.js';
import { AutoQuality, guessLevel, LEVELS } from './quality.js';
import { Input } from './input.js';
import { Hud } from './hud.js';
import { unlockAudio, play, setSound } from './audio.js';

const $ = s => document.querySelector(s);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const save = loadSave();
let game = null;

// ---------- start screen: pick a team ----------
function startScreen() {
  const box = $('#teams');
  box.innerHTML = TEAM_IDS.map(id => `<button type="button" class="team-btn" data-team="${id}" style="--c:${CONFIG.teams[id].color}" aria-pressed="${save.team === id}">${emblemSVG(id, 56)}<b>${CONFIG.teams[id].name}</b><small>${CONFIG.teams[id].element}</small></button>`).join('');
  let team = save.team || null, pace = save.pace || 'relaxed';
  const play = $('#play');
  const refresh = () => {
    for (const b of box.querySelectorAll('.team-btn')) b.setAttribute('aria-pressed', String(b.dataset.team === team));
    for (const b of document.querySelectorAll('.pace-btn')) b.setAttribute('aria-pressed', String(b.dataset.pace === pace));
    play.disabled = !team;
    play.textContent = team ? `Play as ${CONFIG.teams[team].name}` : 'Pick your team';
  };
  box.addEventListener('click', e => { const b = e.target.closest('.team-btn'); if (b) { team = b.dataset.team; refresh(); } });
  document.querySelectorAll('.pace-btn').forEach(b => b.addEventListener('click', () => { pace = b.dataset.pace; refresh(); }));
  play.addEventListener('click', async () => {
    unlockAudio();
    save.team = team; save.pace = pace; writeSave(save);
    $('#start').hidden = true; $('#loading').hidden = false;
    try { await startGame(team, pace); } catch (e) { $('#loading').textContent = 'Sorry, the game could not start: ' + e.message; throw e; }
    $('#loading').hidden = true;
  });
  refresh();
  if (params.has('autostart')) { team = params.get('team') || team || 'hufflepuff'; pace = params.get('pace') || pace; refresh(); play.click(); }
}

// ---------- the game ----------
async function startGame(myTeam, pace) {
  const arena = await (await fetch('arenas/arena1-block.json')).json();
  const others = TEAM_IDS.filter(t => t !== myTeam);
  const rivalTeam = params.get('rival') && others.includes(params.get('rival')) ? params.get('rival') : others[Math.floor(Math.random() * others.length)];
  const seed = Number(params.get('seed')) || (Date.now() % 100000);
  let s = seed; const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const match = createMatch({ arena, myTeam, rivalTeam, pace, rng });
  const { sim, player } = match;

  // renderer + scene
  const canvas = $('#scene');
  const level = params.has('quality') ? Math.max(0, LEVELS.findIndex(l => l.name === params.get('quality'))) : guessLevel();
  const renderer = new WebGLRenderer({ canvas, antialias: level >= 1, powerPreference: 'high-performance' });
  renderer.shadowMap.type = PCFSoftShadowMap;
  const scene = new Scene(); scene.background = new Color('#cfe0ee');
  const hemi = new HemisphereLight('#f2f8ff', '#dfe7ef', 1.9); scene.add(hemi);
  const sun = new DirectionalLight('#fff1d8', 1.25); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 140 });
  sun.shadow.bias = -0.0008; scene.add(sun, sun.target);

  const world = buildWorld(arena, { quality: LEVELS[level].name });
  scene.add(world.group);
  const views = new Map(sim.chars.map(c => [c.id, new CharacterView(c, { isPlayer: c === player })]));
  for (const v of views.values()) scene.add(v.root);
  const fx = new Fx(scene, LEVELS[level]);

  // camera: true isometric (45° around, 35.264° down)
  const camera = new OrthographicCamera(-10, 10, 10, -10, 1, 500);
  const yaw = Math.PI / 4, pitch = Math.atan(Math.SQRT1_2), dist = 120;
  const camOffset = new Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(dist);
  const focus = new Vector3(player.x, 0, player.z);
  let viewH = 24, pxPerUnit = 16, shake = 0;
  function resize() {
    const w = innerWidth, h = innerHeight;
    pxPerUnit = Math.min(34, Math.max(24, h / 15)); // tablets see more of the map instead of bigger buildings
    viewH = h / pxPerUnit;
    const aspect = w / h;
    Object.assign(camera, { left: -viewH * aspect / 2, right: viewH * aspect / 2, top: viewH / 2, bottom: -viewH / 2 });
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  const quality = new AutoQuality(level, L => {
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, L.maxDpr));
    renderer.shadowMap.enabled = L.shadows; sun.castShadow = L.shadows;
    fx.setSnow(L.snow); resize();
    scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  }, { forced: params.has('quality') ? level : null });
  addEventListener('resize', resize); resize();

  // helpers: screen ↔ world
  const ray = new Raycaster(), ground = new Plane(new Vector3(0, 1, 0), 0), hitP = new Vector3();
  const groundAt = (x, y) => { ray.setFromCamera(new Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), camera); return ray.ray.intersectPlane(ground, hitP) ? { x: hitP.x, z: hitP.z } : null; };
  const camRight = new Vector3(), camFwd = new Vector3();
  const toWorldDir = (sx, sy) => {
    camRight.set(1, 0, 0).applyQuaternion(camera.quaternion); camRight.y = 0; camRight.normalize();
    camFwd.set(0, 0, -1).applyQuaternion(camera.quaternion); camFwd.y = 0; camFwd.normalize();
    return { x: camRight.x * sx + camFwd.x * sy, z: camRight.z * sx + camFwd.z * sy };
  };
  const toScreen = (x, y, z) => { const v = new Vector3(x, y, z).project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, off: Math.abs(v.x) > 1 || Math.abs(v.y) > 1 }; };

  // HUD and input
  const hud = new Hud($('#hud'), arena, {
    onTravel: p => { if (sim.travelTo(player, p.x, p.z)) { hud.toast('On my way!'); play('tap'); } else hud.toast('No street goes there.'); },
    onPause: () => pause(true),
  });
  const input = new Input({
    surface: canvas, throwBtn: $('#throw'), joyBase: $('#joy-base'), joyKnob: $('#joy-knob'), toWorldDir, groundAt,
    tapToMove: CONFIG.pace[pace].tapToMove,
    onTapGround: p => { if (sim.travelTo(player, p.x, p.z)) play('tap'); },
    onKey: k => { if (k === 'map') hud.toggleMap(); if (k === 'pause') pause(!paused); },
  });
  $('#hud').hidden = false;
  const touchFirst = matchMedia('(pointer: coarse)').matches;
  hud.say(touchFirst ? 'Snow day! Move with your left thumb. Tap the snowball button to throw, hold it for a big one.' : 'Snow day! Move with WASD or the arrow keys. Click to throw, hold for a big snowball. Space to dodge.', 8);

  // pause menu
  let paused = false;
  function pause(on) {
    paused = on; $('#pause-menu').hidden = !on;
    if (on) $('#q-level').textContent = quality.forced === null ? `Auto (${LEVELS[quality.level].name})` : LEVELS[quality.level].name;
  }
  $('#resume').onclick = () => pause(false);
  $('#q-cycle').onclick = () => {
    const next = quality.forced === null ? 0 : quality.forced + 1;
    if (next >= LEVELS.length) quality.auto(); else quality.set(next);
    $('#q-level').textContent = quality.forced === null ? `Auto (${LEVELS[quality.level].name})` : LEVELS[quality.level].name;
  };
  $('#sound').onclick = () => { save.settings.sound = !save.settings.sound; setSound(save.settings.sound); writeSave(save); $('#sound').textContent = `Sound: ${save.settings.sound ? 'on' : 'off'}`; };
  $('#sound').textContent = `Sound: ${save.settings.sound ? 'on' : 'off'}`; setSound(save.settings.sound);
  $('#restart').onclick = () => location.reload();
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });

  // coach moments
  const said = new Set();
  const coachOnce = (key, text) => { if (!said.has(key)) { said.add(key); hud.say(text, 5); } };

  const rivalName = CONFIG.teams[rivalTeam].name;
  hud.toast(`Rivals today: ${rivalName}`, 3);
  const outpost = arena.places.find(p => p.kind === 'outpost');

  let last = performance.now(), aimTarget = null;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    requestAnimationFrame(frame);
    quality.tick(dt);
    if (paused) { renderer.render(scene, camera); return; }

    // ---- input → simulation input
    const r = input.read();
    const dir = toWorldDir(r.sx, r.sy);
    const inp = { mx: dir.x, mz: dir.z, charge: r.charging && player.ammo > 0 };
    // aim: mouse point (computer) or auto-aim at the nearest rival (touch)
    let aim = null;
    if (r.pressKind === 'mouse' || (r.throw && r.throw.kind === 'mouse')) {
      const m = r.mouse && groundAt(r.mouse.x, r.mouse.y);
      if (m) { const near = sim.enemiesOf(player).find(o => Math.hypot(o.x - m.x, o.z - m.z) < 1.6); aim = near ? { x: near.x, z: near.z } : m; }
    } else {
      const t = sim.autoTarget(player, CONFIG.fight.throwRange * (r.charging ? 1.25 : 1.1));
      aim = t ? { x: t.x, z: t.z } : { x: player.x + Math.sin(player.face) * 7, z: player.z + Math.cos(player.face) * 7 };
    }
    aimTarget = aim;
    if (r.throw) {
      if (player.ammo === 0) { hud.toast('Out of snowballs! Run through a snowdrift.'); }
      else if (aim) { inp.throwAt = aim; inp.big = r.throw.big; }
    }
    if (r.dodge) {
      const d = r.dodge.key ? (Math.hypot(dir.x, dir.z) > 0.1 ? dir : { x: Math.sin(player.face), z: Math.cos(player.face) }) : toWorldDir(r.dodge.sx, r.dodge.sy);
      inp.dodge = { dx: d.x, dz: d.z };
    }
    match.step(dt, inp);

    // ---- events → effects, sound, coach
    for (const e of sim.drainEvents()) {
      fx.onEvent(e, sim.chars);
      const near = e.x !== undefined ? 1 - Math.hypot(e.x - player.x, e.z - player.z) / 40 : 1;
      const v = e.id !== undefined ? views.get(e.id) : null;
      if (v) v.trigger(e.type);
      if (['throw', 'splat', 'hit', 'pickup', 'dodge', 'poof'].includes(e.type)) play(e.type, { near: e.id === player.id ? 1 : near });
      if (e.type === 'freeze') play('freeze', { near: e.id === player.id ? 1 : near });
      if (e.type === 'shake') play('shake', { near: e.id === player.id ? 1 : near });
      if (e.type === 'hit' && e.id === player.id && !reduceMotion) shake = 0.25;
      if (e.type === 'freeze' && e.id === player.id) coachOnce('frozen', 'Brrr! You are a snowman for 3 seconds. Shake it off and you are back at Our School.');
      if (e.type === 'freeze' && sim.chars.find(c => c.id === e.id)?.side === 'rival') coachOnce('rivalFrozen', `Great throw! A ${rivalName} player is frozen into a snowman.`);
      if (e.type === 'noThrowZone' && e.id === player.id) hud.toast('Quiet zone: no snowballs here.');
      if (e.type === 'poof' && Math.hypot(e.x - player.x, e.z - player.z) < 12) coachOnce('zone', 'Snowballs melt near places of worship and cemeteries. These are quiet zones.');
      if (e.type === 'pickup' && e.id === player.id) coachOnce('pickup', 'Snowdrifts give you more snowballs. Our School refills them too.');
      if (e.type === 'arrive' && e.id === player.id) hud.toast('You are there!');
    }
    if (player.ammo === 0) coachOnce('empty', 'Out of snowballs! Run through a snowdrift (the white mounds).');

    // ---- views
    for (const v of views.values()) v.update(dt, reduceMotion);
    sim.drifts.forEach((d, i) => { const t = 1 - d.cd / 7; if (d.lastT !== t) { d.lastT = t; world.updateDrift(i, Math.max(0.15, t)); } });
    fx.update(dt, sim.balls, focus);
    fx.showArc(player, aim || player, r.charging && player.ammo > 0 && !!aim);

    // ---- camera follows the student
    focus.x += (player.x - focus.x) * Math.min(1, dt * 6); focus.z += (player.z - focus.z) * Math.min(1, dt * 6);
    shake = Math.max(0, shake - dt);
    const sx = shake > 0 ? (Math.random() - 0.5) * shake * 0.8 : 0, sz = shake > 0 ? (Math.random() - 0.5) * shake * 0.8 : 0;
    camera.position.set(focus.x + camOffset.x + sx, camOffset.y, focus.z + camOffset.z + sz);
    camera.lookAt(focus.x + sx, 0, focus.z + sz);
    camera.updateMatrixWorld();
    sun.position.set(focus.x + 16, 50, focus.z + 30); // front light: walls facing the camera stay bright sun.target.position.set(focus.x, 0, focus.z); sun.target.updateMatrixWorld();

    // ---- see-through: dissolve what stands between the camera and the student
    const pv = new Vector3(player.x, 1, player.z), pr = renderer.getPixelRatio();
    const ndc = pv.clone().project(camera);
    CUT.center.value.set((ndc.x + 1) / 2 * innerWidth * pr, (ndc.y + 1) / 2 * innerHeight * pr);
    CUT.radius.value = 2.6 * pxPerUnit * pr;
    CUT.depth.value = pv.applyMatrix4(camera.matrixWorldInverse).z + 1.2;

    // ---- HUD
    hud.tick(dt);
    hud.drawMini(sim.chars, player, arena.places);
    hud.setAmmo(player.ammo, CONFIG.fight.ammoMax, player.charge, sim.grid.has(player.x, player.z, GRID.ZONE));
    const items = sim.chars.filter(c => c.side === 'rival' && !c.frozen).map(c => { const p = toScreen(c.x, 1, c.z); return { key: 'c' + c.id, kind: 'rival', team: c.team, color: CONFIG.teams[c.team].color, sx: p.x, sy: p.y, off: p.off }; });
    if (outpost) { const p = toScreen(outpost.x, 0, outpost.z); items.push({ key: 'outpost', kind: 'outpost', sx: p.x, sy: p.y, off: p.off }); }
    hud.arrowsFor(items);
    if (params.has('debug')) $('#debug').textContent = `${quality.fps.toFixed(0)} fps · ${LEVELS[quality.level].name} · ${sim.chars.filter(c => c.side === 'rival' && c.frozen).length} rivals frozen`;

    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  game = { match, sim, player, quality, renderer, hud };
  globalThis.__snowpax = game; // for automated checks
}

startScreen();
