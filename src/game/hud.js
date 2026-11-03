// HUD: mini-map (tap to travel), big map (M), edge arrows to off-screen rivals and the next
// outpost, ammo and charge on the throw button, short coach lines from Mr. Saymaz.
// The maps are turned to match the isometric view: up on the map is up on the screen.
import { CONFIG } from '../config.js';
import { emblemSVG } from '../emblems.js';

const SQ = Math.SQRT1_2;
// world offset (dx, dz) → map offset (u right, v down), matching the camera (looking north-west)
const toMap = (dx, dz) => [(dx - dz) * SQ, (dx + dz) * SQ];
const fromMap = (u, v) => [(u + v) * SQ, (v - u) * SQ];

export class Hud {
  constructor(root, arena, { onTravel, onPause }) {
    this.root = root; this.arena = arena; this.onTravel = onTravel;
    this.mini = root.querySelector('#minimap'); this.big = root.querySelector('#bigmap'); this.bigWrap = root.querySelector('#bigmap-wrap');
    this.arrows = root.querySelector('#arrows'); this.coach = root.querySelector('#coach'); this.toastEl = root.querySelector('#toast');
    this.ammoEl = root.querySelector('#ammo'); this.chargeEl = root.querySelector('#charge'); this.throwBtn = root.querySelector('#throw');
    this.miniRange = 70; // world units shown across the mini-map's half width
    this.prerender();
    const tapMap = (canvas, toWorld) => canvas.addEventListener('pointerup', e => {
      e.stopPropagation(); const r = canvas.getBoundingClientRect(); const w = toWorld(e.clientX - r.left, e.clientY - r.top, r.width, r.height); if (w) onTravel(w);
    });
    for (const c of [this.mini, this.big]) c.addEventListener('pointerdown', e => e.stopPropagation());
    tapMap(this.mini, (x, y, w, h) => { const s = (w / 2) / this.miniRange, [dx, dz] = fromMap((x - w / 2) / s, (y - h / 2) / s); return { x: this.center.x + dx, z: this.center.z + dz }; });
    tapMap(this.big, (x, y, w, h) => { const s = this.bigScale(w, h), [dx, dz] = fromMap((x - w / 2) / s, (y - h / 2) / s); this.toggleMap(false); return { x: dx, z: dz }; });
    root.querySelector('#pause').addEventListener('click', e => { e.stopPropagation(); onPause(); });
    root.querySelector('#map-btn')?.addEventListener('click', e => { e.stopPropagation(); this.toggleMap(); });
    this.bigWrap.addEventListener('pointerup', e => { if (e.target === this.bigWrap) this.toggleMap(false); });
    this.center = { x: 0, z: 0 }; this.toastT = 0; this.coachT = 0; this.arrowEls = new Map();
  }

