// Rival snowmen (the waves at the outposts): three snowballs with a coal face, a carrot nose and
// the rival team's scarf and hat. Shield snowmen carry a dustbin lid, sledders ride a little
// sled, lobbers carry a bucket of snowballs, the captain is big and wears a crown. Each type is
// one merged, vertex-coloured mesh; a small warmth bar floats above.
import { RingGeometry, Group, Mesh, MeshLambertMaterial, Object3D, Color, BufferAttribute, SphereGeometry, ConeGeometry, CylinderGeometry, TorusGeometry, BoxGeometry, CircleGeometry, MeshBasicMaterial, Sprite, SpriteMaterial, CanvasTexture, SRGBColorSpace } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../../config.js';
import { LOOK, toon, addRim, outlineMaterial } from './look.js';

function bake(parts) {
  const o = new Object3D();
  return mergeGeometries(parts.map(([geo, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx]) => {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()); for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
    o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); o.updateMatrix(); g.applyMatrix4(o.matrix);
    const c = new Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new BufferAttribute(a, 3)); return g;
  }));
}
const S = (r, a = 12, b = 9) => new SphereGeometry(r, a, b), W = '#fbfdff', COAL = '#1c2340';
const cache = new Map();
function shape(type, col, dark) {
  const key = type + col; if (cache.has(key)) return cache.get(key);
  const face = y => [[S(0.045, 6, 4), COAL, 0.1, y + 0.05, 0.27], [S(0.045, 6, 4), COAL, -0.1, y + 0.05, 0.27], [new ConeGeometry(0.06, 0.3, 7), '#f08a24', 0, y - 0.02, 0.38, Math.PI / 2], ...[-0.1, -0.035, 0.035, 0.1].map((x, k) => [S(0.025, 5, 4), COAL, x, y - 0.12 + Math.abs(x) * 0.4, 0.27])];
  const hat = y => [[new SphereGeometry(0.29, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), col, 0, y + 0.1, 0], [new TorusGeometry(0.27, 0.06, 6, 14), dark, 0, y + 0.12, 0, Math.PI / 2], [S(0.09, 8, 6), W, 0, y + 0.42, 0]];
  const arms = y => [[new CylinderGeometry(0.025, 0.03, 0.7, 5), '#6a4a3a', 0.5, y, 0, 0, 0, 1.1], [new CylinderGeometry(0.025, 0.03, 0.7, 5), '#6a4a3a', -0.5, y, 0, 0, 0, -1.1]];
  let parts;
  if (type === 'sledder') parts = [[new BoxGeometry(0.7, 0.08, 1.1), '#b9845a', 0, 0.12, 0], [new BoxGeometry(0.06, 0.06, 1.2), '#c8443c', 0.28, 0.04, 0], [new BoxGeometry(0.06, 0.06, 1.2), '#c8443c', -0.28, 0.04, 0], [S(0.42), W, 0, 0.52, 0], [S(0.3), W, 0, 1.0, 0], ...face(1.0), ...hat(1.18), [new TorusGeometry(0.22, 0.06, 6, 12), col, 0, 0.78, 0, Math.PI / 2], [new BoxGeometry(0.4, 0.1, 0.06), '#7cc4f0', 0, 1.1, 0.27]];
  else {
    const big = type === 'captain' ? 1.45 : 1;
    parts = [[S(0.5), W, 0, 0.46, 0], [S(0.37), W, 0, 1.08, 0], [S(0.29), W, 0, 1.58, 0], ...face(1.58), ...hat(1.7), ...arms(1.12), [new TorusGeometry(0.29, 0.075, 6, 14), col, 0, 1.33, 0, Math.PI / 2], [new BoxGeometry(0.14, 0.4, 0.06), col, 0.16, 1.15, 0.3, 0.2]];
    if (type === 'shield') parts.push([new CylinderGeometry(0.42, 0.42, 0.06, 16), '#9aa3b8', 0.15, 1.0, 0.5, Math.PI / 2], [new TorusGeometry(0.42, 0.03, 5, 16), '#6f7890', 0.15, 1.0, 0.53], [new BoxGeometry(0.2, 0.06, 0.06), '#6f7890', 0.15, 1.0, 0.56]);
    if (type === 'lobber') parts.push([new CylinderGeometry(0.2, 0.16, 0.32, 10, 1, true), '#e0463c', -0.42, 0.9, 0.2], [S(0.13, 8, 6), W, -0.42, 1.02, 0.2]);
    if (type === 'captain') parts.push([new CylinderGeometry(0.24, 0.3, 0.22, 8, 1, true), '#e8b84a', 0, 1.98, 0], ...[0, 1, 2, 3, 4, 5].map(k => [new ConeGeometry(0.05, 0.16, 5), '#e8b84a', Math.sin(k * 1.05) * 0.26, 2.14, Math.cos(k * 1.05) * 0.26]));
    if (big !== 1) { const g = bake(parts); g.scale(big, big, big); cache.set(key, g); return g; }
  }
  const g = bake(parts); cache.set(key, g); return g;
}

