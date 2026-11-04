// The Schoolyard Showdown, drawn: the circle in the schoolyard with its progress ring, five banner
// poles (one per outpost won) whose flags rise as the banners are raised, the school bell on its
// frame, and the giant snowball that rolls out at the rival captain.
import {
  Group, Mesh, MeshLambertMaterial, MeshStandardMaterial, MeshBasicMaterial, CylinderGeometry, SphereGeometry, RingGeometry, PlaneGeometry,
  BoxGeometry, TorusGeometry, CanvasTexture, SRGBColorSpace, DoubleSide, Color,
} from 'three';

function flagTex(name, color, dark) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160; const g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 256, 160);
  g.fillStyle = dark; g.fillRect(0, 128, 256, 32); for (let x = 0; x < 256; x += 32) { g.beginPath(); g.moveTo(x, 160); g.lineTo(x + 16, 136); g.lineTo(x + 32, 160); g.fill(); }
  g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(20,28,54,0.85)'; g.lineWidth = 8; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = 46; g.font = `900 ${fs}px system-ui, sans-serif`; while (g.measureText(name).width > 230 && fs > 24) { fs -= 3; g.font = `900 ${fs}px system-ui, sans-serif`; }
  g.strokeText(name, 128, 66); g.fillText(name, 128, 66);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

