// SnowPax: 3-vs-3 snowball brawl across snowed-in Kasımpaşa. Seize the five landmark outposts by
// answering English tasks from the chosen unit while your teammates guard you (outpostflow.js).
// ?arena=schoolyard runs the small feel-test arena instead.
import { WebGLRenderer, Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, Color, Vector3, Vector2, Raycaster, Plane, PCFSoftShadowMap, Fog } from 'three';
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
import { unlockAudio, play, setSound } from './audio.js';
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
import { InstancedMesh, MeshLambertMaterial, SphereGeometry, Object3D } from 'three';

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
    $('#play').disabled = !team; $('#play').textContent = team ? 'PLAY!' : 'Pick your team';
  };
  $('#teams').onclick = e => { const b = e.target.closest('.team-btn'); if (b) { team = b.dataset.team; refresh(); } };
  $('#kits').onclick = e => { const b = e.target.closest('.kit-btn'); if (b) { kit = b.dataset.kit; refresh(); } };
  document.querySelectorAll('.pace-btn').forEach(b => { b.onclick = () => { pace = b.dataset.pace; refresh(); }; });
  document.querySelectorAll('.who-btn').forEach(b => { b.onclick = () => { gender = b.dataset.who; refresh(); }; });
  $('#play').onclick = async () => {
    unlockAudio(); save.team = team; save.kit = kit; save.pace = pace; if (save.look?.gender !== gender) save.look = { gender }; writeSave(save);
    $('#start').hidden = true;
    try { await startGame(team, kit, pace); } catch (err) { $('#loading').hidden = false; $('#loading').textContent = 'Sorry, the game could not start: ' + err.message; throw err; }
  };
  refresh();
  if (params.has('autostart')) { team = params.get('team') || team || 'hufflepuff'; kit = params.get('kit') || kit; pace = params.get('pace') || pace; gender = params.get('who') || gender; refresh(); $('#play').click(); }
}

