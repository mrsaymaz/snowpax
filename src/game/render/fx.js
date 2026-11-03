// Snowballs in flight, splat bursts, falling snow and the big-throw aiming arc.
import {
  InstancedMesh, SphereGeometry, MeshLambertMaterial, Object3D, BufferGeometry, Float32BufferAttribute, Points, PointsMaterial,
  CircleGeometry, MeshBasicMaterial, Line, LineDashedMaterial, Vector3, CanvasTexture, SRGBColorSpace, AdditiveBlending, Group,
} from 'three';
import { SIM } from '../sim.mjs';

function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

export class Fx {
  constructor(scene, quality) {
    this.scene = scene; this.group = new Group(); scene.add(this.group);
    this.o = new Object3D();
    this.balls = new InstancedMesh(new SphereGeometry(0.18, 10, 8), new MeshLambertMaterial({ color: '#ffffff', emissive: '#c8dcf0', emissiveIntensity: 0.25 }), 64);
    this.balls.castShadow = true; this.balls.count = 0; this.group.add(this.balls);
    this.shadows = new InstancedMesh(new CircleGeometry(0.2, 10), new MeshBasicMaterial({ color: '#5b7a99', transparent: true, opacity: 0.25, depthWrite: false }), 64);
    this.shadows.count = 0; this.group.add(this.shadows);

    // splat particles (pooled)
    this.maxP = 600; this.pp = new Float32Array(this.maxP * 3); this.pv = new Float32Array(this.maxP * 3); this.pl = new Float32Array(this.maxP); this.pi = 0;
    const pg = new BufferGeometry(); pg.setAttribute('position', new Float32BufferAttribute(this.pp, 3));
    this.particles = new Points(pg, new PointsMaterial({ size: 0.28, map: dotTexture(), transparent: true, depthWrite: false, color: '#ffffff' }));
    this.particles.frustumCulled = false; this.group.add(this.particles);
    this.pp.fill(-999);

    // falling snow around the camera target
    this.setSnow(quality.snow);

    // aiming arc for big snowballs
    const ag = new BufferGeometry(); ag.setAttribute('position', new Float32BufferAttribute(new Float32Array(32 * 3), 3));
    this.arc = new Line(ag, new LineDashedMaterial({ color: '#ffffff', dashSize: 0.4, gapSize: 0.25, transparent: true, opacity: 0.9, depthTest: false }));
    this.arc.visible = false; this.arc.renderOrder = 8; this.arc.frustumCulled = false; this.group.add(this.arc);
  }

  setSnow(count) {
    if (this.snow) { this.group.remove(this.snow); this.snow.geometry.dispose(); }
    this.snowN = count; this.snowBox = 60;
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { p[i * 3] = (Math.random() - 0.5) * this.snowBox; p[i * 3 + 1] = Math.random() * 30; p[i * 3 + 2] = (Math.random() - 0.5) * this.snowBox; }
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(p, 3));
    this.snow = new Points(g, new PointsMaterial({ size: 0.22, map: dotTexture(), transparent: true, depthWrite: false, opacity: 0.9 }));
    this.snow.frustumCulled = false; this.group.add(this.snow);
  }

  burst(x, y, z, n = 14, power = 3.5) {
    for (let k = 0; k < n; k++) {
      const i = this.pi = (this.pi + 1) % this.maxP;
      this.pp[i * 3] = x; this.pp[i * 3 + 1] = Math.max(0.1, y); this.pp[i * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2, u = Math.random();
      this.pv[i * 3] = Math.cos(a) * power * u; this.pv[i * 3 + 1] = 1.5 + Math.random() * power; this.pv[i * 3 + 2] = Math.sin(a) * power * u;
      this.pl[i] = 0.5 + Math.random() * 0.4;
    }
  }

  onEvent(e, chars) {
    if (e.type === 'splat') this.burst(e.x, e.y, e.z, e.big ? 30 : 12, e.big ? 5 : 3);
    if (e.type === 'poof') this.burst(e.x, e.y, e.z, 8, 1.2);
    if (e.type === 'shake') { const c = chars.find(o => o.id === e.id); if (c) this.burst(c.x, 1.2, c.z, 40, 4.5); }
    if (e.type === 'pickup') { const c = chars.find(o => o.id === e.id); if (c) this.burst(c.x, 0.3, c.z, 10, 2); }
    if (e.type === 'dodge') { const c = chars.find(o => o.id === e.id); if (c) this.burst(c.x, 0.2, c.z, 8, 1.5); }
  }

  showArc(from, to, on) {
    this.arc.visible = on; if (!on) return;
    const pos = this.arc.geometry.attributes.position, n = pos.count;
    const d = Math.hypot(to.x - from.x, to.z - from.z), peak = 1.2 + d * 0.18;
    for (let i = 0; i < n; i++) { const t = i / (n - 1); pos.setXYZ(i, from.x + (to.x - from.x) * t, 1.3 + 4 * peak * t * (1 - t) - 0.4 * t, from.z + (to.z - from.z) * t); }
    pos.needsUpdate = true; this.arc.computeLineDistances();
  }

  update(dt, balls, center) {
    const o = this.o;
    let k = 0;
    for (const b of balls) {
      if (k >= 64) break;
      const s = b.big ? 2.1 : 1;
      o.position.set(b.x, b.y, b.z); o.scale.setScalar(s); o.rotation.set(0, 0, 0); o.updateMatrix(); this.balls.setMatrixAt(k, o.matrix);
      o.position.set(b.x, 0.05, b.z); o.rotation.set(-Math.PI / 2, 0, 0); o.scale.setScalar(s * Math.max(0.4, 1 - b.y * 0.12)); o.updateMatrix(); this.shadows.setMatrixAt(k, o.matrix);
      k++;
    }
    this.balls.count = this.shadows.count = k;
    this.balls.instanceMatrix.needsUpdate = this.shadows.instanceMatrix.needsUpdate = true;

    // particles
    for (let i = 0; i < this.maxP; i++) {
      if (this.pl[i] <= 0) continue;
      this.pl[i] -= dt;
      if (this.pl[i] <= 0) { this.pp[i * 3 + 1] = -999; continue; }
      this.pv[i * 3 + 1] -= 14 * dt;
      this.pp[i * 3] += this.pv[i * 3] * dt; this.pp[i * 3 + 1] = Math.max(0.05, this.pp[i * 3 + 1] + this.pv[i * 3 + 1] * dt); this.pp[i * 3 + 2] += this.pv[i * 3 + 2] * dt;
    }
    this.particles.geometry.attributes.position.needsUpdate = true;

    // snowfall follows the camera target and wraps around
    const sp = this.snow.geometry.attributes.position.array, B = this.snowBox, t = performance.now() / 1000;
    for (let i = 0; i < this.snowN; i++) {
      let y = sp[i * 3 + 1] - dt * (2.2 + (i % 5) * 0.25);
      let x = sp[i * 3] + Math.sin(t * 0.7 + i) * dt * 0.6;
      if (y < 0) { y += 30; }
      // wrap x/z around the centre
      let rx = x - center.x, rz = sp[i * 3 + 2] - center.z;
      if (rx > B / 2) x -= B; else if (rx < -B / 2) x += B;
      if (rz > B / 2) sp[i * 3 + 2] -= B; else if (rz < -B / 2) sp[i * 3 + 2] += B;
      sp[i * 3] = x; sp[i * 3 + 1] = y;
    }
    this.snow.geometry.attributes.position.needsUpdate = true;
  }
}
