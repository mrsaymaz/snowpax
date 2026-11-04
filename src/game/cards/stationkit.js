// Shared pieces for task stations (staged 3D sets): sky, light, snowy ground, pines, bunting,
// falling snow, confetti bursts and snowballs. A set builder calls stage() first and adds its own
// landmark; everything goes into the session's persist group, so it lasts for the whole visit.
import {
  Mesh, MeshLambertMaterial, MeshBasicMaterial, PlaneGeometry, SphereGeometry, ConeGeometry, HemisphereLight, DirectionalLight, CanvasTexture,
  SRGBColorSpace, RepeatWrapping, Fog, Points, PointsMaterial, BufferGeometry, Float32BufferAttribute, Group, Shape, ShapeGeometry, DoubleSide, Vector3, Color,
} from 'three';

export function canvasTex(w, h, draw, repeat = null) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; if (repeat) { t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(...repeat); } return t; }

// sky, fog, light, ground and falling snow; returns { P, snowM, tick, ticks, burst, snowball }
export function stage(s, { top = '#7fb6ea', mid = '#cfe6fb', bottom = '#f4f9ff', ground = '#e4ecf8', fog = '#e6f1fc', sun = '#fff3df', snow = true } = {}) {
  const P = s.persist, scene = s.scene, ticks = [];
  scene.background = canvasTex(4, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, top); gr.addColorStop(0.55, mid); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  scene.fog = new Fog(fog, 18, 48);
  P.add(new HemisphereLight('#eef5ff', '#8fa0cc', 1.15));
  const d = new DirectionalLight(sun, 2.1); d.position.set(5, 9, 7); d.castShadow = true; d.shadow.mapSize.set(1024, 1024); Object.assign(d.shadow.camera, { left: -9, right: 9, top: 9, bottom: -4, near: 1, far: 32 }); d.shadow.bias = -0.0005; P.add(d);
  const snowM = new MeshLambertMaterial({ color: '#f6f9ff' });
  const g = new Mesh(new PlaneGeometry(80, 50), new MeshLambertMaterial({ color: ground })); g.rotation.x = -Math.PI / 2; g.receiveShadow = true; P.add(g);
  if (snow) {
    const N = 240, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 22; pos[i * 3 + 1] = Math.random() * 9; pos[i * 3 + 2] = (Math.random() - 0.5) * 14 - 1; }
    const pg = new BufferGeometry(); pg.setAttribute('position', new Float32BufferAttribute(pos, 3));
    P.add(new Points(pg, new PointsMaterial({ color: '#ffffff', size: 0.07, transparent: true, opacity: 0.9, depthWrite: false })));
    let t = 0; ticks.push(dt => { t += dt; if (s.reduceMotion) return; const a = pg.attributes.position; for (let i = 0; i < N; i++) { let y = a.array[i * 3 + 1] - dt * (0.5 + (i % 5) * 0.08); if (y < 0) y += 9; a.array[i * 3 + 1] = y; a.array[i * 3] += Math.sin(t + i) * dt * 0.08; } a.needsUpdate = true; });
  }
  // a burst of confetti (or snow) at a local point
  const bursts = [];
  const burst = (at, colors = ['#ffd166', '#ffffff', '#7cc4f0', '#f3a6c8'], n = 26, power = 2.4) => {
    if (s.reduceMotion) return;
    const pos = new Float32Array(n * 3), vel = [], col = new Float32Array(n * 3), c = new Color();
    for (let i = 0; i < n; i++) { pos.set([at.x, at.y, at.z], i * 3); const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, r = Math.sqrt(1 - u * u); vel.push(new Vector3(Math.cos(a) * r, Math.abs(u) + 0.4, Math.sin(a) * r).multiplyScalar(power * (0.5 + Math.random() * 0.6))); c.set(colors[i % colors.length]); col.set([c.r, c.g, c.b], i * 3); }
    const geo = new BufferGeometry(); geo.setAttribute('position', new Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new Float32BufferAttribute(col, 3));
    const pts = new Points(geo, new PointsMaterial({ size: 0.11, vertexColors: true, transparent: true, depthWrite: false })); s.step.add(pts);
    bursts.push({ pts, vel, t: 0 });
  };
  ticks.push(dt => { for (const b of [...bursts]) { b.t += dt; const a = b.pts.geometry.attributes.position; b.vel.forEach((v, i) => { v.y -= 5 * dt; a.array[i * 3] += v.x * dt; a.array[i * 3 + 1] += v.y * dt; a.array[i * 3 + 2] += v.z * dt; }); a.needsUpdate = true; b.pts.material.opacity = Math.max(0, 1 - b.t / 0.9); if (b.t > 0.9) { b.pts.parent?.remove(b.pts); bursts.splice(bursts.indexOf(b), 1); } } });
  // a snowball thrown from the bottom of the screen to a local point
  const ballGeo = new SphereGeometry(0.16, 14, 10);
  const snowball = (to, done, from = [0, 0.6, 7]) => { const b = new Mesh(ballGeo, snowM); b.position.set(...from); b.castShadow = true; s.step.add(b); s.fly(b, [to.x, to.y, to.z], { T: 0.42, lift: 1.4, done: () => { b.parent?.remove(b); burst(to, ['#ffffff', '#e8f4ff'], 14, 1.6); done?.(); } }); };
  return { P, snowM, ticks, burst, snowball, tick: dt => ticks.forEach(f => f(dt)) };
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
