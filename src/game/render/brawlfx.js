// Juice: snowballs with team-coloured trails, lob landing markers, the rolling super boulder,
// splat bursts, footstep puffs, aim indicators and floating damage numbers.
import {
  Group, InstancedMesh, Mesh, Object3D, SphereGeometry, IcosahedronGeometry, MeshLambertMaterial, MeshBasicMaterial, PlaneGeometry,
  CircleGeometry, RingGeometry, BufferGeometry, Float32BufferAttribute, Points, PointsMaterial, CanvasTexture, SRGBColorSpace, Color, Vector3,
} from 'three';
import { CONFIG } from '../../config.js';

function dot() {
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

export class BrawlFx {
  constructor(scene, layer, camera) {
    this.g = new Group(); scene.add(this.g); this.layer = layer; this.camera = camera; this.o = new Object3D();
    this.balls = new InstancedMesh(new SphereGeometry(0.22, 14, 10), new MeshLambertMaterial({ color: '#ffffff', emissive: new Color('#cfe6ff'), emissiveIntensity: 0.3 }), 96); this.balls.count = 0; this.balls.castShadow = true; this.g.add(this.balls);
    this.boulders = new InstancedMesh(new IcosahedronGeometry(1, 2), new MeshLambertMaterial({ color: '#ffffff', emissive: new Color('#bfe2ff'), emissiveIntensity: 0.25 }), 12); this.boulders.count = 0; this.boulders.castShadow = true; this.g.add(this.boulders);
    this.shadows = new InstancedMesh(new CircleGeometry(0.25, 14), new MeshBasicMaterial({ color: '#4a6182', transparent: true, opacity: 0.3, depthWrite: false }), 108); this.shadows.count = 0; this.g.add(this.shadows);
    this.marks = new InstancedMesh(new RingGeometry(0.75, 0.95, 28), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }), 24); this.marks.count = 0; this.g.add(this.marks);
    // particles: one pool, coloured per particle
    this.N = 900; this.pp = new Float32Array(this.N * 3).fill(-99); this.pc = new Float32Array(this.N * 3).fill(1); this.pv = new Float32Array(this.N * 3); this.pl = new Float32Array(this.N); this.ps = new Float32Array(this.N); this.pi = 0;
    const pg = new BufferGeometry(); pg.setAttribute('position', new Float32BufferAttribute(this.pp, 3)); pg.setAttribute('color', new Float32BufferAttribute(this.pc, 3));
    this.points = new Points(pg, new PointsMaterial({ size: 0.32, map: dot(), vertexColors: true, transparent: true, depthWrite: false })); this.points.frustumCulled = false; this.g.add(this.points);
    // aim indicators
    const lane = new PlaneGeometry(1, 1); lane.rotateX(-Math.PI / 2); lane.translate(0, 0, -0.5);
    this.aimLane = new Mesh(lane, new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false })); this.aimLane.visible = false; this.aimLane.renderOrder = 3; this.g.add(this.aimLane);
    this.aimFan = null; this.aimRing = new Mesh(new RingGeometry(0.9, 1.15, 32), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false })); this.aimRing.rotation.x = -Math.PI / 2; this.aimRing.visible = false; this.g.add(this.aimRing);
    this.nums = [];
    this.tmp = new Vector3();
  }

  emit(x, y, z, n, color, power = 3, life = 0.6, size = 1) {
    const col = new Color(color);
    for (let k = 0; k < n; k++) {
      const i = this.pi = (this.pi + 1) % this.N, a = Math.random() * 6.283, u = Math.random();
      this.pp[i * 3] = x; this.pp[i * 3 + 1] = y; this.pp[i * 3 + 2] = z;
      this.pv[i * 3] = Math.cos(a) * power * u; this.pv[i * 3 + 1] = 1 + Math.random() * power; this.pv[i * 3 + 2] = Math.sin(a) * power * u;
      this.pc[i * 3] = col.r; this.pc[i * 3 + 1] = col.g; this.pc[i * 3 + 2] = col.b; this.pl[i] = life * (0.6 + Math.random() * 0.6); this.ps[i] = size;
    }
  }

  number(x, z, text, kind = 'dmg') {
    const el = document.createElement('div'); el.className = 'fx-num ' + kind; el.textContent = text; this.layer.appendChild(el);
    this.nums.push({ el, x, z, y: 2.4, t: 0, life: kind === 'big' ? 1.3 : 0.85 });
  }

  onEvent(e, sim) {
    const color = e.team ? CONFIG.teams[e.team]?.color : '#ffffff';
    if (e.type === 'splat') this.emit(e.x, Math.max(0.2, e.y), e.z, e.big ? 34 : 14, e.onChar ? '#ffffff' : '#f2f8ff', e.big ? 5 : 3, 0.55);
    if (e.type === 'splat' && e.big) this.emit(e.x, 0.3, e.z, 12, color, 3, 0.5);
    if (e.type === 'poof') this.emit(e.x, e.y, e.z, 8, '#e3d9ff', 1.2, 0.5);
    // numbers and words only for what the student does or gets (calmer fights): everyone else's hits are just splats
    const mine = this.focusId == null || e.id === this.focusId || e.by === this.focusId;
    if (e.type === 'hit' && mine) this.number(e.x, e.z, '-' + e.dmg, sim.chars.find(c => c.id === e.id)?.side === 'home' ? 'dmg hurt' : 'dmg');
    if (e.type === 'freeze') { if (mine) this.number(e.x, e.z, 'FROZEN!', 'big'); this.emit(e.x, 1, e.z, 40, '#bfe8ff', 4, 0.9); }
    if (e.type === 'shake') { const c = sim.chars.find(o => o.id === e.id); if (c) this.emit(c.x, 1.2, c.z, 46, '#ffffff', 5, 0.8); }
    if (e.type === 'respawn') this.emit(e.x, 0.4, e.z, 24, '#fff4b8', 2.5, 0.7);
    if (e.type === 'pickup') { const c = sim.chars.find(o => o.id === e.id); if (c) this.emit(c.x, 0.4, c.z, 18, '#bfe2ff', 2.5, 0.6); }
    if (e.type === 'super') this.emit(e.x, 0.5, e.z, 30, '#ffe066', 4, 0.6);
    if (e.type === 'wallBreak' || e.type === 'wallMelt') this.emit(e.x, 0.6, e.z, 30, '#ffffff', 3.5, 0.7);
  }

  aim(kind, from, to, color, range, spreadDeg = 0) {
    this.aimLane.visible = this.aimRing.visible = false; if (this.aimFan) this.aimFan.visible = false;
    if (!kind) return;
    const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz) || 1, ang = Math.atan2(-dx, -dz);
    if (kind === 'lob') {
      const L = Math.min(d, range), tx = from.x + dx / d * L, tz = from.z + dz / d * L;
      this.aimRing.visible = true; this.aimRing.position.set(tx, 0.06, tz); this.aimRing.material.color.set(color);
      this.aimLane.visible = true; this.aimLane.position.set(from.x, 0.05, from.z); this.aimLane.rotation.y = ang; this.aimLane.scale.set(0.12, 1, L); this.aimLane.material.color.set(color);
    } else if (kind === 'spread') {
      if (!this.aimFan || this.aimFan.userData.key !== spreadDeg + '|' + range) {
        if (this.aimFan) this.g.remove(this.aimFan);
        const half = (spreadDeg * 1.6) * Math.PI / 180, geo = new CircleGeometry(range, 20, Math.PI / 2 - half, half * 2); geo.rotateX(-Math.PI / 2);
        this.aimFan = new Mesh(geo, new MeshBasicMaterial({ color, transparent: true, opacity: 0.32, depthWrite: false })); this.aimFan.userData.key = spreadDeg + '|' + range; this.aimFan.renderOrder = 3; this.g.add(this.aimFan);
      }
      this.aimFan.visible = true; this.aimFan.position.set(from.x, 0.05, from.z); this.aimFan.rotation.y = ang; this.aimFan.material.color.set(color);
    } else {
      this.aimLane.visible = true; this.aimLane.position.set(from.x, 0.05, from.z); this.aimLane.rotation.y = ang;
      this.aimLane.scale.set(kind === 'super' ? 1.6 : 0.5, 1, range); this.aimLane.material.color.set(kind === 'super' ? '#ffd23f' : color);
      this.aimLane.material.opacity = kind === 'super' ? 0.45 : 0.35;
    }
  }

  update(dt, sim) {
    const o = this.o; let b = 0, s = 0, bo = 0, mk = 0;
    for (const ball of sim.balls) {
      const team = CONFIG.teams[ball.team]?.color || '#ffffff';
      if (ball.kind === 'boulder') {
        if (bo < 12) { o.position.set(ball.x, ball.r, ball.z); o.rotation.set(sim.t * 8 * Math.sign(-ball.vz || 1), 0, sim.t * 8 * Math.sign(ball.vx || 1)); o.scale.setScalar(ball.r); o.updateMatrix(); this.boulders.setMatrixAt(bo++, o.matrix); }
        if (Math.random() < 0.7) this.emit(ball.x, 0.2, ball.z, 2, '#ffffff', 1.5, 0.5);
      } else if (b < 96) {
        o.position.set(ball.x, ball.y, ball.z); o.rotation.set(0, 0, 0); o.scale.setScalar(ball.kind === 'lob' ? 1.35 : 1); o.updateMatrix(); this.balls.setMatrixAt(b++, o.matrix);
        if (Math.random() < 0.85) this.emit(ball.x, ball.y, ball.z, 1, team, 0.25, 0.28, 0.8);
        if (ball.kind === 'lob' && mk < 24) { o.position.set(ball.x1, 0.06, ball.z1); o.rotation.set(-Math.PI / 2, 0, 0); o.scale.setScalar(ball.splash / 0.95); o.updateMatrix(); this.marks.setMatrixAt(mk++, o.matrix); }
      }
      if (s < 108) { o.position.set(ball.x, 0.04, ball.z); o.rotation.set(-Math.PI / 2, 0, 0); o.scale.setScalar(ball.kind === 'boulder' ? ball.r * 3.4 : Math.max(0.5, 1.1 - ball.y * 0.15)); o.updateMatrix(); this.shadows.setMatrixAt(s++, o.matrix); }
    }
    this.balls.count = b; this.boulders.count = bo; this.shadows.count = s; this.marks.count = mk;
    for (const m of [this.balls, this.boulders, this.shadows, this.marks]) m.instanceMatrix.needsUpdate = true;
    // footstep puffs
    for (const c of sim.chars) if (c.moving > 2 && !c.frozen && !(c.hidden && c.side === 'rival') && Math.random() < dt * 6) this.emit(c.x, 0.1, c.z, 1, '#ffffff', 0.6, 0.4);
    // particles
    for (let i = 0; i < this.N; i++) {
      if (this.pl[i] <= 0) continue;
      this.pl[i] -= dt; if (this.pl[i] <= 0) { this.pp[i * 3 + 1] = -99; continue; }
      this.pv[i * 3 + 1] -= 12 * dt;
      this.pp[i * 3] += this.pv[i * 3] * dt; this.pp[i * 3 + 1] = Math.max(0.05, this.pp[i * 3 + 1] + this.pv[i * 3 + 1] * dt); this.pp[i * 3 + 2] += this.pv[i * 3 + 2] * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.color.needsUpdate = true;
    // floating numbers
    const W = innerWidth, H = innerHeight;
    this.nums = this.nums.filter(n => {
      n.t += dt; if (n.t > n.life) { n.el.remove(); return false; }
      this.tmp.set(n.x, n.y + n.t * 1.6, n.z).project(this.camera);
      n.el.style.transform = `translate(${(this.tmp.x + 1) / 2 * W}px, ${(1 - this.tmp.y) / 2 * H}px) translate(-50%, -50%) scale(${n.t < 0.12 ? 0.6 + n.t * 4 : 1})`;
      n.el.style.opacity = String(Math.min(1, 2.5 * (1 - n.t / n.life)));
      return true;
    });
  }
}
