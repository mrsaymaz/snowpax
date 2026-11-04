// World tasks (inspired by Languini's station close-ups): an English task played as a 3D action on
// the real landmark. The camera swoops in to the landmark, the fight goes on in slow motion around
// it, and the words sit on 3D things (snow bricks, birdhouses …) as crisp HTML labels pinned to
// them every frame, so they stay sharp, tappable and readable aloud.
//
// Two ways to play them (?tasks=arena for the first):
//   'station' (default) – a station opens: its own staged 3D set fills the screen (the Snow Castle
//                         workshop …), like Languini's stations; a snow flurry covers the cut
//   'arena'             – on the real landmark in the arena: the camera swoops in to it
// Either way the fight goes on in slow motion.
//
// The task card shell asks open(theme) for a session when a step has a world scene
// (cards/scenes.js). A session lives while the card stays open on that landmark; each step clears
// its own things, and things put in session.persist stay for the whole visit.
import { Group, Vector3, Scene, PerspectiveCamera } from 'three';

const EASE = t => t * t * (3 - 2 * t);

export class WorldTasks {
  constructor({ scene, layer, groundH = () => 0, fx = null, zones = () => [], player = null, reduceMotion = false, mode = 'station', stations = {} }) {
    Object.assign(this, { scene, layer, groundH, fx, zones, player, reduceMotion, mode, stations });
    this.wipe = document.createElement('div'); this.wipe.className = 'wt-wipe'; document.body.appendChild(this.wipe);
    this.session = null; this.blend = 0; this.lastPose = null;
    this.caption = document.createElement('div'); this.caption.className = 'wt-caption'; this.caption.hidden = true; layer.appendChild(this.caption);
  }
  get active() { return !!this.session; }
  // the camera pose the arena camera blends to: { eye, look } in world space, or null
  pose() { return this.session && !this.session.station ? this.session.camPose : null; }
  flurry() { if (this.reduceMotion) return; this.wipe.classList.remove('on'); void this.wipe.offsetWidth; this.wipe.classList.add('on'); }

  // a session on the landmark of this theme, if the student is at it (else null: the flat scene)
  open(theme) {
    if (this.session?.theme === theme) return this.session;
    const build = this.stations[theme], station = this.mode === 'station' && !!build;
    const z = this.zones().find(q => q.id === theme);
    if (!station && (!z || !this.player || Math.hypot(this.player.x - z.x, this.player.z - z.z) > 16)) return null;
    this.close();
    // a station: its own scene and camera, with the staged set built once per visit
    const scene = station ? new Scene() : this.scene, camera = station ? new PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 200) : null;
    const group = new Group();
    if (station) { scene.add(group); this.flurry(); } else { group.position.set(z.x, this.groundH(z.x, z.z), z.z); this.scene.add(group); }
    const persist = new Group(), step = new Group(); group.add(persist, step);
    const labels = new Set(), wt = this;
    const s = this.session = {
      theme, zone: z, group, persist, step, camPose: null, reduceMotion: this.reduceMotion, station, showAt: performance.now() + (station && !this.reduceMotion ? 160 : 0), scene: station ? scene : null, camera, set: null, // showAt: the cut hides under the flurry
      // camera target, in the landmark's (or station's) local space
      frame(eye, look) { s.camPose = { eye: group.localToWorld(new Vector3(...eye)), look: group.localToWorld(new Vector3(...look)) }; s.eyeDist = s.camPose.eye.distanceTo(s.camPose.look); if (station && !s.camAt) { s.camAt = { eye: s.camPose.eye.clone(), look: s.camPose.look.clone() }; } },
      // pixels per metre at the look point once the camera has arrived (to size things to their labels)
      pxPerMeter() { const fov = station ? camera.fov : 24; return innerHeight / (2 * (s.eyeDist || 10) * Math.tan(fov * Math.PI / 360)); },
      get ready() { return station || wt.blend > 0.9; },
      // an HTML label pinned to a 3D object (its local point at `at`), tappable
      label(html, { cls = '', obj = null, at = [0, 0, 0], onTap = null, persistent = false } = {}) {
        const el = document.createElement(onTap ? 'button' : 'div'); if (onTap) el.type = 'button';
        el.className = 'wt-label ' + cls; el.innerHTML = html; wt.layer.appendChild(el);
        const L = { el, obj, at: new Vector3(...at), persistent }; labels.add(L);
        if (onTap) el.addEventListener('click', e => { e.preventDefault(); onTap(); });
        el._pin = L; return el;
      },
      unlabel(el) { for (const L of labels) if (L.el === el) { labels.delete(L); el.remove(); } },
      measure(el) { el.style.visibility = 'hidden'; el.style.left = '0px'; el.style.top = '0px'; const r = el.getBoundingClientRect(); el.style.visibility = ''; return { w: r.width, h: r.height }; },
      puff(obj, n = 14, color = '#ffffff') { if (!wt.fx || wt.reduceMotion) return; const p = obj.getWorldPosition(new Vector3()); wt.fx.emit(p.x, p.y, p.z, n, color, 2.6, 0.5, 0.9); },
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
    if (station) s.set = build(s); // the staged set (lights, sky, castle …) in s.persist
    document.body.classList.add('worldtask'); document.body.classList.toggle('station', station); this.layer.hidden = false;
    return s;
  }
  close() {
    const s = this.session; if (!s) return;
    for (const L of s.labels) L.el.remove();
    this.scene.remove(s.group); s.group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); } });
    if (s.station) this.flurry();
    this.session = null; this.caption.hidden = true;
    document.body.classList.remove('worldtask', 'station');
  }

  // every frame, after the camera moved: animations, then pin the labels to their things
  tick(dt, camera) {
    const s = this.session; if (!s) return;
    if (s.station) { // the station's own camera: fit the screen, ease to the framed pose
      camera = s.camera; if (Math.abs(camera.aspect - innerWidth / innerHeight) > 1e-3) { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
      if (s.camPose && s.camAt) { const k = Math.min(1, dt * 3); s.camAt.eye.lerp(s.camPose.eye, k); s.camAt.look.lerp(s.camPose.look, k); camera.position.copy(s.camAt.eye); camera.lookAt(s.camAt.look); camera.updateMatrixWorld(); }
      s.set?.tick?.(dt);
    }
    for (const f of s.stepTicks) f(dt);
    for (const tw of [...s.tweens]) { tw.t += dt; const k = Math.min(1, tw.t / tw.T); tw.run(k); if (k >= 1) { s.tweens.splice(s.tweens.indexOf(tw), 1); tw.done?.(); } }
    const v = new Vector3(), W = innerWidth, H = innerHeight, show = s.station ? performance.now() >= s.showAt : this.blend > 0.85;
    for (const L of s.labels) {
      if (L.obj) { v.copy(L.at); L.obj.localToWorld(v); } else { v.copy(L.at); s.group.localToWorld(v); }
      v.project(camera);
      const on = show && v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
      L.el.style.opacity = on ? '' : '0'; L.el.style.pointerEvents = on ? '' : 'none';
      L.el.style.transform = `translate(${((v.x + 1) / 2 * W).toFixed(1)}px, ${((1 - v.y) / 2 * H).toFixed(1)}px) translate(-50%, -50%)`;
    }
  }
}
