// Life in the snowed-in neighbourhood: seagulls that sit on roofs, lamps and the ferry and fly
// off when a kid runs close, street cats warming themselves by the chimneys (they watch you go
// by), footprints that stay in the snow for a while, and steam from tea glasses on the sills.
// Everything is instanced: a few draw calls in total, whatever the numbers.
import {
  Group, InstancedMesh, Mesh, MeshLambertMaterial, MeshBasicMaterial, ShaderMaterial, Object3D, Color, BufferAttribute, InstancedBufferAttribute,
  SphereGeometry, ConeGeometry, CapsuleGeometry, TorusGeometry, BoxGeometry, PlaneGeometry, CanvasTexture,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const rnd = (a, b = 0) => { let h = Math.imul((a * 73856093) ^ (b * 19349663), 2654435761); h ^= h >>> 13; h = Math.imul(h, 1597334677); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// bake simple parts into one vertex-coloured geometry: [geometry, colour, x, y, z, rx, ry, rz, sx, sy, sz]
function bake(parts) {
  const o = new Object3D();
  return mergeGeometries(parts.map(([geo, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx]) => {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()); for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
    o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); o.updateMatrix(); g.applyMatrix4(o.matrix);
    const c = new Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new BufferAttribute(a, 3)); return g;
  }));
}

