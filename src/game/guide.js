// Mr. Saymaz's guide: the first time a player meets each part of the game (the stage, the sled ride,
// the camp, the Snow Shop, the fight, a task), Mr. Saymaz steps in from the side with a speech card,
// one short idea a card, a small moving picture of the gesture (swipe, tap, drag, the thumb stick)
// and a spotlight on the button he talks about. The game holds still meanwhile. Each guide shows once
// (saved on this device); "How to play" in the pause menu shows them again.
//
// guide.show(id, steps, { force }) → a promise, resolved when the player closes it
// a step: { pose, title, text, gesture, spot } — pose: full | smile | point | cheer | think;
// gesture: swipe | updown | tap | drag | stick | null; spot: a CSS selector to light up, or null
const POSES = ['full', 'smile', 'point', 'cheer', 'think'];
// off for automated test browsers (they cannot press Next) unless ?guides=on; ?guides=off for anyone
const Q = new URLSearchParams(location.search), OFF = Q.get('guides') === 'off' || (navigator.webdriver && Q.get('guides') !== 'on');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const GESTURE = {
  swipe: '<div class="gd-g gd-swipe" aria-hidden="true"><i class="lane"></i><i class="lane"></i><i class="lane"></i><b class="sled">🛷</b><span class="hand">👆</span><em class="ar l">‹</em><em class="ar r">›</em></div>',
  updown: '<div class="gd-g gd-updown" aria-hidden="true"><b class="sled">🛷</b><span class="hand">👆</span><em class="ar u">⌃</em><em class="ar d">⌄</em></div>',
  tap: '<div class="gd-g gd-tap" aria-hidden="true"><i class="ring"></i><span class="hand">👆</span></div>',
  drag: '<div class="gd-g gd-drag" aria-hidden="true"><i class="btn">❄</i><i class="trail"></i><span class="hand">👆</span></div>',
  stick: '<div class="gd-g gd-stick" aria-hidden="true"><i class="base"></i><i class="knob"></i></div>',
};

