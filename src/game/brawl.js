// SnowPax: 3-vs-3 snowball brawl across snowed-in Kasımpaşa. Seize the five landmark outposts by
// answering English tasks from the chosen unit while your teammates guard you (outpostflow.js).
// ?arena=schoolyard runs the small feel-test arena instead.
import { WebGLRenderer, WebGLRenderTarget, Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, Color, Vector3, Vector2, Raycaster, Plane, PCFSoftShadowMap, Fog } from 'three';
import { CONFIG, TEAM_IDS } from '../config.js';
import { emblemSVG } from '../emblems.js';
import { loadSave, writeSave } from '../save.mjs';
import { createMatch } from './match.mjs';
import { playerLook } from './looks.mjs';
import { buildTileArena } from './tilemap.mjs';
import { SCHOOLYARD } from './arenas/schoolyard.mjs';
import { GRID } from './grid.mjs';
import { buildVillage, LIGHTING, DAYLIGHT } from './render/village.js';
import { LOOK, makePost, buildBackdrop } from './render/look.js';
import { WorldLife } from './render/worldlife.js';
import { makeGround } from './terrain.mjs';
import { Kid } from './render/kids.js';
import { BrawlFx } from './render/brawlfx.js';
import { CUT } from './render/cutout.js';
import { AutoQuality, guessLevel, LEVELS } from './quality.js';
import { Sticks } from './sticks.js';
import { unlockAudio, play, setSound, music, stopMusic, measureTrack } from './audio.js';
import { speech } from './speech.js';
import { karakoyStation, bankalarStation, tersaneStation, aynalikavakStation, miniaturkStation } from './cards/golden.js';
import { galataStation, istiklalStation, taksimStation, cihangirStation, tophaneStation } from './cards/downtown.js';
import { drawLogo, Hero, lessonPicker, unitsOf } from './startui.js';
import { OutpostFlow, assignFlakeWords } from './outpostflow.js';
import { ensureUnit, startRun } from '../rules/progress.mjs';
import { StageRunner } from './stagerun.js';
import { stageState, STAGES } from './stages.mjs';
import { SnowmanView } from './render/snowmen.js';
import { ShowdownView } from './render/showdown.js';
import { useBasicScenes } from './cards/scenes.js';
import { WorldTasks } from './render/worldtask.js';
import { castleStation } from './cards/castle3d.js';
import { treehouseStation, archeryStation, fountainStation, bellStation } from './cards/stations.js';
import { talkStation } from './cards/talk.js';
import { shopStation, shopScene } from './cards/shop.js';
import { InstancedMesh, MeshLambertMaterial, SphereGeometry, Object3D, Group, Mesh, BoxGeometry, Sprite, SpriteMaterial, CanvasTexture, SRGBColorSpace, CylinderGeometry, PlaneGeometry, MeshBasicMaterial, AdditiveBlending, DoubleSide, CircleGeometry, RingGeometry, TorusGeometry } from 'three';
import { SHOP, ROLES } from './fights.mjs';
import { buildKid, bakeKid } from './render/kids2.js';
import { KID_SCALE } from './render/kids.js';

const $ = s => document.querySelector(s);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const save = loadSave();
const KITS = CONFIG.kits;
const KIT_ICON = { thrower: '⚡', lobber: '🌙', sprayer: '💥' };
const KIT_TEXT = { thrower: 'Fast, straight throws', lobber: 'Throws over walls', sprayer: 'Three at once, close up' };