export class WorldLife {
  constructor(scene, life, { low = false } = {}) {
    this.g = new Group(); scene.add(this.g); this.o = new Object3D(); this.time = 0;
    const mat = new MeshLambertMaterial({ vertexColors: true });

    // ---------- seagulls ----------
    const body = bake([
      [new SphereGeometry(0.12, 8, 6), '#f4f6fb', 0, 0, 0, 0, 0, 0, 1, 0.9, 1.9],
      [new SphereGeometry(0.085, 8, 6), '#ffffff', 0, 0.08, 0.2],
      [new ConeGeometry(0.025, 0.1, 5), '#f0a43a', 0, 0.07, 0.31, Math.PI / 2],
      [new ConeGeometry(0.07, 0.18, 5), '#9aa3b8', 0, 0.01, -0.27, -Math.PI / 2, 0, 0, 1, 1, 0.6],
      [new SphereGeometry(0.02, 4, 3), '#1c2340', 0.05, 0.11, 0.25], [new SphereGeometry(0.02, 4, 3), '#1c2340', -0.05, 0.11, 0.25],
    ]);
    const wing = bake([[new BoxGeometry(0.36, 0.02, 0.15), '#a9b1c6', 0.18, 0, 0], [new BoxGeometry(0.1, 0.021, 0.12), '#2f344a', 0.33, 0, -0.01]]); // pivot at the shoulder
    const perches = (life.perches || []).filter((p, k) => rnd(k, 11) < 0.55);
    this.perches = perches.map(p => ({ p, taken: false }));
    const n = low ? Math.min(10, this.perches.length) : Math.min(30, this.perches.length);
    this.gulls = [];
    for (let k = 0; k < n; k++) {
      const slot = this.perches[Math.floor(k * this.perches.length / n)]; slot.taken = true;
      this.gulls.push({ slot, x: slot.p[0], y: slot.p[1], z: slot.p[2], yaw: rnd(k, 5) * 6.28, state: 'sit', t: rnd(k, 7) * 4, vx: 0, vy: 0, vz: 0, flap: rnd(k, 9) * 6 });
    }
    this.gBody = new InstancedMesh(body, mat, Math.max(1, n)); this.gWingL = new InstancedMesh(wing, mat, Math.max(1, n)); this.gWingR = new InstancedMesh(wing, mat, Math.max(1, n));
    for (const m of [this.gBody, this.gWingL, this.gWingR]) { m.count = n; m.frustumCulled = false; m.castShadow = !low; this.g.add(m); }

    // ---------- cats by the chimneys ----------
    const cat = bake([
      [new CapsuleGeometry(0.085, 0.14, 3, 8), '#ffffff', 0, 0.09, 0, Math.PI / 2, 0, 0, 1, 1, 1],
      [new SphereGeometry(0.075, 8, 6), '#ffffff', 0, 0.17, 0.12],
      [new ConeGeometry(0.03, 0.06, 4), '#ffffff', 0.04, 0.24, 0.12], [new ConeGeometry(0.03, 0.06, 4), '#ffffff', -0.04, 0.24, 0.12],
      [new TorusGeometry(0.1, 0.022, 4, 8, Math.PI), '#ffffff', -0.02, 0.06, -0.12, Math.PI / 2, 0, 0.3],
      [new SphereGeometry(0.014, 4, 3), '#3d6b3a', 0.028, 0.185, 0.19], [new SphereGeometry(0.014, 4, 3), '#3d6b3a', -0.028, 0.185, 0.19],
    ]);
    this.catSpots = (life.cats || []).map(c => ({ c, used: false }));
    const cats = this.catSpots.filter((_, k) => k % Math.max(1, Math.floor(this.catSpots.length / (low ? 10 : 30))) === 0).slice(0, low ? 10 : 30);
    this.cats = cats.map(sp => { sp.used = true; const [x, y, z, yaw] = sp.c; return { spot: sp, x, y, z, yaw, base: yaw, look: 0 }; });
    this.catMesh = new InstancedMesh(cat, mat, Math.max(1, cats.length)); this.catMesh.count = cats.length;
    const FUR = ['#e39a4f', '#8d8fa0', '#3a3a46', '#f0e0c8', '#c9773a', '#f4f1ea'];
    this.cats.forEach((c, k) => this.catMesh.setColorAt(k, new Color(FUR[Math.floor(rnd(k, 3) * FUR.length)])));
    if (this.catMesh.instanceColor) this.catMesh.instanceColor.needsUpdate = true;
    this.g.add(this.catMesh); this.placeCats();

    // ---------- footprints: a ring buffer of soft prints that fade ----------
    this.FP = 420; this.fpI = 0; this.fpAge = new Float32Array(this.FP).fill(99);
    const fg = new PlaneGeometry(0.18, 0.28); fg.rotateX(-Math.PI / 2);
    this.fade = new InstancedBufferAttribute(new Float32Array(this.FP), 1); fg.setAttribute('fade', this.fade);
    this.prints = new InstancedMesh(fg, new ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: 'attribute float fade; varying float vF; varying vec2 vUv; void main() { vUv = uv; vF = fade; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying float vF; varying vec2 vUv; void main() { vec2 p = (vUv - 0.5) * vec2(2.0, 1.25); float heel = length(p - vec2(0.0, -0.22)); float toe = length((p - vec2(0.0, 0.18)) * vec2(1.0, 0.8)); float d = min(heel * 1.25, toe); float a = smoothstep(0.42, 0.3, d) * vF * 0.6; gl_FragColor = vec4(0.4, 0.42, 0.68, a); }',
    }), this.FP);
    this.prints.frustumCulled = false; this.prints.renderOrder = 1;
    for (let k = 0; k < this.FP; k++) { this.o.position.set(0, -5, 0); this.o.updateMatrix(); this.prints.setMatrixAt(k, this.o.matrix); }
    this.g.add(this.prints); this.walkers = new Map();

    // ---------- steam from tea glasses ----------
    const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new CanvasTexture(c); })();
    this.steamSrc = low ? [] : (life.steam || []).slice(0, 24);
    this.steam = new InstancedMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), Math.max(1, this.steamSrc.length * 3));
    this.steam.count = this.steamSrc.length * 3; this.steam.frustumCulled = false; this.g.add(this.steam);
  }

  // A few animals go a long way: gulls and cats far from the player quietly move closer
  // (gulls fly in from off screen; cats hop to a chimney out of view).
  gather(f) {
    const dist = (x, z) => Math.hypot(x - f.x, z - f.z);
    const gl = this.gulls.find(g => g.state === 'sit' && dist(g.x, g.z) > 30);
    if (gl) {
      const free = this.perches.filter(s => !s.taken && dist(s.p[0], s.p[2]) > 5 && dist(s.p[0], s.p[2]) < 16);
      if (free.length) {
        const s = free[Math.floor(rnd(free.length, this.time * 13 | 0) * free.length)], a = rnd(this.time * 7 | 0, 3) * 6.28;
        gl.slot.taken = false; gl.slot = s; s.taken = true; gl.state = 'land';
        gl.x = f.x + Math.sin(a) * 26; gl.z = f.z + Math.cos(a) * 26; gl.y = 9; gl.vx = gl.vz = 0; gl.vy = -1;
      }
    }
    const cat = this.cats.find(c => dist(c.x, c.z) > 26);
    if (cat) {
      const free = this.catSpots.filter(sp => !sp.used && dist(sp.c[0], sp.c[2]) > 13 && dist(sp.c[0], sp.c[2]) < 22);
      if (free.length) { const sp = free[Math.floor(rnd(free.length, this.time * 17 | 0) * free.length)]; cat.spot.used = false; sp.used = true; cat.spot = sp; [cat.x, cat.y, cat.z, cat.base] = sp.c; cat.yaw = cat.base; this.placeCats(); }
    }
  }

  placeCats() { this.cats.forEach((c, k) => { this.o.position.set(c.x, c.y, c.z); this.o.rotation.set(0, c.yaw, 0); this.o.scale.setScalar(1.25); this.o.updateMatrix(); this.catMesh.setMatrixAt(k, this.o.matrix); }); this.catMesh.instanceMatrix.needsUpdate = true; }

  // a footprint step for each walking kid
  step(c, dt) {
    let w = this.walkers.get(c.id); if (!w) { w = { x: c.x, z: c.z, side: 1 }; this.walkers.set(c.id, w); }
    if (c.frozen || c.thaw) { w.x = c.x; w.z = c.z; return; }
    const d = Math.hypot(c.x - w.x, c.z - w.z); if (d < 0.42) return;
    if (d > 2) { w.x = c.x; w.z = c.z; return; } // respawned or knocked back: no trail across the map
    const yaw = Math.atan2(c.x - w.x, c.z - w.z), k = this.fpI = (this.fpI + 1) % this.FP;
    w.side = -w.side; w.x = c.x; w.z = c.z;
    this.o.position.set(c.x + Math.cos(yaw) * 0.1 * w.side, 0.02, c.z - Math.sin(yaw) * 0.1 * w.side); this.o.rotation.set(0, yaw, 0); this.o.scale.setScalar(1); this.o.updateMatrix();
    this.prints.setMatrixAt(k, this.o.matrix); this.prints.instanceMatrix.needsUpdate = true; this.fpAge[k] = 0;
  }

  tick(dt, chars, camera, focus = null) {
    this.time += dt; const t = this.time, o = this.o;
    if (focus && (this._rt = (this._rt || 0) - dt) <= 0) { this._rt = 0.8; this.gather(focus); }
    // footprints fade over 14 s
    for (const c of chars) this.step(c, dt);
    for (let k = 0; k < this.FP; k++) { if (this.fpAge[k] > 14) { this.fade.array[k] = 0; continue; } this.fpAge[k] += dt; this.fade.array[k] = Math.max(0, 1 - this.fpAge[k] / 14); }
    this.fade.needsUpdate = true;

    // gulls
    const near = (x, z, r) => chars.some(c => !c.frozen && Math.hypot(c.x - x, c.z - z) < r);
    this.gulls.forEach((gl, k) => {
      gl.t -= dt;
      if (gl.state === 'sit') {
        if (near(gl.x, gl.z, 2.6)) { // startled: up and away from the nearest kid
          const c = chars.reduce((a, b) => (Math.hypot(b.x - gl.x, b.z - gl.z) < Math.hypot(a.x - gl.x, a.z - gl.z) ? b : a));
          const a = Math.atan2(gl.x - c.x, gl.z - c.z) + (rnd(k, t | 0) - 0.5); gl.state = 'fly'; gl.t = 4 + rnd(k, 3) * 4; gl.vx = Math.sin(a) * 3; gl.vz = Math.cos(a) * 3; gl.vy = 2.6; gl.slot.taken = false;
        } else if (gl.t < 0) { gl.t = 2 + rnd(k, t * 10 | 0) * 5; gl.yaw += (rnd(k, t | 0) - 0.5) * 2.5; } // shuffle round
      } else if (gl.state === 'fly') {
        gl.vy += (Math.min(5.5, gl.y) < 4.5 ? 1.2 : -1.0) * dt; gl.vy *= 0.98;
        const turn = 0.6 * dt, cs = Math.cos(turn), sn = Math.sin(turn), vx = gl.vx * cs - gl.vz * sn; gl.vz = gl.vx * sn + gl.vz * cs; gl.vx = vx; // a lazy circle
        if (gl.t < 0) { // find a quiet perch not far away
          const free = this.perches.filter(s => !s.taken && Math.hypot(s.p[0] - gl.x, s.p[2] - gl.z) < 22 && !near(s.p[0], s.p[2], 4));
          if (free.length) { gl.slot = free[Math.floor(rnd(k, t * 7 | 0) * free.length)]; gl.slot.taken = true; gl.state = 'land'; } else gl.t = 2;
        }
      } else { // gliding in to land
        const [px, py, pz] = gl.slot.p, dx = px - gl.x, dy = py - gl.y, dz = pz - gl.z, d = Math.hypot(dx, dy, dz);
        const sp = Math.min(3.2, 0.8 + d); gl.vx += (dx / d * sp - gl.vx) * dt * 2.5; gl.vy += (dy / d * sp - gl.vy) * dt * 2.5; gl.vz += (dz / d * sp - gl.vz) * dt * 2.5;
        if (d < 0.08) { gl.state = 'sit'; gl.x = px; gl.y = py; gl.z = pz; gl.vx = gl.vy = gl.vz = 0; gl.t = 3; }
        else if (near(px, pz, 2.6)) { gl.slot.taken = false; gl.state = 'fly'; gl.t = 3; }
      }
      if (gl.state !== 'sit') { gl.x += gl.vx * dt; gl.y += gl.vy * dt; gl.z += gl.vz * dt; gl.yaw = Math.atan2(gl.vx, gl.vz); }
      const flying = gl.state !== 'sit', flap = flying ? Math.sin(t * (gl.state === 'land' ? 9 : 13) + gl.flap) * 0.85 : -0.12, bob = flying ? 0 : Math.max(0, Math.sin(t * 3 + k)) * 0.01;
      o.position.set(gl.x, gl.y + bob, gl.z); o.rotation.set(flying ? -0.15 : 0, gl.yaw, 0); o.scale.setScalar(1.2); o.updateMatrix(); this.gBody.setMatrixAt(k, o.matrix);
      for (const [mesh, s] of [[this.gWingR, 1], [this.gWingL, -1]]) {
        o.position.set(gl.x + Math.cos(gl.yaw) * 0.07 * s, gl.y + bob + 0.05, gl.z - Math.sin(gl.yaw) * 0.07 * s);
        o.rotation.set(0, gl.yaw + (s < 0 ? Math.PI : 0), 0);
        if (!flying) o.rotateY(s * 1.35); // folded along the back
        o.rotateZ(flap);
        o.scale.setScalar(1.2); o.updateMatrix(); mesh.setMatrixAt(k, o.matrix);
      }
    });
    for (const m of [this.gBody, this.gWingL, this.gWingR]) m.instanceMatrix.needsUpdate = true;

    // cats turn their heads to watch a kid walk by (checked a few times a second)
    if ((this._ct = (this._ct || 0) - dt) <= 0) {
      this._ct = 0.25;
      let moved = false;
      for (const c of this.cats) {
        const kid = chars.find(ch => Math.hypot(ch.x - c.x, ch.z - c.z) < 4);
        const want = kid ? Math.atan2(kid.x - c.x, kid.z - c.z) : c.base + Math.sin(t * 0.2 + c.x) * 0.4;
        let d = want - c.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
        if (Math.abs(d) > 0.05) { c.yaw += d * 0.5; moved = true; }
      }
      if (moved) this.placeCats();
    }

    // tea steam: three soft wisps per glass
    if (camera && this.steamSrc.length) {
      this.steamSrc.forEach((s, k) => { for (let j = 0; j < 3; j++) { const a = ((t * 0.5 + j / 3 + rnd(k, j)) % 1); o.position.set(s[0] + Math.sin(t * 2 + j + k) * 0.04, s[1] + a * 0.5, s[2]); o.quaternion.copy(camera.quaternion); o.scale.setScalar(0.12 + a * 0.22); o.updateMatrix(); this.steam.setMatrixAt(k * 3 + j, o.matrix); } });
      this.steam.instanceMatrix.needsUpdate = true;
    }
  }
}
