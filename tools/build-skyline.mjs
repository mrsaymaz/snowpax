#!/usr/bin/env node
// Paints public/skyline.svg: the start-screen backdrop. Dusk over the frozen Golden Horn seen
// from snowed-in Kasımpaşa: the far shore's domes and minarets, Galata Tower on its hill, a
// ferry stuck in the ice, snowy rooftops with smoking chimneys, a laundry line, gulls and a cat.
// Generic shapes in the game's palette, not a copy of any picture.   node tools/build-skyline.mjs
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let seed = 11; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const W = 1600, H = 900, out = [];
const add = s => out.push(s);

add(`<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4c4f9a"/><stop offset="0.45" stop-color="#a98fc4"/><stop offset="0.72" stop-color="#f0b9a6"/><stop offset="0.82" stop-color="#ffd4a3"/></linearGradient>
<radialGradient id="sun" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff1d0"/><stop offset="0.3" stop-color="#ffd59a" stop-opacity="0.8"/><stop offset="1" stop-color="#ffb37a" stop-opacity="0"/></radialGradient>
<linearGradient id="ice" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9d9ea"/><stop offset="1" stop-color="#b9cdea"/></linearGradient>
<radialGradient id="win" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffcf7a" stop-opacity="0.9"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient>
</defs>`);
add(`<rect width="${W}" height="${H}" fill="url(#sky)"/>`);
add(`<circle cx="330" cy="560" r="260" fill="url(#sun)"/><circle cx="330" cy="560" r="46" fill="#fff0cf" opacity="0.9"/>`);

// the far shore: a long low hill with domes and slim minarets
const shoreY = x => 600 - 34 * Math.sin(x / 260) - 18 * Math.sin(x / 90 + 1);
let d = `M0 ${H} L0 ${shoreY(0)}`; for (let x = 0; x <= W; x += 20) d += ` L${x} ${shoreY(x).toFixed(1)}`; d += ` L${W} ${H} Z`;
add(`<path d="${d}" fill="#9a8cc4"/>`);
for (let k = 0; k < 70; k++) { const x = r() * W, y = shoreY(x), w = 14 + r() * 30, h = 8 + r() * 22; add(`<rect x="${x.toFixed(0)}" y="${(y - h + 6).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="#8a7dba"/>`); if (r() < 0.35) add(`<rect x="${(x + w * 0.3).toFixed(0)}" y="${(y - h + 10).toFixed(0)}" width="3" height="4" fill="#ffd08a" opacity="0.8"/>`); }
for (const [cx, s] of [[620, 1.15], [905, 0.9], [1130, 0.75], [140, 0.7]]) { // mosques on the skyline
  const y = shoreY(cx) - 8, R = 44 * s;
  add(`<g fill="#7d70b0"><rect x="${cx - R * 1.6}" y="${y - R * 0.55}" width="${R * 3.2}" height="${R * 0.7}"/><path d="M${cx - R} ${y - R * 0.5} A${R} ${R} 0 0 1 ${cx + R} ${y - R * 0.5} Z"/>`
    + `<path d="M${cx - R * 1.75} ${y - R * 0.3} A${R * 0.5} ${R * 0.5} 0 0 1 ${cx - R * 0.75} ${y - R * 0.3} Z"/><path d="M${cx + R * 0.75} ${y - R * 0.3} A${R * 0.5} ${R * 0.5} 0 0 1 ${cx + R * 1.75} ${y - R * 0.3} Z"/>`
    + [-2.3, 2.3].map(m => `<rect x="${cx + m * R - 4 * s}" y="${y - R * 2.6}" width="${8 * s}" height="${R * 2.4}"/><path d="M${cx + m * R - 6 * s} ${y - R * 2.6} L${cx + m * R} ${y - R * 3.2} L${cx + m * R + 6 * s} ${y - R * 2.6} Z"/>`).join('')
    + `</g><path d="M${cx - R * 0.98} ${y - R * 0.62} A${R} ${R} 0 0 1 ${cx + R * 0.98} ${y - R * 0.62} A${R} ${R * 0.55} 0 0 0 ${cx - R * 0.98} ${y - R * 0.62} Z" fill="#f4f1fb" opacity="0.85"/>`);
}

