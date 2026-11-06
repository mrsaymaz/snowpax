// The opening screen's pieces: the SnowPax logo (drawn at runtime, so it is crisp at any size and
// needs no font download), the live 3D hero (your own kid, turning slowly in the snow, dressed as
// you choose: girl or boy, your team's puffer, your snowball style's hat), and the lesson picker.
import {
  WebGLRenderer, Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, Group, Mesh, MeshLambertMaterial, MeshBasicMaterial,
  SphereGeometry, CircleGeometry, BufferGeometry, Float32BufferAttribute, Points, PointsMaterial, CanvasTexture, SRGBColorSpace, Box3,
} from 'three';
import { buildKid, bakeKid, setKidMood } from './render/kids2.js';
import { makeLook } from './looks.mjs';

// ---------- the logo ----------
// An icy tile with a snowball, then "Snow" in snow white and "Pax" in gold, chunky with a navy
// outline and a little depth, snow piled on every letter with a drip or two, and the byline.
export function drawLogo(canvas, { height = 64, byline = true } = {}) {
  const dpr = Math.min(3, devicePixelRatio || 1), fs = height * 0.74, tile = height * 0.92, gap = height * 0.16, ink = '#1c2340';
  const font = `900 ${fs}px "Arial Rounded MT Bold", "Nunito", ui-rounded, system-ui, sans-serif`;
  const m = document.createElement('canvas').getContext('2d'); m.font = font;
  const words = [['Snow', '#ffffff', '#cfe4ff'], ['Pax', '#ffd34d', '#f39a12']], wW = words.reduce((s, [w]) => s + m.measureText(w).width, 0);
  const W = Math.ceil(tile + gap + wW + fs * 0.3), H = Math.ceil(height * (byline ? 1.42 : 1.12));
  canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const g = canvas.getContext('2d'); g.scale(dpr, dpr); g.lineJoin = 'round'; g.lineCap = 'round';
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  // the tile: icy blue, a snowball with a shaded side and a shine, two sparkles
  const ty = height * 0.1, tg = g.createLinearGradient(0, ty, 0, ty + tile); tg.addColorStop(0, '#9fdcff'); tg.addColorStop(1, '#3f6fe0');
  g.fillStyle = ink; rr(0, ty + tile * 0.07, tile, tile, tile * 0.26); g.fill(); // the tile's depth
  g.fillStyle = tg; rr(0, ty, tile, tile, tile * 0.26); g.fill(); g.lineWidth = height * 0.055; g.strokeStyle = ink; g.stroke();
  const bx = tile * 0.5, by = ty + tile * 0.55, br = tile * 0.3;
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(bx, by, br, 0, 7); g.fill();
  g.fillStyle = '#cfe2fb'; g.beginPath(); g.arc(bx, by, br, 0.2, Math.PI * 0.95); g.arc(bx - br * 0.18, by - br * 0.2, br * 0.95, Math.PI * 0.95, 0.2, true); g.fill();
  g.lineWidth = height * 0.045; g.strokeStyle = ink; g.beginPath(); g.arc(bx, by, br, 0, 7); g.stroke();
  g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(bx - br * 0.38, by - br * 0.42, br * 0.2, br * 0.12, -0.6, 0, 7); g.fill();
  const spark = (x, y, r) => { g.strokeStyle = '#ffffff'; g.lineWidth = height * 0.035; for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; g.beginPath(); g.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke(); } };
  spark(tile * 0.8, ty + tile * 0.22, tile * 0.08); spark(tile * 0.2, ty + tile * 0.24, tile * 0.05);
  // the word: depth, outline, fill, then snow on top of every letter
  g.font = font; g.textBaseline = 'alphabetic';
  const base = ty + tile * 0.8, capH = m.measureText('H').actualBoundingBoxAscent || fs * 0.72, xH = m.measureText('x').actualBoundingBoxAscent || fs * 0.52;
  let x = tile + gap; const caps = [];
  for (const [w, c0, c1] of words) {
    g.lineWidth = fs * 0.2; g.strokeStyle = ink; g.fillStyle = ink; g.strokeText(w, x, base + fs * 0.08); g.fillText(w, x, base + fs * 0.08); // depth
    g.strokeText(w, x, base);
    const fg = g.createLinearGradient(0, base - capH, 0, base); fg.addColorStop(0, c0); fg.addColorStop(1, c1); g.fillStyle = fg; g.fillText(w, x, base);
    let cx = x; for (const ch of w) { const cw = m.measureText(ch).width; caps.push({ x: cx, w: cw, top: base - (ch === ch.toUpperCase() ? capH : xH) }); cx += cw; }
    x += m.measureText(w).width;
  }
  for (const [k, c] of caps.entries()) { // a snow cap on each letter, a drip on some
    const cx = c.x + c.w * 0.5, cw = c.w * 0.78, ch = fs * 0.15, y = c.top - ch * 0.15;
    g.fillStyle = '#ffffff'; g.strokeStyle = ink; g.lineWidth = height * 0.045;
    g.beginPath(); g.moveTo(cx - cw / 2, y + ch * 0.55);
    g.bezierCurveTo(cx - cw / 2, y - ch * 0.4, cx - cw * 0.1, y - ch * 0.55, cx, y - ch * 0.15);
    g.bezierCurveTo(cx + cw * 0.15, y - ch * 0.6, cx + cw / 2, y - ch * 0.35, cx + cw / 2, y + ch * 0.5);
    if (k % 3 === 1) { g.lineTo(cx + cw * 0.18, y + ch * 0.6); g.quadraticCurveTo(cx + cw * 0.1, y + ch * 1.5, cx + cw * 0.02, y + ch * 0.62); } // a drip
    g.quadraticCurveTo(cx, y + ch * 0.95, cx - cw / 2, y + ch * 0.55); g.closePath(); g.fill(); g.stroke();
  }
  if (byline) { g.font = `800 ${height * 0.17}px system-ui, sans-serif`; g.letterSpacing = `${height * 0.035}px`; g.fillStyle = ink; g.fillText('BY MR. SAYMAZ', tile + gap + 2, H - height * 0.04 + 1.5); g.fillStyle = '#e4edff'; g.fillText('BY MR. SAYMAZ', tile + gap + 1, H - height * 0.04); }
  return canvas;
}

