// One seagull design for the whole game (a herring gull, as on the Golden Horn): white head and
// body, pale grey back and wings with black wing tips and a white spot, a yellow beak with a red
// spot, pale eyes, pink legs. Facing +z, about 0.5 long at scale 1.
// Parts are [geometry, colour, x, y, z, rx, ry, rz, sx, sy, sz] lists, so the town can bake them
// into instanced meshes (worldlife.js) and a station can build them as meshes (gullGroup).
import { SphereGeometry, ConeGeometry, CylinderGeometry, BoxGeometry, Group, Mesh, MeshLambertMaterial } from 'three';

export const GULL = { white: '#f8f9fc', grey: '#a6b0c4', black: '#24283a', beak: '#f6c43c', spot: '#d8402e', leg: '#e7a59c', eye: '#1c2340' };
const C = GULL;
const half = r => new SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);

export function gullBodyParts() {
  return [
    [new SphereGeometry(0.12, 12, 8), C.white, 0, 0, 0, 0, 0, 0, 1, 0.86, 2.05],            // body
    [half(0.118), C.grey, 0, 0.012, -0.04, 0, 0, 0, 1.06, 0.62, 1.7],                        // grey back (mantle)
    [new SphereGeometry(0.086, 12, 8), C.white, 0, 0.115, 0.2, 0, 0, 0, 1, 0.95, 1.1],       // head
    [new ConeGeometry(0.03, 0.13, 6), C.beak, 0, 0.098, 0.32, Math.PI / 2, 0, 0, 1, 1, 0.8], // beak
    [new SphereGeometry(0.014, 5, 4), C.spot, 0, 0.083, 0.31],                               // the red spot under the beak tip
    [new SphereGeometry(0.016, 5, 4), C.eye, 0.058, 0.135, 0.245], [new SphereGeometry(0.016, 5, 4), C.eye, -0.058, 0.135, 0.245],
    [new ConeGeometry(0.075, 0.16, 6), C.white, 0, 0.01, -0.27, -Math.PI / 2, 0, 0, 1.2, 1, 0.45], // tail
    [new CylinderGeometry(0.009, 0.009, 0.12, 4), C.leg, 0.04, -0.15, 0.02], [new CylinderGeometry(0.009, 0.009, 0.12, 4), C.leg, -0.04, -0.15, 0.02],
    [new BoxGeometry(0.05, 0.01, 0.06), C.leg, 0.04, -0.21, 0.04], [new BoxGeometry(0.05, 0.01, 0.06), C.leg, -0.04, -0.21, 0.04],
  ];
}
// one wing, its pivot at the shoulder, reaching out along +x (mirror it for the left wing)
export function gullWingParts() {
  return [
    [new BoxGeometry(0.2, 0.02, 0.17), C.grey, 0.1, 0, 0],                          // inner wing
    [new BoxGeometry(0.16, 0.018, 0.13), C.grey, 0.27, 0, -0.025, 0, 0.22, 0],      // outer wing, swept back
    [new BoxGeometry(0.13, 0.019, 0.1), C.black, 0.4, 0, -0.06, 0, 0.42, 0],        // black tip
    [new SphereGeometry(0.018, 5, 4), C.white, 0.42, 0.012, -0.07],                 // the white spot on the tip
    [new BoxGeometry(0.34, 0.021, 0.03), C.white, 0.17, 0, -0.085, 0, 0.12, 0],     // white trailing edge
  ];
}

const mats = new Map(), mat = c => { if (!mats.has(c)) mats.set(c, new MeshLambertMaterial({ color: c })); return mats.get(c); };
const build = (parts, parent) => { for (const [g, c, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx] of parts) { const m = new Mesh(g, mat(c)); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); m.castShadow = true; parent.add(m); } };
// a gull as a group (for stations): .userData.wings = [left, right] pivots; flap(t, amount) beats them
export function gullGroup(scale = 1) {
  const g = new Group(), body = new Group(); g.add(body); body.scale.setScalar(scale);
  build(gullBodyParts(), body);
  const wings = [-1, 1].map(s => { const w = new Group(); w.position.set(s * 0.09, 0.05, 0.02); w.scale.x = s; build(gullWingParts(), w); body.add(w); return w; });
  g.userData.wings = wings; g.userData.body = body;
  const sg = i => (i ? 1 : -1); // the left wing is mirrored, so its turns go the other way
  g.userData.flap = (t, amt = 1) => wings.forEach((w, i) => { w.rotation.y = 0; w.rotation.z = sg(i) * (0.25 + Math.sin(t) * 0.75 * amt); });
  g.userData.fold = () => wings.forEach((w, i) => { w.rotation.z = sg(i) * -0.1; w.rotation.y = sg(i) * 1.15; }); // folded back along the body
  g.userData.open = () => wings.forEach(w => { w.rotation.y = 0; });
  return g;
}