export class ShowdownView {
  constructor(scene, { color = '#f5b616', dark = '#8a5a00', groundY = () => 0, reduceMotion = false } = {}) {
    Object.assign(this, { scene, color, dark, groundY, reduceMotion });
    this.group = null; this.t = 0;
  }
  start(z, banners) {
    this.stop();
    const g = this.group = new Group(), y0 = this.groundY(z.x, z.z); g.position.set(z.x, y0, z.z); this.scene.add(g); this.z = z;
    // the circle and its fill (how far the banners are)
    const base = new Mesh(new RingGeometry(z.r - 0.2, z.r, 64), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false }));
    base.rotation.x = -Math.PI / 2; base.position.y = 0.05; g.add(base);
    this.fill = new Mesh(new RingGeometry(0.9, z.r - 0.22, 64, 1, Math.PI / 2, 0.001), new MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.35, depthWrite: false }));
    this.fill.rotation.x = -Math.PI / 2; this.fill.position.y = 0.04; g.add(this.fill); this.shownP = -1;
    // five banner poles round the back of the circle (north, so the camera sees them)
    const pole = new CylinderGeometry(0.06, 0.07, 3.2, 8), knob = new SphereGeometry(0.11, 10, 8), woodM = new MeshLambertMaterial({ color: '#6b4a32' }), goldM = new MeshStandardMaterial({ color: '#f2c14e', roughness: 0.35, metalness: 0.3 });
    this.flags = banners.map((b, k) => {
      const a = Math.PI + (k - (banners.length - 1) / 2) * 0.42, R = z.r + 1.5, x = Math.sin(a) * R, zz = Math.cos(a) * R;
      const p = new Mesh(pole, woodM); p.position.set(x, 1.6, zz); p.castShadow = true; g.add(p);
      const kn = new Mesh(knob, goldM); kn.position.set(x, 3.25, zz); g.add(kn);
      const mound = new Mesh(new SphereGeometry(0.35, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new MeshLambertMaterial({ color: '#f6f8ff' })); mound.position.set(x, 0, zz); g.add(mound);
      const cloth = new Mesh(new PlaneGeometry(1.15, 0.72, 8, 1), new MeshLambertMaterial({ map: flagTex(b.name, this.color, this.dark), side: DoubleSide, color: '#8790a8' }));
      cloth.position.set(x + 0.6, 0.55, zz); cloth.castShadow = true; g.add(cloth);
      cloth.userData = { up: false, y: 0.55, x, zz, base: cloth.geometry.attributes.position.array.slice() };
      return cloth;
    });
    // the school bell on a wooden frame behind the banners
    const bell = this.bell = new Group(); bell.position.set(0, 0, -(z.r + 3.3)); g.add(bell);
    for (const s of [-1, 1]) { const post = new Mesh(new BoxGeometry(0.22, 2.6, 0.22), woodM); post.position.set(s * 0.8, 1.3, 0); post.castShadow = true; bell.add(post); }
    const beam = new Mesh(new BoxGeometry(2.1, 0.24, 0.3), woodM); beam.position.y = 2.6; bell.add(beam);
    const roof = new Mesh(new CylinderGeometry(0.01, 1.35, 0.55, 4, 1), new MeshLambertMaterial({ color: '#a8453c' })); roof.position.y = 3.0; roof.rotation.y = Math.PI / 4; roof.scale.z = 0.5; bell.add(roof);
    const snowCap = new Mesh(new CylinderGeometry(0.01, 1.3, 0.25, 4, 1), new MeshLambertMaterial({ color: '#f6f8ff' })); snowCap.position.y = 3.2; snowCap.rotation.y = Math.PI / 4; snowCap.scale.z = 0.5; bell.add(snowCap);
    const swing = this.swing = new Group(); swing.position.y = 2.45; bell.add(swing);
    const cup = new Mesh(new CylinderGeometry(0.2, 0.45, 0.6, 18, 1, true), new MeshStandardMaterial({ color: '#f2c14e', roughness: 0.3, metalness: 0.45, side: DoubleSide })); cup.position.y = -0.38; cup.castShadow = true; swing.add(cup);
    const top = new Mesh(new SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), cup.material); top.position.y = -0.08; swing.add(top);
    const lip = new Mesh(new TorusGeometry(0.45, 0.04, 6, 20), cup.material); lip.rotation.x = Math.PI / 2; lip.position.y = -0.68; swing.add(lip);
    const clap = new Mesh(new SphereGeometry(0.08, 8, 6), new MeshLambertMaterial({ color: '#7a5a20' })); clap.position.y = -0.7; swing.add(clap);
    this.ringT = 0;
  }
  raise(k) { const f = this.flags?.[k]; if (!f) return; f.userData.up = true; f.material.color.set('#ffffff'); }
  giantBall(from, to, seconds) {
    if (!this.group) return;
    const m = this.ball = new Mesh(new SphereGeometry(1.25, 28, 18), new MeshLambertMaterial({ color: '#fbfdff', emissive: new Color('#9fc4ff'), emissiveIntensity: 0.15 }));
    m.castShadow = true; this.scene.add(m);
    this.ballRun = { from, to, T: seconds, t: 0 };
  }
  burst(at) { this.burstAt = { x: at.x, z: at.z, t: 0 }; }
  ring() { this.ringT = 2.6; }
  stop() {
    if (this.group) { this.scene.remove(this.group); this.group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.map?.dispose(); } }); this.group = null; }
    if (this.ball) { this.scene.remove(this.ball); this.ball.geometry.dispose(); this.ball = null; }
    this.flags = null; this.ballRun = null;
  }
  tick(dt) {
    if (!this.group) return;
    this.t += dt; const z = this.z;
    // fill: how far the banners are
    const p = Math.max(0, z.progress || 0);
    if (Math.abs(p - this.shownP) > 0.004) { this.shownP = p; this.fill.geometry.dispose(); this.fill.geometry = new RingGeometry(0.9, z.r - 0.22, 64, 1, Math.PI / 2, Math.max(0.001, p * Math.PI * 2)); }
    // flags rise and wave
    for (const f of this.flags) {
      const u = f.userData, target = u.up ? 2.65 : 0.55; u.y += (target - u.y) * Math.min(1, dt * 2.2); f.position.y = u.y;
      if (!this.reduceMotion) { const a = f.geometry.attributes.position, b = u.base, amp = u.up ? 0.09 : 0.02; for (let i = 0; i < a.count; i++) { const x = b[i * 3] + 0.575; a.array[i * 3 + 2] = b[i * 3 + 2] + Math.sin(this.t * 6 - x * 4) * amp * x; } a.needsUpdate = true; }
    }
    // the bell swings while it rings
    if (this.ringT > 0) { this.ringT -= dt; this.swing.rotation.z = Math.sin(this.t * 9) * 0.55 * Math.min(1, this.ringT); } else this.swing.rotation.z *= 0.9;
    // the giant snowball rolls, growing a little, then bursts
    const r = this.ballRun;
    if (r && this.ball) {
      r.t += dt; const k = Math.min(1, r.t / r.T), e = k * k * (3 - 2 * k), x = r.from.x + (r.to.x - r.from.x) * e, zz = r.from.z + (r.to.z - r.from.z) * e;
      const s = 0.8 + 0.4 * k; this.ball.scale.setScalar(s); this.ball.position.set(x, this.groundY(x, zz) + 1.25 * s, zz);
      const dir = Math.atan2(r.to.x - r.from.x, r.to.z - r.from.z); this.ball.rotation.set(r.t * 7, dir, 0, 'YXZ');
      if (k >= 1) { this.scene.remove(this.ball); this.ball.geometry.dispose(); this.ball = null; this.ballRun = null; }
    }
  }
}
