// Character lab: the three kid design directions side by side (?view=front|game|turn).
import { WebGLRenderer, Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, Color, Mesh, PlaneGeometry, MeshLambertMaterial, CircleGeometry, MeshBasicMaterial, PCFSoftShadowMap, Group, Vector3 } from 'three';
import { buildKid, DESIGNS } from './game/render/kids2.js';

const params = new URLSearchParams(location.search), view = params.get('view') || 'front';
const renderer = new WebGLRenderer({ canvas: document.getElementById('c'), antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFSoftShadowMap;
const scene = new Scene(); scene.background = new Color('#cfe0f4');
scene.add(new HemisphereLight('#e6eeff', '#7d8cc4', 1.0));
const sun = new DirectionalLight('#fff2de', 2.0); sun.position.set(6, 10, 7); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 }); scene.add(sun);
const ground = new Mesh(new PlaneGeometry(80, 80), new MeshLambertMaterial({ color: '#eef2fb' })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const ROWS = [
  { team: 'hufflepuff', kit: 'thrower', skin: 0, hair: 0 }, { team: 'gryffindor', kit: 'lobber', skin: 2, hair: 2 },
  { team: 'ravenclaw', kit: 'sprayer', skin: 3, hair: 3 }, { team: 'slytherin', kit: 'thrower', skin: 1, hair: 4 },
];
const kids = [];
const only = params.has('d') ? +params.get('d') : -1, GAP = view === 'game' ? 3.2 : 5.0; // ?view=close&d=0 shows one design up close
DESIGNS.forEach((design, r) => ROWS.forEach((k, c) => {
  if (only >= 0 && r !== only) return;
  const m = buildKid({ design, ...k }); m.position.set((c - 1.5) * 2.0, 0, only >= 0 ? 0 : (r - 1) * GAP);
  if (view === 'game') { const ring = new Mesh(new CircleGeometry(0.55, 24), new MeshBasicMaterial({ color: '#4a6182', transparent: true, opacity: 0.25 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; m.add(ring); }
  m.rotation.y = view === 'front' ? 0.35 : 0; scene.add(m); kids.push(m);
}));
const cam = new PerspectiveCamera(view === 'game' ? 24 : 30, 1, 0.1, 200);
if (view === 'game') { cam.position.set(0, 17.6 * 0.86, 16 * 0.86 + 1); cam.lookAt(0, 0, 0.8); }
else if (only >= 0) { cam.position.set(0, 2.4, 8.2); cam.lookAt(0, 1.0, 0); }
else { cam.position.set(0, 9.5, 21); cam.lookAt(0, 0.6, 0); }
const NAMES = ['A · Puffer kids', 'B · Vinyl toys', 'C · Knitted plush'], labels = document.getElementById('labels');
function placeLabels() { // each label sits level with its row on screen
  labels.innerHTML = DESIGNS.map((d, i) => { if (only >= 0 && i !== only) return ''; const p = new Vector3(0, 1.0, only >= 0 ? 0 : (i - 1) * GAP).project(cam); return `<div style="top:${((1 - p.y) / 2 * 100).toFixed(1)}%">${NAMES[i]}</div>`; }).join('');
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); placeLabels(); }
addEventListener('resize', resize); resize();
let t = 0;
renderer.setAnimationLoop(() => { t += 0.016; if (view === 'turn') for (const k of kids) k.rotation.y = t * 0.8; renderer.render(scene, cam); });
globalThis.__lab = true;
