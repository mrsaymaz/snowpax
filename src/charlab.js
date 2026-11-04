// Character lab (characters.html): the team kids, girls and boys on every team.
// ?view=front|game|turn|close  ·  ?d=puffer|vinyl|plush (default puffer)  ·  ?baked=1 shows the merged game meshes
import { WebGLRenderer, Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, Color, Mesh, PlaneGeometry, MeshLambertMaterial, CircleGeometry, MeshBasicMaterial, PCFSoftShadowMap, Vector3 } from 'three';
import { buildKid, bakeKid } from './game/render/kids2.js';
import { TEAM_IDS, CONFIG } from './config.js';
import { assignLooks } from './game/looks.mjs';
import { makeRng } from './tasks/subtasks.mjs';

const params = new URLSearchParams(location.search), view = params.get('view') || 'front', design = params.get('d') || 'puffer';
const renderer = new WebGLRenderer({ canvas: document.getElementById('c'), antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFSoftShadowMap;
const scene = new Scene(); scene.background = new Color('#cfe0f4');
scene.add(new HemisphereLight('#e6eeff', '#7d8cc4', 1.0));
const sun = new DirectionalLight('#fff2de', 2.0); sun.position.set(6, 10, 7); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 }); scene.add(sun);
const ground = new Mesh(new PlaneGeometry(80, 80), new MeshLambertMaterial({ color: '#eef2fb' })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

// four teams of three, looks assigned the way a match assigns them
const KITS = ['thrower', 'lobber', 'sprayer'], rng = makeRng(+(params.get('seed') || 7));
const seats = assignLooks(TEAM_IDS.flatMap(team => KITS.map(kit => ({ team, side: team, role: 'mate', kit }))), rng);
const close = view === 'close', GAP = view === 'game' ? 3.0 : 4.2, kids = [];
const rows = close ? [TEAM_IDS[+(params.get('t') || 0)]] : TEAM_IDS;
rows.forEach((team, r) => seats.filter(s => s.team === team).forEach((s, c) => {
  let m = buildKid({ design, team, kit: s.kit, ...s.look, mood: params.get('mood') || 'happy' }); if (params.has('baked')) m = bakeKid(m);
  m.position.set((c - 1) * (close ? 2.1 : 2.3), 0, close ? 0 : (r - (rows.length - 1) / 2) * GAP);
  if (view === 'game') { const ring = new Mesh(new CircleGeometry(0.55, 24), new MeshBasicMaterial({ color: '#4a6182', transparent: true, opacity: 0.25 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; m.add(ring); }
  m.rotation.y = view === 'front' ? 0.3 : 0; scene.add(m); kids.push(m);
}));
const cam = new PerspectiveCamera(view === 'game' ? 24 : 30, 1, 0.1, 200);
if (view === 'game') { cam.position.set(0, 17.6 * 0.86, 16 * 0.86 + 1); cam.lookAt(0, 0, 0.8); }
else if (close) { cam.position.set(0, 2.4, 7.4); cam.lookAt(0, 1.0, 0); }
else { cam.position.set(0, 10, 20); cam.lookAt(0, 0.6, 0); }
const labels = document.getElementById('labels');
function placeLabels() {
  labels.innerHTML = rows.map((team, i) => {
    const p = new Vector3(-4.2, 1.0, close ? 0 : (i - (rows.length - 1) / 2) * GAP).project(cam);
    const who = seats.filter(s => s.team === team).map(s => s.look.gender === 'girl' ? 'girl' : 'boy').join(' · ');
    return `<div style="top:${((1 - p.y) / 2 * 100).toFixed(1)}%">${CONFIG.teams[team].name} · ${who}</div>`;
  }).join('');
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); placeLabels(); }
addEventListener('resize', resize); resize();
let t = 0;
renderer.setAnimationLoop(() => { t += 0.016; if (view === 'turn') for (const k of kids) k.rotation.y = t * 0.8; renderer.render(scene, cam); });
globalThis.__lab = true;
