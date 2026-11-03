// Chunky kids in puffy jackets with team-coloured hats and scarves. A frozen kid becomes a
// snowman (with their scarf) and shakes it off. Over each head: a warmth bar with the team
// emblem, so colour is never the only signal. Snowballs carried show on the back.
import {
  Group, Mesh, MeshLambertMaterial, SphereGeometry, CapsuleGeometry, CylinderGeometry, ConeGeometry, BoxGeometry,
  TorusGeometry, CanvasTexture, BackSide, SRGBColorSpace, Sprite, SpriteMaterial, RingGeometry, MeshBasicMaterial, Color,
} from 'three';
import { CONFIG } from '../../config.js';
import { emblemSVG } from '../../emblems.js';
import { makeMaterial, styleOf } from './style.js';

const JACKETS = ['#3d5a80', '#8d6e63', '#5c6bc0', '#26a69a', '#ef8354', '#7e57c2', '#546e7a', '#c0ca33'];
const SKIN = ['#f1c7a3', '#e0a87e', '#c68863', '#a86f4d', '#f6d5bb'];
const geo = {
  body: new CapsuleGeometry(0.44, 0.4, 6, 16), head: new SphereGeometry(0.38, 18, 14), hat: new SphereGeometry(0.4, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), cheek: new SphereGeometry(0.07, 8, 6), mitten: new SphereGeometry(0.13, 10, 8), boot: new SphereGeometry(0.16, 10, 8), hatBand: new TorusGeometry(0.38, 0.06, 6, 18),
  pom: new SphereGeometry(0.11, 8, 6), leg: new CapsuleGeometry(0.13, 0.25, 3, 6), arm: new CapsuleGeometry(0.11, 0.32, 3, 6),
  scarf: new TorusGeometry(0.3, 0.09, 6, 14), tail: new BoxGeometry(0.14, 0.38, 0.06), eye: new SphereGeometry(0.045, 6, 4),
  ball: new SphereGeometry(0.09, 6, 5), snowBottom: new SphereGeometry(0.6, 12, 10), snowMid: new SphereGeometry(0.45, 12, 10), snowTop: new SphereGeometry(0.33, 12, 10),
  nose: new ConeGeometry(0.06, 0.28, 6), ring: new RingGeometry(0.62, 0.8, 24),
};
const mats = new Map();
let STYLE = 'toybox';
export function setCharacterStyle(style) { STYLE = style; mats.clear(); }
const mat = hex => { if (!mats.has(hex)) mats.set(hex, makeMaterial(STYLE, { color: hex, noGrain: true })); return mats.get(hex); };
// Outline hull for cartoon/paper styles: a slightly larger back-face copy of each part.
function outlineGroup(group, scale = 1.12) {
  const o = styleOf(STYLE).outline; if (!o) return;
  const m = new MeshBasicMaterial({ color: o.color, side: BackSide });
  for (const part of [...group.children]) { if (!part.isMesh) continue; const h = new Mesh(part.geometry, m); h.position.copy(part.position); h.rotation.copy(part.rotation); h.scale.copy(part.scale).multiplyScalar(scale); group.add(h); part.userData.hull = h; }
}

