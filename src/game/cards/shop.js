// The Snow Shop (build moments before each fight): a snowy market stall where your stars buy boosts.
// The four boosts stand on the counter and the shelf as things you can see: big mittens, a lightning
// bolt (quick hands), a gold star (super start) and a puffer jacket on a hanger (warm coat), each
// with a price tag to tap. Your kid stands at the counter and cheers for each buy.
import { Group, Mesh, MeshLambertMaterial, MeshBasicMaterial, MeshStandardMaterial, BoxGeometry, CylinderGeometry, SphereGeometry, CapsuleGeometry, TorusGeometry, ExtrudeGeometry, PlaneGeometry, Shape, Vector3, CanvasTexture, SRGBColorSpace } from 'three';
import { stage, pines, mounds, actor } from './stationkit.js';
import { SHOP } from '../fights.mjs';
import { esc } from './util.js';

const L = c => new MeshLambertMaterial({ color: c });
const tall = () => innerWidth / innerHeight < 0.8;
const sign = text => { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#5a3a2a'; g.beginPath(); g.roundRect(6, 6, 500, 116, 26); g.fill(); g.strokeStyle = '#f2c14e'; g.lineWidth = 8; g.stroke(); g.fillStyle = '#fff6dc'; g.font = '900 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 68); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; };

// the boosts as things
function itemMesh(id, color) {
  const g = new Group(), add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const m = new Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; g.add(m); return m; };
  if (id === 'gloves') { // two big puffy mittens
    const mat = new MeshStandardMaterial({ color, roughness: 0.7 }), cuff = L('#f6f4ef');
    for (const s of [-1, 1]) { add(new CapsuleGeometry(0.17, 0.16, 8, 16), mat, s * 0.2, 0.26, 0, 0, 0, s * 0.25); add(new SphereGeometry(0.09, 12, 8), mat, s * 0.34, 0.24, 0.02); add(new CylinderGeometry(0.15, 0.15, 0.1, 16), cuff, s * 0.22, 0.03, 0, 0, 0, s * 0.25); }
  } else if (id === 'quick') { // a lightning bolt
    const sh = new Shape(); sh.moveTo(0.05, 0.55); sh.lineTo(-0.2, 0.05); sh.lineTo(-0.02, 0.05); sh.lineTo(-0.12, -0.45); sh.lineTo(0.22, 0.12); sh.lineTo(0.03, 0.12); sh.lineTo(0.15, 0.55); sh.lineTo(0.05, 0.55);
    const m = add(new ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }), new MeshStandardMaterial({ color: '#ffd23e', emissive: '#ffb000', emissiveIntensity: 0.35, roughness: 0.4 }), 0, 0.5, -0.05);
  } else if (id === 'super') { // a big gold star
    const sh = new Shape(), R = 0.36, r = 0.16; for (let k = 0; k < 10; k++) { const a = Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r : R; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (k) sh.lineTo(x, y); else sh.moveTo(x, y); } sh.closePath();
    add(new ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }), new MeshStandardMaterial({ color: '#f2c14e', emissive: '#e8a10a', emissiveIntensity: 0.45, metalness: 0.4, roughness: 0.35 }), 0, 0.42, -0.05);
  } else if (id === 'coat') { // a puffer jacket on a hanger
    const mat = new MeshStandardMaterial({ color: '#e0584a', roughness: 0.7 });
    add(new TorusGeometry(0.14, 0.012, 6, 20, Math.PI), L('#8a6a4a'), 0, 0.86, 0); add(new CylinderGeometry(0.01, 0.01, 0.42, 6), L('#8a6a4a'), 0, 0.72, 0, 0, 0, Math.PI / 2);
    add(new CapsuleGeometry(0.2, 0.26, 8, 16), mat, 0, 0.42, 0);
    for (const y of [0.3, 0.44, 0.58]) add(new TorusGeometry(0.2, 0.05, 8, 20), mat, 0, y, 0, Math.PI / 2);
    for (const s of [-1, 1]) add(new CapsuleGeometry(0.07, 0.24, 6, 10), mat, s * 0.27, 0.44, 0, 0, 0, s * 0.35);
    add(new BoxGeometry(0.02, 0.4, 0.02), L('#f6f4ef'), 0, 0.42, 0.21);
  }
  return g;
}