// ---------- the game ----------
async function startGame(myTeam, kit, pace) {
  useBasicScenes(params.get('scenes') === 'basic'); // ?scenes=basic: the plain cards, to compare
  // Arena 1 world (five outposts) by default; the small schoolyard feel test with ?arena=schoolyard
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
  // ?look=v1 brings back the old diorama look, and ?free the free-roaming world
  const V2 = params.get('look') !== 'v1' && arena.world && !params.has('free');
  // each stage at its own time of day; dusk = how far the lamps and windows are lit
  const STAGE_LIGHT = { boulevard: ['morning', 0], archery: ['noon', 0], kizilay: ['afternoon', 0.1], sururi: ['golden', 0.35], waterfront: ['sunset', 0.7], schoolyard: ['evening', 1] };
  let stageLight = STAGE_LIGHT.boulevard;
  const stageClip = z => ({ x: z.x, z: z.z, r: 16.5 });
  const firstZone = sim.zones.find(q => q.id === 'boulevard') || sim.zones[0];
  let world = buildVillage(arena, { rivalTeam, homeTeam: myTeam, quality: LEVELS[level].name, look: V2 ? 'v2' : 'v1', clip: V2 ? stageClip(firstZone) : null }); scene.add(world.group);
  let life = arena.world ? new WorldLife(scene, world.life, { low: LEVELS[level].name === 'low', ground: groundH, pickups: sim.pickups }) : null;
  let backdrop = V2 ? buildBackdrop(firstZone.x, firstZone.z, { rIn: 17, seed: 3 }) : null; if (backdrop) scene.add(backdrop);
  // a stage build: only the area round this outpost, plus the painted backdrop beyond the snowbanks
  const rebuildWorld = z => {
    if (!V2) return;
    scene.remove(world.group); world.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    world = buildVillage(arena, { rivalTeam, homeTeam: myTeam, quality: LEVELS[level].name, look: 'v2', clip: stageClip(z) }); scene.add(world.group);
    if (life) scene.remove(life.g); life = new WorldLife(scene, world.life, { low: LEVELS[level].name === 'low', ground: groundH, pickups: sim.pickups });
    if (backdrop) scene.remove(backdrop); backdrop = buildBackdrop(z.x, z.z, { rIn: 17, seed: z.id.length * 7 }); scene.add(backdrop);
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
  function resize() {
    const w = innerWidth, h = innerHeight, a = w / h; camera.aspect = a;
    // portrait (phones held upright): a wider lens and a little further back, so the narrow screen
    // still shows the fight round you; the extra height shows more of the street ahead
    camera.fov = a < 1 ? 24 + (1 - a) * 37 : 24;
    zoom = Math.min(1.35, Math.max(1, Math.min(w, h) / 390)) * (a < 1.5 ? 1.12 : 1) * (a < 1 ? 1 + (1 - a) * 0.5 : 1) * (Number(params.get('zoom')) || 1) * (V2 ? 0.86 : 1); // v2: closer, bigger characters
    camera.updateProjectionMatrix(); renderer.setSize(w, h, false); stages?.sled?.resize(w, h); post?.setSize(w, h);
    const dist = off.length() * zoom; scene.fog.near = base.fogNear = dist * 1.25; scene.fog.far = base.fogFar = dist * 2.9; // haze only beyond the arena
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
      const scr = c => { v.set(c.x, groundH(c.x, c.z) + (c.role === 'minion' ? 0.9 : 1.0), c.z).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };
      let best = null, bd = R;
      for (const c of sim.enemiesOf(player)) { if (c.frozen || c.gone || !sim.canSee(player, c)) continue; const [sx, sy] = scr(c), d = Math.hypot(sx - x, sy - y); if (d < bd) { bd = d; best = c; } }
      if (best) { fx.number?.(best.x, best.z, '🎯', 'warm'); return { target: best.id }; }
      const [px, py] = scr(player); if (Math.hypot(px - x, py - y) < R * 1.1) return { auto: true };
      return null;
    },
  });
  $('#hud').hidden = !!(arena.world && !params.has('free'));
  $('#zone-bar .home').style.background = myCol; $('#zone-bar .rival').style.background = rivCol;
  $('#score .home').innerHTML = emblemSVG(myTeam, 22); $('#score .rival').innerHTML = emblemSVG(rivalTeam, 22);
  $('#super').style.setProperty('--c', '#ffd23f');
  const touch = matchMedia('(pointer: coarse)').matches;
  const coach = (text, sec = 4.5) => { $('#coach .line').textContent = text; $('#coach').hidden = false; clearTimeout(coach.t); coach.t = setTimeout(() => { $('#coach').hidden = true; }, sec * 1000); };
  const seen = new Set(), once = (key, text, sec = 4.5) => { if (seen.has(key)) return; seen.add(key); coach(text, sec); };
  $('#flakes b').textContent = save.snowflakes || 0; $('#flakes').hidden = !arena.world;
  const banner = (text, cls = '', sec = 1.6) => { const b = $('#banner'); b.textContent = text; b.className = 'show ' + cls; clearTimeout(banner.t); banner.t = setTimeout(() => { b.className = ''; }, sec * 1000); };
  // English tasks as task stations (?scenes=basic for the plain cards): a staged 3D set opens for the task, like Languini's stations
  const worldTasks = arena.world ? new WorldTasks({ layer: $('#wt-layer'), player, reduceMotion, sound: (n, o) => play(n, o), stations: { sururi: s => castleStation(s, { color: myCol }), boulevard: s => treehouseStation(s, { color: myCol }), archery: s => archeryStation(s, { color: myCol }), kizilay: s => fountainStation(s, { color: myCol }), waterfront: s => bellStation(s, { color: myCol }) } }) : null;
  const flow = unit ? new OutpostFlow({
    sim, player, unit, unitProgress, save, writeSave, pace, rng, root: $('#taskcard'), familyOverride: params.get('family'), world: worldTasks, worldColor: myCol,
    ui: { banner: (...a) => banner(...a), coach: (...a) => coach(...a), play, fx, fireworks: z => { if (reduceMotion) return; for (const col of [myCol, '#ffffff', '#ffd166', '#7cc4f0']) fx.emit(z.x, 3.5, z.z, 40, col, 6, 1.4, 1.2); } },
  }) : null;
  // Arena 1 plays as stages (?free for the old free-roaming world)
  const showdownView = new ShowdownView(scene, { color: myCol, dark: CONFIG.teams[myTeam].dark, groundY: (x, z) => groundH(x, z), reduceMotion });
  const fireworks = z => { if (reduceMotion) return; for (const col of [myCol, '#ffffff', '#ffd166', '#7cc4f0']) fx.emit(z.x, 3.5, z.z, 40, col, 6, 1.4, 1.2); };
  stages = flow && !params.has('free') ? new StageRunner({
    match, flow, unit, unitProgress, save, writeSave, pace, rng, team: myTeam, kit, reduceMotion,
    ui: { banner: (...a) => banner(...a), coach: (...a) => coach(...a), play,
      snapCamera: () => { focus.set(player.x, 0, player.z - 1.2); camShift = 0; },
      showWall: cells => showWall(cells), onGone: list => dropSnowmen(list), rebuildWorld: z => rebuildWorld(z), fireworks,
      seizeButton: on => { $('#seizebtn').hidden = !on; },
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
  // rival snowmen views
  const snowmen = new Map();
  const dropSnowmen = list => { for (const [id, v] of snowmen) if (!list || list.some(c => c.id === id) || !sim.chars.some(c => c.id === id)) { scene.remove(v.root); v.dispose(); snowmen.delete(id); } };
  const feed = (html) => { const li = document.createElement('div'); li.className = 'feed-item'; li.innerHTML = html; $('#feed').prepend(li); setTimeout(() => li.remove(), 3500); while ($('#feed').children.length > 3) $('#feed').lastChild.remove(); };

  // mini-map (top left) and the big map: tap a place to walk there
  const FAM = { answer: 'B', sort: 'C', match: 'A', listen: 'E', build: 'D' };
  const mapImg = document.createElement('canvas'), MP = 4; mapImg.width = arena.w * MP; mapImg.height = arena.h * MP;
  const TILE_COL = { H: '#5e6888', S: '#d9cfa6', K: '#f4f8ff', Q: '#a99bd2', C: '#8e86b8', W: '#5f9bd0', G: '#b98a6a', O: '#24304f', c: '#7c84a8', t: '#2d5a5d', '_': '#ffffff', '=': '#eef0fa', '+': '#e3dcf6', q: '#ece6fb', P: '#d5c79c', f: '#d5c79c', '#': '#d5c79c', d: '#ffffff', Y: '#eadfc0', h: '#eadfc0', r: '#f4f8ff', j: '#b98a6a', p: '#dfeee3', '.': '#e7edf8', u: '#f6f8ff', s: '#cfe0fb', l: '#7c84a8', R: '#8d95b8', D: '#f4f6fc', T: '#2d5a5d', v: '#9aa36a', y: '#a8453c', x: '#2f6f6a', B: '#4f7a5a', F: '#b9845a', k: '#b9845a' };
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

  let last = performance.now(), puffT = 0, camY = 0, camShift = 0, tScale = 1; const zoneKeys = {}, held = new Set();
  function frame(now) {
    const rdt = Math.min(0.05, (now - last) / 1000); last = now; // real time
    tScale += ((worldTasks?.active ? 0.25 : 1) - tScale) * Math.min(1, rdt * 3); // a 3D task: the fight goes on in slow motion
    const dt = rdt * tScale;
    requestAnimationFrame(frame); quality.tick(dt);
    LOOK.time.value += dt;
    if (paused) { draw(stages?.mode === 'sled' ? stages.sled.scene : scene, stages?.mode === 'sled' ? stages.sled.camera : camera); return; }
    if (stages?.mode === 'sled') { stages.update(dt); draw(stages.sled.scene, stages.sled.camera); return; } // the sled journey has its own scene
    const live = !pose && countdown <= 0 && (!stages || stages.mode === 'outpost');
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
      fx.onEvent(e, sim); flow?.onEvent(e); stages?.onEvent(e);
      if (e.type === 'spawnMinion') { const c = sim.chars.find(q => q.id === e.id); if (c) { const v = new SnowmanView(c); snowmen.set(c.id, v); scene.add(v.root); fx.emit(e.x, 0.6, e.z, 20, '#ffffff', 3, 0.6); } }
      if (e.type === 'melt') fx.emit(e.x, 0.5, e.z, 22, '#f4f7ff', 2.5, 0.8);
      if (e.type === 'blast') fx.emit(e.x, 3.2, e.z, 16, myCol, 3, 0.6);
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
        if (!reduceMotion) fx.emit(e.x, 0.2, e.z, 34, '#ffffff', 4.5, 0.8, 1.3);
        if (v) { score[v.side === 'home' ? 'rival' : 'home']++; feed(`<b style="color:${CONFIG.teams[by?.team || v.team].dark}">${by ? name(by) : 'Someone'}</b> froze <b style="color:${CONFIG.teams[v.team].dark}">${name(v) === 'You' ? 'you' : name(v)}</b> ❄`); }
        if (e.id === player.id) { $('#frozen').hidden = false; coach('Brrr! You are a snowman. Shake it off and you are back at Our School.', 3.5); }
        if (by === player) banner('FROZEN ONE!', 'good', 1.1);
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
      k.update(dt, { visible, reduceMotion, groundY: groundH(c.x, c.z) });
    }
    for (const v of snowmen.values()) { v.update(dt, groundH(v.c.x, v.c.z)); v.root.visible = sim.canSee(player, v.c) || v.c.frozen > 0; }
    sim.drifts.forEach((d, i) => { const t = 1 - d.cd / 6; if (d.lt !== t) { d.lt = t; world.updateDrift(i, Math.max(0.2, t)); } });
    fx.update(pose ? 0 : dt, sim);
    for (const zz of sim.zones) { const key = `${zz.progress.toFixed(3)}|${zz.contested}`; if (key !== zoneKeys[zz.id] || zz.contested) { zoneKeys[zz.id] = key; world.setZone(zz.progress, myCol, rivCol, zz.contested, now / 1000, zz.id); } }
    const z = sim.nearestZone(player.x, player.z);

    // camera
    const tH = Math.tan(camera.fov * Math.PI / 360), upright = camera.aspect < 1, halfW0 = tH * off.length() * zoom * camera.aspect;
    // reading a card: keep the student and the fight beside it (left half), or above it in portrait, where the card is at the bottom
    camShift += ((player.planted && !worldTasks?.active ? (upright ? tH * off.length() * zoom * 0.55 : halfW0 * 0.5) : 0) - camShift) * Math.min(1, dt * 4);
    const tx = player.x + (upright ? 0 : camShift), tz = player.z - 1.2 + (upright ? camShift : 0);
    focus.x += (tx - focus.x) * Math.min(1, dt * 5); focus.z += (tz - focus.z) * Math.min(1, dt * 5);
    const halfW = tH * off.length() * zoom * camera.aspect, lim = params.has('zoom') ? 0 : Math.max(0, arena.w / 2 - halfW + 0.5);
    focus.x = Math.max(-lim, Math.min(lim, focus.x));
    if (!params.has('zoom')) focus.z = Math.max(arena.z0 + 5, Math.min(arena.z0 + arena.h - 3.5, focus.z));
    shake = Math.max(0, shake - dt);
    const j = shake > 0 ? shake * 0.6 : 0;
    camY += (groundH(player.x, player.z) - camY) * Math.min(1, dt * 4);
    camera.position.set(focus.x + off.x * zoom + (Math.random() - 0.5) * j, off.y * zoom + camY, focus.z + off.z * zoom + (Math.random() - 0.5) * j);
    camera.lookAt(focus.x, camY, focus.z); camera.updateMatrixWorld();
    sun.position.set(focus.x + sunDir[0], sunDir[1], focus.z + sunDir[2]); sun.target.position.set(focus.x, 0, focus.z - 2); sun.target.updateMatrixWorld();
    world.tick(dt, focus, reduceMotion, camera); showdownView.tick(dt); worldTasks?.tick(rdt);
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
    $('#zone-bar .home').style.width = (z.progress > 0 ? p : 0) + '%'; $('#zone-bar .rival').style.width = (z.progress < 0 ? p : 0) + '%';
    $('#zone-label').textContent = `${z.label}: ` + (stages?.phase === 'fight' && stages.zone === z ? 'clear the snowmen!' : z.showdown ? (z.owner === 'home' ? 'giant snowball!' : `banners ${stages?.bannersUp || 0} of 5`) : flow?.busy && flow.zone === z ? (flow.mode === 'defend' ? 'answer to refill snowballs' : `answer to seize ${p}%`) : flow?.waveZone === z ? 'defend it!' : z.owner === 'home' ? 'yours!' : z.owner === 'rival' ? 'rivals hold it' : z.contested ? 'contested!' : z.home ? `seizing… ${p}%` : z.rival ? `rivals seizing… ${p}%` : `${Math.round(Math.hypot(z.x - player.x, z.z - player.z))} steps away`);
    drawMini();
    $('#zone').classList.toggle('contested', !!z.contested);
    $('#score .h').textContent = score.home; $('#score .r').textContent = score.rival;
    $('#super').classList.toggle('ready', player.super >= 1); $('#super').style.setProperty('--p', Math.round(player.super * 100));
    $('#attack .pips').innerHTML = Array.from({ length: CONFIG.fight.ammoMax }, (_, i) => `<i style="--f:${Math.max(0, Math.min(1, player.ammo - i))}"></i>`).join('');
    $('#attack').classList.toggle('empty', player.ammo < 1);
    $('#attack').classList.toggle('quiet', sim.grid.has(player.x, player.z, GRID.ZONE));
    if (params.has('debug')) $('#debug').textContent = `${quality.fps.toFixed(0)} fps · ${LEVELS[quality.level].name}`;
    const wts = worldTasks?.session, inStation = wts && now >= wts.showAt; draw(inStation ? wts.scene : scene, inStation ? wts.camera : camera); // a station shows its own set
  }
  requestAnimationFrame(frame);
  const screenOf = c => { const v = new Vector3(c.x, groundH(c.x, c.z) + (c.role === 'minion' ? 0.9 : 1.0), c.z).project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; };
  globalThis.__snowpax = { match, sim, player, quality, renderer, world, life, flow, stages, scene, snowmen, screenOf };
  if (stages) stages.showMap();
}

startScreen();