export function makeGuide({ save, writeSave, sound = () => {} }) {
  const el = document.createElement('div');
  el.id = 'guide'; el.className = 'guide'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'gd-title');
  el.innerHTML = `<div class="gd-dim"></div><div class="gd-spot" hidden></div>
    <div class="gd-man">${POSES.map(p => `<img src="img/saymaz/${p}.webp" alt="" data-pose="${p}" draggable="false">`).join('')}</div>
    <div class="gd-card"><div class="gd-name"><img src="img/saymaz/bust.webp" alt="" draggable="false"><b>Mr. Saymaz</b></div>
      <h3 id="gd-title"></h3><p class="gd-text"></p><div class="gd-demo"></div>
      <div class="gd-foot"><button type="button" class="gd-skip">Skip</button><span class="gd-dots" aria-hidden="true"></span><button type="button" class="gd-next">Next ▶</button></div></div>`;
  document.body.appendChild(el);
  for (const p of POSES) { const i = new Image(); i.src = `img/saymaz/${p}.webp`; } // ready before the first guide
  const $ = s => el.querySelector(s);
  const seen = () => (save.guides ||= {});
  let cur = null; // { steps, k, done }
  const queue = [];

  const place = sel => { // the spotlight on a button (a soft round hole in the dim, with a pulsing ring)
    const spot = $('.gd-spot'), t = sel && document.querySelector(sel), r = t && t.getClientRects().length ? t.getBoundingClientRect() : null; // (fixed elements have no offsetParent)
    if (!r || !r.width) { spot.hidden = true; el.classList.remove('spotting', 'spot-low', 'spot-left', 'spot-wide'); return; }
    const pad = 8; Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    spot.hidden = false; el.classList.add('spotting');
    // keep the card on the other half of the screen from the spot
    el.classList.toggle('spot-low', r.top + r.height / 2 > innerHeight * 0.55);
    const low = r.top + r.height / 2 > innerHeight * 0.45, wide = r.width > innerWidth * 0.6;
    el.classList.toggle('spot-left', !wide && low && r.left + r.width / 2 < innerWidth * 0.5); // a button where he stands: he steps over to the right
    el.classList.toggle('spot-wide', wide && low); el.style.setProperty('--lift', `${Math.max(0, innerHeight - r.top + 14)}px`); // a wide row at the bottom: he stands on top of it
  };
  const render = () => {
    const s = cur.steps[cur.k], last = cur.k === cur.steps.length - 1;
    for (const img of el.querySelectorAll('.gd-man img')) img.classList.toggle('on', img.dataset.pose === (s.pose || 'full'));
    $('#gd-title').textContent = s.title || ''; $('.gd-text').innerHTML = esc(s.text || '').replace(/\*(.+?)\*/g, '<b>$1</b>');
    $('.gd-demo').innerHTML = s.gesture ? GESTURE[s.gesture] || '' : ''; $('.gd-demo').hidden = !s.gesture;
    $('.gd-dots').innerHTML = cur.steps.length > 1 ? cur.steps.map((_, i) => `<i class="${i === cur.k ? 'on' : ''}"></i>`).join('') : '';
    $('.gd-next').textContent = last ? (s.go || "Let's go!") : 'Next ▶';
    $('.gd-skip').hidden = last || cur.steps.length < 2;
    const card = $('.gd-card'); card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
    place(s.spot);
    $('.gd-next').focus({ preventScroll: true });
  };
  const close = () => {
    const c = cur; cur = null; el.classList.add('out'); document.body.classList.remove('guiding');
    setTimeout(() => { if (!cur) { el.hidden = true; el.classList.remove('out', 'spotting'); } }, 260);
    c.done(); if (queue.length) { const [id, steps, opts, done] = queue.shift(); open(id, steps, opts, done); }
  };
  const next = () => { if (!cur) return; sound('tap'); if (cur.k < cur.steps.length - 1) { cur.k++; render(); } else close(); };
  $('.gd-next').onclick = next;
  $('.gd-skip').onclick = () => { if (cur) { sound('tap'); close(); } };
  el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); if (cur) close(); } });
  addEventListener('resize', () => { if (cur) place(cur.steps[cur.k].spot); });

  function open(id, steps, opts, done) {
    cur = { id, steps, k: 0, done };
    seen()[id] = true; writeSave?.(save);
    el.hidden = false; el.classList.remove('out'); document.body.classList.add('guiding');
    el.classList.toggle('enter', true); setTimeout(() => el.classList.remove('enter'), 600);
    sound('pop'); render();
  }
  return {
    get holding() { return !!cur; },
    seen: id => !!seen()[id],
    show(id, steps, opts = {}) {
      if (!steps?.length || (!opts.force && (seen()[id] || OFF))) return Promise.resolve(false);
      return new Promise(res => { const done = () => res(true); if (cur) queue.push([id, steps, opts, done]); else open(id, steps, opts, done); });
    },
    reset() { save.guides = {}; writeSave?.(save); },
  };
}

