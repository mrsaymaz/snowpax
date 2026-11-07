// Shared pieces for task stations (staged 3D sets): sky, light, snowy ground, pines, bunting,
// falling snow, confetti bursts and snowballs. A set builder calls stage() first and adds its own
// landmark; everything goes into the session's persist group, so it lasts for the whole visit.
import {
  Mesh, MeshLambertMaterial, MeshBasicMaterial, PlaneGeometry, SphereGeometry, ConeGeometry, CylinderGeometry, HemisphereLight, DirectionalLight, CanvasTexture,
  SRGBColorSpace, RepeatWrapping, Fog, Points, PointsMaterial, BufferGeometry, Float32BufferAttribute, Group, Shape, ShapeGeometry, DoubleSide, BackSide, Vector3, Color,
} from 'three';
import { buildKid, bakeKid, setKidMood } from '../render/kids2.js';

// the painted distance behind every station: layered snowy hills, pines and the Istanbul skyline
let backdropTex = null;
function paintBackdrop() {
  if (backdropTex) return backdropTex;
  backdropTex = canvasTex(2048, 512, (g, W, H) => {
    const rnd = (k => () => (k = (k * 16807) % 2147483647) / 2147483647)(7);
    const hills = (base, amp, col, step) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += step) g.lineTo(x, base - Math.sin(x * 0.004 + base) * amp - Math.sin(x * 0.011) * amp * 0.4); g.lineTo(W, H); g.fill(); };
    hills(330, 40, 'rgba(176, 196, 228, 0.75)', 16);
    // the skyline: domes, minarets and a round tower, very faint
    g.fillStyle = 'rgba(150, 170, 210, 0.7)';
    for (const [x, w, h] of [[300, 120, 70], [560, 90, 50], [1240, 160, 80], [1500, 100, 60], [1760, 130, 70]]) { g.fillRect(x - w / 2, 330 - h, w, h + 40); g.beginPath(); g.arc(x, 330 - h, w * 0.32, Math.PI, 0); g.fill(); for (const m of [-1, 1]) { g.fillRect(x + m * w * 0.62 - 4, 330 - h - 70, 8, h + 70); g.beginPath(); g.moveTo(x + m * w * 0.62 - 6, 330 - h - 70); g.lineTo(x + m * w * 0.62, 330 - h - 96); g.lineTo(x + m * w * 0.62 + 6, 330 - h - 70); g.fill(); } }
    g.fillRect(1004, 200, 40, 160); g.beginPath(); g.moveTo(996, 202); g.lineTo(1024, 150); g.lineTo(1052, 202); g.fill();
    hills(380, 30, 'rgba(206, 220, 242, 0.95)', 12);
    g.fillStyle = 'rgba(120, 160, 170, 0.75)';
    for (let x = 0; x < W; x += 22 + rnd() * 30) { const h = 26 + rnd() * 34, y = 392 + rnd() * 18; g.beginPath(); g.moveTo(x - h * 0.35, y); g.lineTo(x, y - h); g.lineTo(x + h * 0.35, y); g.fill(); }
    hills(420, 18, '#e8eef9', 10);
    const fade = g.createLinearGradient(0, 400, 0, H); fade.addColorStop(0, 'rgba(232,238,249,0)'); fade.addColorStop(1, '#e8eef9'); g.fillStyle = fade; g.fillRect(0, 400, W, H - 400);
  });
  return backdropTex;
}
// the city's painted distance (Downtown): rows of tall apartment buildings with lit windows climbing
// away in layers of haze, the old city's domes and minarets far off, a round tower on a hill
let cityTex = null;
function paintCity() {
  if (cityTex) return cityTex;
  cityTex = canvasTex(2048, 512, (g, W, H) => {
    const rnd = (k => () => (k = (k * 16807) % 2147483647) / 2147483647)(11);
    // the far skyline: domes and minarets, very faint
    g.fillStyle = 'rgba(150, 160, 205, 0.55)';
    for (const [x, w, h] of [[260, 130, 60], [720, 100, 46], [1380, 150, 66], [1820, 110, 52]]) { g.fillRect(x - w / 2, 300 - h, w, h + 60); g.beginPath(); g.arc(x, 300 - h, w * 0.3, Math.PI, 0); g.fill(); for (const m of [-1, 1]) g.fillRect(x + m * w * 0.6 - 3, 300 - h - 60, 6, h + 60); }
    g.fillRect(1040, 190, 34, 130); g.beginPath(); g.moveTo(1032, 192); g.lineTo(1057, 140); g.lineTo(1082, 192); g.fill(); // a round tower with its pointed cap
    // three layers of buildings, nearer ones darker and with lit windows
    for (const [base, hMin, hMax, col, winA] of [[330, 40, 90, 'rgba(170, 170, 210, 0.85)', 0.25], [370, 50, 110, 'rgba(150, 146, 190, 0.92)', 0.55], [410, 60, 130, 'rgba(126, 118, 166, 0.98)', 0.85]]) {
      for (let x = 0; x < W;) {
        const w = 30 + rnd() * 50, h = hMin + rnd() * (hMax - hMin); g.fillStyle = col; g.fillRect(x, base - h, w, h + 200);
        g.fillStyle = 'rgba(230, 228, 246, 0.9)'; g.fillRect(x - 2, base - h - 3, w + 4, 4); // snow on the cornice
        for (let y = base - h + 8; y < base - 6; y += 12) for (let wx = x + 5; wx < x + w - 6; wx += 9) if (rnd() < winA) { g.fillStyle = rnd() < 0.7 ? 'rgba(255, 214, 140, 0.95)' : 'rgba(90, 96, 130, 0.9)'; g.fillRect(wx, y, 4, 6); }
        x += w + rnd() * 3;
      }
    }
    const fade = g.createLinearGradient(0, 400, 0, H); fade.addColorStop(0, 'rgba(232,230,246,0)'); fade.addColorStop(1, '#e8e6f6'); g.fillStyle = fade; g.fillRect(0, 400, W, H - 400);
  });
  return cityTex;
}
let groundTex = null;
function paintGround() {
  if (groundTex) return groundTex;
  groundTex = canvasTex(512, 512, (g, W) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, W);
    for (let i = 0; i < 70; i++) { const x = Math.random() * W, y = Math.random() * W, r = 20 + Math.random() * 70, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(190, 208, 236, 0.22)'); gr.addColorStop(1, 'rgba(190, 208, 236, 0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255, 255, 255, ${0.6 + Math.random() * 0.4})`; g.fillRect(Math.random() * W, Math.random() * W, 2, 2); }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(150, 200, 255, 0.55)'; g.fillRect(Math.random() * W, Math.random() * W, 2, 2); }
  }, [10, 6]);
  return groundTex;
}

export function canvasTex(w, h, draw, repeat = null) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; if (repeat) { t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(...repeat); } return t; }

// sky, fog, light, ground and falling snow; returns { P, snowM, tick, ticks, burst, snowball }
export function stage(s, { top = '#7fb6ea', mid = '#cfe6fb', bottom = '#f4f9ff', ground = '#e4ecf8', fog = '#e6f1fc', sun = '#fff3df', snow = true, backdrop = 'hills' } = {}) {
  const P = s.persist, scene = s.scene, ticks = [];
  scene.background = canvasTex(4, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, top); gr.addColorStop(0.55, mid); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  scene.fog = new Fog(fog, 20, 52);
  P.add(new HemisphereLight('#e8f0ff', '#93a3d2', 0.95));
  const rim = new DirectionalLight('#bcd4ff', 0.7); rim.position.set(-5, 6, -8); P.add(rim); // a cool rim from behind
  const d = new DirectionalLight(sun === '#fff3df' ? '#ffe7c4' : sun, 2.35); d.position.set(6, 8.5, 6.5); d.castShadow = true; d.shadow.mapSize.set(1024, 1024); Object.assign(d.shadow.camera, { left: -9, right: 9, top: 9, bottom: -4, near: 1, far: 32 }); d.shadow.bias = -0.0005; P.add(d);
  const snowM = new MeshLambertMaterial({ color: '#f6f9ff' });
  const g = new Mesh(new PlaneGeometry(80, 50), new MeshLambertMaterial({ color: ground, map: paintGround() })); g.rotation.x = -Math.PI / 2; g.receiveShadow = true; P.add(g);
  const back = new Mesh(new CylinderGeometry(30, 30, 14, 48, 1, true, Math.PI * 0.5, Math.PI), new MeshBasicMaterial({ map: backdrop === 'city' ? paintCity() : paintBackdrop(), transparent: true, side: BackSide, fog: false, depthWrite: false }));
  back.position.set(0, 6.2, 4); back.renderOrder = -1; P.add(back); // the painted distance
  if (snow) {
    const N = 240, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 22; pos[i * 3 + 1] = Math.random() * 9; pos[i * 3 + 2] = (Math.random() - 0.5) * 14 - 1; }
    const pg = new BufferGeometry(); pg.setAttribute('position', new Float32BufferAttribute(pos, 3));
    P.add(new Points(pg, new PointsMaterial({ color: '#ffffff', size: 0.07, transparent: true, opacity: 0.9, depthWrite: false })));
    let t = 0; ticks.push(dt => { t += dt; if (s.reduceMotion) return; const a = pg.attributes.position; for (let i = 0; i < N; i++) { let y = a.array[i * 3 + 1] - dt * (0.5 + (i % 5) * 0.08); if (y < 0) y += 9; a.array[i * 3 + 1] = y; a.array[i * 3] += Math.sin(t + i) * dt * 0.08; } a.needsUpdate = true; });
  }
  // a burst of confetti (or snow) at a local point; round soft sparks
  const bursts = [], dot = canvasTex(32, 32, (g2, w) => { const gr = g2.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, w, w); });
  const burst = (at, colors = ['#ffd166', '#ffffff', '#7cc4f0', '#f3a6c8'], n = 26, power = 2.4, size = 0.11, life = 0.9) => {
    if (s.reduceMotion) return;
    const pos = new Float32Array(n * 3), vel = [], col = new Float32Array(n * 3), c = new Color();
    for (let i = 0; i < n; i++) { pos.set([at.x, at.y, at.z], i * 3); const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, r = Math.sqrt(1 - u * u); vel.push(new Vector3(Math.cos(a) * r, Math.abs(u) + 0.4, Math.sin(a) * r).multiplyScalar(power * (0.5 + Math.random() * 0.6))); c.set(colors[i % colors.length]); col.set([c.r, c.g, c.b], i * 3); }
    const geo = new BufferGeometry(); geo.setAttribute('position', new Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new Float32BufferAttribute(col, 3));
    const pts = new Points(geo, new PointsMaterial({ size, vertexColors: true, transparent: true, depthWrite: false, map: dot, alphaTest: 0.05 })); s.step.add(pts);
    bursts.push({ pts, vel, t: 0, life });
  };
  ticks.push(dt => { for (const b of [...bursts]) { b.t += dt; const a = b.pts.geometry.attributes.position; b.vel.forEach((v, i) => { v.y -= 5 * dt; a.array[i * 3] += v.x * dt; a.array[i * 3 + 1] += v.y * dt; a.array[i * 3 + 2] += v.z * dt; }); a.needsUpdate = true; b.pts.material.opacity = Math.max(0, 1 - b.t / b.life); if (b.t > b.life) { b.pts.parent?.remove(b.pts); bursts.splice(bursts.indexOf(b), 1); } } });
  // a snowball thrown from the bottom of the screen to a local point
  const ballGeo = new SphereGeometry(0.16, 14, 10);
  const snowball = (to, done, from = [0, 0.6, 7]) => { const b = new Mesh(ballGeo, snowM); b.position.set(...from); b.castShadow = true; s.step.add(b); s.fly(b, [to.x, to.y, to.z], { T: 0.42, lift: 1.4, done: () => { b.parent?.remove(b); burst(to, ['#ffffff', '#e8f4ff'], 14, 1.6); s.sound?.('splat'); done?.(); } }); };
  // fireworks: rockets rise and burst in the team's colours (the round is done)
  const rocketGeo = new SphereGeometry(0.07, 8, 6);
  const fireworks = (spots, colors) => spots.forEach(([x, y, z], k) => setTimeout(() => {
    if (!s.group.parent) return; // the station has closed
    const r = new Mesh(rocketGeo, new MeshBasicMaterial({ color: '#fff4c2' })); r.position.set(x * 0.8, Math.max(0.4, y - 3.5), z + 0.6); s.step.add(r); s.sound?.('swish');
    s.fly(r, [x, y, z], { T: 0.55, lift: 0, done: () => { r.parent?.remove(r); burst(new Vector3(x, y, z), colors, 54, 2.6, 0.26, 1.4); burst(new Vector3(x, y, z), ['#ffffff'], 18, 1.2, 0.16, 0.8); s.sound?.('pop'); } });
  }, k * 260));
  return { P, snowM, ticks, burst, snowball, fireworks, tick: dt => ticks.forEach(f => f(dt)) };
}

export function pines(P, list, snowM) {
  const pineM = new MeshLambertMaterial({ color: '#2f6f6a' });
  for (const [x, z, sc] of list) for (let l = 0; l < 3; l++) { const c = new Mesh(new ConeGeometry((1.0 - l * 0.25) * sc, 1.3 * sc, 9), l === 2 ? snowM : pineM); c.position.set(x, (0.9 + l * 0.75) * sc, z); c.castShadow = true; P.add(c); }
}
export function mounds(P, list, snowM) { for (const [x, z, r] of list) { const m = new Mesh(new SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), snowM); m.position.set(x, 0, z); m.scale.y = 0.55; m.receiveShadow = true; P.add(m); } }
export function bunting(P, { x0, x1, y, sag = 0.5, z = 0, n = 15, colors }) {
  const G = new Group(); P.add(G);
  for (let i = 0; i < n; i++) { const u = i / (n - 1), x = x0 + u * (x1 - x0), yy = y - Math.sin(u * Math.PI) * sag; const tri = new Shape(); tri.moveTo(-0.14, 0); tri.lineTo(0.14, 0); tri.lineTo(0, -0.3); tri.closePath(); const f = new Mesh(new ShapeGeometry(tri), new MeshLambertMaterial({ color: colors[i % colors.length], side: DoubleSide })); f.position.set(x, yy, z); G.add(f); }
  return t => G.children.forEach((f, i) => { f.rotation.x = Math.sin(t * 2.2 + i) * 0.25; });
}
// a flat label board (a plank/sign) that a label sits on
export const board = (w, h, color) => new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color, transparent: true, opacity: 0 }));
// lay out n widths in a row centred on 0, with a gap; returns centre x's
export function row(ws, gap) { const tot = ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1); let x = -tot / 2; return ws.map(w => { const c = x + w / 2; x += w + gap; return c; }); }

// the student's own kid in the station: throws, cheers, shrugs (the player's look, team and kit)
export function actor(s, P, { at = [-3.4, 0, 3.4], face = Math.PI - 0.6, scale = 0.82 } = {}) {
  const c = s.player; if (!c) return null;
  const make = kit => { const k = bakeKid(buildKid({ team: c.team, kit, ...(c.look || {}), hero: true })); k.scale.setScalar(scale); k.position.set(...at); k.rotation.y = face; k.traverse(o => { if (o.isMesh) o.castShadow = true; }); P.add(k); return k; };
  let kid = make(c.kit);
  const shadow = new Mesh(new CylinderGeometry(0.5, 0.5, 0.01, 20), new MeshBasicMaterial({ color: '#4a6182', transparent: true, opacity: 0.22, depthWrite: false })); shadow.position.set(at[0], at[1] + 0.01, at[2]); P.add(shadow);
  let [armL, armR] = kid.userData.arms; const y0 = at[1];
  let t = 0, act = null, moodT = 0;
  const run = (name, T, f) => { act = { name, T, t: 0, f }; };
  const mood = (m, sec) => { setKidMood(kid, m); moodT = sec; }; // a face for a moment, then back to happy
  const look = at[0] < 0 ? 0.5 : -0.5; // facing the camera (a little toward the middle), so the face shows
  const turn = (k, amt = 1) => { const e = k < 0.22 ? k / 0.22 : k > 0.78 ? (1 - k) / 0.22 : 1, u = e * e * (3 - 2 * e); kid.rotation.y = face + (look - face) * u * amt; };
  const A = {
    kid,
    // a new snowball style: the same kid with the style's hat (the Snow Shop)
    setKit(kit) { const old = kid; kid = make(kit); kid.rotation.y = old.rotation.y; P.remove(old); old.traverse(o => { if (o.isMesh) o.geometry?.dispose?.(); }); [armL, armR] = kid.userData.arms; A.kid = kid; act = null; return kid; },
    // turn to face a direction (radians), or back to the camera with null
    face(ry) { kid.rotation.y = ry == null ? face : ry; },
    hand() { return armR.localToWorld(new Vector3(0, -0.42, 0)).sub(s.group.position); }, // where things leave from
    throw() { s.sound?.('swish'); if (s.reduceMotion) return; run('throw', 0.36, k => { armR.rotation.x = -2.8 * Math.sin(k * Math.PI); }); },
    cheer(long = false) { mood('joy', long ? 2.2 : 1.2); if (s.reduceMotion) return; run('cheer', long ? 2.0 : 1.1, k => { turn(k); const u = Math.sin(Math.min(1, k * 1.3) * Math.PI); armL.rotation.x = armR.rotation.x = -2.6 * u; kid.position.y = y0 + Math.abs(Math.sin(k * Math.PI * (long ? 4 : 2))) * 0.28; }); },
    oops() { mood('surprised', 1.1); if (s.reduceMotion) return; run('oops', 1.0, k => { turn(k, 0.8); armL.rotation.z = -0.35 - Math.sin(k * Math.PI) * 0.6; armR.rotation.z = 0.35 + Math.sin(k * Math.PI) * 0.6; }); },
    tick(dt) {
      t += dt; if (moodT > 0 && (moodT -= dt) <= 0) setKidMood(kid, 'happy');
      if (act) { act.t += dt; const k = Math.min(1, act.t / act.T); act.f(k); if (k >= 1) { armL.rotation.x = armR.rotation.x = 0; armL.rotation.z = -0.35; armR.rotation.z = 0.35; kid.rotation.y = face; kid.position.y = y0; act = null; } }
      else if (!s.reduceMotion) kid.position.y = y0 + Math.abs(Math.sin(t * 2.2)) * 0.03;
    },
  };
  return A;
}