// Emblem image for warmth-bar labels, drawn once per team.
const emblemCache = new Map();
function emblemImage(team) {
  if (!emblemCache.has(team)) {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(emblemSVG(team, 64).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
    emblemCache.set(team, img);
  }
  return emblemCache.get(team);
}

export class CharacterView {
  constructor(c, { isPlayer = false } = {}) {
    this.c = c; this.team = CONFIG.teams[c.team];
    const g = this.root = new Group();
    const k = this.kid = new Group(); g.add(k);
    const jacket = mat(isPlayer ? '#e8eef5' : JACKETS[c.id % JACKETS.length]), skin = mat(SKIN[(c.id * 3) % SKIN.length]), team = mat(this.team.color), dark = mat(this.team.dark);
    const s = (c.captain ? 1.35 : 1) * 1.3; // chunky toy kids, readable on a phone
    k.scale.setScalar(s);
    const body = new Mesh(geo.body, jacket); body.position.y = 0.78; body.scale.set(1, 1, 0.9); k.add(body);
    const head = new Mesh(geo.head, skin); head.position.y = 1.5; k.add(head);
    for (const x of [-0.21, 0.21]) { const ch = new Mesh(geo.cheek, mat('#ff9aa2')); ch.position.set(x, 1.42, 0.3); ch.scale.set(1, 0.7, 0.5); k.add(ch); }
    const hat = new Mesh(geo.hat, team); hat.position.y = 1.56; k.add(hat);
    const band = new Mesh(geo.hatBand, dark); band.rotation.x = Math.PI / 2; band.position.y = 1.58; k.add(band);
    const pom = new Mesh(geo.pom, mat('#ffffff')); pom.position.y = 1.98; pom.scale.setScalar(1.25); k.add(pom);
    const scarf = new Mesh(geo.scarf, team); scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.17; k.add(scarf);
    const tail = new Mesh(geo.tail, dark); tail.position.set(0.16, 0.98, -0.32); tail.rotation.x = 0.25; k.add(tail);
    for (const x of [-0.13, 0.13]) { const e = new Mesh(geo.eye, mat('#1d2733')); e.position.set(x, 1.53, 0.34); e.scale.set(1, 1.3, 0.6); k.add(e); }
    this.legs = [-0.17, 0.17].map(x => { const l = new Mesh(geo.leg, mat('#33415c')); l.position.set(x, 0.32, 0); const bt = new Mesh(geo.boot, mat('#5a3b2e')); bt.position.set(0, -0.2, 0.06); bt.scale.set(1, 0.7, 1.3); l.add(bt); k.add(l); return l; });
    this.arms = [-0.5, 0.5].map(x => { const a = new Mesh(geo.arm, jacket); a.position.set(x, 0.95, 0); a.rotation.z = x < 0 ? -0.25 : 0.25; const mt = new Mesh(geo.mitten, team); mt.position.set(0, -0.3, 0); a.add(mt); k.add(a); return a; });
    // carried snowballs on the back (up to 8)
    this.ammo = []; for (let i = 0; i < CONFIG.fight.ammoMax; i++) { const b = new Mesh(geo.ball, mat('#ffffff')); const row = Math.floor(i / 4), col = i % 4; b.position.set(-0.24 + col * 0.16, 0.62 + row * 0.18, -0.4); k.add(b); this.ammo.push(b); }
    for (const m of k.children) m.castShadow = true;
    outlineGroup(k);

    // snowman (hidden until frozen)
    const sm = this.snowman = new Group(); sm.visible = false; g.add(sm);
    const add = (geom, m, y) => { const o = new Mesh(geom, m); o.position.y = y; o.castShadow = true; sm.add(o); return o; };
    add(geo.snowBottom, mat('#fbfdff'), 0.5); add(geo.snowMid, mat('#fbfdff'), 1.15); add(geo.snowTop, mat('#fbfdff'), 1.66);
    const sScarf = add(geo.scarf, team, 1.42); sScarf.rotation.x = Math.PI / 2;
    const nose = add(geo.nose, mat('#f08a24'), 1.66); nose.rotation.x = Math.PI / 2; nose.position.z = 0.36;
    for (const x of [-0.11, 0.11]) { const e = add(geo.eye, mat('#1d2733'), 1.74); e.position.set(x, 1.74, 0.29); }
    sm.scale.setScalar(s);
    outlineGroup(sm, 1.06);

    // ground ring: team colour, brighter for the student
    const ring = new Mesh(geo.ring, new MeshBasicMaterial({ color: isPlayer ? '#ffffff' : this.team.color, transparent: true, opacity: isPlayer ? 0.95 : 0.6 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; ring.scale.setScalar(isPlayer ? 1.15 * s : s); g.add(ring);
    if (isPlayer) { const inner = new Mesh(geo.ring, new MeshBasicMaterial({ color: this.team.color })); inner.rotation.x = -Math.PI / 2; inner.position.y = 0.05; inner.scale.setScalar(0.8 * s); g.add(inner); }

    // warmth bar + emblem
    this.barCanvas = document.createElement('canvas'); this.barCanvas.width = 128; this.barCanvas.height = 32;
    this.barTex = new CanvasTexture(this.barCanvas); this.barTex.colorSpace = SRGBColorSpace;
    this.bar = new Sprite(new SpriteMaterial({ map: this.barTex, depthTest: false, transparent: true }));
    this.bar.scale.set(1.9, 0.475, 1); this.bar.position.y = 2.2 * s; this.bar.renderOrder = 10; g.add(this.bar);
    this.lastWarmth = -1; this.isPlayer = isPlayer;
    this.anim = { throw: 0, hit: 0, shake: 0, walk: Math.random() * 6 };
    emblemImage(c.team).onload = () => { this.lastWarmth = -1; };
  }

  drawBar() {
    const c = this.c, g = this.barCanvas.getContext('2d'), w = c.warmth / c.maxWarmth;
    g.clearRect(0, 0, 128, 32);
    const img = emblemImage(c.team); if (img.complete && img.naturalWidth) g.drawImage(img, 0, 0, 32, 32);
    g.fillStyle = 'rgba(16,30,48,0.75)'; g.beginPath(); g.roundRect(36, 9, 88, 14, 7); g.fill();
    g.fillStyle = w > 0.5 ? this.team.color : w > 0.25 ? '#f5a623' : '#7fc8ff'; // cold = icy blue
    g.beginPath(); g.roundRect(38, 11, Math.max(0, 84 * w), 10, 5); g.fill();
    this.barTex.needsUpdate = true;
  }

  trigger(type) { if (type === 'throw') this.anim.throw = 0.3; if (type === 'hit') this.anim.hit = 0.25; if (type === 'shake') this.anim.shake = 0.7; }

  update(dt, reduceMotion) {
    const c = this.c, a = this.anim;
    this.root.position.set(c.x, 0, c.z);
    this.root.rotation.y = c.face;
    const frozen = c.frozen > 0, thaw = c.thaw > 0;
    this.snowman.visible = frozen || (thaw && a.shake > 0.35);
    this.kid.visible = !this.snowman.visible;
    if (this.snowman.visible) {
      const wob = thaw ? Math.sin(a.shake * 40) * 0.25 : 0;
      this.snowman.rotation.z = reduceMotion ? 0 : wob;
    }
    // walk cycle
    const sp = Math.min(1, c.moving / 6);
    a.walk += dt * (6 + 8 * sp);
    const swing = Math.sin(a.walk) * 0.7 * sp;
    this.legs[0].rotation.x = swing; this.legs[1].rotation.x = -swing;
    this.kid.position.y = Math.abs(Math.sin(a.walk)) * 0.08 * sp;
    // throw: right arm swings over
    a.throw = Math.max(0, a.throw - dt);
    this.arms[1].rotation.x = a.throw > 0 ? -2.6 * Math.sin((a.throw / 0.3) * Math.PI) : -swing * 0.6;
    this.arms[0].rotation.x = swing * 0.6;
    // charging a big snowball: arm back
    if (c.charge > 0) this.arms[1].rotation.x = -1.2 - c.charge * 1.2;
    a.hit = Math.max(0, a.hit - dt);
    this.kid.rotation.x = a.hit > 0 && !reduceMotion ? -0.35 * Math.sin((a.hit / 0.25) * Math.PI) : 0;
    a.shake = Math.max(0, a.shake - dt);
    if (thaw && a.shake < 0.35 && !reduceMotion) this.kid.rotation.y = (1 - a.shake / 0.35) * Math.PI * 2; else this.kid.rotation.y = 0;
    // invulnerable after a thaw: blink
    this.root.visible = !(c.invuln > 0 && !frozen && Math.floor(c.invuln * 12) % 2 === 1 && c.dodge <= 0);
    this.ammo.forEach((b, i) => { b.visible = i < c.ammo; if (b.userData.hull) b.userData.hull.visible = b.visible; });
    for (const part of [...this.legs, ...this.arms]) if (part.userData.hull) part.userData.hull.rotation.copy(part.rotation);
    const wq = Math.round((c.warmth / c.maxWarmth) * 40);
    if (wq !== this.lastWarmth) { this.lastWarmth = wq; this.drawBar(); }
    this.bar.visible = !frozen;
  }
}
