// Touch-first controls with keyboard and mouse support.
//
// Phone/tablet: floating joystick anywhere on the left half · throw button (tap = quick throw
// with auto-aim, hold = charge a big snowball, release = throw) · swipe on the right half =
// dodge · in Relaxed pace a quick tap on the street walks there.
// Computer: WASD/arrows move · mouse aims · click throws (hold for big) · Space dodges ·
// M opens the map · Esc pauses.
const HOLD = 0.22;     // seconds before a press becomes a charge
const JOY_R = 56;      // joystick radius in CSS px

export class Input {
  constructor({ surface, throwBtn, joyBase, joyKnob, toWorldDir, groundAt, onTapGround, onKey, tapToMove }) {
    Object.assign(this, { surface, throwBtn, joyBase, joyKnob, toWorldDir, groundAt, onTapGround, onKey, tapToMove });
    this.keys = new Set(); this.joy = null; this.press = null; this.mouse = null; this.swipes = new Map();
    this.pending = { throw: null, dodge: null };
    this.usedTouch = false; this.usedKeys = false;
    this.bind();
  }

  bind() {
    const s = this.surface;
    s.addEventListener('pointerdown', e => this.down(e));
    s.addEventListener('pointermove', e => this.move(e));
    s.addEventListener('pointerup', e => this.up(e));
    s.addEventListener('pointercancel', e => this.up(e, true));
    s.addEventListener('contextmenu', e => e.preventDefault());
    this.throwBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); this.throwBtn.setPointerCapture?.(e.pointerId); this.startPress(e.pointerId, 'button'); });
    this.throwBtn.addEventListener('pointerup', e => { e.preventDefault(); e.stopPropagation(); this.endPress(e.pointerId); });
    this.throwBtn.addEventListener('pointercancel', e => { this.press = null; });
    addEventListener('keydown', e => {
      if (e.target && /INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName) && e.key !== 'Escape') return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) { e.preventDefault(); this.usedKeys = true; }
      if (k === ' ' && !e.repeat) this.pending.dodge = { key: true };
      if (k === 'm' && !e.repeat) this.onKey?.('map');
      if (k === 'escape' && !e.repeat) this.onKey?.('pause');
      this.keys.add(k);
    });
    addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => { this.keys.clear(); this.joy = null; this.press = null; this.showJoy(false); });
  }

  down(e) {
    if (e.pointerType === 'mouse') {
      this.mouse = { x: e.clientX, y: e.clientY };
      if (e.button === 0) this.startPress(e.pointerId, 'mouse');
      return;
    }
    this.usedTouch = true;
    this.surface.setPointerCapture?.(e.pointerId);
    const left = e.clientX < innerWidth / 2;
    if (left && !this.joy) {
      this.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), moved: false };
    } else {
      this.swipes.set(e.pointerId, { x0: e.clientX, y0: e.clientY, t0: performance.now() });
    }
  }

  move(e) {
    if (e.pointerType === 'mouse') { this.mouse = { x: e.clientX, y: e.clientY }; return; }
    if (this.joy && e.pointerId === this.joy.id) {
      this.joy.x = e.clientX; this.joy.y = e.clientY;
      if (Math.hypot(this.joy.x - this.joy.ox, this.joy.y - this.joy.oy) > 10 && !this.joy.moved) { this.joy.moved = true; this.showJoy(true); }
      this.drawJoy();
    }
  }

  up(e, cancelled = false) {
    if (e.pointerType === 'mouse') { if (e.button === 0) this.endPress(e.pointerId); return; }
    const now = performance.now();
    if (this.joy && e.pointerId === this.joy.id) {
      const tap = !this.joy.moved && now - this.joy.t0 < 260;
      if (tap && !cancelled && this.tapToMove) this.tapGround(e.clientX, e.clientY);
      this.joy = null; this.showJoy(false); return;
    }
    const sw = this.swipes.get(e.pointerId); this.swipes.delete(e.pointerId);
    if (!sw || cancelled) return;
    const dx = e.clientX - sw.x0, dy = e.clientY - sw.y0, dt = now - sw.t0, d = Math.hypot(dx, dy);
    if (d > 35 && dt < 350) this.pending.dodge = { sx: dx / d, sy: -dy / d };
    else if (d < 12 && dt < 260 && this.tapToMove) this.tapGround(e.clientX, e.clientY);
  }

  tapGround(x, y) { const p = this.groundAt(x, y); if (p) this.onTapGround?.(p); }

  startPress(id, kind) { this.press = { id, kind, t0: performance.now() }; }
  endPress(id) {
    if (!this.press || this.press.id !== id) return;
    const held = (performance.now() - this.press.t0) / 1000;
    this.pending.throw = { kind: this.press.kind, big: held >= HOLD, held };
    this.press = null;
  }
  get charging() { return !!this.press && (performance.now() - this.press.t0) / 1000 >= HOLD; }

  showJoy(on) { this.joyBase.style.display = this.joyKnob.style.display = on ? 'block' : 'none'; if (on) this.drawJoy(); }
  drawJoy() {
    const j = this.joy; if (!j) return;
    let dx = j.x - j.ox, dy = j.y - j.oy; const d = Math.hypot(dx, dy);
    if (d > JOY_R) { dx *= JOY_R / d; dy *= JOY_R / d; }
    this.joyBase.style.transform = `translate(${j.ox - 60}px, ${j.oy - 60}px)`;
    this.joyKnob.style.transform = `translate(${j.ox + dx - 28}px, ${j.oy + dy - 28}px)`;
  }

  // Called once per frame. Returns the joystick/keys direction in screen terms and one-shot actions.
  read() {
    let sx = 0, sy = 0;
    if (this.joy && this.joy.moved) {
      let dx = this.joy.x - this.joy.ox, dy = this.joy.y - this.joy.oy; const d = Math.hypot(dx, dy);
      const mag = Math.min(1, Math.max(0, (d - 6) / (JOY_R - 6)));
      if (d > 0) { sx = (dx / d) * mag; sy = (-dy / d) * mag; }
    }
    const k = this.keys;
    if (k.has('a') || k.has('arrowleft')) sx -= 1;
    if (k.has('d') || k.has('arrowright')) sx += 1;
    if (k.has('w') || k.has('arrowup')) sy += 1;
    if (k.has('s') || k.has('arrowdown')) sy -= 1;
    const out = { sx, sy, throw: this.pending.throw, dodge: this.pending.dodge, charging: this.charging, pressKind: this.press?.kind || null, mouse: this.mouse };
    this.pending.throw = null; this.pending.dodge = null;
    return out;
  }
}
