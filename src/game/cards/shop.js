// The Snow Shop (build moments before each fight), like a clothes shop in a big open-world game: your
// own kid stands in the middle, looking at you, in front of a snowy market stall, and the four
// boosts are price tags on the parts they change (big gloves at a hand, quick hands at the other,
// a warm coat at the shoulder, super start by the head). Buy one and you see it on your kid at
// once (gear.js): red mittens, glowing wristbands, a fluffy collar and coat, a super-snowball badge and glow.
import { Group, Mesh, MeshLambertMaterial, MeshBasicMaterial, MeshStandardMaterial, BoxGeometry, CylinderGeometry, SphereGeometry, CapsuleGeometry, TorusGeometry, ExtrudeGeometry, PlaneGeometry, Shape, Vector3, CanvasTexture, SRGBColorSpace } from 'three';
import { stage, pines, mounds, actor } from './stationkit.js';
import { SHOP } from '../fights.mjs';
import { setGear, tickGear } from '../render/gear.js';
import { esc } from './util.js';

const L = c => new MeshLambertMaterial({ color: c });
const tall = () => innerWidth / innerHeight < 0.8;
const sign = text => { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#5a3a2a'; g.beginPath(); g.roundRect(6, 6, 500, 116, 26); g.fill(); g.strokeStyle = '#f2c14e'; g.lineWidth = 8; g.stroke(); g.fillStyle = '#fff6dc'; g.font = '900 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 68); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; };

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
  const A = actor(s, P, { at: [0, 0, 2.4], face: 0, scale: 1 }); // in the middle, looking at you
  return { tick: dt => { K.tick(dt); A?.tick(dt); }, K, A, color };
}

// the shop itself: your kid in the middle; a price tag beside each part a boost changes
const SPOTS = { super: [-0.95, 2.0, 0.1], coat: [0.98, 1.38, 0.1], gloves: [-0.98, 0.55, 0.1], quick: [0.98, 0.55, 0.1] };
export function shopScene(s, { info, buy, color }) {
  const T = tall(), K = s.set.K, A = s.set.A, kid = A?.kid;
  if (T) s.frame([0, 1.35, 7.0], [0, 1.12, 2.4], 34); else s.frame([0, 1.4, 6.9], [0, 1.15, 2.4], 40);
  const owned = inf => new Set([...inf.boosts, ...inf.next]);
  if (kid) setGear(kid, owned(info), { color });
  const tags = Object.keys(SHOP.boosts).map(id => ({ id, el: s.label('', { cls: 'shop-tag', obj: kid || s.persist, at: SPOTS[id], onTap: () => buy(id), persistent: true }) }));
  s.onTick(() => { if (kid) tickGear(kid, performance.now() / 1000); });
  const render = inf => {
    for (const { id, el } of tags) {
      const b = SHOP.boosts[id], has = (b.keep ? inf.boosts : inf.next).has(id), can = !has && inf.flakes >= b.cost;
      el.className = 'wt-label shop-tag' + (has ? ' owned' : can ? '' : ' poor');
      el.innerHTML = `<span class="shop-icon">${b.icon}</span><b>${esc(b.name)}</b><small>${esc(b.tip)}</small><span class="shop-price">${has ? (b.keep ? '✓ Yours' : '✓ Ready') : `Buy ❄ ${b.cost}`}</span>`;
    }
  };
  render(info);
  return {
    refresh(inf, boughtId) {
      render(inf); if (!kid || !boughtId) return;
      setGear(kid, owned(inf), { color }); // you see it on your kid at once
      const at = SPOTS[boughtId], p = kid.localToWorld(new Vector3(at[0] * 0.55, at[1], 0.3)).sub(s.group.position);
      K.burst(p, ['#ffd166', '#ffffff', color], 34, 1.4); A?.cheer(); s.kick = 1;
    },
  };
}
