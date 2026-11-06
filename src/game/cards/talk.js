// A neighbourhood child asks you a question face to face (the camp before a fight), like the
// customer conversations in Languini: a close-up of the child on a snowy lane, their question in a
// speech bubble (read aloud), and your replies as chat bubbles below. Right first time: a big
// smile, a puff of snow, and they come out of it in your team's colour and puffer jacket. A miss:
// a surprised face, the right reply glows, and they will ask again in a moment. Scored like a
// choice card (one item, right first time or not).
import { Group, Mesh, MeshLambertMaterial, MeshBasicMaterial, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, PlaneGeometry, Vector3 } from 'three';
import { stage, pines, mounds } from './stationkit.js';
import { buildKid, bakeKid, setKidMood } from '../render/kids2.js';
import { esc } from './util.js';

const L = c => new MeshLambertMaterial({ color: c });
const tall = () => innerWidth / innerHeight < 0.8;

// the set: a snowy lane with snowed-in houses, lit windows, a lamp and a low fence
export function talkStation(s, { color = '#f5b616' } = {}) {
  const K = stage(s, { top: '#86b3e6', mid: '#d6e8fb', bottom: '#f6faff', ground: '#e8eff9' }), { P, snowM } = K;
  const walls = ['#e7d3c0', '#d5e2ee', '#e9d6de', '#dfe8d8', '#efe2c4'];
  for (let k = 0; k < 6; k++) { // a row of houses behind the child
    const x = -7.5 + k * 3, w = 2.6, h = 2.2 + (k % 2) * 0.7, z = -6.5 - (k % 3) * 0.4;
    const wall = new Mesh(new BoxGeometry(w, h, 2), L(walls[k % walls.length])); wall.position.set(x, h / 2, z); P.add(wall);
    const roof = new Mesh(new ConeGeometry(w * 0.82, 1.1, 4), L(['#5f6b95', '#6d6a9c', '#56709a'][k % 3])); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.62; roof.position.set(x, h + 0.55, z); P.add(roof);
    const cap = new Mesh(new SphereGeometry(w * 0.6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), snowM); cap.scale.set(1, 0.32, 0.62); cap.position.set(x, h + 0.62, z); P.add(cap);
    for (const dx of [-0.6, 0.6]) { const win = new Mesh(new PlaneGeometry(0.5, 0.55), new MeshBasicMaterial({ color: '#ffd98a' })); win.position.set(x + dx, h * 0.55, z + 1.01); P.add(win); }
  }
  const post = new Mesh(new CylinderGeometry(0.06, 0.08, 3, 8), L('#3d4a6b')); post.position.set(2.8, 1.5, -2.2); P.add(post);
  const lampG = new Mesh(new BoxGeometry(0.3, 0.36, 0.3), new MeshBasicMaterial({ color: '#ffcf7a' })); lampG.position.set(2.8, 3.05, -2.2); P.add(lampG);
  for (let k = -6; k <= 6; k++) { const pk = new Mesh(new BoxGeometry(0.1, 0.7, 0.08), L('#b9845a')); pk.position.set(k * 0.6, 0.35, -3.2); P.add(pk); }
  const rail = new Mesh(new BoxGeometry(8, 0.08, 0.06), L('#b9845a')); rail.position.set(0, 0.55, -3.2); P.add(rail);
  pines(P, [[-4.6, -4.4, 1.0], [4.8, -4.6, 1.1]], snowM);
  mounds(P, [[-2.8, -1.4, 0.7], [3.1, -1.2, 0.8]], snowM);
  return { tick: dt => K.tick(dt), K, color };
}

