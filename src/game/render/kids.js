// The kids in the arena: the puffer-jacket model from kids2.js (girls and boys, glossy eyes, a hat
// per kit: beanie = Quick Thrower, earmuffs = Lobber, cap = Sprayer) merged into a few meshes,
// plus the frozen snowman, team ring, a warmth bar with number and team emblem, and your own
// snowball bar under yours.
import { GreaterDepth,
  Group, Mesh, MeshLambertMaterial, MeshBasicMaterial, SphereGeometry, CapsuleGeometry, CylinderGeometry, ConeGeometry, TorusGeometry,
  CircleGeometry, RingGeometry, BoxGeometry, CanvasTexture, SRGBColorSpace, Sprite, SpriteMaterial, BackSide, Color, BufferAttribute,
} from 'three';
import { CONFIG } from '../../config.js';
import { emblemSVG } from '../../emblems.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildKid, bakeKid } from './kids2.js';
import { makeLook } from '../looks.mjs';
import { setGear, tickGear } from './gear.js';

// the kids' size: about one tile wide and 1.75 tall (the sled run and the stations use the same kid)
export const KID_SCALE = 0.74;

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
  shadow: new CircleGeometry(0.4, 20), ring: new RingGeometry(0.4, 0.5, 32),
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
    const ink = M('#1d2733');
    const root = this.root = new Group();
    const s = c.captain ? 1.35 : isPlayer ? 1.12 : 1; // the student's kid a little bigger (the hit area stays the same: it is in the simulation)
    // the kid model: its look comes from the seat (girls and boys on every team); old saves get one
    const look = c.look || makeLook(c.id % 2 ? 'girl' : 'boy', () => ((c.id * 0.6180339) % 1));
    const kid = this.kid = bakeKid(buildKid({ team: c.team, kit: c.kit, ...look, hero: isPlayer })); root.add(kid);
    kid.scale.setScalar(KID_SCALE * s); // about one tile wide and 1.75 tall, in proportion to the battlefield (was 1.1)
    this.arms = kid.userData.arms; this.legs = kid.userData.legs;
    this.vc = kid.userData.material; this.mats.push(this.vc);
    kid.traverse(o => { if (o.isMesh && o.material !== this.vc) { o.material = o.material.clone(); this.mats.push(o.material); } }); // face and badge fade with the kid
    const add = (geo, m, x, y, z, parent = kid, outline = false) => { const o = new Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); if (outline) this.outline(o, parent); return o; };
    this.outlineMat = new MeshBasicMaterial({ color: OUTLINE, side: BackSide, transparent: true }); this.mats.push(this.outlineMat);
    // snowman (frozen)
    const sm = this.snowman = new Group(); sm.visible = false; root.add(sm); sm.scale.setScalar(KID_SCALE * 1.05 * s);
    const snowWhite = M('#fbfdff');
    add(G.snowB, snowWhite, 0, 0.5, 0, sm, true); add(G.snowM, snowWhite, 0, 1.12, 0, sm, true); add(G.snowT, snowWhite, 0, 1.62, 0, sm, true);
    const ss = add(G.scarf, M(this.team.color), 0, 1.4, 0, sm); ss.rotation.x = Math.PI / 2;
    const nose = add(G.nose, M('#f08a24'), 0, 1.62, 0.36, sm); nose.rotation.x = Math.PI / 2;
    for (const x of [-0.11, 0.11]) add(G.eyeP, ink, x, 1.72, 0.28, sm);
    // shadow + ring
    const shadow = new Mesh(G.shadow, new MeshBasicMaterial({ color: '#4a6182', transparent: true, opacity: 0.28, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; root.add(shadow);
    this.ring = new Mesh(G.ring, new MeshBasicMaterial({ color: isPlayer ? '#ffffff' : this.team.color, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false })); this.ring.renderOrder = 6; /* shows even when wading in deep snow */ this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.04; if (isPlayer) root.add(this.ring); // only the student's own kid has a ring (sides show by colour)
    if (isPlayer) {
      // the student's ring: gold, breathing a little, with a pointer the way they face
      // on the snow, not over the kid: depth-tested (the kid hides the part behind it), lifted a hair and pulled forward so the ground never swallows it
      const floor = m => Object.assign(m, { depthTest: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      this.ring.geometry = new RingGeometry(0.4, 0.56, 40); this.ring.material.color.set('#ffd23f'); this.ring.material.opacity = 1; floor(this.ring.material); this.ring.position.y = 0.07; this.ring.scale.setScalar(1.18); // a bold gold band
      const edge = this.ringEdge = new Mesh(new RingGeometry(0.35, 0.61, 40), floor(new MeshBasicMaterial({ color: '#1c2340', transparent: true, opacity: 0.85 }))); // with a navy edge, so it reads on bright snow
      edge.rotation.x = -Math.PI / 2; edge.position.y = 0.065; edge.renderOrder = 5; root.add(edge);
      const aim = this.aim = new Group(); aim.position.y = 0.08; root.add(aim);
      const tri = new Mesh(new ConeGeometry(0.17, 0.32, 3), floor(new MeshBasicMaterial({ color: '#ffd23f', transparent: true })));
      tri.rotation.x = Math.PI / 2; tri.scale.set(1, 1, 0.2); tri.position.z = 0.9; tri.renderOrder = 7; aim.add(tri); // a flat arrowhead at the ring's edge
      const triE = new Mesh(new ConeGeometry(0.24, 0.44, 3), floor(new MeshBasicMaterial({ color: '#1c2340', transparent: true, opacity: 0.85 })));
      triE.rotation.x = Math.PI / 2; triE.scale.set(1, 1, 0.2); triE.position.z = 0.9; triE.renderOrder = 5; aim.add(triE);
      // seen through walls, trees and roofs: a light silhouette wherever something stands in front of the kid
      // (drawn before the kid, against the world only, so the kid's own arms never show through it)
      const xc = new Color(this.team.color).lerp(new Color('#ffffff'), 0.45);
      const xray = this.xray = new MeshBasicMaterial({ color: xc, depthFunc: GreaterDepth, depthWrite: false });
      const parts = []; kid.traverse(o => { if (o.isMesh) parts.push(o); });
      for (const o of parts) { const x = new Mesh(o.geometry, xray); x.renderOrder = 1; x.castShadow = false; o.add(x); o.renderOrder = 2; }
    }
    // bars
    this.bc = document.createElement('canvas'); this.bc.width = 160; this.bc.height = isPlayer ? 56 : 40;
    this.bt = new CanvasTexture(this.bc); this.bt.colorSpace = SRGBColorSpace;
    this.bar = new Sprite(new SpriteMaterial({ map: this.bt, depthTest: false, transparent: true }));
    this.bar.scale.set(1.6, 1.6 * this.bc.height / 160, 1); this.bar.position.y = 2.15 * s; this.bar.renderOrder = 20; root.add(this.bar);
    this.bake();
    // a wooden sled with red runners, shown while riding a sled run
    const sled = this.sled = new Group(); sled.visible = false; root.add(sled);
    const plank = new Mesh(new BoxGeometry(0.62, 0.08, 1.15), new MeshLambertMaterial({ color: '#b9784a' })); plank.position.y = 0.2; sled.add(plank);
    for (const x of [-0.27, 0.27]) { const r = new Mesh(new BoxGeometry(0.06, 0.06, 1.3), new MeshLambertMaterial({ color: '#c8443c' })); r.position.set(x, 0.07, 0.02); sled.add(r); const tip = new Mesh(new TorusGeometry(0.12, 0.03, 4, 8, Math.PI), r.material); tip.position.set(x, 0.18, 0.66); tip.rotation.y = Math.PI / 2; sled.add(tip); }
    plank.castShadow = true;
    this.last = ''; this.t = Math.random() * 6; this.throwT = 0; this.shakeT = 0;
    emblem(c.team).onload = () => { this.last = ''; };
  }
  // The kid comes merged from bakeKid(); merge the snowman's parts the same way.
  bake() {
    const sm = this.snowman, isOutline = m => m.material === this.outlineMat;
    const direct = sm.children.filter(m => m.isMesh), colored = direct.filter(m => !isOutline(m)), lines = direct.filter(isOutline);
    const snowMat = new MeshLambertMaterial({ vertexColors: true, transparent: true }); this.mats.push(snowMat);
    if (colored.length) { const m = new Mesh(bakeColored(colored), snowMat); m.castShadow = true; sm.add(m); }
    if (lines.length) sm.add(new Mesh(bakeColored(lines), this.outlineMat));
    for (const m of direct) sm.remove(m);
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

  onEvent(type) { if (type === 'throw' || type === 'super') this.throwT = 0.28; if (type === 'shake') this.shakeT = 0.7; if (type === 'hit') this.hitT = 0.32; }

  update(dt, { visible = true, reduceMotion = false, groundY = 0 } = {}) {
    if (this.c.gear !== this.gearRef) { this.gearRef = this.c.gear; setGear(this.kid, this.c.gear || [], { color: this.team?.dark }); } // what the student bought in the Snow Shop
    if (this.gearRef) tickGear(this.kid, this.t || 0);
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
    this.hitT = Math.max(0, (this.hitT || 0) - dt); this.kid.rotation.z = reduceMotion ? 0 : Math.sin(this.hitT * 34) * 0.22 * (this.hitT / 0.32); // hit: a quick wobble
    // hidden in a hedge: you see yourself (and your team) faded
    const fade = c.hidden && c.revealT <= 0 ? 0.45 : 1;
    for (const m of this.mats) m.opacity = fade;
    // spawn shield: soft blink
    this.kid.visible = this.kid.visible && !(c.shield > 0 && Math.floor(c.shield * 10) % 2 === 1);
    this.drawBars(); this.bar.visible = !frozen && visible;
    this.ring.visible = this.showRing !== false && visible; // (the arrival hides it for its shots; it comes back after)
    if (this.aim) { this.aim.rotation.y = c.face; this.aim.visible = this.ring.visible && !frozen; const b = reduceMotion ? 0 : Math.sin(performance.now() / 260) * 0.04; this.ring.scale.setScalar(1.18 + b); this.ringEdge.scale.setScalar(1.18 + b); this.ringEdge.visible = this.ring.visible; }
  }
}
