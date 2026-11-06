// The team kids (the characters with the most screen time), with smooth 3D shading.
// Chosen look: 'puffer' – a chunky kid in a quilted puffer jacket with a fur collar, big mittens and
// boots, with the big glossy 'vinyl' eyes. 'vinyl' and 'plush' stay as lab comparisons.
// Girls and boys: girls wear pigtails, braids or a ponytail and have eyelashes; boys have short,
// curly or tufted hair. Hats by kit: thrower = beanie, lobber = earmuffs, sprayer = cap with goggles.
// bakeKid() merges a model into a few draw calls for the game (body, face, badge, each arm and leg).
import {
  Group, Mesh, MeshStandardMaterial, MeshPhysicalMaterial, MeshLambertMaterial, MeshBasicMaterial, SphereGeometry, CapsuleGeometry, CylinderGeometry,
  TorusGeometry, BoxGeometry, CircleGeometry, CanvasTexture, SRGBColorSpace, Color, Matrix4, BufferAttribute,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../../config.js';
import { emblemSVG } from '../../emblems.js';

export const DESIGNS = ['puffer', 'vinyl', 'plush'];
const SKINS = ['#f3c9a5', '#e0a87e', '#c68863', '#a86f4d', '#f6d5bb'];
const HAIR = ['#3b2a20', '#6a3f22', '#c98a3c', '#1f1a1a', '#8a4b2a'];

const texCache = new Map();
function canvas(key, w, h, draw) { if (texCache.has(key)) return texCache.get(key); const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4; texCache.set(key, t); return t; }

// faces: drawn crisp on a patch over the front of the head. Moods: 'happy' (default), 'joy' (eyes
// squeezed into smiles, a big open smile), 'surprised' (wide eyes, raised brows, an O mouth)
function faceTex(style, mood = 'happy', lashes = false) {
  return canvas('face' + style + mood + lashes, 256, 256, (g, W) => {
    const eye = (x, y, big) => {
      if (style === 'plush') return; // plush kids get real button eyes
      if (style === 'vinyl') { g.fillStyle = '#141826'; g.beginPath(); g.ellipse(x, y, big * 0.78, big, 0, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x - big * 0.25, y - big * 0.4, big * 0.28, big * 0.34, 0, 0, 7); g.fill(); g.beginPath(); g.arc(x + big * 0.3, y + big * 0.35, big * 0.12, 0, 7); g.fill(); return; }
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, y, big * 0.8, big, 0, 0, 7); g.fill();
      g.fillStyle = '#5a3a2a'; g.beginPath(); g.ellipse(x, y + big * 0.12, big * 0.55, big * 0.68, 0, 0, 7); g.fill();
      g.fillStyle = '#1c2340'; g.beginPath(); g.ellipse(x, y + big * 0.15, big * 0.33, big * 0.42, 0, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x - big * 0.22, y - big * 0.2, big * 0.2, 0, 7); g.fill(); g.beginPath(); g.arc(x + big * 0.2, y + big * 0.32, big * 0.09, 0, 7); g.fill();
      g.strokeStyle = '#1c2340'; g.lineWidth = 5; g.beginPath(); g.ellipse(x, y, big * 0.8, big, 0, 0, 7); g.stroke();
    };
    const big = style === 'vinyl' ? 30 : style === 'plush' ? 16 : 26, ey = style === 'vinyl' ? 118 : 116, ex = style === 'vinyl' ? 52 : 44;
    const joy = mood === 'joy', wow = mood === 'surprised', browUp = wow ? 14 : joy ? 4 : 0;
    if (joy && style !== 'plush') { g.strokeStyle = '#141826'; g.lineWidth = 10; g.lineCap = 'round'; for (const s of [-1, 1]) { g.beginPath(); g.arc(W / 2 + s * ex, ey + 10, big * 0.72, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); } }
    else { eye(W / 2 - ex, ey, wow ? big * 1.14 : big); eye(W / 2 + ex, ey, wow ? big * 1.14 : big); }
    if (lashes && !joy) { g.strokeStyle = '#141826'; g.lineWidth = 6; g.lineCap = 'round'; for (const s of [-1, 1]) for (const [a, l] of [[0.25, 16], [0.62, 14]]) { const x0 = W / 2 + s * (ex + Math.sin(a) * big * 0.78), y0 = ey - Math.cos(a) * big; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + s * l * Math.sin(a + 0.5), y0 - l * Math.cos(a + 0.5)); g.stroke(); } }
    if (style !== 'plush') { g.strokeStyle = '#3b2a20'; g.lineWidth = 7; g.lineCap = 'round'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(W / 2 + s * (ex - 18), ey - big - 16 - browUp); g.quadraticCurveTo(W / 2 + s * ex, ey - big - 24 - browUp * 1.3, W / 2 + s * (ex + 18), ey - big - 12 - browUp); g.stroke(); } }
    g.fillStyle = 'rgba(255,120,130,0.45)'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(W / 2 + s * (ex + 26), ey + 44, 22, 13, 0, 0, 7); g.fill(); }
    g.strokeStyle = '#1c2340'; g.lineWidth = style === 'plush' ? 4 : 6; g.lineCap = 'round';
    if (style === 'plush') { g.setLineDash([7, 6]); g.beginPath(); g.arc(W / 2, ey + 34, 22, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke(); g.setLineDash([]); }
    else if (joy) { g.fillStyle = '#7a2a2a'; g.beginPath(); g.moveTo(W / 2 - 32, ey + 38); g.quadraticCurveTo(W / 2, ey + 92, W / 2 + 32, ey + 38); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#ff8a8a'; g.beginPath(); g.ellipse(W / 2, ey + 63, 13, 7, 0, 0, 7); g.fill(); }
    else if (wow) { g.fillStyle = '#7a2a2a'; g.beginPath(); g.ellipse(W / 2, ey + 54, 11, 15, 0, 0, 7); g.fill(); g.stroke(); }
    else if (mood === 'happy') { g.fillStyle = '#7a2a2a'; g.beginPath(); g.moveTo(W / 2 - 22, ey + 40); g.quadraticCurveTo(W / 2, ey + 70, W / 2 + 22, ey + 40); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#ff8a8a'; g.beginPath(); g.ellipse(W / 2, ey + 55, 9, 5, 0, 0, 7); g.fill(); }
  });
}
const knitTex = col => canvas('knit' + col, 64, 64, (g, W) => { g.fillStyle = col; g.fillRect(0, 0, W, W); g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 3; for (let y = 0; y < W; y += 8) for (let x = 0; x < W; x += 8) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4, y + 7); g.lineTo(x + 8, y); g.stroke(); } g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1.5; for (let y = 2; y < W; y += 8) for (let x = 0; x < W; x += 8) { g.beginPath(); g.moveTo(x + 1, y); g.lineTo(x + 4, y + 5); g.stroke(); } });
const emblemTex = team => canvas('emb' + team, 128, 128, (g, W) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); const im = new Image(); im.onload = () => { g.drawImage(im, 8, 8, 112, 112); texCache.get('emb' + team).needsUpdate = true; }; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(emblemSVG(team, 112).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')); });

// one kid model: { design, team, kit, skin (index), hair (index) }
// a neighbourhood child not on a team yet: a plain everyday coat, no badge (team 'neutral')
export const NEUTRAL = { color: '#c9bba4', dark: '#8c7d68' };
export function buildKid({ design = 'puffer', team = 'hufflepuff', kit = 'thrower', gender = 'boy', style = null, skin = 0, hair = 0, mood = 'happy' } = {}) {
  const girl = gender === 'girl'; style = style || (girl ? 'pigtails' : 'short');
  const T = CONFIG.teams[team] || NEUTRAL, root = new Group(), col = T.color, dark = T.dark, skinCol = SKINS[skin % SKINS.length], hairCol = HAIR[hair % HAIR.length];
  const fab = c => design === 'vinyl' ? new MeshPhysicalMaterial({ color: c, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 }) : design === 'plush' ? new MeshLambertMaterial({ color: '#ffffff', map: knitTex(c) }) : new MeshStandardMaterial({ color: c, roughness: 0.72, metalness: 0 });
  const skinM = design === 'vinyl' ? new MeshPhysicalMaterial({ color: skinCol, roughness: 0.38, clearcoat: 0.6 }) : design === 'plush' ? new MeshLambertMaterial({ color: skinCol }) : new MeshStandardMaterial({ color: skinCol, roughness: 0.6 });
  const M = { team: fab(col), dark: fab(dark), white: fab('#f6f4ef'), boot: fab(design === 'plush' ? '#8a5a3c' : '#5a3a2a'), pants: fab('#34405e'), hair: fab(hairCol), scarf: fab(kit === 'lobber' ? '#ffd166' : kit === 'sprayer' ? '#7bdff2' : '#f4f1ea') };
  const add = (geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx, parent = root) => { const o = new Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); o.castShadow = true; parent.add(o); return o; };
  const S = (r, a = 24, b = 16) => new SphereGeometry(r, a, b);
  const hy = design === 'vinyl' ? 1.38 : design === 'puffer' ? 1.44 : 1.4, hr = design === 'vinyl' ? 0.56 : design === 'plush' ? 0.48 : 0.53;

  // legs and boots, each a group pivoting at the hip so it can walk
  const legs = [-1, 1].map(s => {
    const leg = new Group(); leg.position.set(s * 0.15, 0.45, 0); root.add(leg);
    add(new CapsuleGeometry(0.13, 0.18, 6, 12), M.pants, 0, -0.13, 0, 0, 0, 0, 1, 1, 1, leg);
    if (design === 'vinyl') add(new CapsuleGeometry(0.15, 0.12, 6, 12), M.boot, 0, -0.35, 0.05, Math.PI / 2, 0, 0, 1, 1, 1, leg);
    else { add(S(0.17, 16, 12), M.boot, 0, -0.35, 0.05, 0, 0, 0, 1, 0.75, 1.35, leg); add(new TorusGeometry(0.14, 0.05, 8, 16), M.white, 0, -0.25, 0.02, Math.PI / 2, 0, 0, 1, 1, 1, leg); add(new CylinderGeometry(0.17, 0.18, 0.04, 16), fab('#2b2f45'), 0, -0.43, 0.06, 0, 0, 0, 1, 1, 1.3, leg); }
    return leg;
  });
  // body
  if (design === 'puffer') {
    add(new CapsuleGeometry(0.35, 0.34, 8, 20), M.team, 0, 0.8, 0);
    [0.6, 0.79, 0.98].forEach((y, k) => add(new TorusGeometry(0.33 - k * 0.025, 0.1, 12, 28), M.team, 0, y, 0, Math.PI / 2)); // quilted puffer
    add(new BoxGeometry(0.04, 0.55, 0.04), M.dark, 0, 0.8, 0.43);
    add(new TorusGeometry(0.47, 0.06, 6, 20, Math.PI), M.dark, 0, 0.46, 0, Math.PI / 2, 0, 0, 0.82, 0.82, 0.82); // hem
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; add(S(0.11, 10, 8), M.white, Math.sin(a) * 0.27, 1.12 + (k % 2) * 0.02, Math.cos(a) * 0.27); } // fur collar
  } else if (design === 'vinyl') {
    add(new CapsuleGeometry(0.34, 0.24, 10, 24), M.team, 0, 0.74, 0);
    add(new CylinderGeometry(0.36, 0.36, 0.12, 24), M.dark, 0, 0.5, 0);
  } else {
    add(S(0.42, 24, 18), M.team, 0, 0.8, 0, 0, 0, 0, 1, 1.05, 0.95);
    add(new TorusGeometry(0.4, 0.015, 4, 32), fab('#1c2340'), 0, 0.8, 0, Math.PI / 2); // a seam
    for (const y of [0.92, 0.72]) add(new CylinderGeometry(0.045, 0.045, 0.03, 12), M.white, 0, y, 0.41, Math.PI / 2); // buttons
  }
  // chest badge with the team emblem
  if (CONFIG.teams[team]) { // not for a child who is not on a team yet
    const badge = add(new CircleGeometry(0.12, 24), new MeshBasicMaterial({ map: emblemTex(team), transparent: true }), design === 'puffer' ? 0.17 : 0, design === 'vinyl' ? 0.82 : 0.9, design === 'vinyl' ? 0.355 : design === 'plush' ? 0.42 : 0.45);
    badge.castShadow = false; if (design !== 'plush') badge.rotation.x = -0.1;
  }
  // scarf
  add(new TorusGeometry(design === 'vinyl' ? 0.3 : 0.31, 0.09, 10, 22), M.scarf, 0, 1.14, 0, Math.PI / 2); add(new BoxGeometry(0.16, 0.42, 0.07), M.scarf, 0.14, 0.92, 0.3, 0.15, 0, 0.15);
  // arms and mittens
  const arms = [-1, 1].map(s => {
    const arm = new Group(); arm.position.set(s * (design === 'vinyl' ? 0.42 : 0.44), 1.0, 0); arm.rotation.z = s * 0.35; root.add(arm);
    add(new CapsuleGeometry(0.12, design === 'vinyl' ? 0.16 : 0.26, 6, 12), M.team, 0, -0.18, 0, 0, 0, 0, 1, 1, 1, arm);
    if (design === 'puffer') add(new TorusGeometry(0.11, 0.045, 8, 14), M.white, 0, -0.34, 0, Math.PI / 2, 0, 0, 1, 1, 1, arm);
    add(S(design === 'puffer' ? 0.15 : 0.13, 14, 10), design === 'plush' ? M.white : M.dark, 0, design === 'vinyl' ? -0.34 : -0.42, 0, 0, 0, 0, 1, 1, 1, arm);
    return arm;
  });
  // head, face, ears, hair. Eyes sit on the head's equator; every hat stops above the brows.
  add(S(hr, 32, 24), skinM, 0, hy, 0, 0, 0, 0, 1.04, 0.98, 1);
  const face = add(new SphereGeometry(hr * 1.008, 32, 16, Math.PI / 2 - 1.0, 2.0, Math.PI / 2 - 0.7, 1.55), new MeshBasicMaterial({ map: faceTex(design === 'plush' ? 'plush' : 'vinyl', mood, girl), transparent: true }), 0, hy, 0, 0, 0, 0, 1.04, 0.98, 1); face.castShadow = false; face.userData.isFace = true;
  if (design === 'plush') { const btn = new MeshStandardMaterial({ color: '#1c2340', roughness: 0.25 }); for (const s of [-1, 1]) { add(S(0.065, 14, 10), btn, s * hr * 0.35, hy + 0.01, hr * 0.92, 0, 0, 0, 1, 1, 0.45); add(new TorusGeometry(0.035, 0.008, 4, 12), fab('#ffffff'), s * hr * 0.35, hy + 0.01, hr * 0.92 + 0.03); } }
  for (const s of [-1, 1]) add(S(0.09, 12, 10), skinM, s * hr * 1.0, hy - 0.04, 0, 0, 0, 0, 0.6, 1, 1);
  const capY = hy + hr * 0.47, capR = hr * 0.93;               // where every hat's edge sits
  add(new SphereGeometry(hr * 1.035, 28, 12, 0, Math.PI * 2, 0, 1.1), M.hair, 0, hy, -0.01, 0, 0, 0, 1.04, 1, 1); // hair on top
  // hair down the back and sides: to the nape for boys, past the ears for girls
  add(new SphereGeometry(hr * (girl ? 1.06 : 1.04), 24, 16, Math.PI * 1.5 - 1.85, 3.7, 0.5, girl ? 1.75 : 1.2), M.hair, 0, hy, -0.01, 0, 0, 0, 1.04, 1, 1);
  const tie = fab(kit === 'lobber' ? '#ffd166' : kit === 'sprayer' ? '#7bdff2' : col);
  if (style === 'pigtails') for (const s of [-1, 1]) {           // two bunches behind the ears
    add(S(0.06, 10, 8), tie, s * hr * 0.98, hy - 0.08, -hr * 0.4);
    add(S(0.15, 16, 12), M.hair, s * hr * 1.1, hy - 0.24, -hr * 0.42, 0, 0, s * 0.35, 0.8, 1.25, 0.85);
  } else if (style === 'braids') for (const s of [-1, 1]) {      // two braids over the shoulders
    for (let k = 0; k < 3; k++) add(S(0.09 - k * 0.008, 12, 10), M.hair, s * (hr * 0.82 + k * 0.03), hy - 0.32 - k * 0.15, hr * 0.12 + k * 0.05, 0, 0, 0, 1, 1.15, 1);
    add(S(0.05, 8, 6), tie, s * (hr * 0.82 + 0.1), hy - 0.78, hr * 0.12 + 0.17);
  } else if (style === 'ponytail') {                             // a ponytail out of the back
    add(S(0.07, 10, 8), tie, 0, hy + 0.02, -hr * 1.04);
    add(new CapsuleGeometry(0.12, 0.34, 8, 14), M.hair, hr * 0.42, hy - 0.2, -hr * 1.02, -0.35, 0, 0.55, 1, 1, 0.85); // swung to one side so it shows from the front
  } else if (style === 'curly') {                                // curls round the hairline
    for (let k = 0; k < 9; k++) { const a = -1.9 + k * 0.475; add(S(0.085, 10, 8), M.hair, Math.sin(a) * hr * 0.98, hy + hr * 0.3 + Math.cos(a * 0.8) * 0.06, Math.cos(a) * hr * 0.9); }
  }
  if (girl) for (const s of [-1, 1]) add(new CapsuleGeometry(0.075, 0.2, 6, 10), M.hair, s * hr * 0.9, hy - 0.12, hr * 0.32, 0.15, 0, s * 0.12); // locks framing the face
  if (style === 'tuft' && kit === 'lobber') { add(new CapsuleGeometry(0.06, 0.12, 4, 8), M.hair, 0.04, hy + hr * 1.0, hr * 0.35, 0.7, 0, -0.3); add(new CapsuleGeometry(0.05, 0.1, 4, 8), M.hair, -0.06, hy + hr * 0.98, hr * 0.4, 0.8, 0, 0.35); } // a tuft sticking out (hats cover it)
  // fringe: side-swept for girls, short for boys
  if (girl) for (const [x, sx] of [[-0.18, 1.0], [0.0, 1.25], [0.17, 0.9]]) add(S(0.12, 12, 10), M.hair, x, capY - 0.04 + Math.abs(x) * 0.05, hr * 0.82 - Math.abs(x) * 0.15, 0.5, 0, -0.35, sx * 1.2, 0.55, 0.7);
  else for (const s of [-1, 0, 1]) add(S(0.11, 12, 10), M.hair, s * 0.15, capY - 0.02, hr * 0.84 - Math.abs(s) * 0.05, 0.5, 0, s * 0.3, 1.15, 0.6, 0.7);
  const dome = (m, sy = 1.08) => add(new SphereGeometry(hr * 1.07, 28, 12, 0, Math.PI * 2, 0, 1.12), m, 0, hy + 0.02, 0, 0, 0, 0, 1.04, sy, 1.04);
  const nBefore = root.children.length;
  if (kit === 'lobber') {                                       // earmuffs: a band over the top, cups on the ears
    add(new TorusGeometry(hr * 1.1, 0.045, 8, 28, Math.PI), M.dark, 0, hy - 0.02, 0);
    for (const s of [-1, 1]) { add(new CylinderGeometry(0.17, 0.17, 0.12, 20), M.dark, s * hr * 1.06, hy - 0.04, 0, 0, 0, Math.PI / 2); add(S(0.16, 14, 10), design === 'vinyl' ? M.team : M.white, s * hr * 1.14, hy - 0.04, 0, 0, 0, 0, 0.5, 1, 1); }
  } else if (kit === 'sprayer') {                               // cap with goggles pushed up on it
    dome(M.team, 1.0);
    add(new CylinderGeometry(hr * 0.72, hr * 0.78, 0.05, 24, 1, false, -1.3, 2.6), M.dark, 0, capY, hr * 0.38, 0.12, 0, 0); // visor
    if (design === 'puffer') add(S(0.08, 10, 8), M.white, 0, hy + hr * 1.1, 0);
    const a = 0.72, gy = hy + 0.02 + hr * 1.07 * Math.sin(a), gz = hr * 1.07 * Math.cos(a) * 1.04;
    add(new TorusGeometry(hr * 1.07 * Math.cos(a) * 1.05, 0.03, 6, 32), fab('#3d4a6b'), 0, gy, 0, Math.PI / 2);
    const lens = new MeshStandardMaterial({ color: '#ffb347', roughness: 0.15, emissive: new Color('#a85a00'), emissiveIntensity: 0.35 });
    for (const s of [-1, 1]) { const g = new Group(); g.position.set(s * 0.13, gy, gz - 0.02); g.rotation.set(Math.PI / 2 - a, s * 0.28, 0); root.add(g); add(new CylinderGeometry(0.1, 0.1, 0.07, 20), fab('#3d4a6b'), 0, 0, 0, 0, 0, 0, 1, 1, 1, g); add(new CylinderGeometry(0.075, 0.075, 0.075, 20), lens, 0, 0.005, 0, 0, 0, 0, 1, 1, 1, g); }
  } else {                                                      // beanie with a cuff and a pom-pom
    dome(design === 'plush' ? fab(col) : M.team, design === 'vinyl' ? 1.12 : 1.22);
    if (design === 'puffer') for (const y of [0.16, 0.3]) add(new TorusGeometry(capR * (1 - y * 0.9), 0.02, 6, 28), M.white, 0, capY + y, 0, Math.PI / 2);
    add(new TorusGeometry(capR + 0.03, 0.075, 10, 28), M.dark, 0, capY + 0.03, 0, Math.PI / 2, 0, 0, 1.04, 1, 1);
    add(S(design === 'vinyl' ? 0.18 : 0.15, 16, 12), M.white, 0, hy + hr * (design === 'vinyl' ? 1.2 : 1.3) + 0.1, 0); // pom-pom
    if (design === 'puffer') for (const s of [-1, 1]) { add(new BoxGeometry(0.1, 0.24, 0.16), M.team, s * hr * 1.0, hy - 0.08, -0.02, 0, 0, s * 0.12); add(S(0.05, 8, 6), M.white, s * hr * 1.0, hy - 0.26, -0.02); } // ear flaps
  }
  // hats are pushed back on the head so the eyes stay clear from the high game camera
  const tilt = kit === 'lobber' ? 0 : kit === 'sprayer' ? 0.42 : 0.36;
  if (tilt) { const pivot = new Group(); pivot.position.y = hy; pivot.rotation.x = -tilt; for (const o of root.children.slice(nBefore)) { o.position.y -= hy; pivot.add(o); } root.add(pivot); }
  root.userData = { design, team, kit, gender, style, arms, legs, face: { style: design === 'plush' ? 'plush' : 'vinyl', lashes: girl } };
  return root;
}

