// Impacts: what makes a hit feel like a hit. Snow splats left on the ground where snowballs land
// (they fade after a few seconds), and a freeze that shatters: a burst of ice shards with a spin and
// a frosty ring rolling out over the snow. Everything is instanced (one draw call each), pooled and
// recycled, so a busy fight costs no more than a quiet one.
import {
  Group, InstancedMesh, Mesh, Object3D, PlaneGeometry, TetrahedronGeometry, RingGeometry, MeshBasicMaterial, MeshLambertMaterial,
  CanvasTexture, SRGBColorSpace, Color, Vector3,
} from 'three';

// a splat: a soft white blob with a few drops thrown out round it (drawn once, on a canvas)
function splatTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const blob = (x, y, r) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.98)'); gr.addColorStop(0.7, 'rgba(248,252,255,0.9)'); gr.addColorStop(1, 'rgba(240,248,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
  let seed = 7; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 9; k++) { const a = k / 9 * 6.283 + r() * 0.5, d = 10 + r() * 14; blob(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 16 + r() * 10); }
  blob(64, 64, 30);
  for (let k = 0; k < 10; k++) { const a = r() * 6.283, d = 36 + r() * 22; blob(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 3 + r() * 5); }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

export class ImpactFx {
  constructor(scene, { groundAt = () => 0, reduceMotion = false } = {}) {
    this.g = new Group(); scene.add(this.g); this.groundAt = groundAt; this.reduceMotion = reduceMotion; this.o = new Object3D(); this.v = new Vector3();
    // ground splats
    const pg = new PlaneGeometry(1, 1); pg.rotateX(-Math.PI / 2);
    this.splats = new InstancedMesh(pg, new MeshBasicMaterial({ map: splatTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 40);
    this.splats.count = 40; this.splats.renderOrder = 2; this.splats.frustumCulled = false; this.g.add(this.splats);
    this.sp = Array.from({ length: 40 }, () => ({ t: 1e9, life: 6, x: 0, y: -99, z: 0, s: 1, a: 0 })); this.si = 0;
    // ice shards
    this.shards = new InstancedMesh(new TetrahedronGeometry(0.17), new MeshLambertMaterial({ color: '#7fd3ff', emissive: new Color('#3aa8f0'), emissiveIntensity: 0.55 }), 80); // icy blue: they read on white snow
    this.shards.count = 80; this.shards.castShadow = false; this.shards.frustumCulled = false; this.g.add(this.shards);
    this.sh = Array.from({ length: 80 }, () => ({ t: 1e9, life: 0.9, p: new Vector3(0, -99, 0), v: new Vector3(), r: new Vector3(), w: new Vector3(), s: 1 })); this.hi = 0;
    // frost rings rolling out on the snow
    this.rings = Array.from({ length: 5 }, () => { const m = new Mesh(new RingGeometry(0.78, 1, 40), new MeshBasicMaterial({ color: '#7fd3ff', transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 3; this.g.add(m); return { m, t: 1e9 }; });
    this.ri = 0;
    this.flush(0);
  }
  splat(x, z, size = 1) {
    const s = this.sp[this.si = (this.si + 1) % this.sp.length];
    Object.assign(s, { t: 0, life: 5 + Math.random() * 2, x, z, y: this.groundAt(x, z) + 0.035 + this.si * 0.0004, s: size * (0.75 + Math.random() * 0.5), a: Math.random() * 6.283 });
  }
  shatter(x, y, z) {
    const n = this.reduceMotion ? 8 : 22, gy = this.groundAt(x, z);
    for (let k = 0; k < n; k++) {
      const s = this.sh[this.hi = (this.hi + 1) % this.sh.length], a = Math.random() * 6.283, u = 2.2 + Math.random() * 3.2;
      s.t = 0; s.life = 0.7 + Math.random() * 0.5; s.p.set(x, gy + y * (0.4 + Math.random() * 0.8), z);
      s.v.set(Math.cos(a) * u, 3 + Math.random() * 4, Math.sin(a) * u); s.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      s.w.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18); s.s = 0.6 + Math.random() * 0.9; s.gy = gy;
    }
    if (!this.reduceMotion) { const r = this.rings[this.ri = (this.ri + 1) % this.rings.length]; r.t = 0; r.m.position.set(x, gy + 0.06, z); r.m.visible = true; }
    for (let k = 0; k < 3; k++) this.splat(x + (Math.random() - 0.5) * 1.2, z + (Math.random() - 0.5) * 1.2, 1.3); // and the snow it leaves
  }
  onEvent(e) {
    if (e.type === 'splat' && !e.onChar && (e.y === undefined || e.y < 0.9)) this.splat(e.x, e.z, e.big ? 1.9 : 0.85);
    else if (e.type === 'splat' && e.wall) this.splat(e.x, e.z, 0.6); // the snow that slides down the wall
    if (e.type === 'freeze') this.shatter(e.x, 1.1, e.z);
  }
  update(dt) {
    let any = false;
    for (let i = 0; i < this.sp.length; i++) {
      const s = this.sp[i]; s.t += dt; const k = s.t / s.life;
      const sc = k >= 1 ? 0.0001 : s.s * Math.min(1, s.t * 14) * (k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1); // pops out, then melts away
      this.o.position.set(s.x, k >= 1 ? -99 : s.y, s.z); this.o.rotation.set(0, s.a, 0); this.o.scale.setScalar(sc); this.o.updateMatrix(); this.splats.setMatrixAt(i, this.o.matrix);
    }
    this.splats.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < this.sh.length; i++) {
      const s = this.sh[i]; if (s.t > s.life) { if (s.p.y > -50) { s.p.y = -99; this.o.position.copy(s.p); this.o.scale.setScalar(0.0001); this.o.updateMatrix(); this.shards.setMatrixAt(i, this.o.matrix); any = true; } continue; }
      s.t += dt; s.v.y -= 14 * dt; s.p.addScaledVector(s.v, dt); if (s.p.y < s.gy + 0.05) { s.p.y = s.gy + 0.05; s.v.multiplyScalar(0.45); s.v.y = Math.abs(s.v.y) * 0.4; s.w.multiplyScalar(0.6); } // a little bounce on the snow
      s.r.addScaledVector(s.w, dt); const k = s.t / s.life;
      this.o.position.copy(s.p); this.o.rotation.set(s.r.x, s.r.y, s.r.z); this.o.scale.setScalar(s.s * (k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1)); this.o.updateMatrix(); this.shards.setMatrixAt(i, this.o.matrix); any = true;
    }
    if (any) this.shards.instanceMatrix.needsUpdate = true;
    for (const r of this.rings) { if (!r.m.visible) continue; r.t += dt; const k = r.t / 0.55; if (k >= 1) { r.m.visible = false; continue; } r.m.scale.setScalar(0.4 + k * 2.6); r.m.material.opacity = 0.85 * (1 - k); }
  }
  flush() { this.update(0); }
}
