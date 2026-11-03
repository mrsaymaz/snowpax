// Controls for the arena.
// Touch: floating move stick on the left half · Throw button (tap = auto-aim at the nearest
// rival, drag = aim yourself, release = throw) · Super button (same, when charged) · in
// Relaxed pace a quick tap on the snow walks there.
// Computer: WASD/arrows move · mouse aims · left click throws · right click or Q/E = super ·
// Space dodges · Esc pauses.
const JOY_R = 58, DEAD = 16;

export class Sticks {
  constructor({ surface, attackBtn, superBtn, joyBase, joyKnob, groundAt, onTapGround, onKey, tapToMove }) {
    Object.assign(this, { surface, attackBtn, superBtn, joyBase, joyKnob, groundAt, onTapGround, onKey, tapToMove });
    this.keys = new Set(); this.move = null; this.aim = null; this.mouse = null; this.mouseDown = null; this.taps = new Map();
    this.pending = { attack: null, super: null, dodge: null };
    this.usedTouch = false;
    this.bind();
  }

  bind() {
    const s = this.surface;
    s.addEventListener('pointerdown', e => this.down(e));
    addEventListener('pointermove', e => this.moveEv(e));
    addEventListener('pointerup', e => this.up(e));
    addEventListener('pointercancel', e => this.up(e, true));
    s.addEventListener('contextmenu', e => e.preventDefault());
    for (const [btn, kind] of [[this.attackBtn, 'attack'], [this.superBtn, 'super']]) {
      btn.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation(); this.usedTouch = e.pointerType !== 'mouse' || this.usedTouch;
        const r = btn.getBoundingClientRect();
        this.aim = { id: e.pointerId, kind, cx: r.left + r.width / 2, cy: r.top + r.height / 2, x: e.clientX, y: e.clientY, btn };
        btn.classList.add('pressed');
      });
      btn.addEventListener('contextmenu', e => e.preventDefault());
    }
    addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (k === ' ' && !e.repeat) this.pending.dodge = true;
      if ((k === 'q' || k === 'e') && !e.repeat) this.pending.super = { mouse: true };
      if (k === 'escape' && !e.repeat) this.onKey?.('pause');
      this.keys.add(k);
    });
    addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => { this.keys.clear(); this.move = null; this.aim = null; this.showJoy(false); });
  }

  down(e) {
    if (e.pointerType === 'mouse') {
      this.mouse = { x: e.clientX, y: e.clientY };
      if (e.button === 0) this.pending.attack = { mouse: true };
      if (e.button === 2) this.pending.super = { mouse: true };
      return;
    }
    this.usedTouch = true;
    if (e.clientX < innerWidth / 2 && !this.move) this.move = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), moved: false };
    else this.taps.set(e.pointerId, { x: e.clientX, y: e.clientY, t0: performance.now() });
  }

  moveEv(e) {
    if (e.pointerType === 'mouse') this.mouse = { x: e.clientX, y: e.clientY };
    if (this.move && e.pointerId === this.move.id) {
      this.move.x = e.clientX; this.move.y = e.clientY;
      if (!this.move.moved && Math.hypot(this.move.x - this.move.ox, this.move.y - this.move.oy) > 10) { this.move.moved = true; this.showJoy(true); }
      this.drawJoy();
    }
    if (this.aim && e.pointerId === this.aim.id) { this.aim.x = e.clientX; this.aim.y = e.clientY; this.drawAimKnob(); }
  }

  up(e, cancelled = false) {
    const now = performance.now();
    if (this.aim && e.pointerId === this.aim.id) {
      const a = this.aim; this.aim = null; a.btn.classList.remove('pressed'); a.btn.querySelector('.knob')?.style.removeProperty('transform');
      if (!cancelled) {
        const dx = a.x - a.cx, dy = a.y - a.cy, d = Math.hypot(dx, dy);
        this.pending[a.kind] = d < DEAD ? { auto: true } : { sx: dx / d, sy: -dy / d, mag: Math.min(1, (d - DEAD) / (JOY_R * 1.1)) };
      }
      return;
    }
    if (this.move && e.pointerId === this.move.id) {
      const tap = !this.move.moved && now - this.move.t0 < 260;
      if (tap && !cancelled && this.tapToMove) this.tapGround(e.clientX, e.clientY);
      this.move = null; this.showJoy(false); return;
    }
    const t = this.taps.get(e.pointerId); this.taps.delete(e.pointerId);
    if (t && !cancelled && this.tapToMove && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 12 && now - t.t0 < 260) this.tapGround(e.clientX, e.clientY);
  }

  tapGround(x, y) { const p = this.groundAt(x, y); if (p) this.onTapGround?.(p); }
  showJoy(on) { this.joyBase.style.display = this.joyKnob.style.display = on ? 'block' : 'none'; if (on) this.drawJoy(); }
  drawJoy() {
    const j = this.move; if (!j) return;
    let dx = j.x - j.ox, dy = j.y - j.oy; const d = Math.hypot(dx, dy); if (d > JOY_R) { dx *= JOY_R / d; dy *= JOY_R / d; }
    this.joyBase.style.transform = `translate(${j.ox - 62}px, ${j.oy - 62}px)`;
    this.joyKnob.style.transform = `translate(${j.ox + dx - 28}px, ${j.oy + dy - 28}px)`;
  }
  drawAimKnob() {
    const a = this.aim, k = a.btn.querySelector('.knob'); if (!k) return;
    let dx = a.x - a.cx, dy = a.y - a.cy; const d = Math.hypot(dx, dy), R = a.btn.clientWidth * 0.32; if (d > R) { dx *= R / d; dy *= R / d; }
    k.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  read() {
    let sx = 0, sy = 0;
    if (this.move && this.move.moved) {
      const dx = this.move.x - this.move.ox, dy = this.move.y - this.move.oy, d = Math.hypot(dx, dy), mag = Math.min(1, Math.max(0, (d - 6) / (JOY_R - 6)));
      if (d > 0) { sx = dx / d * mag; sy = -dy / d * mag; }
    }
    const k = this.keys;
    if (k.has('a') || k.has('arrowleft')) sx -= 1; if (k.has('d') || k.has('arrowright')) sx += 1;
    if (k.has('w') || k.has('arrowup')) sy += 1; if (k.has('s') || k.has('arrowdown')) sy -= 1;
    let aiming = null;
    if (this.aim) { const dx = this.aim.x - this.aim.cx, dy = this.aim.y - this.aim.cy, d = Math.hypot(dx, dy); aiming = d < DEAD ? { kind: this.aim.kind, auto: true } : { kind: this.aim.kind, sx: dx / d, sy: -dy / d, mag: Math.min(1, (d - DEAD) / (JOY_R * 1.1)) }; }
    const out = { sx, sy, attack: this.pending.attack, super: this.pending.super, dodge: this.pending.dodge, aiming, mouse: this.mouse };
    this.pending = { attack: null, super: null, dodge: null };
    return out;
  }
}
