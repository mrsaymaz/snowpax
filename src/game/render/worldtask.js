// Task stations (inspired by Languini's stations): an English task played as a 3D action in a staged
// set of its own that fills the screen (the Snow Castle workshop, the Treehouse …). A snow flurry
// covers the cut in and out, the fight goes on in slow motion meanwhile, and the words sit on 3D
// things (snow bricks, birdhouses …) as crisp HTML labels pinned to them every frame, so they stay
// sharp, tappable and readable aloud.
//
// The task card shell asks open(theme) for a session when a step has a station scene
// (cards/scenes.js). A session lives while the card stays open on that landmark; each step clears
// its own things, and things put in session.persist stay for the whole visit.
import { Group, Vector3, Scene, PerspectiveCamera } from 'three';

const EASE = t => t * t * (3 - 2 * t);
// the lens for a screen shape: the same width of the set on every screen. Tall (portrait) screens
// get a wider lens, up to 72°, and beyond that the camera steps back (k > 1).
function lens(aspect, width = 52) {
  const h = width * Math.PI / 360, fov = Math.min(72, Math.max(34, 2 * Math.atan(Math.tan(h) / aspect) * 180 / Math.PI));
  const hEff = Math.atan(Math.tan(fov * Math.PI / 360) * aspect);
  return { fov, k: Math.max(1, Math.tan(h) / Math.tan(hEff)) };
}

export class WorldTasks {
  constructor({ layer, player = null, reduceMotion = false, stations = {}, sound = null }) {
    Object.assign(this, { layer, player, reduceMotion, stations, sound });
    this.wipe = document.createElement('div'); this.wipe.className = 'wt-wipe'; document.body.appendChild(this.wipe);
    this.finger = document.createElement('div'); this.finger.className = 'wt-finger'; this.finger.textContent = '👆'; this.finger.hidden = true; layer.appendChild(this.finger);
    this.toured = new Set(); this.lastTap = null;
    this.session = null;
    this.caption = document.createElement('div'); this.caption.className = 'wt-caption'; this.caption.hidden = true; layer.appendChild(this.caption);
  }
  get active() { return !!this.session; }
  flurry() { if (this.reduceMotion) return; this.wipe.classList.remove('on'); void this.wipe.offsetWidth; this.wipe.classList.add('on'); }

