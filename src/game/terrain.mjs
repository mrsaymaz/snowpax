// Ground height. The world is flat snow except for a few round sled hills, so the height is
// worked out from the hills directly (no height map to download). Shared by the simulation
// (snowball heights, sled speed) and the renderer (terrain, kids standing on the hill).
export function makeGround(hills = []) {
  if (!hills.length) return () => 0;
  return (x, z) => {
    let h = 0;
    for (const H of hills) {
      const d = Math.hypot(x - H.x, z - H.z); if (d >= H.r) continue;
      const top = 1.1, f = d <= top ? 1 : 0.5 * (1 + Math.cos(Math.PI * (d - top) / (H.r - top))); // a flat top for the start, smooth slopes
      if (H.h * f > h) h = H.h * f;
    }
    return h;
  };
}