// ---------- start screen ----------
function startScreen() {
  let team = save.team || null, kit = save.kit || 'thrower', pace = save.pace || 'relaxed', gender = save.look?.gender || (Math.random() < 0.5 ? 'girl' : 'boy');
  $('#teams').innerHTML = TEAM_IDS.map(id => `<button type="button" class="pick team-btn" data-team="${id}" style="--c:${CONFIG.teams[id].color}">${emblemSVG(id, 48)}<b>${CONFIG.teams[id].name}</b></button>`).join('');
  $('#kits').innerHTML = Object.entries(KITS).map(([id, k]) => `<button type="button" class="pick kit-btn" data-kit="${id}"><span class="ico">${KIT_ICON[id]}</span><b>${k.name}</b><small>${KIT_TEXT[id]}</small></button>`).join('');
  const refresh = () => {
    document.querySelectorAll('.team-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.team === team)));
    document.querySelectorAll('.kit-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kit === kit)));
    document.querySelectorAll('.pace-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pace === pace)));
    document.querySelectorAll('.who-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.who === gender)));
    $('#play').disabled = !team; $('#play').textContent = team ? 'PLAY ▶' : 'Pick your team';
    $('#st-team-hint').textContent = team ? CONFIG.teams[team].name : 'Pick one to play';
    $('#start').style.setProperty('--tc', team ? CONFIG.teams[team].color : '#e889b5'); // the hats on the girl and boy tiles
    hero?.set({ team, gender, kit, look: save.look });
  };
  // the logo, your kid turning in the snow (dressed as you choose), the lesson, the stars, sound
  drawLogo($('#st-logo'), { height: innerHeight < 450 ? 40 : innerWidth < 380 || innerHeight < 700 ? 48 : 60 });
  let hero = null; try { if (!params.has('autostart')) hero = new Hero($('#st-hero')); } catch (err) { console.warn('hero', err); }
  let unitId = params.get('unit') || save.unitId || 'g5u1';
  const showLesson = async () => {
    const grade = +(/^g(\d)/.exec(unitId)?.[1] || 5), n = +(/u(\d+)$/.exec(unitId)?.[1] || 1), card = $('#st-lesson');
    card.querySelector('i').textContent = grade; card.querySelector('small').textContent = `Grade ${grade} · Unit ${n}`;
    const sts = save.units?.[unitId]?.arenas?.[0]?.stages || {}, stars = ['kasimpasa', 'golden-horn', 'downtown'].reduce((n, id) => n + (sts[id]?.stars || 0), 0), open2 = !!sts.kasimpasa?.done, open3 = open2 && !!sts['golden-horn']?.done;
    $('#st-stars').textContent = `★ ${stars} / 9`; $('#st-ar-open').textContent = `${open3 ? 3 : open2 ? 2 : 1} of 3 open`;
    const card3 = (el, n, id, open, lock) => { el.classList.toggle('locked', !open); el.classList.toggle('open', open); el.querySelector('small').textContent = open ? (sts[id]?.done ? `Arena ${n} · ${'★'.repeat(sts[id].stars)}` : `Arena ${n} · Ready`) : lock; };
    card3($('#st-ar2'), 2, 'golden-horn', open2, '🔒 Win Kasımpaşa first'); card3($('#st-ar3'), 3, 'downtown', open3, '🔒 Win the Golden Horn first');
    try { const u = (await unitsOf(grade)).find(q => q.id === unitId); if (u) card.querySelector('b').textContent = u.title; } catch { /* offline: keep the number */ }
  };
  showLesson();
  $('#st-lesson').onclick = () => lessonPicker(document.body, { current: unitId, onPick: id => { unitId = id; save.unitId = id; writeSave(save); showLesson(); } });
  const soundIcon = () => { $('#st-sound').textContent = save.settings.sound ? '🔊' : '🔈'; $('#st-sound').setAttribute('aria-label', save.settings.sound ? 'Sound on' : 'Sound off'); };
  soundIcon(); $('#st-sound').onclick = () => { save.settings.sound = !save.settings.sound; setSound(save.settings.sound); writeSave(save); soundIcon(); };
  $('#teams').onclick = e => { const b = e.target.closest('.team-btn'); if (b) { team = b.dataset.team; refresh(); } };
  $('#kits').onclick = e => { const b = e.target.closest('.kit-btn'); if (b) { kit = b.dataset.kit; refresh(); } };
  document.querySelectorAll('.pace-btn').forEach(b => { b.onclick = () => { pace = b.dataset.pace; refresh(); }; });
  document.querySelectorAll('.who-btn').forEach(b => { b.onclick = () => { gender = b.dataset.who; refresh(); }; });
  $('#play').onclick = async () => {
    unlockAudio(); save.team = team; save.kit = kit; save.pace = pace; save.unitId = unitId; if (save.look?.gender !== gender) save.look = { gender }; writeSave(save);
    $('#start').hidden = true; hero?.dispose(); hero = null;
    try { await startGame(team, kit, pace); } catch (err) { $('#loading').hidden = false; $('#loading').textContent = 'Sorry, the game could not start: ' + err.message; throw err; }
  };
  refresh();
  if (params.has('autostart')) { team = params.get('team') || team || 'hufflepuff'; kit = params.get('kit') || kit; pace = params.get('pace') || pace; gender = params.get('who') || gender; refresh(); $('#play').click(); }
}

// ---------- the game ----------
async function startGame(myTeam, kit, pace) {
  useBasicScenes(params.get('scenes') === 'basic'); // ?scenes=basic: the plain cards, to compare
  // Arena 1 world (the Kasımpaşa outpost) by default; the small schoolyard feel test with ?arena=schoolyard
  const worldDef = params.get('arena') === 'schoolyard' ? null : await (await fetch('arenas/arena1.json')).json();
  const arena = buildTileArena(worldDef || SCHOOLYARD);
  const others = TEAM_IDS.filter(t => t !== myTeam);
  const rivalTeam = others.includes(params.get('rival')) ? params.get('rival') : others[Math.floor(Math.random() * others.length)];
  let s = Number(params.get('seed')) || (Date.now() % 100000); const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
  save.look = playerLook(save.look); writeSave(save); // the player's kid; teammates and rivals mix girls and boys around it
  const match = createMatch({ arena, myTeam, rivalTeam, pace, rng, playerKit: kit, playerLook: save.look });
  const { sim, player } = match;
  const myCol = CONFIG.teams[myTeam].color, rivCol = CONFIG.teams[rivalTeam].color;
  // test helper: ?at=<outpost id> starts the student and teammates beside that outpost
  const atZone = sim.zones.find(zz => zz.id === params.get('at'));
  if (atZone) { // the first free side of the circle, south first
    sim.zone = atZone;
    const r = atZone.r + 0.7, ang = [0, 0.5, -0.5, 1.2, -1.2, Math.PI / 2, -Math.PI / 2, 2.2, -2.2, Math.PI].find(a => [-1.2, 0, 1.2].every(o => { const x = atZone.x + Math.sin(a) * r + Math.cos(a) * o, z = atZone.z + Math.cos(a) * r - Math.sin(a) * o; return match.grid.freeCircle(x, z, 0.4); })) ?? 0;
    sim.chars.filter(c => c.side === 'home').forEach((c, k) => { const o = (k - 1) * 1.2; c.x = atZone.x + Math.sin(ang) * r + Math.cos(ang) * o; c.z = atZone.z + Math.cos(ang) * r - Math.sin(ang) * o; c.face = ang + Math.PI; });
    globalThis.__atAngle = ang;
  }
  // ?at=<sled run id> starts beside that run's hilltop; ?weather=blizzard|sun|gust forces the weather soon after the start
  const atRun = sim.runs.find(r => r.id === params.get('at'));
  if (atRun) sim.chars.filter(c => c.side === 'home').forEach((c, k) => { c.x = atRun.pts[0][0] - 1.6 + k * 1.6; c.z = atRun.pts[0][1] + 2.2; });
  if (params.get('weather') === 'gust') sim.weather.gustNext = 1; else if (['blizzard', 'sun'].includes(params.get('weather'))) { sim.weather.next = 1; sim.weather.force = params.get('weather'); }
  const groundH = makeGround(arena.hills || []);
  // the unit being practised (Grade 5 Unit 1 unless ?unit=g6u3 or the save says otherwise)
  let unit = null, unitProgress = null;
  if (arena.world) {
    const unitId = params.get('unit') || save.unitId || 'g5u1', grade = (/^g(\d)/.exec(unitId) || [0, 5])[1];
    const bank = await (await fetch(`content/grade${grade}.json`)).json();
    unit = bank.units.find(u => u.id === unitId) || bank.units[0];
    save.unitId = unit.id; unitProgress = ensureUnit(save, unit.id, rng);
    if (!unitProgress.arenas[0].run) startRun(unitProgress, 0);
    writeSave(save);
    assignFlakeWords(sim, unit, unitProgress.missed, rng);
  }

  // renderer, scene, lights
  const canvas = $('#scene');
  const level = params.has('quality') ? Math.max(0, LEVELS.findIndex(l => l.name === params.get('quality'))) : guessLevel();
  const renderer = new WebGLRenderer({ canvas, antialias: level >= 1, powerPreference: 'high-performance' });
  renderer.shadowMap.type = PCFSoftShadowMap;
  const scene = new Scene(); scene.background = new Color(LIGHTING.sky); scene.fog = new Fog(LIGHTING.fog[0], LIGHTING.fog[1], LIGHTING.fog[2]);
  scene.add(new HemisphereLight(LIGHTING.hemi[0], LIGHTING.hemi[1], LIGHTING.hemi[2]));
  const sun = new DirectionalLight(LIGHTING.sun[0], LIGHTING.sun[1]); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 4;
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 }); sun.shadow.bias = -0.0006; scene.add(sun, sun.target);

  // the bold look (cartoon shading, outlines, glow, a build of only the stage area) is the default;
  // ?look=v1 brings back the old diorama look
  const V2 = params.get('look') !== 'v1' && arena.world;
  // each stage at its own time of day; dusk = how far the lamps and windows are lit
  const STAGE_LIGHT = { kasimpasa: ['afternoon', 0.15], 'golden-horn': ['golden', 0.4], downtown: ['evening', 0.85], boulevard: ['morning', 0], archery: ['noon', 0], kizilay: ['afternoon', 0.1], sururi: ['golden', 0.35], waterfront: ['sunset', 0.7], schoolyard: ['evening', 1] };
  let stageLight = STAGE_LIGHT.boulevard;
  // what a stage build shows: a circle round the outpost, or a battlefield's field and the street frame round it
  const fieldBox = (z, pad = 0) => { const b = z.battlefield; return { x0: z.x - b.hw - pad, x1: z.x + b.hw + pad, z0: z.z - b.back - pad, z1: z.z + b.front + pad }; };
  const stageClip = z => (z.battlefield ? { x: z.x, z: z.z, r: 40, rect: fieldBox(z, 7) } : { x: z.x, z: z.z, r: 16.5 });
  const stageBackdrop = z => {
    if (!z.battlefield) return buildBackdrop(z.x, z.z, { rIn: 17, seed: z.id.length * 7 });
    const b = fieldBox(z, 7.5), cz = (b.z0 + b.z1) / 2;
    // beyond the street frame; nothing just south of it, where it would stand between the camera and the team
    return buildBackdrop(z.x, cz, { rIn: z.battlefield.hw + 7, rOut: 50, seed: z.id.length * 7, avoid: (x, zz) => x > b.x0 && x < b.x1 && zz > b.z0 && zz < b.z1 + 9 });
  };
  const firstZone = sim.zones.find(q => q.id === 'boulevard') || sim.zones[0];
  let world = buildVillage(arena, { rivalTeam, homeTeam: myTeam, quality: LEVELS[level].name, look: V2 ? 'v2' : 'v1', clip: V2 ? stageClip(firstZone) : null }); scene.add(world.group);
  let life = arena.world ? new WorldLife(scene, world.life, { low: LEVELS[level].name === 'low', ground: groundH, pickups: sim.pickups }) : null;
  let backdrop = V2 ? stageBackdrop(firstZone) : null; if (backdrop) scene.add(backdrop);
  // a stage build: only the area round this outpost, plus the painted backdrop beyond the snowbanks
  const rebuildWorld = z => {
    if (!V2) return;
    scene.remove(world.group); world.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    world = buildVillage(arena, { rivalTeam, homeTeam: myTeam, quality: LEVELS[level].name, look: 'v2', clip: stageClip(z) }); scene.add(world.group);
    if (life) scene.remove(life.g); life = new WorldLife(scene, world.life, { low: LEVELS[level].name === 'low', ground: groundH, pickups: sim.pickups });
    if (backdrop) scene.remove(backdrop); backdrop = stageBackdrop(z); scene.add(backdrop);
    for (const zz of sim.zones) { if (zz.owner === 'home') world.setOwner(zz.id, myCol); delete zoneKeys[zz.id]; }
    stageLight = STAGE_LIGHT[z.id] || STAGE_LIGHT.boulevard; dayK = -1;
  };
  // the light slides from late afternoon to dusk over the first five minutes (?dusk=0..1 to preview)
  const hemi = scene.children.find(o => o.isHemisphereLight), sunDir = [...LIGHTING.sunDir];
  const lerpC = (a, b, k) => new Color(a).lerp(new Color(b), k);
  const applyDay = k => {
    const A = V2 ? DAYLIGHT[stageLight[0]] : DAYLIGHT.afternoon, B = V2 ? A : DAYLIGHT.dusk;
    scene.background.copy(lerpC(A.sky, B.sky, k)); scene.fog.color.copy(lerpC(A.fog, B.fog, k));
    hemi.color.copy(lerpC(A.hemi[0], B.hemi[0], k)); hemi.groundColor.copy(lerpC(A.hemi[1], B.hemi[1], k)); hemi.intensity = A.hemi[2] + (B.hemi[2] - A.hemi[2]) * k;
    sun.color.copy(lerpC(A.sun[0], B.sun[0], k)); sun.intensity = A.sun[1] + (B.sun[1] - A.sun[1]) * k;
    for (let i = 0; i < 3; i++) sunDir[i] = A.sunDir[i] + (B.sunDir[i] - A.sunDir[i]) * k;
    world.setDusk(V2 ? stageLight[1] : k); if (V2) post?.setGrade(A.grade);
    base.sun = sun.intensity; base.hemi = hemi.intensity; base.fog.copy(scene.fog.color);
  };
  const base = { sun: 1, hemi: 1, fog: new Color(), fogNear: 30, fogFar: 62 }, WHITEOUT = new Color('#eef1fa');
  const wx = { blizzard: 0, sun: 0 }; // weather blends, 0..1
  const forcedDusk = params.has('dusk') ? Math.max(0, Math.min(1, +params.get('dusk') || 0)) : null;
  let dayK = -1;
  const kids = new Map(sim.chars.map(c => [c.id, new Kid(c, { isPlayer: c === player })]));
  for (const k of kids.values()) scene.add(k.root);
  const camera = new PerspectiveCamera(24, innerWidth / innerHeight, 0.5, 140); // restrained perspective
  const post = V2 && LEVELS[level].name !== 'low' ? makePost(renderer, LEVELS[level].name) : null; // glow + colour grade
  const draw = (sc, cam) => (post ? post.render(sc, cam) : renderer.render(sc, cam));
  const fx = new BrawlFx(scene, $('#fx-layer'), camera);

  // steep follow camera looking north
  // about 50° down: kids show their faces, the arena reads like a stage
  const off = new Vector3(0, 17.6, 16.0); let zoom = 1, shake = 0;
  const focus = new Vector3(player.x, 0, player.z - 1.2);
  let stages = null; // set below once the HUD exists
  // ---------- a ride made ready before it starts ----------
  // Every shader the ride and its places' scenes need is compiled, and every shape and picture is
  // handed to the GPU once (a draw into a tiny target, with nothing culled), so none of that happens
  // mid-ride on a phone (it is what made the ride stutter as a place came near).
  async function warmRide(sled) {
    const groups = sled.slots.map(q => q.scene?.group).filter(Boolean), first = sled.slots.find(q => q.scene)?.scene;
    const vis = groups.map(g => g.visible), culled = [];
    groups.forEach(g => { g.visible = true; });
    const hidden = []; sled.scene.traverse(o => { if (o.frustumCulled) { culled.push(o); o.frustumCulled = false; } if (!o.visible && !groups.includes(o)) { hidden.push(o); o.visible = true; } }); // the ride's things made ahead are hidden till they are needed: shown for this one draw
    if (first) sled.lightFor(first); // a place's light: the sun's shadow drawn, the lamps on
    try {
      if (renderer.compileAsync) await renderer.compileAsync(sled.scene, sled.camera); else renderer.compile(sled.scene, sled.camera);
      const rt = new WebGLRenderTarget(8, 8), was = renderer.getRenderTarget(); renderer.setRenderTarget(rt); renderer.render(sled.scene, sled.camera); renderer.setRenderTarget(was); rt.dispose();
    } finally {
      culled.forEach(o => { o.frustumCulled = true; }); hidden.forEach(o => { o.visible = false; }); groups.forEach((g, k) => { g.visible = vis[k]; }); sled.lightFor(null);
    }
  }

  // ---------- the finale of the ride in: arriving at the carousel ----------
  // The camera comes in high over the real field, sweeps low round the carousel as it turns (its
  // landmarks pass the camera in task order, the rival team in front of it), then drops behind
  // the team at the south end, where the stage begins. No bars (a vignette), the name card, Mr.
  // Saymaz's welcome, a cheeky fairground waltz, a cheer. Nothing moves in the fight meanwhile.
  let intro = null; const seenIntro = new Set();
  const introCard = (() => {
    const el = document.createElement('div'); el.className = 'intro-ui'; el.hidden = true;
    el.innerHTML = '<i class="ib top"></i><i class="ib bottom"></i><div class="rh-cine"><small></small><b></b><span class="ic-line"></span><span class="rh-skip" hidden>Tap to skip</span></div>';
    document.body.appendChild(el); return el;
  })();
  const smooth01 = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  function startIntro(z, { title, kicker, line, onDone, tune = 'carousel' }) {
    const id = 'arrive-' + z.id, dur = reduceMotion ? 3.2 : 8.4;
    intro = { z, t: 0, dur, onDone, tune, skippable: seenIntro.has(id) }; seenIntro.add(id);
    document.body.classList.add('intro'); introCard.hidden = false;
    const card = introCard.querySelector('.rh-cine'); card.querySelector('small').textContent = kicker; card.querySelector('b').textContent = title; card.querySelector('.ic-line').textContent = ''; card.querySelector('.rh-skip').hidden = !intro.skippable;
    card.classList.remove('show'); card.hidden = false; void card.offsetWidth; setTimeout(() => { if (intro) card.classList.add('show'); }, 700); setTimeout(() => { if (intro) card.hidden = true; }, 4300); // then the carousel alone
    setTimeout(() => { if (intro) card.querySelector('.ic-line').textContent = `"${line}"`; }, 1600); // on the card only: the arrival is not announced aloud
    world.carousel?.setRate(reduceMotion ? 0.16 : 0.55); music(tune); play('whoosh');
    return dur * 1000;
  }
  function endIntro() {
    if (!intro) return; const done = intro.onDone, tune = intro.tune || 'carousel'; intro = null;
    document.body.classList.remove('intro'); introCard.hidden = true; world.carousel?.setRate(0.16); stopMusic(tune, 0.8); play('cheer');
    done?.();
  }
  addEventListener('pointerdown', () => { if (intro?.skippable && intro.t < intro.dur - 2) intro.t = intro.dur - 2; }); // a tap skips to the drop behind the team
  function resize() {
    const w = innerWidth, h = innerHeight, a = w / h; camera.aspect = a;
    // portrait (phones held upright): a wider lens and a little further back, so the narrow screen
    // still shows the fight round you; the extra height shows more of the street ahead
    camera.fov = a < 1 ? 24 + (1 - a) * 37 : 24;
    zoom = Math.min(1.35, Math.max(1, Math.min(w, h) / 390)) * (a < 1.5 ? 1.12 : 1) * (a < 1 ? 1 + (1 - a) * 0.5 : 1) * (Number(params.get('zoom')) || 1) * (V2 ? 0.78 : 1); // v2: closer, bigger heroes (rivals out of view get edge arrows)
    camera.updateProjectionMatrix(); renderer.setSize(w, h, false); stages?.sled?.resize(w, h); post?.setSize(w, h);
    const dist = off.length() * zoom; scene.fog.near = base.fogNear = dist * (V2 ? 2.2 : 1.25); scene.fog.far = base.fogFar = dist * (V2 ? 4.6 : 2.9); // v2: only a light haze, the battlefield stays clear // haze only beyond the arena
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
    // tap a rival: a snowball at them; tap your own kid: a snowball at the nearest rival
    onTap: (x, y) => {
      if (player.planted || player.frozen || player.thaw) return null;
      const R = Math.max(40, Math.min(innerWidth, innerHeight) * 0.09), v = new Vector3();
      const scr = c => { v.set(c.x, groundH(c.x, c.z) + (c.role === 'minion' ? 0.7 : 0.75), c.z).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };
      let best = null, bd = R;
      for (const c of sim.enemiesOf(player)) { if (c.frozen || c.gone || !sim.canSee(player, c)) continue; const [sx, sy] = scr(c), d = Math.hypot(sx - x, sy - y); if (d < bd) { bd = d; best = c; } }
      if (best) { fx.number?.(best.x, best.z, '🎯', 'warm'); return { target: best.id }; }
      const [px, py] = scr(player); if (Math.hypot(px - x, py - y) < R * 1.1) return { auto: true };
      return null;
    },
  });
  $('#hud').hidden = !!arena.world;
  $('#zone-bar .home').style.background = myCol; $('#zone-bar .rival').style.background = rivCol;
  $('#score .home').innerHTML = emblemSVG(myTeam, 22); $('#score .rival').innerHTML = emblemSVG(rivalTeam, 22);
  $('#super').style.setProperty('--c', '#ffd23f');
  const touch = matchMedia('(pointer: coarse)').matches;
  // Mr. Saymaz keeps quiet in a fight: during one, each line is said once at most, and not more
  // often than every 12 s (the HUD line already says what to do)
  const coachSaid = new Set(); let coachLast = -1e9;
  const coach = (text, sec = 4.5) => {
    const fighting = stages?.mode === 'outpost' && (stages.phase === 'fight' || stages.phase === 'strike' || stages.finalT != null), now = performance.now();
    if (fighting && (coachSaid.has(text) || now - coachLast < 12000)) return;
    coachSaid.add(text); coachLast = now; coachShow(text, sec);
  };
  const coachShow = (text, sec = 4.5) => { $('#coach .line').textContent = text; $('#coach').hidden = false; clearTimeout(coach.t); coach.t = setTimeout(() => { $('#coach').hidden = true; }, sec * 1000); };
  const seen = new Set(), once = (key, text, sec = 4.5) => { if (seen.has(key)) return; seen.add(key); coach(text, sec); };
  $('#flakes b').textContent = save.snowflakes || 0; $('#flakes').hidden = !arena.world || !!unit; // in the stages, ❄ is the Snow Shop money (the #stars pill)
  const banner = (text, cls = '', sec = 1.6) => { const b = $('#banner'); b.textContent = text; b.className = 'show ' + cls; clearTimeout(banner.t); banner.t = setTimeout(() => { b.className = ''; }, sec * 1000); };
  // English tasks as task stations (?scenes=basic for the plain cards): a staged 3D set opens for the task, like Languini's stations
  const worldTasks = arena.world ? new WorldTasks({ layer: $('#wt-layer'), player, reduceMotion, sound: (n, o) => play(n, o), stations: { sururi: s => castleStation(s, { color: myCol }), boulevard: s => treehouseStation(s, { color: myCol }), archery: s => archeryStation(s, { color: myCol }), kizilay: s => fountainStation(s, { color: myCol }), waterfront: s => bellStation(s, { color: myCol }), recruit: s => talkStation(s, { color: myCol }), shop: s => shopStation(s, { color: myCol }),
    karakoy: s => karakoyStation(s, { color: myCol }), bankalar: s => bankalarStation(s, { color: myCol }), tersane: s => tersaneStation(s, { color: myCol }), aynalikavak: s => aynalikavakStation(s, { color: myCol }), 'galata-tower': s => galataStation(s, { color: myCol }), istiklal: s => istiklalStation(s, { color: myCol }), taksim: s => taksimStation(s, { color: myCol }), cihangir: s => cihangirStation(s, { color: myCol }), tophane: s => tophaneStation(s, { color: myCol }), miniaturk: s => miniaturkStation(s, { color: myCol }) } }) : null;
  const flow = unit ? new OutpostFlow({
    sim, player, unit, unitProgress, save, writeSave, pace, rng, root: $('#taskcard'), familyOverride: params.get('family'), world: worldTasks, worldColor: myCol,
    ui: { banner: (...a) => banner(...a), coach: (...a) => coach(...a), play, fx, fireworks: z => { if (reduceMotion) return; for (const col of [myCol, '#ffffff', '#ffd166', '#7cc4f0']) fx.emit(z.x, 3.5, z.z, 40, col, 6, 1.4, 1.2); } },
  }) : null;
  // Arena 1 plays as stages
  const showdownView = new ShowdownView(scene, { color: myCol, dark: CONFIG.teams[myTeam].dark, groundY: (x, z) => groundH(x, z), reduceMotion });
  const fireworks = z => { if (reduceMotion) return; for (const col of [myCol, '#ffffff', '#ffd166', '#7cc4f0']) fx.emit(z.x, 3.5, z.z, 40, col, 6, 1.4, 1.2); };
  stages = flow ? new StageRunner({
    match, flow, unit, unitProgress, save, writeSave, pace, rng, team: myTeam, kit, reduceMotion,
    ui: { warm: sled => warmRide(sled), banner: (...a) => banner(...a), coach: (...a) => coach(...a), play, intro: (z, o) => startIntro(z, o),
      snapCamera: () => { focus.set(player.x, 0, player.z - 1.2); camShift = 0; },
      showWall: cells => showWall(cells), onGone: list => { dropSnowmen(list); dropGoneKids(); }, recruited: (c, R) => fx.number(c.x, c.z, `${c.name} · ${R.name}`, 'word'), rebuildWorld: z => rebuildWorld(z), markRival: z => world.setOwner(z.id, rivCol), fireworks,
      seizeButton: on => { $('#seizebtn').hidden = !on; },
      hush: () => { clearTimeout(coach.t); $('#coach').hidden = true; },
      carousel: { face: k => world.carousel?.face(k), light: k => world.carousel?.light(k, myCol), reset: () => world.carousel?.reset(), seatPos: k => world.carousel?.seatPos(k) },
      wallet: (n, pop) => { const el = $('#stars'); el.hidden = n == null; if (n != null) { el.querySelector('b').textContent = n; if (pop) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); } } },
      build: { open: i => buildUI.open(i), refresh: (i, bought) => buildUI.refresh(i, bought), close: () => buildUI.close() },
      fx, hunt: w => { const el = $('#hunt'), clean = s => String(s ?? '').replace(/[&<>"']/g, ''); el.hidden = !w; clearTimeout(el._mini); if (w) { el.classList.remove('mini'); el.innerHTML = `<small>${w.reveal ? 'Time!' : 'Freeze the snowman that means'}</small><span class="hunt-word">${w.pic ? `<img src="${clean(w.pic)}" alt="">` : ''}<b>${clean(w.tr)}</b></span>`; el._mini = setTimeout(() => el.classList.add('mini'), 2600); el.onclick = () => { el.classList.remove('mini'); clearTimeout(el._mini); el._mini = setTimeout(() => el.classList.add('mini'), 2600); }; } }, // a chip at the side: the whole line, then a small badge that leaves the field clear
      showdown: {
        start: (z, b) => showdownView.start(z, b), raise: k => showdownView.raise(k), giantBall: (f, t, s) => showdownView.giantBall(f, t, s), ring: () => showdownView.ring(), stop: () => showdownView.stop(),
        burst: at => { fx.emit(at.x, 1.4, at.z, reduceMotion ? 20 : 70, '#ffffff', 9, 1.4, 1.6); fx.emit(at.x, 1.4, at.z, reduceMotion ? 8 : 30, '#bfe0ff', 6, 1.2, 1.2); },
      } },
  }) : null;
  $('#seizebtn').onclick = () => { unlockAudio(); stages?.walkIn(); };
  // outposts held in earlier stages stay held
  if (stages) for (const st of STAGES) if (stageState(unitProgress)[st.id]?.done && st.outpost) { const zz = sim.zones.find(q => q.id === st.outpost); if (zz) { zz.owner = 'home'; zz.progress = 1; world.setOwner(zz.id, myCol); } }
  // snowbanks round the stage
  let wallMesh = null;
  const showWall = cells => {
    if (wallMesh) { scene.remove(wallMesh); wallMesh.geometry.dispose(); wallMesh = null; }
    if (!cells || !cells.length) return;
    wallMesh = new InstancedMesh(new SphereGeometry(0.5, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), new MeshLambertMaterial({ color: '#f6f8ff' }), cells.length);
    const o = new Object3D(); cells.forEach(([, , x, z], k) => { o.position.set(x, 0, z); o.rotation.y = k; o.scale.set(1.5 + (k % 3) * 0.2, 1.2 + (k % 4) * 0.25, 1.5); o.updateMatrix(); wallMesh.setMatrixAt(k, o.matrix); });
    wallMesh.receiveShadow = true; scene.add(wallMesh);
  };
  // supply crates on the field (the fights): a crate with a snow cap and a glowing question mark
  // supply crates on the field (the fights): a crate under a big golden "?" badge that bobs and
  // pulses, a soft beam of light, ripples on the snow and sparkles, so it calls you over from afar
  const canvasTex = (S, draw) => { const c = document.createElement('canvas'); c.width = c.height = S; draw(c.getContext('2d'), S); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; };
  const qTex = canvasTex(256, (g, S) => {
    const r = S * 0.4, c = S / 2;
    g.fillStyle = 'rgba(40,24,0,0.35)'; g.beginPath(); g.arc(c + 6, c + 10, r, 0, 7); g.fill(); // a soft drop shadow
    const gr = g.createRadialGradient(c - r * 0.35, c - r * 0.45, r * 0.1, c, c, r); gr.addColorStop(0, '#fff3b0'); gr.addColorStop(0.45, '#ffcf3e'); gr.addColorStop(1, '#f08c00');
    g.fillStyle = gr; g.beginPath(); g.arc(c, c, r, 0, 7); g.fill();
    g.lineWidth = 14; g.strokeStyle = '#ffffff'; g.stroke(); g.lineWidth = 5; g.strokeStyle = '#a85a00'; g.beginPath(); g.arc(c, c, r + 9, 0, 7); g.stroke();
    g.font = '900 150px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 12; g.strokeStyle = '#8a4300'; g.strokeText('?', c, c + 8); g.fillStyle = '#ffffff'; g.fillText('?', c, c + 8);
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.ellipse(c - r * 0.35, c - r * 0.55, r * 0.32, r * 0.14, -0.5, 0, 7); g.fill(); // a shine
  });
  const haloTex = canvasTex(128, (g, S) => { const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); gr.addColorStop(0, 'rgba(255,220,120,0.9)'); gr.addColorStop(0.45, 'rgba(255,180,60,0.35)'); gr.addColorStop(1, 'rgba(255,160,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); });
  const beamTex = canvasTex(64, (g, S) => { const gr = g.createLinearGradient(0, S, 0, 0); gr.addColorStop(0, 'rgba(255,214,110,0.75)'); gr.addColorStop(0.6, 'rgba(255,214,110,0.18)'); gr.addColorStop(1, 'rgba(255,214,110,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); });
  const ringTex = canvasTex(128, (g, S) => { g.strokeStyle = 'rgba(255,200,70,1)'; g.lineWidth = 10; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 8, 0, 7); g.stroke(); });
  const crates = new Map();
  const addCrate = (id, x, z) => {
    const g = new Group(), y0 = groundH(x, z); g.position.set(x, y0, z);
    const body = new Group(); g.add(body); g.userData.body = body;
    const box = new Mesh(new BoxGeometry(0.9, 0.7, 0.9), new MeshLambertMaterial({ color: '#c08a52', emissive: new Color('#5a3300'), emissiveIntensity: 0.25 })); box.position.y = 0.35; box.castShadow = true; body.add(box);
    for (const s of [-1, 1]) { const band = new Mesh(new BoxGeometry(0.94, 0.1, 0.94), new MeshLambertMaterial({ color: '#7a4f2a' })); band.position.y = 0.35 + s * 0.22; body.add(band); }
    const cap = new Mesh(new BoxGeometry(0.92, 0.12, 0.92), new MeshLambertMaterial({ color: '#f6f8ff' })); cap.position.y = 0.76; body.add(cap);
    const add = (o, y) => { o.position.y = y; o.renderOrder = 5; g.add(o); return o; };
    const beam = add(new Mesh(new CylinderGeometry(0.42, 0.62, 7, 18, 1, true), new MeshBasicMaterial({ map: beamTex, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide })), 3.5);
    const halo = add(new Sprite(new SpriteMaterial({ map: haloTex, depthWrite: false, transparent: true, blending: AdditiveBlending })), 2.05);
    const q = add(new Sprite(new SpriteMaterial({ map: qTex, depthWrite: false, depthTest: false, transparent: true })), 2.05); q.renderOrder = 6;
    const rings = [0, 0.5].map(ph => { const m = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.userData.ph = ph; return add(m, 0.04); });
    Object.assign(g.userData, { q, halo, beam, rings, t: 0, spark: 0 });
    scene.add(g); crates.set(id, g); fx.emit(x, 1, z, 36, '#ffd166', 5, 0.9); play('sparkle');
  };
  // ---------- neighbourhood children (the camp): waiting in plain coats, then joining the team ----------
  const waiting = new Map(), bubbleTex = new Map();
  const bubble = text => { if (bubbleTex.has(text)) return bubbleTex.get(text); const t = canvasTex(256, (g, S) => { g.fillStyle = '#ffffff'; g.strokeStyle = '#1c2a55'; g.lineWidth = 6; g.beginPath(); g.roundRect(10, 40, 236, 120, 34); g.fill(); g.stroke(); g.beginPath(); g.moveTo(110, 158); g.lineTo(128, 196); g.lineTo(146, 158); g.fill(); g.font = '900 44px system-ui, sans-serif'; g.fillStyle = '#1c2a55'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 100, 220); }); bubbleTex.set(text, t); return t; };
  const addWaiting = p => {
    const g = new Group(), kid = bakeKid(buildKid({ design: 'vinyl', team: 'neutral', kit: ROLES[p.role]?.kit || 'thrower', ...p.look })); kid.scale.setScalar(KID_SCALE); g.add(kid);
    const shadow = new Mesh(new CircleGeometry(0.4, 18), new MeshBasicMaterial({ color: '#4a6182', transparent: true, opacity: 0.28, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; g.add(shadow);
    const sp = new Sprite(new SpriteMaterial({ map: bubble('Can I join?'), depthTest: false, transparent: true })); sp.scale.set(1.5, 1.5, 1); sp.position.y = 2.2; sp.renderOrder = 7; g.add(sp);
    const tag = new Sprite(new SpriteMaterial({ map: canvasTex(256, (c2, S) => { c2.font = '800 40px system-ui, sans-serif'; c2.textAlign = 'center'; c2.fillStyle = 'rgba(28,42,85,0.85)'; c2.beginPath(); c2.roundRect(28, 92, 200, 64, 28); c2.fill(); c2.fillStyle = '#fff'; c2.textBaseline = 'middle'; c2.fillText(`${ROLES[p.role]?.icon || ''} ${p.name}`, 128, 125, 190); }), depthTest: false, transparent: true })); tag.scale.set(1.4, 1.4, 1); tag.position.y = -0.2; tag.renderOrder = 7; g.add(tag);
    g.position.set(p.x, groundH(p.x, p.z), p.z); g.rotation.y = Math.atan2(player.x - p.x, player.z - p.z); g.userData = { kid, sp, t: Math.random() * 6, p };
    scene.add(g); waiting.set(p.pickup || p.id, g);
  };
  const dropWaiting = id => { const g = waiting.get(id); if (!g) return; scene.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); waiting.delete(id); };
  const tickWaiting = dt => {
    for (const g of waiting.values()) {
      const u = g.userData; u.t += dt; const asking = u.p.asking && !(u.p.cd > 0);
      u.kid.position.y = reduceMotion ? 0 : Math.abs(Math.sin(u.t * 3)) * 0.12; // a little hop: pick me!
      g.rotation.y += (Math.atan2(player.x - g.position.x, player.z - g.position.z) - g.rotation.y) * Math.min(1, dt * 3);
      u.sp.visible = !asking; u.sp.position.y = 2.2 + Math.sin(u.t * 2) * 0.06;
    }
  };
  // a child joins: a puff of snow, and they come out of it in the team's colour and puffer jacket
  const spawnKidView = id => {
    const c = sim.chars.find(q => q.id === id); if (!c || kids.has(id)) return;
    const k = new Kid(c, { isPlayer: false }); kids.set(id, k); scene.add(k.root); k.root.scale.setScalar(0.01); k.popT = 0;
    fx.emit(c.x, 0.9, c.z, reduceMotion ? 20 : 60, '#ffffff', 5, 1.0, 1.2); fx.emit(c.x, 1.2, c.z, 24, myCol, 4, 0.8);
  };
  const dropGoneKids = () => { for (const [id, k] of kids) if (!sim.chars.some(c => c.id === id)) { scene.remove(k.root); k.dispose?.(); kids.delete(id); } };
  // the build moment: the Snow Shop opens (a 3D stall, cards/shop.js) with a slim bar for the
  // ❄ snowflakes, the time and Fight!
  const buildUI = (() => {
    let info = null, open = false, shop = null;
    const el = $('#build');
    const cheapest = Math.min(...Object.values(SHOP.boosts).map(b => b.cost));
    const render = () => { el.querySelector('.bd-stars').textContent = `❄ ${info.flakes}`; el.querySelector('.bd-hint').textContent = info.flakes >= cheapest ? 'Tap a boost to buy it' : info.boosts.size >= Object.keys(SHOP.boosts).length ? 'You have every boost!' : `A boost costs ❄ ${cheapest}`; };
    el.addEventListener('click', e => { if (e.target.closest('.bd-go')) stages?.endBuild(); });
    return {
      open(i) { info = i; open = true; el.hidden = false; render(); document.body.classList.add('building'); const s = worldTasks?.open('shop'); shop = s ? shopScene(s, { info: i, buy: id => stages?.buyBoost(id), color: myCol }) : null; },
      refresh(i, bought) { info = i; if (!open) return; render(); shop?.refresh(i, bought); },
      close() { if (!open) return; open = false; el.hidden = true; document.body.classList.remove('building'); if (shop) worldTasks?.close(); shop = null; },
      tick() { if (open && stages?.plan) el.querySelector('.bd-time').textContent = `${Math.max(0, Math.ceil(stages.plan.build - stages.tBuild))}s`; },
    };
  })();
  const tickCrates = dt => {
    for (const g of crates.values()) {
      const u = g.userData; u.t += dt; const t = u.t, pop = Math.min(1, t / 0.45), over = pop < 1 ? 1 + Math.sin(pop * Math.PI) * 0.35 : 1; // pops in with a little overshoot
      const pulse = reduceMotion ? 1 : 1 + Math.sin(t * 5) * 0.08, bob = reduceMotion ? 0 : Math.sin(t * 2.6) * 0.18;
      u.q.scale.setScalar(1.75 * pop * over * pulse); u.q.position.y = 2.05 + bob; u.q.material.rotation = reduceMotion ? 0 : Math.sin(t * 2.2) * 0.12; // a friendly wiggle
      u.halo.scale.setScalar(3.2 * pop * (1 + Math.sin(t * 5) * 0.12)); u.halo.position.y = u.q.position.y;
      u.beam.material.opacity = 0.55 + Math.sin(t * 3) * 0.2; u.beam.rotation.y += dt * 0.8; u.body.rotation.y += dt * 0.5;
      for (const r of u.rings) { const k = ((t * 0.7 + r.userData.ph) % 1); r.scale.setScalar(0.9 + k * 2.6); r.material.opacity = (1 - k) * 0.9; }
      if (!reduceMotion && (u.spark -= dt) <= 0) { u.spark = 0.35; fx.emit(g.position.x + (Math.random() - 0.5) * 0.8, 2.0 + bob, g.position.z + (Math.random() - 0.5) * 0.8, 3, '#fff1a8', 1.6, 0.6); }
    }
  };
  const dropCrate = id => { const g = crates.get(id); if (!g) return; scene.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); crates.delete(id); };
  // rival snowmen views
  const snowmen = new Map();
  const dropSnowmen = list => { for (const [id, v] of snowmen) if (!list || list.some(c => c.id === id) || !sim.chars.some(c => c.id === id)) { scene.remove(v.root); v.dispose(); snowmen.delete(id); } };
  const feed = (html) => { const li = document.createElement('div'); li.className = 'feed-item'; li.innerHTML = html; $('#feed').prepend(li); setTimeout(() => li.remove(), 3500); while ($('#feed').children.length > 3) $('#feed').lastChild.remove(); };

  // mini-map (top left) and the big map: tap a place to walk there
  const FAM = { answer: 'B', sort: 'C', match: 'A', listen: 'E', build: 'D' };
  const mapImg = document.createElement('canvas'), MP = 4; mapImg.width = arena.w * MP; mapImg.height = arena.h * MP;
  const TILE_COL = { '~': '#c9d2e4', H: '#5e6888', S: '#d9cfa6', K: '#f4f8ff', Q: '#a99bd2', C: '#8e86b8', W: '#5f9bd0', G: '#b98a6a', O: '#24304f', c: '#7c84a8', t: '#2d5a5d', '_': '#ffffff', '=': '#eef0fa', '+': '#e3dcf6', q: '#ece6fb', P: '#d5c79c', f: '#d5c79c', '#': '#d5c79c', d: '#ffffff', Y: '#eadfc0', h: '#eadfc0', r: '#f4f8ff', j: '#b98a6a', p: '#dfeee3', '.': '#e7edf8', u: '#f6f8ff', s: '#cfe0fb', l: '#7c84a8', R: '#8d95b8', D: '#f4f6fc', T: '#2d5a5d', v: '#9aa36a', y: '#a8453c', x: '#2f6f6a', B: '#4f7a5a', F: '#b9845a', k: '#b9845a' };
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
    if (W2 < 8 || H2 < 8) return; // hidden (stage map, sled run)
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
  function pause(on) { paused = on; $('#pause-menu').hidden = !on; if (flow) { const a = flow.accuracy; $('#accuracy').hidden = false; $('#accuracy').innerHTML = `Right first time: <b>${a.firstTry} of ${a.total}</b> (${a.pct}%)<br><small>Get ${Math.round(CONFIG.demand.unlockAccuracy * 100)}% to unlock the next arena.</small>`; } $('#q-level').textContent = quality.forced === null ? `Auto (${LEVELS[quality.level].name})` : LEVELS[quality.level].name; }
  $('#pause').onclick = () => pause(true); $('#resume').onclick = () => pause(false);
  $('#q-cycle').onclick = () => { const n = quality.forced === null ? 0 : quality.forced + 1; if (n >= LEVELS.length) quality.auto(); else quality.set(n); pause(true); };
  $('#sound').onclick = () => { save.settings.sound = !save.settings.sound; setSound(save.settings.sound); writeSave(save); $('#sound').textContent = `Sound: ${save.settings.sound ? 'on' : 'off'}`; };
  $('#sound').textContent = `Sound: ${save.settings.sound ? 'on' : 'off'}`; setSound(save.settings.sound);
  $('#restart').onclick = () => location.reload();
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });

  // round flow: countdown, then play; capturing the zone celebrates and resets it
  const pose = params.has('pose');
  let countdown = pose || stages ? 0 : 3.2, lastCount = 4, resetZoneAt = 0, score = { home: 0, rival: 0 };
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

  let last = performance.now(), puffT = 0, camY = 0, camShift = 0, tScale = 1, fieldZoom = 1; const zoneKeys = {}, held = new Set();
  function frame(now) {
    const rdt = Math.min(0.05, (now - last) / 1000); last = now; // real time
    tScale += ((worldTasks?.active ? 0.25 : 1) - tScale) * Math.min(1, rdt * 3); // a 3D task: the fight goes on in slow motion
    const dt = rdt * tScale;
    requestAnimationFrame(frame); quality.tick(dt);
    LOOK.time.value += dt;
    if (paused) { draw(stages?.mode === 'sled' ? stages.sled.scene : scene, stages?.mode === 'sled' ? stages.sled.camera : camera); return; }
    if (stages?.mode === 'sled') { stages.update(dt); draw(stages.sled.scene, stages.sled.camera); return; } // the sled journey has its own scene
    const live = !pose && !intro && countdown <= 0 && (!stages || stages.mode === 'outpost');
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
      if (cmd.target != null) { const t = sim.chars.find(c => c.id === cmd.target); return t ? { x: t.x, z: t.z } : null; } // a tapped rival
      if (cmd.mouse) { const m = r.mouse && groundAt(r.mouse.x, r.mouse.y); return m ? { x: m.x, z: m.z, manual: true } : null; }
      if (cmd.auto) { const t = sim.autoTarget(player, isSuper ? range : null); return t ? { x: t.x, z: t.z } : { x: player.x + Math.sin(player.face) * range, z: player.z + Math.cos(player.face) * range, manual: true }; }
      const d = range * (0.3 + 0.7 * cmd.mag); return { x: player.x + cmd.sx * d, z: player.z - cmd.sy * d, manual: true };
    };
    if (live && r.attack) { const t = shotTarget(r.attack, false); if (t) { if (player.ammo < 1) { $('#attack').classList.add('empty-flash'); setTimeout(() => $('#attack').classList.remove('empty-flash'), 250); } inp.attack = t; inp.manual = !!t.manual; } }
    if (live && r.super) { if (player.super >= 1) { const t = shotTarget(r.super, true); if (t) { inp.super = t; inp.manual = !!t.manual; } } }
    if (live && r.dodge) inp.dodge = { dx: inp.mx, dz: inp.mz };
    if (live) { match.step(dt, inp); stages?.update(dt); } else for (const c of sim.chars) c.moving = 0;

    // aim indicator while dragging (or always the mouse on desktop)
    let aimKind = null, aimTo = null;
    if (r.aiming) {
      const isSuper = r.aiming.kind === 'super', cmd = r.aiming.auto ? { auto: true } : r.aiming, t = shotTarget(cmd, isSuper);
      aimKind = isSuper ? 'super' : kitInfo.shot; aimTo = t;
    }
    fx.aim(aimKind, player, aimTo || player, myCol, aimKind === 'super' ? CONFIG.superBoulder.range : kitInfo.range, kitInfo.spreadDeg || 0);

    // events → effects, sounds, HUD
    if (flow && live) flow.update(rdt); // card timers run in real time
    for (const e of sim.drainEvents()) {
      fx.focusId = player.id; fx.onEvent(e, sim); flow?.onEvent(e); stages?.onEvent(e);
      if (e.type === 'recruitWait') { const p = sim.pickups.find(q => q.id === e.pickup); if (p) addWaiting({ ...p, pickup: p.id }); }
      if (e.type === 'recruitGone') dropWaiting(e.pickup);
      if (e.type === 'spawnKid') spawnKidView(e.id);
      if (e.type === 'coat') { fx.emit(e.x, 1, e.z, 16, '#ffcf9a', 2.5, 0.6); fx.number(e.x, e.z, 'WARM COAT!', 'warm'); }
      if (e.type === 'supplyDrop') addCrate(e.pickup, e.x, e.z);
      if (e.type === 'supplyGone') dropCrate(e.pickup);
      if (e.type === 'collect' && e.kind === 'supply') { fx.emit(e.x, 0.8, e.z, 30, '#ffd166', 4, 0.8); fx.number(e.x, e.z, e.right ? 'SUPPLIES!' : '+1 ❄', 'warm'); }
      if (e.type === 'spawnMinion') { const c = sim.chars.find(q => q.id === e.id); if (c) { const v = new SnowmanView(c); snowmen.set(c.id, v); scene.add(v.root); fx.emit(e.x, 0.6, e.z, 20, '#ffffff', 3, 0.6); } }
      if (e.type === 'melt') fx.emit(e.x, 0.5, e.z, 22, '#f4f7ff', 2.5, 0.8);
      if (e.type === 'blast') fx.emit(e.x, 3.2, e.z, 16, myCol, 3, 0.6);
      const k = e.id !== undefined ? kids.get(e.id) : null; if (k) k.onEvent(e.type);
      const near = e.x !== undefined ? Math.max(0, 1 - Math.hypot(e.x - player.x, e.z - player.z) / 18) : 1;
      if (['throw', 'hit', 'pickup', 'poof', 'dodge'].includes(e.type)) play(e.type, { near: e.id === player.id ? 1 : near });
      if (e.type === 'splat' && e.wall) play('splat', { near: near * 0.6 });
      if (e.type === 'super') { play('super', { near }); if (!reduceMotion) shake = Math.max(shake, 0.25); }
      if (e.type === 'superReady' && e.id === player.id) { play('superReady'); if (!seen.has('super')) banner('SUPER READY!', 'super', 1.2); once('super', 'Your super is ready! Press the gold button to roll a giant snowball.'); } // the glowing button says it after the first time
      if (e.type === 'hit' && e.id === player.id && !reduceMotion) shake = Math.max(shake, 0.18);
      if (e.type === 'freeze') {
        const v = sim.chars.find(c => c.id === e.id), by = sim.chars.find(c => c.id === e.by);
        play('freeze', { near: e.id === player.id ? 1 : near });
        if (!reduceMotion) fx.emit(e.x, 0.2, e.z, 34, '#ffffff', 4.5, 0.8, 1.3);
        if (v) { score[v.side === 'home' ? 'rival' : 'home']++; if (!stages) feed(`<b style="color:${CONFIG.teams[by?.team || v.team].dark}">${by ? name(by) : 'Someone'}</b> froze <b style="color:${CONFIG.teams[v.team].dark}">${name(v) === 'You' ? 'you' : name(v)}</b> ❄`); }
        if (e.id === player.id) $('#frozen').hidden = false; // the screen says it: no coach bubble on top
      }
      if (e.type === 'respawn' && e.id === player.id) $('#frozen').hidden = true;
      if (e.type === 'noThrowZone' && e.id === player.id) coach('Quiet zone: no snowballs near the mosque.', 3);
      // Phase 2: sleds, pickups, snow off the roofs, wind and weather (with English to read)
      const me = e.id === player.id;
      if (e.type === 'sledStart') { play('sled', { near: me ? 1 : near }); if (me) { banner('WHEEE!', 'go', 1.0); once('sled', 'Sledding! You can still throw snowballs on the way down.'); } }
      if (e.type === 'sledEnd' || e.type === 'sledCrash') { if (!reduceMotion) fx.emit(e.x, 0.2 + groundH(e.x, e.z), e.z, e.type === 'sledCrash' ? 30 : 18, '#ffffff', 3, 0.6); }
      if (e.type === 'collect' && e.kind === 'flake') {
        play('sparkle'); fx.emit(e.x, 0.8 + groundH(e.x, e.z), e.z, 24, '#c9f4ff', 2.5, 0.7); fx.number(e.x, e.z, '+1 ❄', 'warm');
        save.snowflakes = (save.snowflakes || 0) + 1; writeSave(save); $('#flakes b').textContent = save.snowflakes;
        once('flake', 'A glowing snowflake! Collect them all over the neighbourhood.');
      }
      if (e.type === 'collect' && e.kind === 'cocoa') { play('slurp', { near: me ? 1 : near }); fx.emit(e.x, 0.6, e.z, 16, '#ffcf9a', 2, 0.6); fx.number(e.x, e.z, '+40', 'warm'); if (me) once('cocoa', 'Hot cocoa! It warms you up.'); }
      if (e.type === 'snowDump') {
        const tall = 'tTvyx'.includes(e.tile) ? 2.6 : e.tile === 'l' ? 1.9 : 1.3;
        play('flump', { near }); life?.pile(e.x, e.z);
        if (!reduceMotion) { fx.emit(e.x, tall + groundH(e.x, e.z), e.z, 34, '#ffffff', 1.4, 0.9, 1.2); fx.emit(e.x, 0.3, e.z, 16, '#f4f7ff', 3, 0.6); }
        if (e.hit.length) once('dump', 'Splosh! Hit a roof or a tree and the snow falls on anyone below.');
      }
      if (e.type === 'gust') { if (e.on) { play('whoosh'); banner('POYRAZ!', 'super', 1.4); once('gust', 'Whoosh! The poyraz is a cold north-east wind. It pushes your snowballs.'); } }
      if (e.type === 'weather') {
        if (e.kind === 'blizzard') { banner('BLIZZARD!', 'lose', 1.8); coach('A blizzard! You can\'t see far. Sneak up on your rivals.', 4.5); }
        else if (e.kind === 'sun') { banner('SUNSHINE!', 'win', 1.8); coach('The sun is out! You warm up faster.', 4); }
        else coach('The weather is calm again.', 3);
      }
      if (e.type === 'zoneCaptured') {
        const zc = sim.zones.find(zz => zz.id === e.zone) || sim.zone;
        if (e.side === 'home') { banner('OUTPOST SEIZED!', 'win', 2.6); play('capture'); fx.emit(zc.x, 0.5, zc.z, 90, myCol, 6, 1.2); fx.emit(zc.x, 0.5, zc.z, 60, '#ffffff', 5, 1.2); if (!arena.world) coach('Great teamwork! In the full game, the English task card opens here while your team guards you.', 5); }
        else { banner('Rivals took the outpost!', 'lose', 2.2); play('freeze'); coach(arena.world ? 'Take it back! Step into the circle and answer the questions.' : 'Take it back! Stand in the circle with your team.', 4); }
        if (arena.world) {
          const spot = { x: zc.x, z: zc.z + zc.r - 0.6 }, other = e.side === 'home' ? 'rival' : 'home';
          sim.held[other] = sim.held[other].filter(h => !(Math.abs(h.x - spot.x) < 0.01 && Math.abs(h.z - spot.z) < 0.01)); held.delete(zc.id + ':' + other);
          sim.held[e.side].push(spot); held.add(zc.id + ':' + e.side); drawMap(); world.setOwner(zc.id, e.side === 'home' ? myCol : rivCol);
        }
        else resetZoneAt = sim.t + 4;
      }
    }
    if (resetZoneAt && sim.t > resetZoneAt) { sim.resetZone(); resetZoneAt = 0; }
    if (!player.frozen && !player.thaw) $('#frozen').hidden = true; else $('#frozen .count').textContent = Math.max(1, Math.ceil(player.frozen + player.thaw)).toString();

    // views
    for (const [id, k] of kids) {
      const c = k.c, visible = !c.benched && (c.side === 'home' || sim.canSee(player, c) || c.frozen);
      k.update(dt, { visible: visible || (!!intro && !c.benched), reduceMotion, groundY: groundH(c.x, c.z) });
      if (intro) { k.bar.visible = false; k.ring.visible = false; if (k.innerRing) k.innerRing.visible = false; } // the arrival: no bars or rings in the shot
    }
    tickCrates(dt); tickWaiting(dt); buildUI.tick();
    for (const k of kids.values()) if (k.popT !== undefined && k.popT < 1) { k.popT = Math.min(1, k.popT + dt * 2.5); const q = k.popT, o = q < 1 ? 1 + Math.sin(q * Math.PI) * 0.3 : 1; k.root.scale.setScalar(Math.max(0.01, q * o)); }
    for (const v of snowmen.values()) { v.update(dt, groundH(v.c.x, v.c.z)); v.root.visible = sim.canSee(player, v.c) || v.c.frozen > 0; }
    sim.drifts.forEach((d, i) => { const t = 1 - d.cd / 6; if (d.lt !== t) { d.lt = t; world.updateDrift(i, Math.max(0.2, t)); } });
    fx.update(pose ? 0 : dt, sim);
    for (const zz of sim.zones) { const key = `${zz.progress.toFixed(3)}|${zz.contested}`; if (key !== zoneKeys[zz.id] || zz.contested) { zoneKeys[zz.id] = key; world.setZone(zz.progress, myCol, rivCol, zz.contested, now / 1000, zz.id); } }
    const z = sim.nearestZone(player.x, player.z);

    // camera (a battlefield pulls back a little and looks a little ahead, up the field)
    const onField = !!(stages?.mode === 'outpost' && stages.zone?.battlefield && !player.planted); fieldZoom += ((onField ? 1.1 : 1) - fieldZoom) * Math.min(1, dt * 2.5); const zf = zoom * fieldZoom;
    const tH = Math.tan(camera.fov * Math.PI / 360), upright = camera.aspect < 1, halfW0 = tH * off.length() * zf * camera.aspect;
    // reading a card: keep the student and the fight beside it (left half), or above it in portrait, where the card is at the bottom
    camShift += ((player.planted && !worldTasks?.active ? (upright ? tH * off.length() * zf * 0.55 : halfW0 * 0.5) : 0) - camShift) * Math.min(1, dt * 4);
    const tx = player.x + (upright ? 0 : camShift), tz = player.z - 1.2 - (Math.min(fieldZoom, 1.1) - 1) * 15 + (upright ? camShift : 0);
    focus.x += (tx - focus.x) * Math.min(1, dt * 5); focus.z += (tz - focus.z) * Math.min(1, dt * 5);
    const halfW = tH * off.length() * zf * camera.aspect, lim = params.has('zoom') ? 0 : Math.max(0, arena.w / 2 - halfW + 0.5);
    focus.x = Math.max(-lim, Math.min(lim, focus.x));
    if (!params.has('zoom')) focus.z = Math.max(arena.z0 + 5, Math.min(arena.z0 + arena.h - 3.5, focus.z));
    shake = Math.max(0, shake - dt);
    const j = shake > 0 ? shake * 0.6 : 0;
    camY += (groundH(player.x, player.z) - camY) * Math.min(1, dt * 4);
    camera.position.set(focus.x + off.x * zf + (Math.random() - 0.5) * j, off.y * zf + camY, focus.z + off.z * zf + (Math.random() - 0.5) * j);
    camera.lookAt(focus.x, camY, focus.z); camera.updateMatrixWorld();
    if (intro) { // the arrival: scripted shots, blended into the game's own camera for the last two seconds
      intro.t += rdt; const I = intro, C = I.z, t = I.t, P = new Vector3(), L = new Vector3();
      if (reduceMotion) { P.set(C.x, 19, C.z + 30); L.set(C.x, 1, C.z + 3); }
      else if (t < 3.0) { const k = smooth01(t / 3); P.set(C.x + 3 * k, 27 - 12 * k, C.z + 58 - 33 * k); L.set(C.x, 2 * k, C.z + 9 - 9 * k); } // high over the field and the rooftops
      else { const k = smooth01((t - 3) / 3.4), a = 0.95 - 1.5 * k, r = 12.5 - 1.6 * k; P.set(C.x + Math.sin(a) * r, 4.6 + 1.0 * k, C.z + Math.cos(a) * r); L.set(C.x, 1.5, C.z); } // low round the turning carousel, its landmarks passing
      const out = reduceMotion ? (t > I.dur - 0.4 ? 1 : 0) : smooth01((t - (I.dur - 2)) / 2), look = new Vector3(focus.x, camY, focus.z);
      camera.position.lerpVectors(P, camera.position.clone(), out); camera.lookAt(L.lerp(look, out)); camera.updateMatrixWorld();
      const gullsOn = t < 2.8 || t >= I.dur; for (const m of [life?.gBody, life?.gWingL, life?.gWingR]) if (m) m.visible = gullsOn; // no gull flying into the lens on the low arc
      if (t >= I.dur) endIntro();
    }
    sun.position.set(focus.x + sunDir[0], sunDir[1], focus.z + sunDir[2]); sun.target.position.set(focus.x, 0, focus.z - 2); sun.target.updateMatrixWorld();
    world.tick(dt, focus, reduceMotion, camera); showdownView.tick(dt); worldTasks?.tick(rdt);
    edgeMarks();
    if (arena.world) {
      const k = V2 ? 0 : forcedDusk ?? Math.min(1, sim.t / 300); // the v2 sample: a fixed time of day per stage
      if (Math.abs(k - dayK) > 0.01) { dayK = k; applyDay(k); }
      life.tick(pose ? 0 : dt, sim.chars, camera, player, sim.weather);
      // weather blends in and out over about two seconds
      for (const kind of ['blizzard', 'sun']) wx[kind] += ((sim.weather.kind === kind ? 1 : 0) - wx[kind]) * Math.min(1, dt * 1.2);
      const b = wx.blizzard, su = wx.sun;
      scene.fog.near = base.fogNear * (1 - 0.55 * b); scene.fog.far = base.fogFar * (1 - 0.5 * b) * (1 + 0.3 * su);
      scene.fog.color.copy(base.fog).lerp(WHITEOUT, b * 0.6);
      sun.intensity = base.sun * (1 + 0.35 * su) * (1 - 0.35 * b); hemi.intensity = base.hemi * (1 + 0.12 * su);
      world.setWeather({ snow: 1 + 1.8 * b, wx: sim.weather.wx, wz: sim.weather.wz });
      $('#weather').style.setProperty('--b', b.toFixed(3)); $('#weather').style.setProperty('--s', su.toFixed(3));
    }
    // powder kicked up by running kids
    if (!reduceMotion && (puffT -= dt) <= 0) { puffT = 0.12; for (const c of sim.chars) if (!c.frozen && Math.hypot(c.vx, c.vz) > 2 && !sim.grid.has(c.x, c.z, GRID.ROAD)) fx.emit(c.x - c.vx * 0.05, 0.12, c.z - c.vz * 0.05, 2, '#f4f7ff', 0.7, 0.45, 0.8); }
    // see-through: anything between the camera and the player dissolves
    const pv = new Vector3(player.x, 1 + groundH(player.x, player.z), player.z), pr = renderer.getPixelRatio(), ndc = pv.clone().project(camera);
    CUT.center.value.set((ndc.x + 1) / 2 * innerWidth * pr, (ndc.y + 1) / 2 * innerHeight * pr);
    CUT.radius.value = Math.min(innerWidth, innerHeight) * 0.13 * pr;   // just around the player
    CUT.depth.value = pv.applyMatrix4(camera.matrixWorldInverse).z + 1.8; // only things in front of the student

    // HUD
    const p = Math.round(Math.abs(z.progress) * 100);
    const fbar = stages?.fightBar(), ftext = stages?.fightText();
    $('#zone-bar .home').style.width = (fbar != null ? Math.round(fbar * 100) : z.progress > 0 ? p : 0) + '%'; $('#zone-bar .rival').style.width = (fbar == null && z.progress < 0 ? p : 0) + '%';
    const zt = (ftext && stages.zone === z ? ftext : stages?.phase === 'fight' && stages.zone === z ? (z.battlefield ? 'beat the rival team!' : 'clear the snowmen!') : z.showdown ? (z.owner === 'home' ? 'giant snowball!' : `banners ${stages?.bannersUp || 0} of 5`) : flow?.busy && flow.zone === z ? (flow.mode === 'defend' ? 'answer to refill snowballs' : `answer to seize ${p}%`) : flow?.waveZone === z ? 'defend it!' : z.owner === 'home' ? 'yours!' : z.owner === 'rival' ? 'rivals hold it' : z.contested ? 'contested!' : z.home ? `seizing… ${p}%` : z.rival ? `rivals seizing… ${p}%` : `${Math.round(Math.hypot(z.x - player.x, z.z - player.z))} steps away`);
    $('#zone-label').textContent = stages ? zt.charAt(0).toUpperCase() + zt.slice(1) : `${z.label}: ${zt}`; // in a stage there is one place: no need to name it (it wrapped to three lines on a phone)
    drawMini();
    $('#zone').classList.toggle('contested', !!z.contested);
    $('#score .h').textContent = score.home; $('#score .r').textContent = score.rival;
    $('#super').classList.toggle('ready', player.super >= 1); $('#super').style.setProperty('--p', Math.round(player.super * 100));
    $('#attack .pips').innerHTML = Array.from({ length: player.ammoMax || CONFIG.fight.ammoMax }, (_, i) => `<i style="--f:${Math.max(0, Math.min(1, player.ammo - i))}"></i>`).join('');
    $('#attack').classList.toggle('empty', player.ammo < 1);
    $('#attack').classList.toggle('quiet', sim.grid.has(player.x, player.z, GRID.ZONE));
    if (params.has('debug')) $('#debug').textContent = `${quality.fps.toFixed(0)} fps · ${LEVELS[quality.level].name}`;
    const wts = worldTasks?.session, inStation = wts && now >= wts.showAt; draw(inStation ? wts.scene : scene, inStation ? wts.camera : camera); // a station shows its own set
  }
  requestAnimationFrame(frame);
  // rivals just out of view: an arrow at the screen edge pointing to each (within 30 m)
  const edgeLayer = document.createElement('div'); edgeLayer.id = 'edge-marks'; document.body.appendChild(edgeLayer);
  const marks = Array.from({ length: 3 }, () => { const m = document.createElement('div'); m.className = 'edge-mark'; m.style.setProperty('--c', rivCol); m.hidden = true; edgeLayer.appendChild(m); return m; });
  const crateMark = document.createElement('div'); crateMark.className = 'crate-mark'; crateMark.hidden = true; crateMark.innerHTML = '<span class="cm-in"><i></i><b>?</b></span>'; edgeLayer.appendChild(crateMark);
  const ev = new Vector3();
  function edgeMarks() {
    const show = stages ? stages.mode === 'outpost' && !worldTasks?.active : true; let k = 0;
    if (show) for (const c of sim.enemiesOf(player)) {
      if (k >= marks.length) break; if (c.gone || Math.hypot(c.x - player.x, c.z - player.z) > 30) continue;
      ev.set(c.x, groundH(c.x, c.z) + 0.9, c.z).project(camera);
      const sx = (ev.x + 1) / 2 * innerWidth, sy = (1 - ev.y) / 2 * innerHeight, M = 34, top = 96;
      if (ev.z < 1 && sx > M && sx < innerWidth - M && sy > top && sy < innerHeight - M) continue; // on screen
      const cx = innerWidth / 2, cy = innerHeight / 2, dx = sx - cx, dy = sy - cy, f = Math.min(Math.abs((innerWidth / 2 - M) / (dx || 1e-6)), Math.abs((innerHeight / 2 - M - (dy < 0 ? top / 2 : 0)) / (dy || 1e-6)));
      const m = marks[k++]; m.hidden = false; m.style.transform = `translate(${cx + dx * f}px, ${cy + dy * f}px) translate(-50%, -50%) rotate(${Math.atan2(dy, dx)}rad)`;
    }
    for (; k < marks.length; k++) marks[k].hidden = true;
    // a supply crate out of view: a golden "?" at the screen edge, pointing to it
    const s = show && sim.pickups.find(p => p.kind === 'supply' && !p.asking);
    crateMark.hidden = true;
    if (s) {
      ev.set(s.x, groundH(s.x, s.z) + 1.5, s.z).project(camera);
      const sx = (ev.x + 1) / 2 * innerWidth, sy = (1 - ev.y) / 2 * innerHeight, M = 46, top = 120;
      if (!(ev.z < 1 && sx > M && sx < innerWidth - M && sy > top && sy < innerHeight - M)) {
        const cx = innerWidth / 2, cy = innerHeight / 2, dx = (ev.z < 1 ? sx : 2 * cx - sx) - cx, dy = (ev.z < 1 ? sy : 2 * cy - sy) - cy, f = Math.min(Math.abs((innerWidth / 2 - M) / (dx || 1e-6)), Math.abs((innerHeight / 2 - M - (dy < 0 ? top / 2 : 0)) / (dy || 1e-6)));
        const px = Math.max(M, Math.min(innerWidth - M, cx + dx * f)), py = Math.max(top, Math.min(innerHeight - M, cy + dy * f)); // always fully on screen
        crateMark.hidden = false; crateMark.style.transform = `translate(${px}px, ${py}px) translate(-50%, -50%)`; crateMark.style.setProperty('--a', Math.atan2(dy, dx) + 'rad');
      }
    }
  }
  const screenOf = c => { const v = new Vector3(c.x, groundH(c.x, c.z) + (c.role === 'minion' ? 0.7 : 0.75), c.z).project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; };
  globalThis.__snowpax = { match, sim, player, quality, renderer, world, life, flow, stages, scene, snowmen, screenOf, worldTasks, intro: () => intro, measureTrack };
  if (stages) stages.showMap();
}

startScreen();