// Galata Tower on the Beyoğlu hill (right)
const hill = `M980 ${H} L980 640 Q1180 520 1600 560 L1600 ${H} Z`; add(`<path d="${hill}" fill="#7a6eae"/>`);
for (let k = 0; k < 26; k++) { const x = 1000 + r() * 600, y = 620 - (x - 980) * 0.12 + r() * 30, w = 20 + r() * 34, h = 14 + r() * 26; add(`<rect x="${x.toFixed(0)}" y="${(y - h).toFixed(0)}" width="${w.toFixed(0)}" height="${(h + 40).toFixed(0)}" fill="#6c609f"/><path d="M${(x - 3).toFixed(0)} ${(y - h).toFixed(0)} q${(w / 2 + 3).toFixed(0)} -12 ${(w + 6).toFixed(0)} 0 z" fill="#f2eefa"/>`); if (r() < 0.6) add(`<rect x="${(x + w / 3).toFixed(0)}" y="${(y - h + 9).toFixed(0)}" width="5" height="6" fill="#ffcf7a"/>`); }
{
  const x = 1270, b = 548;
  add(`<g fill="#5d5296"><rect x="${x - 26}" y="${b - 150}" width="52" height="160"/><rect x="${x - 34}" y="${b - 160}" width="68" height="12" rx="3"/><rect x="${x - 29}" y="${b - 190}" width="58" height="32"/><path d="M${x - 33} ${b - 190} L${x} ${b - 262} L${x + 33} ${b - 190} Z"/></g>`);
  add(`<path d="M${x - 33} ${b - 190} L${x} ${b - 262} L${x + 33} ${b - 190} Q${x} ${b - 205} ${x - 33} ${b - 190} Z" fill="#f6f3fc"/><rect x="${x - 36}" y="${b - 164}" width="72" height="6" rx="3" fill="#f6f3fc"/>`);
  for (let k = 0; k < 5; k++) add(`<rect x="${x - 22 + k * 10}" y="${b - 184}" width="5" height="16" rx="2.5" fill="#ffcf7a"/>`);
  for (let k = 0; k < 3; k++) add(`<rect x="${x - 4}" y="${b - 130 + k * 40}" width="8" height="14" rx="4" fill="#ffcf7a" opacity="0.85"/>`);
}

// the frozen Golden Horn with a ferry stuck in the ice
add(`<path d="M0 640 Q500 615 980 650 L1100 700 L0 720 Z" fill="url(#ice)"/>`);
for (let k = 0; k < 14; k++) { const x = r() * 1000, y = 640 + r() * 60; add(`<path d="M${x.toFixed(0)} ${y.toFixed(0)} l${(40 + r() * 80).toFixed(0)} ${(r() * 6 - 3).toFixed(0)}" stroke="#ffffff" stroke-width="2" opacity="0.6"/>`); }
add(`<g transform="translate(700 650)"><path d="M-70 0 L70 0 L58 18 L-58 18 Z" fill="#3d4a6b"/><rect x="-60" y="-6" width="120" height="8" fill="#f0ecf4"/><rect x="-42" y="-26" width="84" height="20" fill="#f0ecf4"/><rect x="-46" y="-30" width="92" height="6" rx="3" fill="#ffffff"/>`
  + [0, 1, 2, 3, 4].map(k => `<rect x="${-36 + k * 15}" y="-21" width="9" height="8" fill="#ffcf7a"/>`).join('') + `<rect x="16" y="-46" width="10" height="18" fill="#c8584a"/><circle cx="26" cy="-56" r="7" fill="#e8e4f2" opacity="0.7"/><circle cx="36" cy="-68" r="10" fill="#e8e4f2" opacity="0.5"/></g>`);

