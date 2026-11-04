// Bold, chunky kids for the arena view: team-coloured puffy jackets, a hat per kit
// (beanie = Quick Thrower, earmuffs = Lobber, cap = Sprayer), a dark outline so they pop,
// a warmth bar with number and team emblem, and your own snowball bar under yours.
import {
  Group, Mesh, MeshLambertMaterial, MeshBasicMaterial, SphereGeometry, CapsuleGeometry, CylinderGeometry, ConeGeometry, TorusGeometry,
  CircleGeometry, RingGeometry, BoxGeometry, CanvasTexture, SRGBColorSpace, Sprite, SpriteMaterial, BackSide, Color, BufferAttribute,
} from 'three';
import { CONFIG } from '../../config.js';
import { emblemSVG } from '../../emblems.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LOOK, toon, addRim } from './look.js';

// Merge meshes (in their parent's space, plus an optional extra matrix) into one geometry
// with per-vertex colours, so a whole kid draws in a handful of calls.
function bakeColored(meshes, extra = null) {
  const geos = meshes.map(m => {
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone());
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
    m.updateMatrix(); g.applyMatrix4(m.matrix); if (extra) g.applyMatrix4(extra);
    const c = m.material.color, n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new BufferAttribute(col, 3)); return g;
  });
  return mergeGeometries(geos);
}

const SKIN = ['#f3c9a5', '#e0a87e', '#c68863', '#a86f4d', '#f6d5bb'];
const OUTLINE = '#1c2340';
const G = {
  body: new CapsuleGeometry(0.4, 0.34, 6, 16), head: new SphereGeometry(0.44, 20, 16), eyeW: new SphereGeometry(0.11, 12, 10), eyeP: new SphereGeometry(0.06, 10, 8),
  cheek: new SphereGeometry(0.075, 8, 6), smile: new TorusGeometry(0.11, 0.025, 6, 12, Math.PI), leg: new CapsuleGeometry(0.13, 0.18, 4, 8), boot: new SphereGeometry(0.17, 10, 8),
  arm: new CapsuleGeometry(0.12, 0.26, 4, 8), mitten: new SphereGeometry(0.14, 10, 8), scarf: new TorusGeometry(0.33, 0.09, 8, 18),
  beanie: new SphereGeometry(0.47, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), band: new TorusGeometry(0.45, 0.07, 8, 20), pom: new SphereGeometry(0.15, 12, 10),
  muff: new CylinderGeometry(0.17, 0.17, 0.12, 14), hairband: new TorusGeometry(0.47, 0.045, 6, 20, Math.PI),
  capTop: new SphereGeometry(0.46, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.3), brim: new CylinderGeometry(0.28, 0.3, 0.05, 16, 1, false, -Math.PI / 2, Math.PI),
  shadow: new CircleGeometry(0.5, 20), ring: new RingGeometry(0.5, 0.62, 32),
  snowB: new SphereGeometry(0.55, 16, 12), snowM: new SphereGeometry(0.42, 16, 12), snowT: new SphereGeometry(0.32, 16, 12), nose: new ConeGeometry(0.06, 0.28, 8),
};