// what Mr. Saymaz says, part by part (simple English for Grades 5–8; touch or keyboard wording)
export function guideSteps(id, { touch = true, spell = false, ulti = false } = {}) {
  const T = touch;
  switch (id) {
    case 'welcome': return [
      { pose: 'full', title: "Hello! I'm Mr. Saymaz.", text: 'It is a snow day in Kasımpaşa, and the rival team took our outposts. Let’s take them back together!' },
      { pose: 'point', title: 'English is your power', text: 'Every right answer gives you *❄ snowflakes*. Right the first time? Even more!' },
      ...(ulti ? [{ pose: 'cheer', title: 'Ulti points for your team', text: "Win a stage with good English and your team gets *Ulti points* in my English League. Tap *League* on the first screen to see your grade's teams." }] : []),
      { pose: 'smile', title: 'How a stage goes', text: 'Sled in, make friends, shop for boosts, then win the snowball fight. Ready?', go: "Let's go!" },
    ];
    case 'sled': return [
      { pose: 'point', title: 'Steer the sled', text: T ? '*Swipe left or right* to change lanes.' : 'Press *← and →* to change lanes.', gesture: T ? 'swipe' : null },
      { pose: 'point', title: 'Jump and duck', text: T ? '*Swipe up* to jump over fences. *Swipe down* to duck under lines.' : 'Press *↑* to jump and *↓* to duck.', gesture: T ? 'updown' : null },
      { pose: 'smile', title: 'Ramps and snowflakes', text: 'Ride up the *blue ramps* and catch the *purple snowflakes*. Tap in the air to spin!', gesture: T ? 'tap' : null },
      ...(spell ? [{ pose: 'think', title: 'Spell the word', text: 'Ride into the letters *in the right order*. The first letter is a gift!' }] : []),
      { pose: 'cheer', title: 'Look to the left!', text: 'On the way you pass the places of this stage. Enjoy the view!', go: 'Ride!' },
    ];
    case 'camp': return [
      { pose: 'point', title: 'Walk around', text: T ? 'Put your *thumb on the left half* of the screen and slide it. Or tap the map to walk there.' : 'Walk with *W A S D* or the arrow keys. Or click the map.', gesture: T ? 'stick' : null, spot: '#minimap' },
      { pose: 'smile', title: 'Make friends', text: 'Neighbourhood kids want to join your team. *Walk up to each one* and answer their question.', go: 'OK!' },
    ];
    case 'shop': return [
      { pose: 'point', title: 'The Snow Shop', text: 'These are your *❄ snowflakes*. You earn them with English.', spot: '#build .bd-stars' },
      { pose: 'smile', title: 'Buy a boost', text: '*Tap a price tag* to buy it. You see it on your kid at once!', gesture: T ? 'tap' : null },
      { pose: 'think', title: 'Your snowball style', text: 'Try each style: *fast throws*, *lobs over walls* or *three at once*.', spot: '#build .bd-kits' },
      { pose: 'cheer', title: 'Ready?', text: 'Tap *Fight!* when you are ready.', spot: '#build .bd-go', go: 'Got it!' },
    ];
    case 'fight': return [
      { pose: 'point', title: 'Move', text: T ? 'Put your *thumb on the left half* of the screen and slide it to move.' : 'Walk with *W A S D* or the arrow keys.', gesture: T ? 'stick' : null },
      { pose: 'point', title: 'Throw', text: T ? '*Tap* to throw at the nearest rival. *Drag* to aim.' : '*Click* to throw where the mouse points.', gesture: T ? 'drag' : null, spot: T ? '#attack' : null },
      { pose: 'smile', title: 'Super snowball', text: 'When the *star* glows, tap it to roll a giant snowball!', spot: '#super' },
      { pose: 'cheer', title: 'Win the fight', text: 'Freeze rivals to win. Frozen? No problem: you are back in a moment.', spot: '#zone', go: 'Fight!' },
    ];
    case 'task': return [
      { pose: 'think', title: 'A task', text: 'Read the task at the top. Then *tap the answer* in the scene.', spot: '#taskcard', gesture: T ? 'tap' : null },
      { pose: 'smile', title: 'Mistakes are OK', text: 'Not sure? Try! After a mistake *the right answer glows* to help you.', go: 'OK!' },
    ];
    case 'strike': return [{ pose: 'point', title: 'Hold the circle', text: 'Stand in the glowing circle until the time runs out. Freeze anyone who steps in!', go: 'OK!' }];
    case 'showdown': return [{ pose: 'cheer', title: 'The captain!', text: 'Only *your* snowballs can freeze the captain. Your team keeps the others busy. Go!', go: 'Go!' }];
    default: return [];
  }
}