// the set: a market stall with a striped awning, a counter and a shelf, lanterns and a sign
export function shopStation(s, { color = '#f5b616' } = {}) {
  const K = stage(s, { top: '#86b3e6', mid: '#d6e8fb', bottom: '#f6faff' }), { P, snowM } = K;
  const wood = L('#a8754e'), dark = L('#6e4a32');
  const counter = new Mesh(new BoxGeometry(5.6, 1.0, 1.2), wood); counter.position.set(0, 0.5, 0); counter.castShadow = counter.receiveShadow = true; P.add(counter);
  const top = new Mesh(new BoxGeometry(5.8, 0.1, 1.35), dark); top.position.set(0, 1.03, 0); P.add(top);
  const shelf = new Mesh(new BoxGeometry(5.0, 0.1, 0.6), dark); shelf.position.set(0, tall() ? 2.42 : 1.85, -0.75); P.add(shelf);
  const backW = new Mesh(new BoxGeometry(5.6, 2.8, 0.15), L('#d9b48a')); backW.position.set(0, 1.4, -1.1); P.add(backW);
  for (const x of [-2.75, 2.75]) { const post = new Mesh(new BoxGeometry(0.16, 3.4, 0.16), dark); post.position.set(x, 1.7, 0.55); P.add(post); }
  for (let k = 0; k < 8; k++) { // the striped awning: team colour and white
    const st = new Mesh(new BoxGeometry(0.75, 0.06, 1.9), L(k % 2 ? '#ffffff' : color)); st.position.set(-2.62 + k * 0.75, 3.35, 0.15); st.rotation.x = 0.28; P.add(st);
  }
  const awSnow = new Mesh(new BoxGeometry(6.1, 0.14, 1.7), snowM); awSnow.position.set(0, 3.5, 0.08); awSnow.rotation.x = 0.28; P.add(awSnow);
  const sg = new Mesh(new PlaneGeometry(2.4, 0.6), new MeshBasicMaterial({ map: sign('SNOW SHOP'), transparent: true })); sg.position.set(0, tall() ? 3.12 : 2.75, -1.0); P.add(sg);
  for (const x of [-2.4, 2.4]) { const lamp = new Mesh(new SphereGeometry(0.14, 12, 8), new MeshBasicMaterial({ color: '#ffd98a' })); lamp.position.set(x, 2.9, 0.75); P.add(lamp); }
  pines(P, [[-5.2, -2.2, 1.2], [5.4, -2.0, 1.3], [-6.6, 0.8, 1.0], [6.8, 0.9, 1.1]], snowM);
  mounds(P, [[-4.2, 2.2, 0.8], [4.4, 2.4, 0.9]], snowM);
  const A = actor(s, P, { at: [tall() ? -2.05 : -3.4, 0, tall() ? 1.6 : 1.9], face: tall() ? Math.PI - 0.5 : Math.PI - 0.7, scale: 0.8 }); // beside the counter
  return { tick: dt => { K.tick(dt); A?.tick(dt); }, K, A, color };
}

// the shop itself: the boosts on display, a price tag on each; `buy(id)` asks the stage runner
export function shopScene(s, { info, buy, color }) {
  const T = tall(), K = s.set.K, A = s.set.A;
  if (T) s.frame([0, 2.0, 7.4], [0, 1.72, 0], 34); else s.frame([0, 2.4, 7.4], [0, 1.45, 0], 46);
  const ids = Object.keys(SHOP.boosts);
  // portrait: two on the shelf, two on the counter; landscape: all four along the counter
  const spots = T ? [[-1.0, 1.08, 0.2], [1.0, 1.08, 0.2], [-1.0, 2.47, -0.75], [1.0, 2.47, -0.75]] : [[-1.95, 1.08, 0.2], [-0.65, 1.08, 0.2], [0.65, 1.08, 0.2], [1.95, 1.08, 0.2]];
  const items = ids.map((id, k) => {
    const m = itemMesh(id, color); m.position.set(...spots[k]); s.persist.add(m);
    const tag = s.label('', { cls: 'shop-tag', obj: m, at: T ? [0, -0.36, 0.4] : [0, -0.08, 0.35], onTap: () => buy(id), persistent: true }); // phones: just below the thing
    const ph = k * 1.3; s.onTick(dt => { if (!s.reduceMotion) m.rotation.y = Math.sin(performance.now() / 900 + ph) * 0.25; });
    return { id, m, tag };
  });
  const render = inf => {
    for (const it of items) {
      const b = SHOP.boosts[it.id], owned = (b.keep ? inf.boosts : inf.next).has(it.id), can = !owned && inf.stars >= b.cost;
      it.tag.className = 'wt-label shop-tag' + (owned ? ' owned' : can ? '' : ' poor');
      it.tag.innerHTML = `<b>${esc(b.name)}</b><small>${esc(b.tip)}</small><span class="shop-price">${owned ? (b.keep ? '✓ Yours' : '✓ Ready') : `Buy ⭐${b.cost}`}</span>`;
    }
  };
  render(info);
  return {
    refresh(inf, boughtId) {
      render(inf);
      const it = items.find(x => x.id === boughtId); if (!it) return;
      K.burst(it.m.position.clone().add(new Vector3(0, 0.4, 0)), ['#ffd166', '#ffffff', color], 30, 1.4); s.wobble(it.m); A?.cheer(); s.kick = 1;
    },
  };
}