const emblemImg = new Map();
function emblem(team) {
  if (!emblemImg.has(team)) { const im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(emblemSVG(team, 64).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')); emblemImg.set(team, im); }
  return emblemImg.get(team);
}

export class Kid {
  constructor(c, { isPlayer = false } = {}) {
    this.c = c; this.isPlayer = isPlayer; this.team = CONFIG.teams[c.team];
    this.mats = [];
    const M = hex => { const m = new MeshLambertMaterial({ color: hex, transparent: true }); this.mats.push(m); return m; };
    const team = M(this.team.color), dark = M(this.team.dark), skin = M(SKIN[(c.id * 3) % SKIN.length]), white = M('#ffffff'), ink = M('#1d2733');
    this.jacket = team;
    const root = this.root = new Group(), kid = this.kid = new Group(); root.add(kid);
    const add = (geo, m, x, y, z, parent = kid, outline = false) => { const o = new Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); if (outline) this.outline(o, parent); return o; };
    this.outlineMat = new MeshBasicMaterial({ color: OUTLINE, side: BackSide, transparent: true }); this.mats.push(this.outlineMat);
    const s = c.captain ? 1.35 : 1; kid.scale.setScalar(1.15 * s);
    this.legs = [-0.16, 0.16].map(x => { const l = add(G.leg, M('#34405e'), x, 0.28, 0); add(G.boot, M('#4a3328'), 0, -0.16, 0.06, l).scale.set(1, 0.7, 1.3); return l; });
    const body = add(G.body, team, 0, 0.78, 0, kid, true); body.scale.set(1.05, 1, 0.95);
    this.arms = [-0.48, 0.48].map(x => { const a = add(G.arm, team, x, 0.86, 0, kid); a.rotation.z = x < 0 ? -0.35 : 0.35; add(G.mitten, white, 0, -0.27, 0, a); return a; });
    const scarf = add(G.scarf, M(c.kit === 'lobber' ? '#ffd166' : c.kit === 'sprayer' ? '#7bdff2' : '#ffffff'), 0, 1.16, 0); scarf.rotation.x = Math.PI / 2;
    const head = add(G.head, skin, 0, 1.55, 0, kid, true);
    for (const x of [-0.15, 0.15]) { add(G.eyeW, white, x, 1.6, 0.36).scale.set(1, 1.25, 0.6); add(G.eyeP, ink, x, 1.59, 0.42).scale.set(1, 1.3, 0.6); add(G.cheek, M('#ff9aa2'), x * 1.55, 1.46, 0.34).scale.set(1, 0.7, 0.5); }
    const smile = add(G.smile, ink, 0, 1.43, 0.4); smile.rotation.z = Math.PI;
    // hats per kit
    if (c.kit === 'lobber') {
      add(G.hairband, dark, 0, 1.58, 0).rotation.y = Math.PI / 2;
      for (const x of [-0.45, 0.45]) { const m = add(G.muff, M('#fff3e0'), x, 1.55, 0); m.rotation.z = Math.PI / 2; }
    } else if (c.kit === 'sprayer') {
      add(G.capTop, team, 0, 1.62, 0, kid, true).scale.set(1, 0.9, 1);
      const br = add(G.brim, dark, 0, 1.66, 0.2); br.rotation.y = Math.PI;
    } else {
      add(G.beanie, team, 0, 1.63, 0, kid, true);
      add(G.band, dark, 0, 1.66, 0).rotation.x = Math.PI / 2;
      add(G.pom, white, 0, 2.08, 0);
    }
    // snowman (frozen)
    const sm = this.snowman = new Group(); sm.visible = false; root.add(sm); sm.scale.setScalar(1.15 * s);
    const snowWhite = M('#fbfdff');
    add(G.snowB, snowWhite, 0, 0.5, 0, sm, true); add(G.snowM, snowWhite, 0, 1.12, 0, sm, true); add(G.snowT, snowWhite, 0, 1.62, 0, sm, true);
    const ss = add(G.scarf, team, 0, 1.4, 0, sm); ss.rotation.x = Math.PI / 2;
    const nose = add(G.nose, M('#f08a24'), 0, 1.62, 0.36, sm); nose.rotation.x = Math.PI / 2;
    for (const x of [-0.11, 0.11]) add(G.eyeP, ink, x, 1.72, 0.28, sm);
    // shadow + ring
    const shadow = new Mesh(G.shadow, new MeshBasicMaterial({ color: '#4a6182', transparent: true, opacity: 0.28, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; root.add(shadow);
    this.ring = new Mesh(G.ring, new MeshBasicMaterial({ color: isPlayer ? '#ffffff' : this.team.color, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false })); this.ring.renderOrder = 6; // shows even when wading in deep snow this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.04; root.add(this.ring);
    if (isPlayer) { const inner = new Mesh(new RingGeometry(0.4, 0.5, 32), new MeshBasicMaterial({ color: this.team.color, transparent: true, depthWrite: false, depthTest: false })); inner.renderOrder = 6; inner.rotation.x = -Math.PI / 2; inner.position.y = 0.045; root.add(inner); this.innerRing = inner; }
    // bars
    this.bc = document.createElement('canvas'); this.bc.width = 160; this.bc.height = isPlayer ? 56 : 40;
    this.bt = new CanvasTexture(this.bc); this.bt.colorSpace = SRGBColorSpace;
    this.bar = new Sprite(new SpriteMaterial({ map: this.bt, depthTest: false, transparent: true }));
    this.bar.scale.set(1.9, 1.9 * this.bc.height / 160, 1); this.bar.position.y = 2.75 * s; this.bar.renderOrder = 20; root.add(this.bar);
    this.bake();
    // a wooden sled with red runners, shown while riding a sled run
    const sled = this.sled = new Group(); sled.visible = false; root.add(sled);
    const plank = new Mesh(new BoxGeometry(0.62, 0.08, 1.15), new MeshLambertMaterial({ color: '#b9784a' })); plank.position.y = 0.2; sled.add(plank);
    for (const x of [-0.27, 0.27]) { const r = new Mesh(new BoxGeometry(0.06, 0.06, 1.3), new MeshLambertMaterial({ color: '#c8443c' })); r.position.set(x, 0.07, 0.02); sled.add(r); const tip = new Mesh(new TorusGeometry(0.12, 0.03, 4, 8, Math.PI), r.material); tip.position.set(x, 0.18, 0.66); tip.rotation.y = Math.PI / 2; sled.add(tip); }
    plank.castShadow = true;
    this.last = ''; this.t = Math.random() * 6; this.throwT = 0; this.shakeT = 0;
    emblem(c.team).onload = () => { this.last = ''; };
  }
  // Replace the many small parts with merged meshes: body+head+hat, outlines, each arm, each leg, the snowman.
  bake() {
    const vc = this.vc = LOOK.v2 ? addRim(toon({ vertexColors: true, transparent: true, emissive: new Color(0) }), 0.28) : new MeshLambertMaterial({ vertexColors: true, transparent: true, emissive: new Color(0) });
    const isOutline = m => m.material === this.outlineMat;
    const swapGroup = grp => {
      const direct = grp.children.filter(m => m.isMesh && !this.arms.includes(m) && !this.legs.includes(m));
      const colored = direct.filter(m => !isOutline(m)), lines = direct.filter(isOutline);
      if (colored.length) { const m = new Mesh(bakeColored(colored), vc); m.castShadow = true; grp.add(m); }
      if (lines.length) { const o = new Mesh(bakeColored(lines), this.outlineMat); grp.add(o); }
      for (const m of direct) grp.remove(m);
    };
    swapGroup(this.kid); swapGroup(this.snowman);
    const limb = part => { // the limb plus its child (mitten/boot) in the limb's own space
      const kids = part.children.filter(c => c.isMesh);
      const geo = bakeColored([Object.assign(new Mesh(part.geometry, part.material)), ...kids]);
      const m = new Mesh(geo, vc); m.position.copy(part.position); m.rotation.copy(part.rotation); m.scale.copy(part.scale); m.castShadow = true;
      this.kid.add(m); this.kid.remove(part); return m;
    };
    this.arms = this.arms.map(limb); this.legs = this.legs.map(limb);
    this.jacket = vc; this.mats = [vc, this.outlineMat];
  }
  outline(mesh, parent) { const o = new Mesh(mesh.geometry, this.outlineMat); o.position.copy(mesh.position); o.rotation.copy(mesh.rotation); o.scale.copy(mesh.scale).multiplyScalar(1.09); parent.add(o); }

  drawBars() {
    const c = this.c, g = this.bc.getContext('2d'), W = 160, w = c.warmth / c.maxWarmth;
    const key = `${Math.ceil(c.warmth)}|${this.isPlayer ? Math.floor(c.ammo * 10) : ''}`;
    if (key === this.last) return; this.last = key;
    g.clearRect(0, 0, W, this.bc.height);
    const im = emblem(c.team); if (im.complete && im.naturalWidth) g.drawImage(im, 0, 0, 36, 36);
    g.fillStyle = 'rgba(20,28,54,0.85)'; g.beginPath(); g.roundRect(38, 6, 120, 26, 9); g.fill();
    g.fillStyle = w > 0.5 ? (c.side === 'home' ? '#52d273' : '#ff5c5c') : w > 0.25 ? '#ffb020' : '#7fd3ff';
    g.beginPath(); g.roundRect(41, 9, Math.max(0, 114 * w), 20, 7); g.fill();
    g.fillStyle = '#ffffff'; g.font = '900 19px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.strokeStyle = 'rgba(20,28,54,0.9)'; g.lineWidth = 4; g.strokeText(String(Math.ceil(c.warmth)), 98, 20); g.fillText(String(Math.ceil(c.warmth)), 98, 20);
    if (this.isPlayer) { // snowballs in hand: three segments under the bar
      const n = CONFIG.fight.ammoMax, sw = (114 - (n - 1) * 4) / n;
      for (let i = 0; i < n; i++) {
        const x = 41 + i * (sw + 4), fill = Math.max(0, Math.min(1, c.ammo - i));
        g.fillStyle = 'rgba(20,28,54,0.85)'; g.beginPath(); g.roundRect(x - 2, 36, sw + 4, 16, 6); g.fill();
        g.fillStyle = fill >= 1 ? '#ffffff' : '#9fb8d6'; g.beginPath(); g.roundRect(x, 38, sw * fill, 12, 5); g.fill();
      }
    }
    this.bt.needsUpdate = true;
  }

  onEvent(type) { if (type === 'throw' || type === 'super') this.throwT = 0.28; if (type === 'shake') this.shakeT = 0.7; }

  update(dt, { visible = true, reduceMotion = false, groundY = 0 } = {}) {
    const c = this.c;
    this.root.position.set(c.x, groundY, c.z);
    this.sled.visible = !!c.sled; this.sled.rotation.y = c.face;
    this.kid.rotation.y = c.face; this.snowman.rotation.y = 0;
    const frozen = c.frozen > 0, thaw = c.thaw > 0;
    this.snowman.visible = frozen || (thaw && this.shakeT > 0.35);
    this.kid.visible = !this.snowman.visible;
    this.root.visible = visible;
    if (this.snowman.visible && thaw && !reduceMotion) this.snowman.rotation.z = Math.sin(this.shakeT * 45) * 0.25;
    // walk + throw + hit flash
    const sp = Math.min(1, c.moving / 3.4); this.t += dt * (5 + 9 * sp);
    const sw = Math.sin(this.t) * 0.75 * sp;
    this.legs[0].rotation.x = sw; this.legs[1].rotation.x = -sw;
    this.kid.position.y = Math.abs(Math.sin(this.t)) * 0.09 * sp;
    if (c.sled) { this.legs[0].rotation.x = this.legs[1].rotation.x = -1.3; this.kid.position.y = 0.05 + Math.sin(this.t * 2) * 0.02; } // sitting on the sled
    this.throwT = Math.max(0, this.throwT - dt); this.shakeT = Math.max(0, this.shakeT - dt);
    this.arms[1].rotation.x = this.throwT > 0 ? -2.8 * Math.sin((this.throwT / 0.28) * Math.PI) : -sw * 0.7;
    this.arms[0].rotation.x = sw * 0.7;
    const squash = c.flash > 0 && !reduceMotion ? 1 - c.flash * 1.5 : 1;
    this.kid.scale.y = this.kid.scale.x * squash;
    this.vc.emissive.setScalar(c.flash > 0 ? 0.75 : 0);
    if (thaw && this.shakeT < 0.35 && !reduceMotion) this.kid.rotation.y = c.face + (1 - this.shakeT / 0.35) * Math.PI * 2;
    // hidden in a hedge: you see yourself (and your team) faded
    const fade = c.hidden && c.revealT <= 0 ? 0.45 : 1;
    for (const m of this.mats) m.opacity = fade;
    // spawn shield: soft blink
    this.kid.visible = this.kid.visible && !(c.shield > 0 && Math.floor(c.shield * 10) % 2 === 1);
    this.drawBars(); this.bar.visible = !frozen && visible;
    if (this.innerRing) this.innerRing.rotation.z += dt * 1.5;
  }
}