export function recruitTalk(ctx) {
  const s = ctx.world, st = ctx.step, who = st.speaker || {}, K = s.set.K, T = tall();
  // the camera: head and shoulders, the child a little above the middle, replies below
  if (T) s.frame([0, 1.6, 3.5], [0, 1.15, 0], 34); else s.frame([0, 1.6, 4.3], [0.6, 1.35, 0], 44);
  const g = new Group(); s.step.add(g);
  const make = (design, team) => { const k = bakeKid(buildKid({ design, team, kit: who.kit || 'thrower', ...(who.look || {}) })); k.traverse(o => { if (o.isMesh) o.castShadow = true; }); return k; };
  let kid = make('vinyl', 'neutral'); g.add(kid);
  const shadow = new Mesh(new CylinderGeometry(0.45, 0.45, 0.01, 20), new MeshBasicMaterial({ color: '#4a6182', transparent: true, opacity: 0.22, depthWrite: false })); shadow.position.y = 0.01; g.add(shadow);
  // their question, in a speech bubble over their head (read aloud), with their name
  const bubble = s.label(`<b class="wt-who">${esc(who.name || '')}</b><span>${esc(st.prompt)}</span>`, { cls: T ? 'wt-bubble' : 'wt-bubble side', obj: g, at: T ? [0, 2.62, 0] : [1.7, 1.98, 0.4] } /* landscape: above your replies, like a chat */);
  const sayBubble = html => { bubble.innerHTML = `<b class="wt-who">${esc(who.name || '')}</b><span>${html}</span>`; bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop'); };
  ctx.speech?.say(st.prompt);
  // your replies: chat bubbles, stacked below the child
  const n = st.options.length, replies = st.options.map((o, i) => {
    const el = s.label(`<span class="wt-you">You</span>${esc(o)}`, { cls: 'wt-reply', onTap: () => pick(i), obj: g, at: T ? [0, 0.95 - i * 0.42, 1.25] : [1.55, 1.36 - i * 0.42, 0.4] });
    return el;
  });
  // the child's little moves: waiting (sway), happy (hop), surprised (lean back)
  let t = 0, hop = 0, lean = 0;
  s.onTick(dt => {
    t += dt; if (s.reduceMotion) return;
    hop = Math.max(0, hop - dt * 1.6); lean = Math.max(0, lean - dt * 1.4);
    kid.position.y = Math.abs(Math.sin(hop * Math.PI * 2)) * 0.35 * Math.min(1, hop * 2);
    kid.rotation.y = Math.sin(t * 1.3) * 0.08; kid.rotation.x = -lean * 0.18;
  });
  let tried = false, done = false;
  const glowRight = () => replies[st.answer].classList.add('show');
  const pick = i => {
    if (ctx.busy || done) return;
    if (i === st.answer) {
      done = true; ctx.item(st.sourceIds?.[0], !tried); replies[i].classList.add('right'); ctx.reveal(st.answerText || st.options[i]);
      for (const r of replies) if (r !== replies[i]) r.classList.add('dim');
      if (!tried) { // they join: a smile, a hop, a puff of snow, and out they come in the team's puffer jacket
        setKidMood(kid, 'joy'); hop = 1; ctx.sound('sparkle');
        sayBubble("Yes! I'm on your team!");
        ctx.later(() => {
          K.burst(new Vector3(0, 1.1, 0).add(g.position), ['#ffffff', '#e8f4ff', s.set.color], 46, 1.8); ctx.sound('superReady');
          g.remove(kid); kid = make('puffer', s.player?.team || 'hufflepuff'); setKidMood(kid, 'joy'); g.add(kid); hop = 1;
        }, 650);
        ctx.finish(2300);
      } else { // right, but not first time: they will ask again in a moment
        setKidMood(kid, 'happy'); sayBubble("That's it! Ask me again in a moment and I'll join."); ctx.finish(1900);
      }
    } else {
      replies[i].classList.remove('wrong'); void replies[i].offsetWidth; replies[i].classList.add('wrong'); ctx.sound('tap');
      setKidMood(kid, 'surprised'); lean = 1; glowRight();
      if (!tried) { tried = true; sayBubble('Hmm… not quite! Try the glowing one.'); ctx.later(() => setKidMood(kid, 'happy'), 1200); }
    }
  };
  ctx.onTimeUp(() => { if (done) return; done = true; if (!tried) ctx.item(st.sourceIds?.[0], false); glowRight(); ctx.reveal(st.answerText || st.options[st.answer]); sayBubble(`I wanted to hear: "${esc(st.options[st.answer])}"`); ctx.finish(1900); });
}
