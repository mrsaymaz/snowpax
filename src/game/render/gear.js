// What the Snow Shop's boosts look like on a kid (the shop's close-up and the student's kid in the
// fight): big red mittens (big gloves), glowing wristbands with little bolts (quick hands), a fluffy
// collar and a longer coat (warm coat), a gold star badge and a warm glow at the feet (super start).
// Works on a built (and baked) kid from kids2.js: arms are groups at the shoulders, hands at -0.42.
import { Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, SphereGeometry, TorusGeometry, CylinderGeometry, RingGeometry, ExtrudeGeometry, Shape, AdditiveBlending, DoubleSide } from 'three';

const mat = (c, extra = {}) => new MeshStandardMaterial({ color: c, roughness: 0.7, ...extra });
const bolt = () => { const sh = new Shape(); sh.moveTo(0.02, 0.12); sh.lineTo(-0.05, 0.01); sh.lineTo(0, 0.01); sh.lineTo(-0.03, -0.1); sh.lineTo(0.05, 0.03); sh.lineTo(0.005, 0.03); sh.lineTo(0.04, 0.12); return new ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: false }); };
const star = (R = 0.09, r = 0.04) => { const sh = new Shape(); for (let k = 0; k < 10; k++) { const a = Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r : R; if (k) sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } sh.closePath(); return new ExtrudeGeometry(sh, { depth: 0.025, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1 }); };

function build(id, kid, color) {
  const g = new Group(); g.name = 'gear-' + id;
  const arms = kid.userData.arms || [];
  if (id === 'gloves') arms.forEach((arm, k) => { // a big red mitten over each hand, with a white cuff and a thumb
    const m = new Group(); m.position.set(0, -0.45, 0); arm.add(m); g.userData.parts = [...(g.userData.parts || []), m];
    const red = mat('#e0463c'); const hand = new Mesh(new SphereGeometry(0.2, 16, 12), red); hand.scale.set(1, 1.12, 0.92); m.add(hand);
    const thumb = new Mesh(new SphereGeometry(0.075, 10, 8), red); thumb.position.set(k ? -0.15 : 0.15, 0.06, 0.06); m.add(thumb);
    const cuff = new Mesh(new TorusGeometry(0.15, 0.06, 8, 16), mat('#fbf7ef')); cuff.rotation.x = Math.PI / 2; cuff.position.y = 0.16; m.add(cuff);
  });
  if (id === 'quick') arms.forEach(arm => { // a glowing band on each wrist, with a little bolt
    const m = new Group(); m.position.set(0, -0.3, 0); arm.add(m); g.userData.parts = [...(g.userData.parts || []), m];
    const glow = mat('#ffd23e', { emissive: '#ffb000', emissiveIntensity: 0.9, roughness: 0.3 });
    const band = new Mesh(new TorusGeometry(0.13, 0.04, 8, 18), glow); band.rotation.x = Math.PI / 2; m.add(band);
    const b = new Mesh(bolt(), glow); b.position.set(0, -0.02, 0.15); m.add(b);
  });
  if (id === 'coat') { // a fluffy white collar and a longer coat below the jacket
    const collar = new Mesh(new TorusGeometry(0.33, 0.1, 10, 24), mat('#fbf7ef', { roughness: 0.95 })); collar.rotation.x = Math.PI / 2; collar.position.y = 1.07; g.add(collar);
    const skirt = new Mesh(new CylinderGeometry(0.4, 0.47, 0.3, 24, 1, true), mat(color, { side: DoubleSide })); skirt.position.y = 0.4; g.add(skirt);
    for (const y of [0.85, 0.65]) { const t = new Mesh(new SphereGeometry(0.035, 8, 6), mat('#6b4a32')); t.position.set(0, y, 0.38); g.add(t); }
    kid.add(g);
  }
  if (id === 'super') { // a gold star badge and a warm glow at the feet
    const s = new Mesh(star(), mat('#f2c14e', { emissive: '#e8a10a', emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.35 })); s.position.set(-0.17, 0.86, 0.4); g.add(s);
    const ring = new Mesh(new RingGeometry(0.5, 0.72, 32), new MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.55, depthWrite: false, blending: AdditiveBlending })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring); g.userData.ring = ring;
    kid.add(g);
  }
  return g;
}

// Put on exactly the gear in `ids` (a Set or array of boost ids); returns what is worn.
export function setGear(kid, ids, { color = '#3d5a8c' } = {}) {
  const want = new Set(ids || []), worn = kid.userData.gear || (kid.userData.gear = new Map());
  for (const [id, g] of worn) if (!want.has(id)) { for (const p of g.userData.parts || []) p.parent?.remove(p); g.parent?.remove(g); worn.delete(id); }
  for (const id of want) if (!worn.has(id)) worn.set(id, build(id, kid, color));
  return worn;
}

// the glow at the feet breathes a little (call every frame)
export function tickGear(kid, t) { const g = kid.userData.gear?.get('super'); if (g?.userData.ring) g.userData.ring.material.opacity = 0.4 + Math.sin(t * 3) * 0.15; }
