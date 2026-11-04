// Life in the snowed-in neighbourhood: seagulls that sit on roofs, lamps and the ferry and fly
// off when a kid runs close, street cats warming themselves by the chimneys (they watch you go
// by), footprints that stay in the snow for a while, and steam from tea glasses on the sills.
// Also the things to collect (glowing snowflakes, hot-cocoa cups), streaks of powder blown by
// the poyraz wind, and little piles where snow fell off a roof.
// Everything is instanced: a few draw calls in total, whatever the numbers.
import {
  Group, InstancedMesh, Mesh, MeshLambertMaterial, MeshBasicMaterial, ShaderMaterial, Object3D, Color, BufferAttribute, InstancedBufferAttribute,
  SphereGeometry, ConeGeometry, CapsuleGeometry, TorusGeometry, BoxGeometry, PlaneGeometry, CanvasTexture, CylinderGeometry, Sprite, SpriteMaterial, SRGBColorSpace,
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
  constructor(scene, life, { low = false, ground = () => 0, pickups = [] } = {}) {
    this.ground = ground;
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

    // ---------- pickups: glowing snowflakes and hot-cocoa cups ----------
    this.pickups = pickups; this.flakes = pickups.filter(p => p.kind === 'flake'); this.cocoas = pickups.filter(p => p.kind === 'cocoa');
    const arm = new BoxGeometry(0.06, 0.5, 0.04), crystal = mergeGeometries([0, 1, 2].map(k => { const g2 = arm.clone(); g2.rotateZ(k * Math.PI / 3); return g2; }).concat([0, 1, 2, 3, 4, 5].map(k => { const g2 = new BoxGeometry(0.04, 0.14, 0.04); g2.rotateZ(0.6); g2.translate(0.04, 0.2, 0); g2.rotateZ(k * Math.PI / 3); return g2; })));
    this.flakeMesh = new InstancedMesh(crystal, new MeshBasicMaterial({ color: '#ffc93c' }), Math.max(1, this.flakes.length)); this.flakeMesh.count = this.flakes.length; this.flakeMesh.frustumCulled = false; this.g.add(this.flakeMesh);
    const haloTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g2 = c.getContext('2d'); const gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,214,110,0.95)'); gr.addColorStop(0.4, 'rgba(255,170,60,0.4)'); gr.addColorStop(1, 'rgba(255,150,40,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64); return new CanvasTexture(c); })();
    this.halo = new InstancedMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: 2 }), Math.max(1, this.flakes.length)); this.halo.count = this.flakes.length; this.halo.frustumCulled = false; this.halo.renderOrder = 4; this.g.add(this.halo);
    // each snowflake shows its English word on a little golden tag
    this.labels = this.flakes.map(p => {
      if (!p.word) return null;
      const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g2 = c.getContext('2d');
      g2.font = '900 34px system-ui, sans-serif'; const w = Math.min(244, g2.measureText(p.word.en).width + 28);
      g2.fillStyle = 'rgba(122,72,10,0.88)'; g2.beginPath(); g2.roundRect((256 - w) / 2, 6, w, 52, 18); g2.fill();
      g2.strokeStyle = '#ffd166'; g2.lineWidth = 3; g2.stroke();
      g2.fillStyle = '#fff6d6'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(p.word.en, 128, 33, 236);
      const tex = new CanvasTexture(c); tex.colorSpace = SRGBColorSpace;
      const sp = new Sprite(new SpriteMaterial({ map: tex, depthWrite: false, transparent: true })); sp.scale.set(1.6, 0.4, 1); sp.renderOrder = 5; this.g.add(sp); return sp;
    });
    const cup = bake([
      [new CylinderGeometry(0.16, 0.13, 0.3, 12), '#e0463c', 0, 0.15, 0], [new CylinderGeometry(0.162, 0.162, 0.06, 12), '#ffffff', 0, 0.2, 0],
      [new CylinderGeometry(0.14, 0.14, 0.02, 12), '#6b3b22', 0, 0.295, 0], [new SphereGeometry(0.07, 8, 6), '#fff6ea', 0.03, 0.31, 0.02],
      [new TorusGeometry(0.08, 0.025, 5, 10), '#e0463c', 0.17, 0.15, 0, 0, 0, 0], [new CylinderGeometry(0.3, 0.3, 0.04, 14), '#d9d2c4', 0, -0.02, 0],
    ]);
    this.cupMesh = new InstancedMesh(cup, mat, Math.max(1, this.cocoas.length)); this.cupMesh.count = this.cocoas.length; this.cupMesh.frustumCulled = false; this.g.add(this.cupMesh);
    this.cocoaSteam = new InstancedMesh(new PlaneGeometry(1, 1), this.steam.material, Math.max(1, this.cocoas.length * 3)); this.cocoaSteam.count = this.cocoas.length * 3; this.cocoaSteam.frustumCulled = false; this.g.add(this.cocoaSteam);

    // ---------- poyraz: streaks of powder racing over the snow ----------
    const streakTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 16; const g2 = c.getContext('2d'); const gr = g2.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g2.fillStyle = gr; g2.fillRect(0, 4, 64, 8); return new CanvasTexture(c); })();
    const sg = new PlaneGeometry(1, 1); sg.rotateX(-Math.PI / 2);
    this.SN = low ? 18 : 40; this.streakMat = new MeshBasicMaterial({ map: streakTex, transparent: true, depthWrite: false, opacity: 0 });
    this.streaks = new InstancedMesh(sg, this.streakMat, this.SN); this.streaks.frustumCulled = false; this.streaks.renderOrder = 3; this.g.add(this.streaks);
    this.streakP = Array.from({ length: this.SN }, (_, k) => ({ u: rnd(k, 51) * 30 - 15, v: rnd(k, 52) * 24 - 12, y: 0.12 + rnd(k, 53) * 0.5, len: 1.5 + rnd(k, 54) * 2.5 }));

    // ---------- snow that fell off a roof or a tree: soft piles that slowly settle ----------
    this.PN = 12; this.pileI = 0; this.piles = Array.from({ length: this.PN }, () => ({ t: 99, x: 0, z: 0 }));
    this.pileMesh = new InstancedMesh(new SphereGeometry(0.5, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), new MeshLambertMaterial({ color: '#fbfdff' }), this.PN); this.pileMesh.frustumCulled = false; this.g.add(this.pileMesh);
    for (let k = 0; k < this.PN; k++) { this.o.position.set(0, -9, 0); this.o.updateMatrix(); this.pileMesh.setMatrixAt(k, this.o.matrix); }
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
    this.o.position.set(c.x + Math.cos(yaw) * 0.1 * w.side, this.ground(c.x, c.z) + 0.19, c.z - Math.sin(yaw) * 0.1 * w.side); this.o.rotation.set(0, yaw, 0); this.o.scale.setScalar(1); this.o.updateMatrix();
    this.prints.setMatrixAt(k, this.o.matrix); this.prints.instanceMatrix.needsUpdate = true; this.fpAge[k] = 0;
  }

  pile(x, z) { const p = this.piles[this.pileI = (this.pileI + 1) % this.PN]; p.t = 0; p.x = x; p.z = z; }

  // wind: { wx, wz } from the simulation (0 when calm)
  tickExtras(dt, camera, focus, wind) {
    const t = this.time, o = this.o;
    // pickups bob and spin; taken ones hide
    this.flakes.forEach((p, k) => {
      const show = !p.taken, y = this.ground(p.x, p.z) + 0.75 + Math.sin(t * 2.2 + k) * 0.12;
      o.position.set(p.x, show ? y : -9, p.z); o.rotation.set(0, t * 1.6 + k, 0); o.scale.setScalar(1.25); o.updateMatrix(); this.flakeMesh.setMatrixAt(k, o.matrix);
      if (camera) { o.quaternion.copy(camera.quaternion); o.scale.setScalar(show ? 1.3 + Math.sin(t * 4 + k) * 0.15 : 0); o.updateMatrix(); this.halo.setMatrixAt(k, o.matrix); }
      const lb = this.labels[k]; if (lb) { lb.visible = show; lb.position.set(p.x, y + 0.7, p.z); }
    });
    this.flakeMesh.instanceMatrix.needsUpdate = true; this.halo.instanceMatrix.needsUpdate = true;
    this.cocoas.forEach((p, k) => {
      const show = !(p.cd > 0), gy = this.ground(p.x, p.z), y = gy + 0.25 + Math.sin(t * 1.8 + k) * 0.05;
      o.position.set(p.x, show ? y : -9, p.z); o.rotation.set(0, t * 0.8 + k, 0); o.scale.setScalar(1.5); o.updateMatrix(); this.cupMesh.setMatrixAt(k, o.matrix);
      if (camera) for (let j = 0; j < 3; j++) { const a = (t * 0.6 + j / 3) % 1; o.position.set(p.x + Math.sin(t * 2 + j) * 0.05, show ? y + 0.5 + a * 0.6 : -9, p.z); o.quaternion.copy(camera.quaternion); o.scale.setScalar(0.18 + a * 0.3); o.updateMatrix(); this.cocoaSteam.setMatrixAt(k * 3 + j, o.matrix); }
    });
    this.cupMesh.instanceMatrix.needsUpdate = true; this.cocoaSteam.instanceMatrix.needsUpdate = true;
    // powder streaks while the wind blows
    const ws = Math.hypot(wind.wx, wind.wz); this.streakMat.opacity = Math.min(0.9, ws * 0.45);
    if (ws > 0.02 && focus) {
      const ux = wind.wx / ws, uz = wind.wz / ws, yaw = Math.atan2(ux, uz) + Math.PI / 2;
      this.streakP.forEach((q, k) => {
        q.u += ws * 4 * dt; if (q.u > 15) { q.u -= 30; q.v = rnd(k, t * 10 | 0) * 24 - 12; }
        const x = focus.x + ux * q.u - uz * q.v, z = focus.z + uz * q.u + ux * q.v;
        o.position.set(x, this.ground(x, z) + q.y, z); o.rotation.set(0, yaw, 0); o.scale.set(q.len, 1, 0.38); o.updateMatrix(); this.streaks.setMatrixAt(k, o.matrix);
      });
      this.streaks.instanceMatrix.needsUpdate = true;
    }
    // piles settle over 10 s
    let dirty = false;
    this.piles.forEach((p, k) => { if (p.t > 10.5) return; p.t += dt; dirty = true; const s2 = p.t < 0.3 ? p.t / 0.3 : Math.max(0, 1 - (p.t - 7) / 3.5); o.position.set(p.x, p.t > 10.5 ? -9 : this.ground(p.x, p.z), p.z); o.rotation.set(0, k, 0); o.scale.set(1.2 * s2, 0.55 * s2, 1.0 * s2); o.updateMatrix(); this.pileMesh.setMatrixAt(k, o.matrix); });
    if (dirty) this.pileMesh.instanceMatrix.needsUpdate = true;
  }

  tick(dt, chars, camera, focus = null, wind = { wx: 0, wz: 0 }) {
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
    this.tickExtras(dt, camera, focus, wind);
  }
}