// ---------- the hero: your kid in the snow ----------
export class Hero {
  constructor(canvas) {
    this.canvas = canvas; this.t = 0; this.alive = true; this.key = '';
    const r = this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true }); r.setClearColor(0x000000, 0); r.outputColorSpace = SRGBColorSpace;
    const s = this.scene = new Scene(), cam = this.camera = new PerspectiveCamera(32, 1, 0.1, 60);
    s.add(new HemisphereLight('#f2f4ff', '#8f86c4', 1.6)); const sun = new DirectionalLight('#ffe7c6', 1.6); sun.position.set(-3, 5, 4); s.add(sun);
    const rim = new DirectionalLight('#9fc4ff', 1.1); rim.position.set(3, 2.5, -3); s.add(rim);
    // a snowy mound to stand on, a soft shadow, falling snow
    const mound = new Mesh(new SphereGeometry(1.25, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), new MeshLambertMaterial({ color: '#f7f9ff' })); mound.scale.y = 0.16; s.add(mound);
    const sh = new Mesh(new CircleGeometry(0.55, 24), new MeshBasicMaterial({ color: '#5f6fa0', transparent: true, opacity: 0.22, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.205; s.add(sh);
    const n = 160, p = new Float32Array(n * 3); for (let k = 0; k < n; k++) { p[k * 3] = (Math.random() - 0.5) * 6; p[k * 3 + 1] = Math.random() * 4; p[k * 3 + 2] = (Math.random() - 0.5) * 3 - 0.5; }
    const fg = new BufferGeometry(); fg.setAttribute('position', new Float32BufferAttribute(p, 3));
    const ft = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); return new CanvasTexture(c); })();
    this.flakes = new Points(fg, new PointsMaterial({ size: 0.07, map: ft, transparent: true, depthWrite: false })); s.add(this.flakes);
    this.holder = new Group(); this.holder.position.y = 0.2; s.add(this.holder);
    this.resize(); this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas);
    let last = performance.now();
    const loop = now => { if (!this.alive) return; requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now; this.tick(dt); };
    requestAnimationFrame(loop);
  }
  // frame the kid: in a tall or square strip, the kid fills about 80% of its height in the middle;
  // in a wide area (landscape), about 60%, a little left of centre so the tagline has the right
  resize() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1, a = w / h, cam = this.camera; this.renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); this.renderer.setSize(w, h, false);
    // the kid's real height, measured: fill about 80% of a tall strip, 70% of a wide area, shifted left there (the tagline is on the right)
    const kh = (this.kidH || 1.9) + 0.25, wide = a > 1.05, fill = wide ? 0.7 : 0.8, vfov = cam.fov * Math.PI / 180, d = kh / fill / 2 / Math.tan(vfov / 2);
    const side = wide ? d * Math.tan(vfov / 2) * a * 0.42 : 0, cy = kh / 2 + 0.05;
    cam.aspect = a; cam.position.set(side, cy + 0.15, d); cam.lookAt(side, cy, 0); cam.updateProjectionMatrix();
  }
  // dress the kid: team (null: an everyday coat), gender, kit (the hat); a little hop when it changes
  set({ team = null, gender = 'girl', kit = 'thrower', look = null }) {
    const key = [team, gender, kit].join('|'); if (key === this.key) return; const first = !this.key; this.key = key;
    let s = gender === 'girl' ? 7 : 3; const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const lk = look && look.gender === gender ? look : makeLook(gender, rng);
    const kid = bakeKid(buildKid({ design: team ? 'puffer' : 'vinyl', team: team || 'neutral', kit, ...lk }));
    if (this.kid) this.holder.remove(this.kid); this.kid = kid; this.holder.add(kid); kid.scale.setScalar(1.08);
    { kid.updateMatrixWorld(true); const box = new Box3().setFromObject(kid); const hh = box.max.y - box.min.y; if (Math.abs(hh - (this.kidH || 0)) > 0.05) { this.kidH = hh; this.resize(); } }
    if (!first) { this.hop = 1; setKidMood(kid, 'joy'); clearTimeout(this.moodT); this.moodT = setTimeout(() => setKidMood(this.kid, 'happy'), 900); }
  }
  tick(dt) {
    this.t += dt; const t = this.t;
    if (this.kid) {
      this.hop = Math.max(0, (this.hop || 0) - dt * 1.8);
      this.kid.position.y = Math.abs(Math.sin(this.hop * Math.PI * 1.5)) * 0.32 * Math.min(1, this.hop * 2);
      this.holder.rotation.y = Math.sin(t * 0.45) * 0.42; // turning to show off the coat
      const a = this.kid.userData.arms; if (a) { a[0].rotation.x = this.hop > 0 ? -2.4 * Math.min(1, this.hop * 2) : Math.sin(t * 1.6) * 0.08; a[1].rotation.z = this.hop > 0 ? 0 : -0.25 - Math.max(0, Math.sin(t * 0.9)) * 0.5; } // a wave now and then
    }
    const fp = this.flakes.geometry.attributes.position.array; for (let k = 0; k < fp.length; k += 3) { fp[k + 1] -= dt * (0.25 + (k % 7) * 0.03); fp[k] += Math.sin(t + k) * dt * 0.08; if (fp[k + 1] < 0) fp[k + 1] += 4; } this.flakes.geometry.attributes.position.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }
  dispose() { this.alive = false; this.ro?.disconnect(); this.scene.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); this.renderer.dispose(); this.renderer.forceContextLoss?.(); }
}