// near rooftops of Kasımpaşa, deep in snow
const roofs = [];
for (let x = -40; x < W + 60;) { const w = 110 + r() * 120, h = 60 + r() * 70; roofs.push([x, w, h]); x += w - 8; }
roofs.forEach(([x, w, h], k) => {
  const top = H - 70 - h, col = ['#3b3f78', '#45457f', '#34396f', '#4a4785'][k % 4];
  add(`<rect x="${x.toFixed(0)}" y="${top.toFixed(0)}" width="${w.toFixed(0)}" height="${(h + 80).toFixed(0)}" fill="${col}"/>`);
  add(`<path d="M${(x - 12).toFixed(0)} ${top.toFixed(0)} L${(x + w / 2).toFixed(0)} ${(top - 46).toFixed(0)} L${(x + w + 12).toFixed(0)} ${top.toFixed(0)} Z" fill="#2b2f60"/>`);
  add(`<path d="M${(x - 16).toFixed(0)} ${(top + 4).toFixed(0)} Q${(x - 8).toFixed(0)} ${(top - 12).toFixed(0)} ${(x + w / 2).toFixed(0)} ${(top - 52).toFixed(0)} Q${(x + w + 8).toFixed(0)} ${(top - 12).toFixed(0)} ${(x + w + 16).toFixed(0)} ${(top + 4).toFixed(0)} Q${(x + w / 2).toFixed(0)} ${(top - 14).toFixed(0)} ${(x - 16).toFixed(0)} ${(top + 4).toFixed(0)} Z" fill="#f7f5fd"/>`);
  if (r() < 0.65) { const cx = x + w * (0.2 + r() * 0.5), cy = top - 30; add(`<rect x="${cx.toFixed(0)}" y="${(cy - 26).toFixed(0)}" width="16" height="34" fill="#2a2d55"/><ellipse cx="${(cx + 8).toFixed(0)}" cy="${(cy - 27).toFixed(0)}" rx="13" ry="6" fill="#ffffff"/>`); for (let s = 0; s < 3; s++) add(`<circle cx="${(cx + 14 + s * 16).toFixed(0)}" cy="${(cy - 44 - s * 22).toFixed(0)}" r="${(8 + s * 6).toFixed(0)}" fill="#e9e3f3" opacity="${(0.55 - s * 0.14).toFixed(2)}"/>`); }
  for (let wi = 0; wi < Math.floor(w / 46); wi++) { const wx = x + 18 + wi * 46, wy = top + 22; if (wx + 22 > x + w) break; add(`<circle cx="${(wx + 11).toFixed(0)}" cy="${(wy + 13).toFixed(0)}" r="26" fill="url(#win)"/><rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="22" height="26" rx="3" fill="#ffcf7a"/><rect x="${(wx - 3).toFixed(0)}" y="${(wy + 24).toFixed(0)}" width="28" height="6" rx="3" fill="#ffffff"/>`); }
});
add(`<rect x="0" y="${H - 60}" width="${W}" height="60" fill="#f2f0fb"/><path d="M0 ${H - 62} Q200 ${H - 90} 420 ${H - 64} T880 ${H - 66} T1300 ${H - 60} T1600 ${H - 70} L1600 ${H} L0 ${H} Z" fill="#ffffff"/>`);
// a frozen laundry line between two roofs
{
  const [x1, y1, x2, y2] = [roofs[3][0] + roofs[3][1] - 20, H - 70 - roofs[3][2] + 16, roofs[5][0] + 30, H - 70 - roofs[5][2] + 16];
  add(`<path d="M${x1} ${y1} Q${(x1 + x2) / 2} ${Math.max(y1, y2) + 34} ${x2} ${y2}" stroke="#2a2d55" stroke-width="2" fill="none"/>`);
  const cols = ['#e8584a', '#f2c14e', '#4f9de0', '#7cc47a', '#e889b5'];
  for (let k = 1; k < 8; k++) { const t = k / 8, x = (1 - t) ** 2 * x1 + 2 * (1 - t) * t * (x1 + x2) / 2 + t * t * x2, y = (1 - t) ** 2 * y1 + 2 * (1 - t) * t * (Math.max(y1, y2) + 34) + t * t * y2; const big = k % 2; add(`<rect x="${(x - (big ? 12 : 5)).toFixed(0)}" y="${y.toFixed(0)}" width="${big ? 24 : 10}" height="${big ? 28 : 18}" rx="3" fill="${cols[k % cols.length]}"/><rect x="${(x - (big ? 13 : 6)).toFixed(0)}" y="${(y - 2).toFixed(0)}" width="${big ? 26 : 12}" height="5" rx="2" fill="#ffffff"/>`); }
}
// a cat by a chimney, gulls over the ice
{ const [x, , h] = roofs[8] || roofs[2], y = H - 70 - h - 40; add(`<g fill="#e39a4f" transform="translate(${(x + 40).toFixed(0)} ${y.toFixed(0)})"><ellipse cx="0" cy="0" rx="18" ry="12"/><circle cx="14" cy="-12" r="10"/><path d="M8 -20 l3 -9 l5 7 z M17 -21 l4 -8 l4 9 z"/><path d="M-16 4 q-14 -2 -12 -18" stroke="#e39a4f" stroke-width="5" fill="none" stroke-linecap="round"/></g>`); }
for (const [x, y, s] of [[520, 470, 1], [585, 440, 0.8], [880, 500, 0.7], [1440, 380, 0.9]]) add(`<path d="M${x - 22 * s} ${y} q${11 * s} ${-12 * s} ${22 * s} 0 q${11 * s} ${-12 * s} ${22 * s} 0" stroke="#ffffff" stroke-width="${4 * s}" fill="none" stroke-linecap="round"/>`);
// falling snow
for (let k = 0; k < 160; k++) add(`<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * H).toFixed(0)}" r="${(1.5 + r() * 3.5).toFixed(1)}" fill="#ffffff" opacity="${(0.5 + r() * 0.5).toFixed(2)}"/>`);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${out.join('')}</svg>`;
writeFileSync(resolve(ROOT, 'public/skyline.svg'), svg);
console.log(`skyline.svg: ${(svg.length / 1024).toFixed(1)} KB`);