  // Draw the whole arena once into an offscreen canvas, in map orientation.
  prerender() {
    const A = this.arena, H = A.half, k = 1.6, size = Math.ceil(2 * H * Math.SQRT2 * k);
    const c = this.map = document.createElement('canvas'); c.width = c.height = size; this.mapK = k;
    const g = c.getContext('2d'), P = (x, z) => { const [u, v] = toMap(x, z); return [size / 2 + u * k, size / 2 + v * k]; };
    g.fillStyle = '#e9f1f8'; g.fillRect(0, 0, size, size);
    const poly = (flat, fill) => { g.beginPath(); for (let i = 0; i < flat.length; i += 2) { const [x, y] = P(flat[i], flat[i + 1]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.fillStyle = fill; g.fill(); };
    for (const a of A.areas) poly(a.p, { park: '#cfe8cc', pitch: '#c6e4c4', playground: '#d8ecc8', wood: '#bcdcb8', cemetery: '#dcd4c6', schoolyard: '#f3e2b4', ourYard: '#ffd76a' }[a.k] || '#ddd');
    g.lineCap = g.lineJoin = 'round';
    for (const r of A.roads) { g.beginPath(); for (let i = 0; i < r.p.length; i += 2) { const [x, y] = P(r.p[i], r.p[i + 1]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(1.5, r.w * k); g.stroke(); }
    for (const b of A.buildings) poly(b.p, b.k === 'ourSchool' ? '#e5383b' : b.k === 'worship' ? '#b9b0d6' : '#b9c6d3');
    for (const z of A.zones) { if (z.c) { const [x, y] = P(z.c[0], z.c[1]); g.beginPath(); g.arc(x, y, z.r * k, 0, 7); g.fillStyle = 'rgba(150,120,210,0.18)'; g.fill(); } }
  }
  bigScale(w, h) { return Math.min(w, h) / (2 * this.arena.half * Math.SQRT2); }

  drawMini(chars, player, places) {
    const c = this.mini, dpr = Math.min(2, devicePixelRatio || 1), W = c.clientWidth, Hh = c.clientHeight;
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(Hh * dpr); }
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.center = { x: player.x, z: player.z };
    const s = (W / 2) / this.miniRange, [pu, pv] = toMap(player.x, player.z), k = this.mapK, size = this.map.width;
    g.save(); g.beginPath(); g.arc(W / 2, Hh / 2, W / 2 - 1, 0, 7); g.clip();
    g.drawImage(this.map, size / 2 + pu * k - (W / 2) / s * k, size / 2 + pv * k - (Hh / 2) / s * k, (W / s) * k, (Hh / s) * k, 0, 0, W, Hh);
    const dot = (x, z, color, r, ring) => { const [u, v] = toMap(x - player.x, z - player.z); g.beginPath(); g.arc(W / 2 + u * s, Hh / 2 + v * s, r, 0, 7); g.fillStyle = color; g.fill(); if (ring) { g.lineWidth = 2; g.strokeStyle = ring; g.stroke(); } };
    for (const pl of places) dot(pl.x, pl.z, pl.kind === 'base' ? '#e5383b' : '#ffffff', 6, '#1b3a5c');
    for (const o of chars) if (!o.frozen) dot(o.x, o.z, CONFIG.teams[o.team].color, o === player ? 5 : 4, o === player ? '#ffffff' : o.side === 'rival' ? '#1b3a5c' : null);
    g.restore();
    g.beginPath(); g.arc(W / 2, Hh / 2, W / 2 - 1, 0, 7); g.lineWidth = 2; g.strokeStyle = 'rgba(27,58,92,0.6)'; g.stroke();
    if (!this.bigWrap.hidden) this.drawBig(chars, player, places);
  }

  drawBig(chars, player, places) {
    const c = this.big, dpr = Math.min(2, devicePixelRatio || 1), W = c.clientWidth, Hh = c.clientHeight;
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(Hh * dpr); }
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = this.bigScale(W, Hh), size = this.map.width, k = this.mapK;
    g.clearRect(0, 0, W, Hh);
    g.drawImage(this.map, W / 2 - (size / 2) / k * s, Hh / 2 - (size / 2) / k * s, (size / k) * s, (size / k) * s);
    const P = (x, z) => { const [u, v] = toMap(x, z); return [W / 2 + u * s, Hh / 2 + v * s]; };
    g.font = 'bold 15px system-ui, sans-serif'; g.textAlign = 'center';
    for (const pl of places) { const [x, y] = P(pl.x, pl.z); g.beginPath(); g.arc(x, y, 8, 0, 7); g.fillStyle = pl.kind === 'base' ? '#e5383b' : '#ffffff'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#1b3a5c'; g.stroke(); g.fillStyle = '#1b3a5c'; g.fillText(pl.label, x, y - 14); }
    for (const o of chars) { if (o.frozen) continue; const [x, y] = P(o.x, o.z); g.beginPath(); g.arc(x, y, o === player ? 7 : 5, 0, 7); g.fillStyle = CONFIG.teams[o.team].color; g.fill(); if (o === player) { g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke(); } }
  }
  toggleMap(on = this.bigWrap.hidden) { this.bigWrap.hidden = !on; }

  // Arrows at the screen edges for rivals and the outpost that are off screen.
  arrowsFor(items) {
    const seen = new Set(), W = innerWidth, H = innerHeight, m = 34;
    for (const it of items) {
      seen.add(it.key);
      let el = this.arrowEls.get(it.key);
      if (!it.off) { if (el) el.style.display = 'none'; continue; }
      if (!el) {
        el = document.createElement('div'); el.className = 'edge-arrow' + (it.kind === 'outpost' ? ' outpost' : '');
        el.innerHTML = it.kind === 'outpost' ? '<span class="tip"></span><span class="ico">⚑</span>' : `<span class="tip"></span><span class="ico">${emblemSVG(it.team, 22)}</span>`;
        if (it.color) el.style.setProperty('--c', it.color);
        this.arrows.appendChild(el); this.arrowEls.set(it.key, el);
      }
      const cx = W / 2, cy = H / 2, dx = it.sx - cx, dy = it.sy - cy, t = Math.min((W / 2 - m) / Math.abs(dx || 1e-6), (H / 2 - m) / Math.abs(dy || 1e-6));
      el.style.display = 'block';
      el.style.transform = `translate(${cx + dx * t - 18}px, ${cy + dy * t - 18}px)`;
      el.querySelector('.tip').style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    }
    for (const [k, el] of this.arrowEls) if (!seen.has(k)) el.style.display = 'none';
  }

  setAmmo(n, max, charge, inZone) {
    this.ammoEl.textContent = n;
    this.throwBtn.classList.toggle('empty', n === 0);
    this.throwBtn.classList.toggle('quiet', inZone);
    this.chargeEl.style.setProperty('--p', Math.round(charge * 100));
    this.chargeEl.classList.toggle('full', charge >= 1);
  }

  say(text, seconds = 5) { this.coach.querySelector('.line').textContent = text; this.coach.hidden = false; this.coachT = seconds; }
  toast(text, seconds = 1.8) { this.toastEl.textContent = text; this.toastEl.hidden = false; this.toastT = seconds; }
  tick(dt) {
    if ((this.coachT -= dt) <= 0) this.coach.hidden = true;
    if ((this.toastT -= dt) <= 0) this.toastEl.hidden = true;
  }
}