// ---------- the lesson picker: grade tabs, the units of the grade ----------
const banks = new Map();
export async function unitsOf(grade) {
  if (!banks.has(grade)) banks.set(grade, fetch(`content/grade${grade}.json`).then(r => r.json()).then(b => b.units.map((u, i) => ({ id: u.id, title: u.title, n: i + 1 }))));
  return banks.get(grade);
}
export function lessonPicker(root, { current, onPick }) {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let grade = +(/^g(\d)/.exec(current)?.[1] || 5);
  const el = document.createElement('div'); el.className = 'lesson-sheet'; el.innerHTML = `<div class="ls-card" role="dialog" aria-label="Choose your lesson"><div class="ls-head"><b>Choose your lesson</b><button type="button" class="ls-x" aria-label="Close">✕</button></div><div class="ls-tabs">${[5, 6, 7, 8].map(gr => `<button type="button" data-g="${gr}">Grade ${gr}</button>`).join('')}</div><div class="ls-list"></div></div>`;
  root.appendChild(el);
  const draw = async () => {
    el.querySelectorAll('.ls-tabs button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.g === grade)));
    const list = el.querySelector('.ls-list'); list.innerHTML = '<p class="ls-wait">Loading…</p>';
    const units = await unitsOf(grade); if (!el.isConnected) return;
    list.innerHTML = units.map(u => `<button type="button" class="ls-unit" data-id="${u.id}" aria-pressed="${u.id === current}"><i>${u.n}</i><span><small>Grade ${grade} · Unit ${u.n}</small><b>${esc(u.title)}</b></span></button>`).join('');
  };
  el.addEventListener('click', e => {
    const tab = e.target.closest('[data-g]'), u = e.target.closest('.ls-unit');
    if (tab) { grade = +tab.dataset.g; draw(); }
    else if (u) { onPick(u.dataset.id); el.remove(); }
    else if (e.target === el || e.target.closest('.ls-x')) el.remove();
  });
  draw();
}
