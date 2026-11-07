// No zooming while playing. A tap on a phone should never zoom the page, and if a zoom slips
// through (iPhone Safari ignores "user-scalable=no"), it snaps straight back so the game always fits.
// - double-tap zoom: `touch-action: manipulation` / `none` in game.css
// - pinch: Safari's gesture events and two-finger moves are cancelled (the game uses pointer
//   events, so taps, swipes, the thumb stick and throwing with two thumbs are not touched)
// - a zoom that happened anyway (an accessibility setting, an old browser): the viewport is reset
const stop = e => { if (e.cancelable) e.preventDefault(); };
for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, stop, { passive: false });
document.addEventListener('touchmove', e => { if (e.touches.length > 1 || (e.scale && e.scale !== 1)) stop(e); }, { passive: false });
document.addEventListener('dblclick', stop, { passive: false });

const meta = document.querySelector('meta[name="viewport"]'), base = meta?.content || '';
let flip = false, timer = 0;
function unzoom() {
  const vv = globalThis.visualViewport;
  if (!meta || !vv || vv.scale <= 1.01) return;
  // rewriting the viewport with maximum-scale=1 makes the browser fall back to 100%
  flip = !flip; meta.content = base.replace(/initial-scale=[\d.]+/, `initial-scale=${flip ? '1.0' : '1'}`);
  scrollTo(0, 0);
}
globalThis.visualViewport?.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(unzoom, 150); });
document.addEventListener('touchend', e => { if (!e.touches.length) { clearTimeout(timer); timer = setTimeout(unzoom, 150); } }, { passive: true });
