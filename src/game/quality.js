// Automatic quality: start from a guess based on the device, then step down when frames
// get slow (target ≥ 30 fps on a cheap phone) and back up when there is plenty of room.
export const LEVELS = [
  { name: 'low',    pixelRatio: 1,   snow: 220,  shadows: false, maxDpr: 1 },
  { name: 'medium', pixelRatio: 1.5, snow: 650,  shadows: false, maxDpr: 1.5 },
  { name: 'high',   pixelRatio: 2,   snow: 1300, shadows: true,  maxDpr: 2 },
];

export function guessLevel() {
  const nav = globalThis.navigator || {};
  const mem = nav.deviceMemory || 4, cores = nav.hardwareConcurrency || 4;
  const small = Math.min(globalThis.screen?.width || 1000, globalThis.screen?.height || 1000) < 500;
  if (mem <= 2 || cores <= 4) return 0;
  if (mem >= 8 && cores >= 8 && !small) return 2;
  return 1;
}

export class AutoQuality {
  constructor(start, apply, { forced = null } = {}) {
    this.level = forced ?? start; this.apply = apply; this.forced = forced;
    this.acc = 0; this.frames = 0; this.cool = 2; this.fps = 60;
    apply(LEVELS[this.level]);
  }
  set(level) { this.forced = level; this.level = level; this.apply(LEVELS[level]); }
  auto() { this.forced = null; }
  tick(dt) {
    this.acc += dt; this.frames++; this.cool -= dt;
    if (this.acc < 2) return;
    this.fps = this.frames / this.acc; this.acc = 0; this.frames = 0;
    if (this.forced !== null || this.cool > 0) return;
    if (this.fps < 34 && this.level > 0) { this.level--; this.apply(LEVELS[this.level]); this.cool = 4; }
    else if (this.fps > 58 && this.level < LEVELS.length - 1) { this.level++; this.apply(LEVELS[this.level]); this.cool = 8; }
  }
}