// Merge a kid model into a few meshes: everything plain-coloured becomes one vertex-coloured mesh
// per group (the body, each arm, each leg); textured parts (face, badge) stay as they are.
export function bakeKid(root, material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.68, metalness: 0, transparent: true })) {
  const { arms, legs } = root.userData;
  const collapse = (group, skip = []) => {
    group.updateMatrixWorld(true);
    const inv = new Matrix4().copy(group.matrixWorld).invert(), plain = [], keep = [];
    const walk = o => { for (const ch of o.children) { if (skip.includes(ch)) continue; if (ch.isMesh) (ch.material.map ? keep : plain).push(ch); walk(ch); } };
    walk(group);
    const geos = plain.map(m => {
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      g.applyMatrix4(new Matrix4().multiplyMatrices(inv, m.matrixWorld));
      const c = m.material.color, n = g.attributes.position.count, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new BufferAttribute(col, 3)); return g;
    });
    const kept = keep.map(m => { const mat = new Matrix4().multiplyMatrices(inv, m.matrixWorld); return { m, mat }; });
    for (const ch of [...group.children]) if (!skip.includes(ch)) group.remove(ch);
    if (geos.length) { const merged = new Mesh(mergeGeometries(geos), material); merged.castShadow = true; group.add(merged); }
    for (const { m, mat } of kept) { mat.decompose(m.position, m.quaternion, m.scale); group.add(m); }
  };
  for (const g of [...arms, ...legs]) collapse(g);
  collapse(root, [...arms, ...legs]);
  root.userData.material = material;
  return root;
}

// change a kid's expression: 'happy', 'joy' or 'surprised' (works on built and baked kids)
export function setKidMood(root, mood = 'happy') {
  const f = root.userData.face; if (!f || root.userData.mood === mood) return; root.userData.mood = mood;
  root.traverse(o => { if (o.isMesh && o.userData.isFace) { o.material.map = faceTex(f.style, mood, f.lashes); o.material.needsUpdate = true; } });
}