export class SnowmanView {
  constructor(c) {
    this.c = c; const team = CONFIG.teams[c.team] || { color: '#e0463c', dark: '#8a2a24' };
    this.root = new Group(); this.mat = LOOK.v2 ? addRim(toon({ vertexColors: true, emissive: new Color(0), transparent: true }), 0.25) : new MeshLambertMaterial({ vertexColors: true, emissive: new Color(0), transparent: true });
    this.body = new Mesh(shape(c.minion, team.color, team.dark), this.mat); this.body.castShadow = true; this.root.add(this.body);
    if (LOOK.v2) this.body.add(new Mesh(this.body.geometry, outlineMaterial(0.03))); // cartoon outline
    const sh = new Mesh(new CircleGeometry(0.55, 16), new MeshBasicMaterial({ color: '#4a6182', transparent: true, opacity: 0.3, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.03; this.root.add(sh);
    // a ring in the rival team's colour, so white snowmen stand out on white snow
    const ring = new Mesh(new RingGeometry(0.55, 0.7, 28), new MeshBasicMaterial({ color: team.color, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.renderOrder = 6; this.root.add(ring); this.ring = ring;
    this.body.scale.setScalar(1.3); this.size = 1.3;
    this.cv = document.createElement('canvas'); this.cv.width = 96; this.cv.height = 16; this.tex = new CanvasTexture(this.cv); this.tex.colorSpace = SRGBColorSpace;
    this.bar = new Sprite(new SpriteMaterial({ map: this.tex, depthTest: false, transparent: true })); this.bar.scale.set(1.0, 0.17, 1); this.bar.position.y = c.minion === 'captain' ? 4.3 : c.minion === 'sledder' ? 2.1 : 2.85; this.bar.renderOrder = 20; this.root.add(this.bar);
    this.last = -1; this.t = Math.random() * 6; this.spawnT = 0.4;
  }
  update(dt, groundY = 0) {
    const c = this.c; this.t += dt * (2 + c.moving * 2);
    this.root.position.set(c.x, groundY, c.z); this.body.rotation.y = c.face;
    const wob = c.minion === 'sledder' ? 0 : Math.sin(this.t * 2) * 0.08 * Math.min(1, c.moving);
    this.body.rotation.z = wob; this.body.position.y = Math.abs(Math.sin(this.t * 2)) * 0.06 * Math.min(1, c.moving);
    this.mat.emissive.setScalar(c.flash > 0 ? 0.6 : 0);
    this.spawnT = Math.max(0, this.spawnT - dt);
    const melt = c.frozen > 0 || c.thaw > 0 ? Math.max(0.05, 1 - (CONFIG.timing.frozenSeconds - c.frozen) / 1.2) : 1;
    const pop = 1 - this.spawnT / 0.4;
    const k = this.size * pop; this.body.scale.set(k * (melt < 1 ? 1 + (1 - melt) * 0.4 : 1), k * melt, k * (melt < 1 ? 1 + (1 - melt) * 0.4 : 1)); this.ring.visible = melt === 1;
    this.bar.visible = melt === 1;
    const f = Math.max(0, c.warmth / c.maxWarmth);
    if (Math.abs(f - this.last) > 0.01) { this.last = f; const g = this.cv.getContext('2d'); g.clearRect(0, 0, 96, 16); g.fillStyle = 'rgba(28,35,64,0.8)'; g.beginPath(); g.roundRect(0, 2, 96, 12, 6); g.fill(); g.fillStyle = f > 0.5 ? '#ff6b5e' : '#ffb03b'; g.beginPath(); g.roundRect(2, 4, 92 * f, 8, 4); g.fill(); this.tex.needsUpdate = true; }
  }
  dispose() { this.mat.dispose(); this.tex.dispose(); this.bar.material.dispose(); }
}