  // the station of this theme (null if the theme has none: the flat card is used)
  open(theme) {
    if (this.session?.theme === theme) return this.session;
    const build = this.stations[theme]; if (!build) return null;
    this.close();
    // its own scene and camera, with the staged set built once per visit
    const scene = new Scene(), camera = new PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 200), group = new Group(), station = true;
    scene.add(group); this.flurry();
    const persist = new Group(), step = new Group(); group.add(persist, step);
    const labels = new Set(), wt = this;
    const s = this.session = {
      theme, group, persist, step, camPose: null, reduceMotion: this.reduceMotion, station, player: this.player, kick: 0, sound: (n, o) => wt.sound?.(n, o), scene, camera, set: null,
      showAt: performance.now() + (this.reduceMotion ? 0 : 160), // the cut hides under the flurry
      // the camera pose, in the station's space
      frame(eye, look, width = 52) { s.lensW = width; const L = lens(innerWidth / innerHeight, width); camera.fov = L.fov; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); const lk = new Vector3(...look); s.camPose = { eye: new Vector3(...eye).sub(lk).multiplyScalar(L.k).add(lk), look: lk }; s.eyeDist = s.camPose.eye.distanceTo(s.camPose.look); if (!s.camAt) s.camAt = { eye: s.camPose.eye.clone(), look: s.camPose.look.clone() }; },
      // pixels per metre at the look point once the camera has arrived (to size things to their labels)
      pxPerMeter() { return innerHeight / (2 * (s.eyeDist || 10) * Math.tan(camera.fov * Math.PI / 360)); },
      // an HTML label pinned to a 3D object (its local point at `at`), tappable
      label(html, { cls = '', obj = null, at = [0, 0, 0], onTap = null, persistent = false } = {}) {
        const el = document.createElement(onTap ? 'button' : 'div'); if (onTap) el.type = 'button';
        el.className = 'wt-label ' + cls; el.innerHTML = html; wt.layer.appendChild(el);
        const L = { el, obj, at: new Vector3(...at), persistent }; labels.add(L);
        if (onTap) el.addEventListener('click', e => { e.preventDefault(); wt.lastTap = el; wt.stopTour(); onTap(); });
        el._pin = L; return el;
      },
      unlabel(el) { for (const L of labels) if (L.el === el) { labels.delete(L); el.remove(); } },
      measure(el) { el.style.visibility = 'hidden'; el.style.left = '0px'; el.style.top = '0px'; const r = el.getBoundingClientRect(); el.style.visibility = ''; return { w: r.width, h: r.height }; },
      puff(obj, n = 14, color = '#ffffff') { s.set?.K?.burst(obj.getWorldPosition(new Vector3()), [color, '#e8f4ff'], n, 1.4); },
      say(text) { wt.caption.innerHTML = text; wt.caption.hidden = !text; wt.caption.classList.remove('show'); void wt.caption.offsetWidth; if (text) wt.caption.classList.add('show'); },
      // a step is over: its things and labels go; persistent ones stay
      onTick(fn) { s.stepTicks.push(fn); }, stepTicks: [],
      clearStep() { s.stepTicks = []; for (const tw of s.tweens.splice(0)) { tw.run(1); tw.done?.(); } // anything still moving lands now
        for (const L of [...labels]) if (!L.persistent) { L.el.remove(); labels.delete(L); } for (const c of [...step.children]) { step.remove(c); c.traverse?.(o => { if (o.isMesh) o.geometry.dispose(); }); } s.say(''); },
      tweens: [],
      // move an object along an arc (from its place to `to`, local), then call done
      fly(obj, to, { T = 0.45, lift = 1.1, spin = 0, done = null } = {}) {
        if (wt.reduceMotion) { obj.position.set(...to); done?.(); return; }
        const from = obj.position.clone(), end = new Vector3(...to);
        s.tweens.push({ t: 0, T, run: k => { const e = EASE(k); obj.position.lerpVectors(from, end, e); obj.position.y += Math.sin(Math.PI * k) * lift; obj.rotation.z = spin * Math.sin(Math.PI * k); }, done });
      },
      wobble(obj, done = null) {
        if (wt.reduceMotion) { done?.(); return; }
        const y0 = obj.position.y; s.tweens.push({ t: 0, T: 0.45, run: k => { obj.rotation.z = Math.sin(k * Math.PI * 4) * 0.25 * (1 - k); obj.position.y = y0 + Math.sin(k * Math.PI) * 0.25; }, done: () => { obj.rotation.z = 0; obj.position.y = y0; done?.(); } });
      },
      labels,
    };
    s.set = build(s); // the staged set (lights, sky, castle …) in s.persist
    document.body.classList.add('worldtask', 'station'); this.layer.hidden = false;
    return s;
  }
  // a right answer: a snowflake flies from what was tapped into the progress bar, and the camera nudges in
  reward(ok) {
    const s = this.session; if (!s || !ok) return;
    s.kick = 1;
    const from = this.lastTap?.getBoundingClientRect(), bar = document.querySelector('#taskcard .tc-bar')?.getBoundingClientRect();
    if (!from || !bar || this.reduceMotion) return;
    const st = document.createElement('div'); st.className = 'wt-star'; st.textContent = '❄'; document.body.appendChild(st);
    const x0 = from.left + from.width / 2, y0 = from.top + from.height / 2, x1 = bar.left + bar.width * (0.2 + Math.random() * 0.6), y1 = bar.top + bar.height / 2;
    st.animate([{ transform: `translate(${x0}px, ${y0}px) translate(-50%, -50%) scale(0.6)`, opacity: 1 }, { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 60}px) translate(-50%, -50%) scale(1.4)`, opacity: 1, offset: 0.5 }, { transform: `translate(${x1}px, ${y1}px) translate(-50%, -50%) scale(0.5)`, opacity: 0.2 }], { duration: 650, easing: 'cubic-bezier(.4,.1,.3,1)' }).onfinish = () => st.remove();
  }
  // the round at this station is done: fireworks over the landmark, the kid cheers, a fanfare.
  // Returns how long to stay in the station before going back to the fight.
  celebrate(text = 'Well done!') {
    const s = this.session; if (!s) return 0;
    this.stopTour(); s.say(`🎉 ${text}`); this.sound?.('fanfare');
    const K = s.set?.K, c = s.set?.colors || ['#ffd166', '#ffffff', '#7cc4f0', '#f3a6c8'];
    s.set?.A?.cheer(true); s.set?.ring?.(); s.set?.celebrate?.();
    if (K && !this.reduceMotion) { // bursts just above what the camera looks at, in front of the set
      const L = (s.camPose?.look || new Vector3(0, 2, 0)).clone();
      K.fireworks([[-2.4, 1.9], [2.3, 2.5], [0, 2.9], [-1.1, 1.4], [1.3, 1.7]].map(([x, y]) => [L.x + x, L.y + y, L.z - 0.6]), c);
    }
    return this.reduceMotion ? 1.0 : 1.8;
  }
  // the first time a station opens: a finger visits every option in turn, the same way, never hinting the answer
  tour() {
    const s = this.session; if (!s || this.toured.has(s.theme) || this.reduceMotion) return;
    this.toured.add(s.theme);
    const targets = [...this.layer.querySelectorAll('button.wt-label:not(.wt-bell):not(.placed)')].slice(0, 6); if (!targets.length) return;
    let k = 0; const f = this.finger; f.hidden = false;
    const next = () => { if (!this.session || k >= targets.length) { this.stopTour(); return; } const r = targets[k++].getBoundingClientRect(); f.style.transform = `translate(${r.left + r.width / 2}px, ${r.bottom - 4}px)`; f.classList.remove('tap'); void f.offsetWidth; f.classList.add('tap'); this.tourT = setTimeout(next, 650); };
    this.tourT = setTimeout(next, 550);
  }
  stopTour() { clearTimeout(this.tourT); this.finger.hidden = true; }
  close() {
    const s = this.session; if (!s) return; this.stopTour();
    for (const L of s.labels) L.el.remove();
    s.group.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); s.scene.clear();
    this.flurry();
    this.session = null; this.caption.hidden = true;
    document.body.classList.remove('worldtask', 'station');
  }

  // every frame: the station's camera, animations, then pin the labels to their things
  tick(dt) {
    const s = this.session; if (!s) return;
    { const camera = s.camera; // fit the screen, ease to the framed pose
      if (Math.abs(camera.aspect - innerWidth / innerHeight) > 1e-3) { camera.aspect = innerWidth / innerHeight; camera.fov = lens(camera.aspect, s.lensW).fov; camera.updateProjectionMatrix(); }
      if (s.camPose && s.camAt) {
        const k = Math.min(1, dt * 3); s.camAt.eye.lerp(s.camPose.eye, k); s.camAt.look.lerp(s.camPose.look, k);
        s.kick = Math.max(0, s.kick - dt * 3); const push = this.reduceMotion ? 0 : Math.sin(s.kick * Math.PI) * 0.035; // a little nudge in on a right answer
        camera.position.copy(s.camAt.eye).lerp(s.camAt.look, push); camera.lookAt(s.camAt.look); camera.updateMatrixWorld();
      }
      s.set?.tick?.(dt);
    }
    for (const f of s.stepTicks) f(dt);
    for (const tw of [...s.tweens]) { tw.t += dt; const k = Math.min(1, tw.t / tw.T); tw.run(k); if (k >= 1) { s.tweens.splice(s.tweens.indexOf(tw), 1); tw.done?.(); } }
    const v = new Vector3(), W = innerWidth, H = innerHeight, show = performance.now() >= s.showAt, camera = s.camera;
    for (const L of s.labels) {
      if (L.obj) { v.copy(L.at); L.obj.localToWorld(v); } else { v.copy(L.at); s.group.localToWorld(v); }
      v.project(camera);
      const on = show && v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
      L.el.style.opacity = on ? '' : '0'; L.el.style.pointerEvents = on ? '' : 'none';
      L.el.style.transform = `translate(${((v.x + 1) / 2 * W).toFixed(1)}px, ${((1 - v.y) / 2 * H).toFixed(1)}px) translate(-50%, -50%)`;
    }
  }
}
