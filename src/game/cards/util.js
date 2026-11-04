// Small helpers shared by the card shell and its scenes.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const shuffle = (a, rng = Math.random) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const wait = ms => new Promise(r => setTimeout(r, ms));
// the order the blocks of an order step go in (their ids end in #0, #1 …)
export const blockOrder = blocks => blocks.slice().sort((a, b) => +String(a.id).split('#').pop() - +String(b.id).split('#').pop());
