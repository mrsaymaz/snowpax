// The Arena 1 world under heavy snow: real Kasımpaşa streets as trodden footpaths through open
// snow. Most of the town is buried: only roof ridges and chimneys poke out of the drifts, and a
// few snowed-in houses near the outposts still show their fronts. Buried cars, the
// frozen Golden Horn, places of worship and the cemetery as quiet scenery, and one
// recognisable landmark at each outpost. Called by buildVillage with its shared helpers.
import {
  BufferGeometry, Float32BufferAttribute, Mesh, MeshLambertMaterial, BoxGeometry, SphereGeometry, CylinderGeometry, ConeGeometry,
  PlaneGeometry, TorusGeometry, CapsuleGeometry, CanvasTexture, RepeatWrapping, SRGBColorSpace, Color, CircleGeometry,
} from 'three';
import { makeGround } from '../terrain.mjs';

const paint = (size, fn) => { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); fn(g, size); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping; t.anisotropy = 4; return t; };
const blot = (g, x, y, r, rgb, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };

export function buildSnowtown(ctx) {
  const { arena, K, M, T, PAL, GEO, rbox, prism, rnd, at, group, glows, smokeSources, lights, low, lantern, pine, rock, barrel, crate, firewood, shovel,
    mSnow, mStone, mStoneDark, mBeam, mWood, mMetal, mIce, mGlass, sign, life, pools } = ctx;
  const rows = arena.rows, W = arena.w, H = arena.h, ground = makeGround(arena.hills || []);
  const normalAt = (x, z) => { const e = 0.25, dx = (ground(x + e, z) - ground(x - e, z)) / (2 * e), dz = (ground(x, z + e) - ground(x, z - e)) / (2 * e), l = Math.hypot(dx, 1, dz); return [-dx / l, 1 / l, -dz / l]; };
  const ch = (i, j) => (i < 0 || j < 0 || i >= W || j >= H ? 'H' : rows[j][i]);
  const solid = c => 'HSKQCWGctO#fRD'.includes(c);
  const walkPath = c => '_+d'.includes(c);

  // ---------- terrain: tiled surfaces with soft darkening near anything solid ----------
  const TEX = {
    snow: T.snow(),
    plaza: paint(256, (g, S) => { g.fillStyle = '#9ea4c0'; g.fillRect(0, 0, S, S); for (let b = 0; b < 8; b++) for (let a = 0; a < 9; a++) { const k = a * 13 + b, x = a * S / 8 - (b % 2) * S / 16, y = b * S / 8, v = 140 + Math.floor(rnd(k, 1) * 55); g.fillStyle = `rgb(${v - 14},${v - 6},${v + 24})`; g.beginPath(); g.ellipse(x + S / 16, y + S / 16, S / 17, S / 21, rnd(k, 2) - 0.5, 0, 7); g.fill(); } for (let k = 0; k < 10; k++) blot(g, rnd(k, 3) * S, rnd(k, 4) * S, 40, '255,255,255', 0.6); }),
    yard: paint(256, (g, S) => { g.fillStyle = '#c8c3dd'; g.fillRect(0, 0, S, S); for (let b = 0; b < 4; b++) for (let a = 0; a < 4; a++) { const v = 205 + Math.floor(rnd(a, b) * 25); g.fillStyle = `rgb(${v - 5},${v - 8},${v + 10})`; g.beginPath(); g.roundRect(a * S / 4 + 3, b * S / 4 + 3, S / 4 - 6, S / 4 - 6, 8); g.fill(); } for (let k = 0; k < 8; k++) blot(g, rnd(k, 5) * S, rnd(k, 6) * S, 50, '255,255,255', 0.55); }),
    ice: paint(256, (g, S) => { // drawn wrapped so the tiles meet without seams
      const wrap = fn => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) fn(ox, oy); };
      g.fillStyle = '#6aa3d4'; g.fillRect(0, 0, S, S); // clearly bluer than the snow: frozen sea, not a snowfield
      for (let k = 0; k < 14; k++) wrap((ox, oy) => blot(g, rnd(k, 21) * S + ox, rnd(k, 22) * S + oy, 30 + rnd(k, 23) * 50, '40,95,160', 0.22));
      for (let k = 0; k < 12; k++) wrap((ox, oy) => blot(g, rnd(k, 11) * S + ox, rnd(k, 12) * S + oy, 25 + rnd(k, 13) * 45, '220,240,255', 0.28));
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.5;
      for (let k = 0; k < 10; k++) wrap((ox, oy) => { g.beginPath(); let x = rnd(k, 14) * S + ox, y = rnd(k, 15) * S + oy; g.moveTo(x, y); for (let s = 0; s < 4; s++) { x += (rnd(k, s) - 0.5) * 60; y += (rnd(s, k) - 0.5) * 60; g.lineTo(x, y); } g.stroke(); });
    }),
  };
  // Open snow, footpaths and the boulevard share one mesh: trodden lanes are a vertex tint that
  // fades into the snow, so the paths read as soft trampled tracks, not tiles.
  const cat = c => (c === 'W' ? 'ice' : 'POf#j'.includes(c) ? 'plaza' : 'YShrK'.includes(c) ? 'yard' : 'snow');
  const trod = c => ('_+d'.includes(c) ? 1 : '=c'.includes(c) ? 0.8 : 'POf#jYhr'.includes(c) ? 0.9 : c === 's' ? 0.25 : 0);
  const quads = { snow: [], plaza: [], yard: [], ice: [] };
  const corner = (i, j) => { let n = 0; for (const [a, b] of [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]]) if ('HSKQCGR'.includes(ch(a, b))) n++; return n; };
  const wear = (i, j) => (trod(ch(i - 1, j - 1)) + trod(ch(i, j - 1)) + trod(ch(i - 1, j)) + trod(ch(i, j))) / 4;
  const TRODDEN = [0.66, 0.66, 0.87];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) quads[cat(ch(i, j))].push([i, j]);
  for (const [name, list] of Object.entries(quads)) {
    if (!list.length) continue;
    const P = [], N = [], U = [], Cc = [];
    const uvs = name === 'ice' ? 0.16 : 0.5;
    const SUN = (() => { const v = [-11, 14, 7], l = Math.hypot(...v); return v.map(c => c / l); })();
    const vert = (x, z, ao, w) => { const y = name === 'snow' ? ground(x, z) : 0;
      if (name === 'snow' && (y > 0.001 || ground(x + 0.6, z) + ground(x - 0.6, z) + ground(x, z + 0.6) + ground(x, z - 0.6) > 0)) { const n = normalAt(x, z), d = n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2]; ao *= 0.78 + 0.3 * Math.max(0, d) + (y > 1.6 ? 0.04 : 0); } /* slopes facing away from the sun read darker */
      P.push(x, y, z); if (y > 0.001 || (name === 'snow' && ground(x + 0.3, z) + ground(x - 0.3, z) + ground(x, z + 0.3) + ground(x, z - 0.3) > 0)) N.push(...normalAt(x, z)); else N.push(0, 1, 0); U.push(x * uvs, -z * uvs); const s = 1 - w; Cc.push(ao * (0.97 * s + TRODDEN[0] * w), ao * (0.97 * s + TRODDEN[1] * w), Math.min(1, ao * (1.02 * s + TRODDEN[2] * w))); };
    for (const [i, j] of list) {
      const [x0, z0] = at(i, j).map(v => v - 0.5);
      const v = [[x0, z0, i, j], [x0 + 1, z0, i + 1, j], [x0 + 1, z0 + 1, i + 1, j + 1], [x0, z0 + 1, i, j + 1]];
      // ice: lighter, shallow ice along the shore, deeper blue further out
      const shore = (ci, cj) => [[ci - 1, cj - 1], [ci, cj - 1], [ci - 1, cj], [ci, cj]].some(([a, b]) => !'Wj'.includes(ch(a, b)));
      const ao = v.map(([, , ci, cj]) => (name === 'ice' ? (shore(ci, cj) ? 1.12 : 0.9) : 1 - corner(ci, cj) * 0.09));
      const w = v.map(([, , ci, cj]) => (name === 'snow' ? wear(ci, cj) : 0));
      const mine = name === 'snow' ? trod(ch(i, j)) : 0;
      if (name === 'snow' && ch(i, j) === 'u') { // the sled hill: finer quads so the slope is smooth
        const D = 3, cAo = (ao[0] + ao[1] + ao[2] + ao[3]) / 4;
        for (let b = 0; b < D; b++) for (let a = 0; a < D; a++) {
          const q = [[a, b], [a + 1, b], [a + 1, b + 1], [a, b + 1]].map(([u, t]) => [x0 + u / D, z0 + t / D]);
          for (const k of [0, 2, 1, 0, 3, 2]) vert(q[k][0], q[k][1], cAo, 0);
        }
      } else if (name === 'snow' && w.some(q => Math.abs(q - mine) > 0.01)) { // an edge cell: fan from the centre for a softer edge
        const cAo = (ao[0] + ao[1] + ao[2] + ao[3]) / 4;
        for (let k = 0; k < 4; k++) { const a = v[k], b = v[(k + 1) % 4]; vert(x0 + 0.5, z0 + 0.5, cAo, mine); vert(b[0], b[1], ao[(k + 1) % 4], w[(k + 1) % 4]); vert(a[0], a[1], ao[k], w[k]); }
      } else for (const k of [0, 2, 1, 0, 3, 2]) vert(v[k][0], v[k][1], ao[k], w[k]); // upward winding
      // beyond the map edge: the snow or the frozen sea carries on into the haze
      if (name === 'snow' || name === 'ice') {
        const E = 45, out = [];
        if (i === 0) out.push([x0 - E, z0, x0, z0 + 1]); if (i === W - 1) out.push([x0 + 1, z0, x0 + 1 + E, z0 + 1]);
        if (j === 0) out.push([x0, z0 - E, x0 + 1, z0]); if (j === H - 1) out.push([x0, z0 + 1, x0 + 1, z0 + 1 + E]);
        if (i === 0 && j === 0) out.push([x0 - E, z0 - E, x0, z0]); if (i === W - 1 && j === 0) out.push([x0 + 1, z0 - E, x0 + 1 + E, z0]);
        if (i === 0 && j === H - 1) out.push([x0 - E, z0 + 1, x0, z0 + 1 + E]); if (i === W - 1 && j === H - 1) out.push([x0 + 1, z0 + 1, x0 + 1 + E, z0 + 1 + E]);
        for (const [ax, az, bx, bz] of out) for (const [x, z] of [[ax, az], [bx, bz], [bx, az], [ax, az], [ax, bz], [bx, bz]]) vert(x, z, name === 'ice' ? 0.9 : 1, 0);
      }
    }
    const geo = new BufferGeometry(); geo.setAttribute('position', new Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new Float32BufferAttribute(N, 3)); geo.setAttribute('uv', new Float32BufferAttribute(U, 2)); geo.setAttribute('color', new Float32BufferAttribute(Cc, 3));
    const mesh = new Mesh(geo, new MeshLambertMaterial({ map: TEX[name], vertexColors: true })); mesh.receiveShadow = true; group.add(mesh);
  }

  // ---------- snowed-in houses ----------
  const used = new Set(), key = (i, j) => i + ',' + j;
  const boxGeo = new BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const capGeo = new SphereGeometry(0.5, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  const lowCap = new SphereGeometry(0.5, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  const ridge = prism(1.0, 1.0, 0.5);
  const tulip = new CylinderGeometry(0.035, 0.025, 0.1, 6); tulip.translate(0, 0.05, 0);
  const mTea = M('glow', '#c4502c');
  const rimTints = ['#5f6b95', '#6d6a9c', '#56709a', '#4f5a82', '#76749f'];
  let lanternCount = 0, chimneyGlow = 0, teaCount = 0;
  const houses = [], houseAt = new Map();
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (ch(i, j) !== 'H' || used.has(key(i, j))) continue;
    let len = 1; const max = 1 + Math.floor(rnd(i, j) * 3);
    while (len < max && ch(i + len, j) === 'H' && !used.has(key(i + len, j))) len++;
    for (let k = 0; k < len; k++) used.add(key(i + k, j));
    const [ax, az] = at(i, j), cx = ax + (len - 1) / 2, cz = az, w = len - 0.08, d = 0.92;
    const h = 0.62 + rnd(j, i) * 0.4 + (rnd(i * 5, j) < 0.1 ? 0.35 : 0); // snowed in up to the windows
    const house = { i, j, len, cx, cz, w, d, h, chimney: null }; houses.push(house);
    for (let k = 0; k < len; k++) houseAt.set(key(i + k, j), house);
    life.perches.push([cx + (rnd(i, j * 17) - 0.5) * (w - 0.3), h + 0.62, cz]);
    const WALLS = [...PAL.plaster, '#d9c6b0', '#c9d9d2', '#e0c7cf', '#d3cfe8'];
    const plaster = M('plaster', WALLS[Math.floor(rnd(i * 3, j) * WALLS.length)]);
    K.put('bh-wall', boxGeo, plaster, cx, 0, cz, 0, w, h, d);
    // a pitched roof (ridge along the row) under a thick blanket of snow, deep drifts up the walls
    const roof = M('shingle', rimTints[Math.floor(rnd(i, j * 3) * rimTints.length)]);
    K.put('bh-roof', ridge, roof, cx, h - 0.04, cz, Math.PI / 2, d + 0.36, 1.1, w + 0.24); // dark eaves show under the snow
    K.put('bh-roofSnow', ridge, mSnow, cx, h + 0.1, cz, Math.PI / 2, d + 0.14, 1.0, w + 0.08);
    K.put('bh-ridgeSnow', capGeo, mSnow, cx, h + 0.56, cz, Math.PI / 2, 0.3, 0.16, w + 0.06);
    K.put('bh-skirt', capGeo, mSnow, cx, 0, cz, 0, w * 1.14, 0.4 + rnd(j * 3, i) * 0.12, d * 1.3);
    // lit windows and the odd lantern on walls that face a path
    for (let k = 0; k < len; k++) for (const [dx, dz] of [[0, 1], [0, -1]]) {
      if (!walkPath(ch(i + k, j + dz)) && !'=P'.includes(ch(i + k, j + dz))) continue;
      const x = ax + k, z = cz + dz * (d / 2 + 0.02), ry = dz > 0 ? 0 : Math.PI;
      const lit = rnd(i + k, j * 5 + dz) < 0.7;
      K.put(lit ? 'bh-glass' : 'bh-glassD', GEO.winGlass, lit ? mGlass : M('glow', '#46557a'), x, h - 0.3, z + dz * 0.01, ry, 0.85, 0.42, 1);
      K.put('bh-sill', GEO.sill, mSnow, x, h - 0.5, z + dz * 0.05, ry, 0.8, 1, 1);
      if (lit && dz > 0 && teaCount < 24 && rnd(i * 19 + k, j) < 0.2) { // tea on the sill: a tray and two tulip glasses, steaming
        teaCount++; const zz = z + 0.13;
        K.put('tea-tray', GEO.sill, M('metal', '#c9b37a'), x, h - 0.42, zz, 0, 0.45, 0.5, 0.6);
        for (const s2 of [-0.09, 0.09]) { K.put('tea-glass', tulip, mTea, x + s2, h - 0.36, zz, 0); }
        life.steam.push([x, h - 0.2, zz]);
      }
      if (!low && lanternCount < 120 && rnd(i + k, j + dz * 3) < 0.12) { lantern(x + 0.34, h - 0.35, z + dz * 0.1); lanternCount++; }
    }
    if (rnd(i * 7, j) < 0.22) {
      const chx = cx + (rnd(i, j * 11) - 0.5) * (w - 0.4);
      K.put('bh-chim', boxGeo, mStoneDark, chx, h, cz - 0.1, 0, 0.3, 0.85, 0.3);
      K.put('bh-chimCap', capGeo, mSnow, chx, h + 0.85, cz - 0.1, 0, 0.4, 0.2, 0.4);
      house.chimney = [chx, h + 0.55, cz - 0.1];
      if (rnd(i * 23, j) < 0.35) life.cats.push([chx + 0.28, h + 0.5, cz - 0.05, rnd(j, i * 29) * 6]);
      if (!low && chimneyGlow < 90 && rnd(j, i * 13) < 0.4) { glows.push([chx, h + 0.92, cz - 0.1, 0.5]); chimneyGlow++; }
    }
  }

  // ---------- the neighbourhood bakery (Fırın) nearest Our School: glowing oven window, big chimney ----------
  const base = arena.places.find(p => p.kind === 'base');
  const bakery = houses.filter(hh => '_=P'.includes(ch(hh.i, hh.j + 1))).sort((a, b) => Math.hypot(a.cx - base.x, a.cz - base.z) - Math.hypot(b.cx - base.x, b.cz - base.z))[0];
  if (bakery) {
    const { cx, cz, w, d, h } = bakery, fz = cz + d / 2 + 0.03;
    K.add(rbox(0.7, 0.06, 0.42, 0.04), M('stone', '#b9b4cf'), cx, h - 0.62, fz); // oven mouth surround
    K.add(new PlaneGeometry(0.5, 0.3), M('glow', '#ff9a3c'), cx, h - 0.4, fz + 0.04);
    K.add(rbox(0.5, 0.5, 1.4, 0.05), mStoneDark, cx + w / 2 - 0.35, h - 0.2, cz - 0.15);
    K.add(GEO.snowCap, mSnow, cx + w / 2 - 0.35, h + 1.2, cz - 0.15, 0, 0, 0, 0.62, 0.25, 0.62);
    glows.push([cx + w / 2 - 0.35, h + 1.3, cz - 0.15, 0.8], [cx, h - 0.4, fz + 0.2, 1.2]); smokeSources.push([cx + w / 2 - 0.35, h + 1.35, cz - 0.15]);
    const sg = sign('Fırın', 1.0); sg.position.set(cx, h + 0.15, fz + 0.06); group.add(sg);
    for (let k = 0; k < 3; k++) K.add(new TorusGeometry(0.09, 0.035, 5, 10), M('wood', '#c98a4a'), cx - 0.45 + k * 0.12, h - 0.68, fz + 0.12, Math.PI / 2); // simit on the ledge
    lights.push([cx, h - 0.2, fz + 0.4]);
  }

  // ---------- frozen laundry lines across the lanes (colourful, stiff with frost) ----------
  const clothCols = ['#e8584a', '#f2c14e', '#4f9de0', '#7cc47a', '#e889b5', '#ffffff'];
  const lineMat = M('metal', '#4a4f6a'), clothMats = clothCols.map(c => M('fabric', c));
  const strung = new Set(); let lines = 0;
  const hang = (ax, ay, az, bx, by, bz) => {
    const L = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az), n = Math.max(2, Math.floor(L / 0.32));
    for (let k = 0; k < 3; k++) { // a sagging line in three pieces
      const t0 = k / 3, t1 = (k + 1) / 3, sag = t => -0.22 * 4 * t * (1 - t);
      const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, y0 = ay + (by - ay) * t0 + sag(t0), x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1, y1 = ay + (by - ay) * t1 + sag(t1);
      const seg = Math.hypot(x1 - x0, y1 - y0, z1 - z0), pitch = Math.atan2(y1 - y0, Math.hypot(x1 - x0, z1 - z0));
      K.put('lineSeg', boxGeo, lineMat, (x0 + x1) / 2, (y0 + y1) / 2 - 0.01, (z0 + z1) / 2, ry, 0.02, 0.02, seg, -pitch);
    }
    for (let k = 1; k < n; k++) {
      if (rnd(lines * 7 + k, 3) < 0.25) continue;
      const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ay + (by - ay) * t - 0.22 * 4 * t * (1 - t);
      const big = rnd(k, lines * 5) < 0.5, mat = clothMats[Math.floor(rnd(lines, k * 3) * clothMats.length)];
      K.put(big ? 'shirt' : 'sock', boxGeo, mat, x, y - (big ? 0.3 : 0.2), z, ry + Math.PI / 2, big ? 0.22 : 0.08, big ? 0.28 : 0.18, 0.025);
      if (big) K.put('shirtSnow', boxGeo, mSnow, x, y - 0.03, z, ry + Math.PI / 2, 0.23, 0.03, 0.04);
    }
    lines++;
  };
  for (const hh of houses) {
    if (lines >= 30 || strung.has(hh)) continue;
    for (const [di, dj] of [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [-1, 2]]) {
      const other = houseAt.get(key(hh.i + di, hh.j + dj)); if (!other || other === hh || strung.has(other)) continue;
      let clear = true; for (let k = 1; k < dj; k++) if (solid(ch(hh.i + Math.round(di * k / dj), hh.j + k))) clear = false;
      if (!clear) continue;
      const ax = at(hh.i + di, hh.j)[0], y1 = hh.h + 0.25, y2 = other.h + 0.25;
      hang(ax, y1, hh.cz + hh.d / 2, at(hh.i + di, 0)[0], y2, other.cz - other.d / 2); strung.add(hh); strung.add(other); break;
    }
    const side = rnd(hh.i, hh.j * 41) < 0.5 ? -1 : 1, pi = side > 0 ? hh.i + hh.len + 1 : hh.i - 2;
    if (!strung.has(hh) && lines < 30 && rnd(hh.i * 41, hh.j) < 0.4 && ch(pi, hh.j) === '.' && ch(pi, hh.j + 1) !== 'H') { // a line along the front out to a pole in the snow
      const [px] = at(pi, hh.j), pz = hh.cz + hh.d / 2 + 0.25, ex = hh.cx + side * hh.w / 2;
      K.put('linePole', GEO.post, mWood, px, 0.65, pz, 0, 1, 1.3, 1); K.put('poleSnow', GEO.snowCap, mSnow, px, 0, pz, 0, 0.5, 0.25, 0.5);
      hang(ex, hh.h + 0.2, pz, px, 1.25, pz); strung.add(hh);
    }
  }

  // ---------- old street lamps, half buried, with warm pools of light ----------
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (ch(i, j) !== 'l') continue;
    const [x, z] = at(i, j), lean = (rnd(i, j * 43) - 0.5) * 0.12;
    K.put('lampPost', GEO.post, mMetal, x, 0.95, z, 0, 1.2, 1.9, 1.2, lean, 0);
    K.put('lampMound', lowCap, mSnow, x, 0, z, rnd(i, j) * 3, 0.9, 0.38, 0.8);
    K.put('lampArm', boxGeo, mMetal, x + 0.18, 1.82, z, 0, 0.4, 0.05, 0.05);
    lantern(x + 0.36, 1.55, z, true);
    pools.push([x + 0.36, z, 2.4]);
    life.perches.push([x + 0.36, 1.92, z]);
  }

  // ---------- sled runs: a packed-snow track with grooves, rounded banks, red marker poles,
  //            a start gate on the hilltop with signs, and a soft pile of snow at the bottom ----------
  if (arena.sledRuns?.length) {
    const trackTex = paint(128, (g, S) => {
      g.fillStyle = '#e4edfb'; g.fillRect(0, 0, S, S);
      for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(255,255,255,${0.4 + rnd(k, 31) * 0.5})`; g.fillRect(rnd(k, 32) * S, rnd(k, 33) * S, 2, 3); }
      for (const u of [0.3, 0.7]) { const gr = g.createLinearGradient((u - 0.08) * S, 0, (u + 0.08) * S, 0); gr.addColorStop(0, 'rgba(120,140,200,0)'); gr.addColorStop(0.5, 'rgba(120,140,200,0.55)'); gr.addColorStop(1, 'rgba(120,140,200,0)'); g.fillStyle = gr; g.fillRect((u - 0.08) * S, 0, 0.16 * S, S); }
    });
    const TP = [], TN = [], TU = [], TI = [], BP = [], BN = [], BU = [], BI = [];
    const destName = { home: 'Our School' }; for (const pl of arena.places) if (pl.kind === 'zone') destName[pl.id] = pl.label;
    const poleRed = M('plaster', '#e0463c'), poleWhite = M('plaster', '#f4f1ea');
    for (const run of arena.sledRuns) {
      // resample the run every 0.4 units
      const pts = run.pts, samp = [];
      for (let k = 0; k + 1 < pts.length; k++) { const [a, b] = [pts[k], pts[k + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 0.4)); for (let m = 0; m < n; m++) samp.push([a[0] + (b[0] - a[0]) * m / n, a[1] + (b[1] - a[1]) * m / n]); }
      samp.push(pts[pts.length - 1]);
      let along = 0;
      samp.forEach(([x, z], k) => {
        const [px, pz] = samp[Math.max(0, k - 1)], [nx, nz] = samp[Math.min(samp.length - 1, k + 1)], tl = Math.hypot(nx - px, nz - pz) || 1, ox = -(nz - pz) / tl, oz = (nx - px) / tl;
        if (k) along += Math.hypot(x - samp[k - 1][0], z - samp[k - 1][1]);
        const base = TP.length / 3;
        for (const sgn of [-1, 1]) { const vx = x + ox * 0.55 * sgn, vz = z + oz * 0.55 * sgn; TP.push(vx, ground(vx, vz) + 0.04, vz); TN.push(...normalAt(vx, vz)); TU.push(sgn < 0 ? 0 : 1, along * 0.6); }
        if (k) TI.push(base - 2, base - 1, base, base - 1, base + 1, base);
        // banks: half-round ridges either side
        for (const sgn of [-1, 1]) {
          const b0 = BP.length / 3, SEG = 4;
          for (let q = 0; q <= SEG; q++) { const th = Math.PI * q / SEG, off = 0.78 + Math.cos(th) * 0.2, vx = x + ox * off * sgn, vz = z + oz * off * sgn; BP.push(vx, ground(x + ox * 0.78 * sgn, z + oz * 0.78 * sgn) + Math.sin(th) * 0.26, vz); BN.push(ox * Math.cos(th) * sgn, Math.sin(th), oz * Math.cos(th) * sgn); BU.push(q / SEG, along * 0.5); }
          if (k) for (let q = 0; q < SEG; q++) { const a = b0 - (SEG + 1) * 2 + q, c = b0 + q; if (sgn > 0) BI.push(a, c, a + 1, a + 1, c, c + 1); else BI.push(a, a + 1, c, a + 1, c + 1, c); }
        }
        // marker poles every 3 units, alternating sides
        if (k && k % 8 === 0 && k < samp.length - 3) { const sgn = (k / 8) % 2 ? 1 : -1, vx = x + ox * 1.05 * sgn, vz = z + oz * 1.05 * sgn, gy = ground(vx, vz); K.put('slPole', GEO.post, poleRed, vx, gy + 0.55, vz, 0, 0.9, 1.1, 0.9); K.put('slPoleTop', GEO.post, poleWhite, vx, gy + 1.2, vz, 0, 0.95, 0.2, 0.95); }
      });
      // the start gate over the track on the hilltop, with the run's name and where it goes
      const [sx, sz] = pts[0], [s2x, s2z] = pts[Math.min(3, pts.length - 1)], dl = Math.hypot(s2x - sx, s2z - sz) || 1, gx = -(s2z - sz) / dl, gz = (s2x - sx) / dl, gy = ground(sx, sz);
      for (const sgn of [-1, 1]) { K.put('gatePost', GEO.post, mBeam, sx + gx * 0.95 * sgn, gy + 1.1, sz + gz * 0.95 * sgn, 0, 1.4, 2.2, 1.4); K.put('gateCap', GEO.snowCap, mSnow, sx + gx * 0.95 * sgn, gy + 2.2, sz + gz * 0.95 * sgn, 0, 0.22, 0.12, 0.22); }
      K.add(new CylinderGeometry(1.0, 1.05, 0.12, 16), mWood, sx, gy + 0.03, sz); K.add(new CylinderGeometry(0.95, 0.95, 0.04, 16), M('snow', '#eef3fc'), sx, gy + 0.1, sz);
      const s1 = sign('SLED RUN', 1.8, '#a83a32'); s1.position.set(sx, gy + 2.25, sz); group.add(s1);
      const s2 = sign('to ' + (destName[run.to] || run.to), 1.7); s2.position.set(sx, gy + 1.7, sz + 0.02); group.add(s2);
      lantern(sx + gx * 0.95, gy + 2.3, sz + gz * 0.95, true);
      for (const sgn of [-1, 1]) { const rx = sx - (s2x - sx) / dl * 0.9 + gx * 1.6 * sgn, rz = sz - (s2z - sz) / dl * 0.9 + gz * 1.6 * sgn; K.put('sledSpare', boxGeo, M('wood', '#b9784a'), rx, ground(rx, rz) + 0.12, rz, Math.atan2(s2x - sx, s2z - sz), 0.45, 0.08, 0.9); K.put('sledSpareRun', boxGeo, M('metal', '#c8443c'), rx, ground(rx, rz) + 0.02, rz, Math.atan2(s2x - sx, s2z - sz), 0.5, 0.06, 1.0); }
      // the bottom: a soft pile to stop in and a finish flag
      const [ex, ez] = pts[pts.length - 1], [e0x, e0z] = pts[Math.max(0, pts.length - 3)], el = Math.hypot(ex - e0x, ez - e0z) || 1, fx = (ex - e0x) / el, fz = (ez - e0z) / el;
      K.put('finishPile', lowCap, mSnow, ex + fx * 1.4, 0, ez + fz * 1.4, Math.atan2(fx, fz), 2.2, 0.45, 1.4);
      K.put('finishPole', GEO.post, mBeam, ex - fz * 1.2, 0.8, ez + fx * 1.2, 0, 1, 1.6, 1); K.put('finishFlag', boxGeo, poleRed, ex - fz * 1.2 + 0.25, 1.35, ez + fx * 1.2, 0, 0.5, 0.3, 0.03);
    }
    const tg = new BufferGeometry(); tg.setAttribute('position', new Float32BufferAttribute(TP, 3)); tg.setAttribute('normal', new Float32BufferAttribute(TN, 3)); tg.setAttribute('uv', new Float32BufferAttribute(TU, 2)); tg.setIndex(TI);
    const track = new Mesh(tg, new MeshLambertMaterial({ map: trackTex, color: '#dfe8fa' })); track.receiveShadow = true; track.renderOrder = 1; group.add(track);
    const bg = new BufferGeometry(); bg.setAttribute('position', new Float32BufferAttribute(BP, 3)); bg.setAttribute('normal', new Float32BufferAttribute(BN, 3)); bg.setAttribute('uv', new Float32BufferAttribute(BU, 2)); bg.setIndex(BI);
    K.add(bg, mSnow, 0, 0, 0);
  }

  // ---------- the buried town: roof ridges, chimneys and dormers poking out of the drifts ----------
  let smokeCount = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (ch(i, j) !== 'R') continue;
    const [x, z] = at(i, j), v = rnd(i * 3, j * 5), ry = rnd(j, i * 9) < 0.5 ? 0 : Math.PI / 2;
    const roof = M('shingle', rimTints[Math.floor(rnd(i, j * 3) * rimTints.length)]);
    K.put('br-mound', capGeo, mSnow, x, 0, z, ry, 1.5, 0.55 + rnd(i, j * 7) * 0.2, 1.25);
    let chx = x, chz = z, top = 0.55;
    if (v < 0.6) { // a roof ridge: the top of a pitched roof, snow lying thick on both slopes
      K.put('br-roof', ridge, roof, x, 0.3, z, ry, 1.15, 0.95, 1.1);
      K.put('br-roofSnow', ridge, mSnow, x, 0.36, z, ry, 1.22, 1.0, 0.98);
      K.put('br-ridgeSnow', capGeo, mSnow, x, 0.72, z, ry, 0.32, 0.16, 1.0);
      chx = x + (ry ? 0 : 0.3); chz = z + (ry ? 0.3 : 0); top = 0.7;
      life.perches.push([x - (ry ? 0 : 0.25), 0.82, z - (ry ? 0.25 : 0)]);
    } else if (v < 0.82) { // a dormer window, still warm inside
      K.put('br-dormer', boxGeo, M('plaster', '#d3cfe8'), x, 0.3, z + 0.15, 0, 0.55, 0.5, 0.5);
      K.put('br-dormerRoof', ridge, roof, x, 0.78, z + 0.15, Math.PI / 2, 0.7, 0.5, 0.65);
      K.put('br-dormerSnow', capGeo, mSnow, x, 0.88, z + 0.15, 0, 0.7, 0.22, 0.6);
      K.put('bh-glass', GEO.winGlass, mGlass, x, 0.55, z + 0.41, 0, 0.5, 0.4, 1);
      continue;
    }
    // a chimney (on the ridge, or alone where the whole house is under the snow)
    K.put('bh-chim', boxGeo, mStoneDark, chx, top - 0.2, chz, 0, 0.3, 0.75, 0.3);
    K.put('bh-chimCap', capGeo, mSnow, chx, top + 0.55, chz, 0, 0.4, 0.2, 0.4);
    if (!low && chimneyGlow < 90 && rnd(j, i * 13) < 0.5) { glows.push([chx, top + 0.62, chz, 0.45]); chimneyGlow++; }
    if (smokeCount < 24 && rnd(i * 11, j) < 0.35) { smokeSources.push([chx, top + 0.7, chz]); smokeCount++; }
    if (rnd(i * 31, j * 3) < 0.22) life.cats.push([chx + 0.26, top + 0.2, chz + 0.12, rnd(i, j * 37) * 6]); // a cat warming itself by the chimney
  }
  // the world's edge: tall rounded snowbanks with the odd snowy pine
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (ch(i, j) !== 'D' || (i + j) % 2) continue;
    const [x, z] = at(i, j), s = 1.6 + rnd(i, j) * 0.9;
    K.put('bank', lowCap, mSnow, x, 0, z, rnd(j, i) * 3, s * 1.4, s * 0.8, s * 1.4);
    if (rnd(i * 7, j * 3) < 0.18) pine(x + 0.3, z + 0.2, 0.9 + rnd(i, j * 5) * 0.4);
  }
  // soft hummocks in the open snow (walkable, just shape)
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (ch(i, j) !== '.' || rnd(i * 13, j * 7) > 0.05) continue;
    const [x, z] = at(i, j);
    K.put('hummock', lowCap, mSnow, x + (rnd(i, j * 2) - 0.5) * 0.5, -0.05, z + (rnd(i * 2, j) - 0.5) * 0.5, rnd(i, j) * 3, 1.3 + rnd(j, i) * 0.8, 0.28, 1.0);
  }

  // ---------- buried cars along the boulevard (cover) ----------
  const carCols = ['#c8584a', '#4f6fa8', '#d99a3e', '#5d8a6a', '#8e7fbf', '#e8e4ee'];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (ch(i, j) !== 'c') continue;
    const [x, z] = at(i, j), along = '=c'.includes(ch(i, j - 1)) && '=c'.includes(ch(i, j + 1)) ? Math.PI / 2 : 0;
    K.put('car-body', boxGeo, M('metal', carCols[Math.floor(rnd(i, j) * carCols.length)]), x, 0, z, along, 1.3, 0.38, 0.68);
    K.put('car-glass', boxGeo, M('glow', '#46557a'), x, 0.36, z, along, 0.7, 0.14, 0.6);
    K.put('car-snow', capGeo, mSnow, x, 0.22, z, along, 1.55, 0.95, 0.9);
    K.put('car-drift', capGeo, mSnow, x, 0, z, along, 1.7, 0.3, 1.0);
  }

  // ---------- quiet scenery: places of worship, the cemetery ----------
  const x0 = arena.x0, z0 = arena.z0;
  const stoneLight = M('stone', '#c9c6dc'), domeMat = M('plaster', '#a99bd2');
  for (const s of arena.scenery) {
    if (s.type === 'mosque') {
      const x = x0 + s.x, z = z0 + s.z;
      if (s.special === 'piyale-pasa') { // a long hall roofed with a row of small domes, one minaret
        K.add(rbox(4.2, 2.6, 1.6, 0.1), stoneLight, x, 0, z);
        for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) { const dx = x - 1.35 + a * 1.35, dz = z - 0.65 + b * 1.3; K.add(new SphereGeometry(0.62, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), domeMat, dx, 1.6, dz); K.add(new SphereGeometry(0.64, 14, 3, 0, Math.PI * 2, 0, Math.PI / 4.5), mSnow, dx, 1.6, dz); }
        K.add(new CylinderGeometry(0.22, 0.26, 5.2, 12), stoneLight, x + 2.4, 2.6, z - 1.0); K.add(new CylinderGeometry(0.38, 0.38, 0.2, 12), mSnow, x + 2.4, 4.0, z - 1.0); K.add(new ConeGeometry(0.25, 1.0, 12), domeMat, x + 2.4, 5.7, z - 1.0);
      } else {
        const sz = Math.min(3, Math.max(1.1, s.size * 0.9)), minaret = s.size >= 1.25;
        K.add(rbox(sz, sz, sz * 0.7, 0.08), stoneLight, x, 0, z);
        K.add(new SphereGeometry(sz * 0.42, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), domeMat, x, sz * 0.7, z);
        K.add(new SphereGeometry(sz * 0.43, 14, 3, 0, Math.PI * 2, 0, Math.PI / 4.5), mSnow, x, sz * 0.7, z);
        if (minaret) { K.add(new CylinderGeometry(0.16, 0.2, sz * 2.4, 10), stoneLight, x + sz * 0.55, sz * 1.2, z - sz * 0.55); K.add(new ConeGeometry(0.18, 0.7, 10), domeMat, x + sz * 0.55, sz * 2.4 + 0.35, z - sz * 0.55); }
      }
    }
  }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (ch(i, j) === 'C' && rnd(i, j) < 0.32) { // cypresses
    const [x, z] = at(i, j), s = 0.8 + rnd(j, i) * 0.5;
    K.put('cyp', GEO.cone, M('plaster', '#24494c'), x + (rnd(i, j * 3) - 0.5) * 0.4, 1.1 * s, z, 0, 0.32 * s, 2.2 * s, 0.32 * s);
    K.put('cypSnow', capGeo, mSnow, x, 1.3 * s, z, 0, 0.42 * s, 0.25 * s, 0.42 * s);
  }

  // ---------- one landmark at each outpost ----------
  const centre = lm => at(lm.i + (lm.w - 1) / 2, lm.j + (lm.h - 1) / 2);
  for (const lm of arena.landmarks) {
    if (lm.type === 'footbridge') { // stair towers either side of the boulevard, a snowy steel deck over it
      const [ax, az] = at(...lm.a), [bx, bz] = at(...lm.b), mx = (ax + bx) / 2, mz = (az + bz) / 2, L = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az);
      for (const [x, z] of [[ax, az], [bx, bz]]) { K.add(rbox(0.9, 0.9, 3.0, 0.06), mStoneDark, x, 0, z); K.add(rbox(1.0, 1.0, 0.2, 0.08), mSnow, x, 3.0, z); }
      K.add(rbox(0.9, L, 0.22, 0.04), M('metal', '#5d6b8f'), mx, 2.85, mz, 0, ry); K.add(rbox(0.86, L - 0.2, 0.16, 0.08), mSnow, mx, 3.05, mz, 0, ry);
      for (const s of [-0.43, 0.43]) K.add(rbox(0.06, L, 0.5, 0.02), M('metal', '#8a97b8'), mx + Math.cos(ry) * s, 3.05, mz - Math.sin(ry) * s, 0, ry);
      for (let k = 1; k < 4; k++) { const t = k / 4; K.add(new CylinderGeometry(0.06, 0.06, 2.85, 8), mMetal, ax + (bx - ax) * t, 1.42, az + (bz - az) * t); }
      const sg = sign('Boulevard Park', 2.0); sg.position.set(mx, 3.9, mz); sg.rotation.y = Math.abs(Math.sin(ry)) > 0.7 ? 0 : 0; group.add(sg);
      lantern(ax + 0.6, 3.25, az); lantern(bx - 0.6, 3.25, bz);
    } else if (lm.type === 'archers-lodge') { // Ottoman archers' lodge: stone hall with lead domes, an arched portico, a gate crowned by a golden bow
      const [x, z] = centre(lm), lead = M('metal', '#8492b4'), marble = M('plaster', '#f8f4fb'), gold = M('glow', '#e8b84a'), red = M('fabric', '#c8443c');
      K.add(rbox(4.1, 3.0, 0.32, 0.08), mStone, x, 0, z);
      K.add(rbox(3.7, 1.7, 1.75, 0.06), marble, x, 0.3, z - 0.55); // the hall
      K.add(rbox(3.9, 1.9, 0.14, 0.05), mStone, x, 2.02, z - 0.55); // cornice
      for (const dx of [-1.15, 0, 1.15]) { // three lead domes with drums and gold finials
        K.add(new CylinderGeometry(0.44, 0.48, 0.28, 16), marble, x + dx, 2.3, z - 0.55);
        K.add(new SphereGeometry(0.47, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), lead, x + dx, 2.44, z - 0.55);
        K.add(new SphereGeometry(0.49, 16, 4, 0, Math.PI * 2, 0, Math.PI / 4.2), mSnow, x + dx, 2.46, z - 0.55);
        K.add(new SphereGeometry(0.06, 8, 6), gold, x + dx, 2.97, z - 0.55); K.add(new ConeGeometry(0.03, 0.22, 6), gold, x + dx, 3.12, z - 0.55);
      }
      // portico: five slim columns, pointed arches, a snowy roof
      K.add(rbox(3.9, 1.05, 0.14, 0.03), mStone, x, 0.32, z + 0.82);
      for (let k = 0; k < 5; k++) { const cx = x - 1.6 + k * 0.8; K.add(new CylinderGeometry(0.08, 0.09, 1.2, 10), marble, cx, 1.06, z + 1.2); K.add(rbox(0.22, 0.22, 0.1, 0.02), mStone, cx, 1.66, z + 1.2); }
      for (let k = 0; k < 4; k++) { const cx = x - 1.2 + k * 0.8; K.add(new TorusGeometry(0.34, 0.085, 6, 12, Math.PI), M('plaster', '#d0573f'), cx, 1.68, z + 1.2); K.add(new TorusGeometry(0.34, 0.088, 6, 12, Math.PI / 3), marble, cx, 1.68, z + 1.2, 0, 0, Math.PI / 3); lantern(cx, 1.45, z + 1.05); } // arches in red and white stone, a lantern under each
      K.add(rbox(3.95, 1.05, 0.12, 0.03), M('wood', '#a5714f'), x, 2.08, z + 0.78, 0.18); K.add(rbox(3.9, 1.0, 0.16, 0.08, 3), mSnow, x, 2.14, z + 0.78, 0.18);
      for (let k = 0; k < 4; k++) { const wx = x - 1.2 + k * 0.8; K.add(new PlaneGeometry(0.44, 0.66), mGlass, wx, 1.0, z + 0.31); K.add(new CircleGeometry(0.22, 12, 0, Math.PI), mGlass, wx, 1.33, z + 0.311); } // arched windows, lit
      // the gate: two stone pylons and a pointed arch, crowned by a big golden bow with crossed arrows
      const gz = z + 1.75;
      for (const sx of [-0.62, 0.62]) { K.add(rbox(0.36, 0.36, 1.9, 0.04), marble, x + sx, 0, gz); K.add(GEO.snowCap, mSnow, x + sx, 1.9, gz, 0, 0, 0, 0.42, 0.18, 0.42); lantern(x + sx, 1.45, gz + 0.25, sx > 0); }
      K.add(new TorusGeometry(0.62, 0.09, 6, 16, Math.PI), M('stone', '#c96f5a'), x, 1.7, gz);
      K.add(new TorusGeometry(0.85, 0.06, 6, 24, Math.PI * 0.8), gold, x, 2.15, gz + 0.05, 0, 0, Math.PI * 0.1); // the bow
      K.add(rbox(1.62, 0.02, 0.02, 0.005), M('glow', '#fff3d6'), x, 2.17, gz + 0.06); // its string
      for (const r of [0.6, -0.6]) { K.add(new CylinderGeometry(0.025, 0.025, 1.7, 6), gold, x, 2.45, gz + 0.08, 0, 0, r); K.add(new ConeGeometry(0.07, 0.18, 4), gold, x - Math.sin(r) * 0.9, 2.45 + Math.cos(r) * 0.9, gz + 0.08, 0, 0, r); }
      const sg = sign("Archers' Lodge", 1.5); sg.position.set(x, 1.35, gz + 0.14); group.add(sg);
      for (const sx of [-1.9, 1.9]) { // tall flagpoles with pennants
        K.put('flagPole', GEO.post, mMetal, x + sx, 1.6, z + 1.5, 0, 0.8, 3.2, 0.8);
        const pen = new BufferGeometry(); pen.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0.9, -0.22, 0, 0, -0.45, 0], 3)); pen.computeVertexNormals();
        K.add(pen, sx < 0 ? red : M('fabric', '#e8b84a'), x + sx, 3.15, z + 1.5);
      }
    } else if (lm.type === 'target') { // a big straw target on an easel with arrows in it
      const [x, z] = centre(lm), rings = ['#f4efe2', '#2f2f3a', '#4f6fa8', '#c8584a', '#e6b93e'];
      for (const dx of [-0.32, 0.32]) K.add(new CylinderGeometry(0.05, 0.05, 1.7, 6), mWood, x + dx, 0.8, z - 0.18, 0.2);
      K.add(new CylinderGeometry(0.66, 0.66, 0.18, 22), M('wood', '#d8c08a'), x, 1.02, z, Math.PI / 2 - 0.15);
      rings.forEach((col, k) => K.add(new CylinderGeometry(0.6 - k * 0.12, 0.6 - k * 0.12, 0.2 + k * 0.01, 22), M('fabric', col), x, 1.02, z + 0.01, Math.PI / 2 - 0.15));
      for (const [ax, ay] of [[0.08, 0.05], [-0.18, 0.2], [0.22, -0.15]]) { K.add(new CylinderGeometry(0.018, 0.018, 0.6, 5), mWood, x + ax, 1.02 + ay, z + 0.35, Math.PI / 2 - 0.15); K.add(rbox(0.12, 0.02, 0.1, 0.005), M('fabric', '#ffffff'), x + ax, 1.02 + ay + 0.08, z + 0.62); }
      K.add(new CapsuleGeometry(0.12, 0.9, 3, 8), mSnow, x, 1.66, z - 0.08, 0, 0, Math.PI / 2);
    } else if (lm.type === 'marker-stone') { // a menzil taşı: a tall white marble record stone with gold bands and a carved top
      const [x, z] = centre(lm), h = 2.0 + ((lm.n || 0) * 0.37) % 1.3, marble = M('stone', '#f1eef6'), gold = M('glow', '#e2b450');
      K.add(rbox(0.6, 0.6, 0.32, 0.05), mStone, x, 0, z); K.add(rbox(0.42, 0.42, 0.18, 0.04), marble, x, 0.32, z);
      K.add(new CylinderGeometry(0.12, 0.16, h, 8), marble, x, 0.5 + h / 2, z);
      for (const t of [0.35, 0.8]) K.add(new TorusGeometry(0.15 - t * 0.03, 0.025, 5, 12), gold, x, 0.5 + h * t, z, Math.PI / 2);
      K.add(new PlaneGeometry(0.16, h * 0.28), M('glow', '#3d4a6b'), x, 0.5 + h * 0.58, z + 0.14); // the carved inscription panel
      K.add(new CylinderGeometry(0.16, 0.12, 0.22, 10), marble, x, 0.6 + h, z); K.add(new SphereGeometry(0.15, 10, 8), marble, x, 0.8 + h, z);
      K.add(GEO.snowCap, mSnow, x, 0.86 + h, z, 0, 0, 0, 0.34, 0.18, 0.34);
    } else if (lm.type === 'fountain') { // an old public fountain: marble block, arched niche, wide eaves, frozen spout
      const [x, z] = centre(lm);
      K.add(rbox(1.9, 0.9, 0.3, 0.06), mStone, x, 0, z); K.add(rbox(1.6, 0.7, 1.7, 0.05), M('stone', '#e6e2ee'), x, 0.3, z);
      K.add(rbox(0.8, 0.12, 1.0, 0.05), M('stone', '#b9b4cf'), x, 0.5, z + 0.36); K.add(new CylinderGeometry(0.4, 0.4, 0.12, 16, 1, false, 0, Math.PI), M('stone', '#b9b4cf'), x, 1.5, z + 0.36, Math.PI / 2, 0, Math.PI / 2);
      K.add(rbox(1.6, 0.5, 0.14, 0.05), M('stone', '#c9c6dc'), x, 0.3, z + 0.65); // basin
      K.add(rbox(2.3, 1.3, 0.16, 0.06), M('shingle', '#6d6a9c'), x, 2.0, z); K.add(rbox(2.2, 1.2, 0.3, 0.14, 3), mSnow, x, 2.12, z);
      K.add(new ConeGeometry(0.05, 0.6, 6), mIce, x, 0.75, z + 0.45, Math.PI);
      const sg = sign('Kızılay Square', 1.9); sg.position.set(x, 2.75, z + 0.2); group.add(sg);
    } else if (lm.type === 'plane-tree') { // a huge old plane tree, branches heavy with snow
      const [x, z] = centre(lm);
      K.add(new CylinderGeometry(0.28, 0.42, 2.2, 10), M('wood', '#9a8c84'), x, 1.1, z);
      for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28, r = k ? 0.85 : 0, y = 2.5 + (k % 2) * 0.35; K.add(new SphereGeometry(0.75, 10, 7), M('plaster', '#5d6f7a'), x + Math.cos(a) * r, y, z + Math.sin(a) * r); K.add(GEO.snowCap, mSnow, x + Math.cos(a) * r, y + 0.2, z + Math.sin(a) * r, 0, 0, 0, 1.45, 0.75, 1.45); }
    } else if (lm.type === 'admiral') { // Cezayirli Gazi Hasan Paşa with his lion: a big bronze statue on a granite pedestal, anchors and a chain fence
      const [x, z] = centre(lm), bronze = M('plaster', '#6fae9f'), bronzeD = M('plaster', '#4f8a80'), granite = M('stone', '#8f93ac'), pale = M('stone', '#dcd8e8'), iron = M('metal', '#3d4a6b');
      K.add(rbox(2.8, 2.8, 0.25, 0.06), granite, x, 0, z); K.add(rbox(2.2, 2.2, 0.3, 0.06), granite, x, 0.25, z);
      K.add(rbox(1.3, 1.3, 1.5, 0.05), pale, x, 0.55, z - 0.3); K.add(rbox(1.5, 1.5, 0.16, 0.05), granite, x, 2.05, z - 0.3);
      K.add(rbox(0.8, 0.04, 0.5, 0.02), M('metal', '#9a7b3e'), x, 1.15, z + 0.36); // bronze plaque
      // the admiral: long kaftan, sash, beard and a tall turban; one arm points out over the Golden Horn
      const top = 2.21, ax = x, az = z - 0.3;
      K.add(new ConeGeometry(0.42, 1.15, 12), bronze, ax, top + 0.58, az); K.add(new CylinderGeometry(0.2, 0.26, 0.5, 12), bronze, ax, top + 1.3, az);
      K.add(new TorusGeometry(0.24, 0.05, 6, 14), bronzeD, ax, top + 1.12, az, Math.PI / 2);
      K.add(new SphereGeometry(0.18, 12, 10), bronze, ax, top + 1.72, az); K.add(new ConeGeometry(0.12, 0.26, 8), bronzeD, ax, top + 1.55, az + 0.1, Math.PI);
      K.add(new CylinderGeometry(0.19, 0.2, 0.34, 12), bronze, ax, top + 2.0, az); K.add(new TorusGeometry(0.21, 0.07, 6, 14), bronzeD, ax, top + 1.88, az, Math.PI / 2);
      K.add(new CapsuleGeometry(0.07, 0.55, 3, 8), bronze, ax - 0.42, top + 1.5, az + 0.1, 0, 0, Math.PI / 2.4); // pointing arm
      K.add(new CapsuleGeometry(0.07, 0.45, 3, 8), bronze, ax + 0.27, top + 1.15, az + 0.1, 0, 0, -0.35);
      K.add(GEO.snowCap, mSnow, ax, top + 2.17, az, 0, 0, 0, 0.42, 0.2, 0.42); // a snow cap on his turban
      // the lion, sitting proudly on the front step, wearing a red scarf the kids gave him
      const lx = x, lz = z + 0.85, ly = 0.55;
      K.add(new CapsuleGeometry(0.22, 0.32, 4, 10), bronze, lx, ly + 0.32, lz - 0.08, -0.5);
      for (const sx of [-0.12, 0.12]) K.add(new CylinderGeometry(0.06, 0.07, 0.42, 8), bronze, lx + sx, ly + 0.21, lz + 0.12);
      K.add(new SphereGeometry(0.3, 14, 10), bronzeD, lx, ly + 0.72, lz + 0.05); // mane
      for (let k = 0; k < 8; k++) { const ang = k / 8 * Math.PI * 2; K.add(new SphereGeometry(0.1, 8, 6), bronzeD, lx + Math.cos(ang) * 0.27, ly + 0.72 + Math.sin(ang) * 0.27, lz + 0.04); }
      K.add(new SphereGeometry(0.19, 12, 10), bronze, lx, ly + 0.72, lz + 0.18); K.add(new SphereGeometry(0.08, 8, 6), bronzeD, lx, ly + 0.66, lz + 0.35);
      for (const sx of [-0.13, 0.13]) K.add(new SphereGeometry(0.06, 6, 5), bronze, lx + sx, ly + 0.9, lz + 0.12);
      K.add(new TorusGeometry(0.3, 0.12, 4, 10, Math.PI * 1.3), bronze, lx + 0.25, ly + 0.15, lz - 0.2, Math.PI / 2, 0, 0.4); // tail
      K.add(new TorusGeometry(0.2, 0.06, 6, 14), M('fabric', '#d9443a'), lx, ly + 0.5, lz + 0.1, Math.PI / 2 - 0.3);
      K.add(rbox(0.12, 0.05, 0.32, 0.02), M('fabric', '#d9443a'), lx + 0.12, ly + 0.36, lz + 0.26, 0.3);
      K.add(GEO.snowCap, mSnow, lx, ly + 0.98, lz + 0.02, 0, 0, 0, 0.36, 0.14, 0.32);
      // anchors at the front corners and a chain fence round the base
      for (const sx of [-1.15, 1.15]) {
        const fx = x + sx, fz = z + 1.15;
        K.add(new CylinderGeometry(0.045, 0.045, 0.9, 8), iron, fx, 0.7, fz); K.add(new TorusGeometry(0.1, 0.03, 6, 10), iron, fx, 1.2, fz);
        K.add(rbox(0.36, 0.06, 0.06, 0.02), iron, fx, 1.0, fz); K.add(new TorusGeometry(0.28, 0.04, 6, 12, Math.PI), iron, fx, 0.55, fz, 0, 0, Math.PI);
        for (const k of [-1, 1]) K.add(new ConeGeometry(0.07, 0.16, 4), iron, fx + k * 0.28, 0.58, fz, 0, 0, k * 0.6);
      }
      for (const [bx, bz] of [[-1.35, -1.35], [1.35, -1.35], [-1.35, 1.35], [1.35, 1.35]]) { K.put('bollard', new CylinderGeometry(0.09, 0.11, 0.5, 8), iron, x + bx, 0.25, z + bz); K.put('bollardSnow', GEO.snowCap, mSnow, x + bx, 0.5, z + bz, 0, 0.14, 0.07, 0.14); }
      for (const [[ax1, az1], [ax2, az2]] of [[[-1.35, -1.35], [1.35, -1.35]], [[1.35, -1.35], [1.35, 1.35]], [[-1.35, -1.35], [-1.35, 1.35]]]) for (let k = 0; k < 6; k++) { const t = (k + 0.5) / 6, sag = 0.12 * 4 * t * (1 - t); K.put('chain', new TorusGeometry(0.05, 0.015, 4, 8), iron, x + ax1 + (ax2 - ax1) * t, 0.42 - sag, z + az1 + (az2 - az1) * t, Math.atan2(ax2 - ax1, az2 - az1)); }
      const sg = sign('Waterfront Park', 1.9); sg.position.set(x, 0.62, z + 1.45); group.add(sg);
      lantern(x - 1.35, 1.0, z + 1.35, true); lantern(x + 1.35, 1.0, z + 1.35);
      life.perches.push([ax, top + 2.3, az], [lx, ly + 1.05, lz]);
    } else if (lm.type === 'pier') { // wooden pier over the ice with bollards and a lamp
      const [x, z] = centre(lm), alongX = lm.along === 'x', L = alongX ? lm.w : lm.h;
      const P2 = (u, v) => (alongX ? [x + u, z + v] : [x + v, z + u]); // u along the pier, v across
      K.add(rbox(alongX ? L + 0.4 : 2.1, alongX ? 2.1 : L + 0.4, 0.22, 0.04), mWood, x, 0.12, z); K.add(rbox(alongX ? L : 1.9, alongX ? 1.9 : L, 0.12, 0.06), M('snow', '#e6ecf8'), x, 0.34, z);
      for (let k = 0; k <= L; k += 1.5) for (const s2 of [-1, 1]) { const [px, pz] = P2(-L / 2 + k, s2 * 1.0), [bx, bz] = P2(-L / 2 + k, s2 * 0.85); K.put('pierPost', new CylinderGeometry(0.1, 0.1, 0.8, 8), mWood, px, 0.1, pz); K.put('bollard', new CylinderGeometry(0.09, 0.11, 0.3, 8), mMetal, bx, 0.48, bz); life.perches.push([bx, 0.66, bz]); }
      const [lx, lz] = P2(L / 2 - 0.3, -0.9); lantern(lx, 1.5, lz, true); K.put('lampPost', GEO.post, mMetal, lx, 0.85, lz, 0, 1, 1.3, 1);
    } else if (lm.type === 'iskele') { // the ferry pier building: a wooden pavilion with a deep roof, a clock and warm windows
      const [x, z] = centre(lm), alongX = lm.along === 'x', ry = alongX ? (lm.dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (lm.dir > 0 ? Math.PI : 0);
      const cream = M('plaster', '#f3e9d8'), trim = M('wood', '#3f5f9a'), roof = M('shingle', '#5d6f9e');
      K.add(rbox(2.1, 2.1, 0.22, 0.04), mWood, x, 0.1, z); K.add(rbox(1.7, 1.6, 1.2, 0.05), cream, x, 0.32, z, 0, ry);
      for (const [u, v] of [[-0.85, -0.8], [0.85, -0.8], [-0.85, 0.8], [0.85, 0.8]]) { const px = x + (alongX ? v : u), pz = z + (alongX ? u : v); K.add(rbox(0.12, 0.12, 1.25, 0.02), trim, px, 0.3, pz); }
      K.add(new ConeGeometry(1.75, 0.95, 4), roof, x, 2.0, z, 0, Math.PI / 4); K.add(new ConeGeometry(1.6, 0.9, 4), mSnow, x, 2.12, z, 0, Math.PI / 4);
      K.add(new SphereGeometry(0.08, 8, 6), M('glow', '#e8b84a'), x, 2.6, z);
      const fwd = alongX ? [-lm.dir, 0] : [0, -lm.dir], fx = x + fwd[0] * 0.82, fz = z + fwd[1] * 0.82, fry = Math.atan2(fwd[0], fwd[1]);
      K.add(new CircleGeometry(0.22, 18), M('glow', '#fff8e6'), fx, 1.3, fz, 0, fry); K.add(new TorusGeometry(0.22, 0.03, 5, 18), trim, fx, 1.3, fz, 0, fry);
      K.add(rbox(0.02, 0.15, 0.02, 0.005), M('glow', '#2b3556'), fx, 1.34, fz, 0, fry); K.add(rbox(0.11, 0.02, 0.02, 0.005), M('glow', '#2b3556'), fx + 0.04, 1.3, fz, 0, fry);
      for (const s2 of [-0.45, 0.45]) { const wx = fx + (alongX ? 0 : s2), wz = fz + (alongX ? s2 : 0); K.add(new PlaneGeometry(0.32, 0.4), mGlass, wx + fwd[0] * 0.01, 0.95, wz + fwd[1] * 0.01, 0, fry); }
      const sg = sign('Kasımpaşa Pier', 1.6); sg.position.set(x, 2.95, z); group.add(sg);
      lantern(fx, 1.75, fz, true); smokeSources.push([x, 2.7, z]);
      life.perches.push([x, 2.68, z]);
    } else if (lm.type === 'ferry') { // a Golden Horn ferry stuck in the ice: white upper decks, navy hull, warm windows, lifebuoys, a smoking funnel
      const [x, z] = centre(lm), alongX = lm.along !== 'z', ry = alongX ? 0 : Math.PI / 2;
      const F = (u, v) => (alongX ? [x + u, z + v] : [x + v, z - u]);
      K.add(rbox(4.6, 1.9, 0.6, 0.3, 3), M('metal', '#2f3b63'), x, -0.2, z, 0, ry); K.add(rbox(4.5, 1.85, 0.4, 0.25, 3), M('plaster', '#f6f3f8'), x, 0.3, z, 0, ry);
      K.add(rbox(4.6, 1.95, 0.08, 0.04), M('fabric', '#c8443c'), x, 0.36, z, 0, ry);
      K.add(rbox(3.2, 1.4, 0.7, 0.1), M('plaster', '#f6f3f8'), x, 0.7, z, 0, ry); K.add(rbox(3.3, 1.5, 0.1, 0.05), M('metal', '#3d4a6b'), x, 1.4, z, 0, ry); K.add(rbox(3.2, 1.4, 0.24, 0.12, 3), mSnow, x, 1.48, z, 0, ry);
      K.add(rbox(1.2, 1.0, 0.5, 0.08), M('plaster', '#f6f3f8'), x - (alongX ? 1.0 : 0), 1.5, z + (alongX ? 0 : 1.0), 0, ry); K.add(rbox(1.25, 1.05, 0.16, 0.08, 3), mSnow, x - (alongX ? 1.0 : 0), 2.02, z + (alongX ? 0 : 1.0), 0, ry);
      for (let k = 0; k < 6; k++) for (const side of [0.71, -0.71]) { const [wx, wz] = F(-1.35 + k * 0.54, side); K.add(new PlaneGeometry(0.34, 0.3), mGlass, wx, 1.02, wz, 0, ry + (side < 0 ? Math.PI : 0)); }
      for (const u of [-1.6, 1.6]) { const [bx, bz] = F(u, 0.97); K.add(new TorusGeometry(0.16, 0.05, 6, 12), M('fabric', '#ffffff'), bx, 0.55, bz, 0, ry); K.add(new TorusGeometry(0.165, 0.052, 6, 12, Math.PI / 2), M('fabric', '#d9443a'), bx, 0.55, bz, 0, ry); K.add(new TorusGeometry(0.165, 0.052, 6, 12, Math.PI / 2), M('fabric', '#d9443a'), bx, 0.55, bz, 0, ry, Math.PI); }
      const [fx, fz] = F(0.7, 0); K.add(new CylinderGeometry(0.2, 0.24, 0.9, 14), M('plaster', '#f2c14e'), fx, 2.0, fz); K.add(new CylinderGeometry(0.205, 0.205, 0.22, 14), M('metal', '#2b2f45'), fx, 2.38, fz); K.add(new CylinderGeometry(0.26, 0.26, 0.1, 14), mSnow, fx, 2.52, fz);
      const [mx, mz] = F(-1.8, 0); K.put('mast', GEO.post, mMetal, mx, 1.4, mz, 0, 0.6, 2.2, 0.6); K.add(rbox(0.4, 0.02, 0.26, 0.01), M('fabric', '#d9443a'), mx + (alongX ? 0.2 : 0), 2.35, mz + (alongX ? 0 : 0.2), 0, ry);
      smokeSources.push([fx, 2.6, fz]);
      for (const [u, v, y] of [[-1.4, 0, 1.65], [-0.4, 0.3, 1.65], [1.6, -0.5, 0.75]]) { const [px, pz] = F(u, v); life.perches.push([px, y, pz]); }
    } else if (lm.type === 'pavilion') { // an octagonal park pavilion under a heavy snow roof
      const [x, z] = centre(lm);
      K.add(new CylinderGeometry(1.2, 1.25, 0.25, 8), mStone, x, 0.12, z);
      for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28 + 0.39; K.add(new CylinderGeometry(0.07, 0.07, 1.6, 8), mBeam, x + Math.cos(a) * 1.0, 1.05, z + Math.sin(a) * 1.0); }
      K.add(new CylinderGeometry(1.3, 1.3, 0.14, 8), mBeam, x, 1.85, z); K.add(new ConeGeometry(1.55, 1.0, 8), M('shingle', '#56709a'), x, 2.4, z); K.add(new ConeGeometry(1.35, 0.95, 8), mSnow, x, 2.55, z);
      K.add(new SphereGeometry(0.12, 8, 6), M('metal', '#c9a24a'), x, 3.05, z);
      const sg = sign('Sururi Park', 1.7); sg.position.set(x, 3.4, z); group.add(sg);
      lantern(x, 1.6, z, true);
    } else if (lm.type === 'simit-cart') { // a street seller's cart: red box, glass case of sesame rings, wheels in the snow
      const [x, z] = centre(lm), red = M('metal', '#c8443c');
      K.add(rbox(1.0, 0.6, 0.6, 0.06), red, x, 0.25, z); K.add(rbox(0.9, 0.5, 0.42, 0.03), M('glow', '#ffe6b0'), x, 0.85, z);
      for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) K.add(new TorusGeometry(0.1, 0.04, 5, 10), M('wood', '#c98a4a'), x - 0.28 + a * 0.28, 0.95 + b * 0.14, z + 0.05, Math.PI / 2 - 0.4);
      K.add(rbox(1.05, 0.65, 0.06, 0.03), red, x, 1.27, z); K.add(rbox(1.0, 0.6, 0.18, 0.08, 3), mSnow, x, 1.32, z);
      for (const s2 of [-0.42, 0.42]) K.add(new CylinderGeometry(0.22, 0.22, 0.06, 12), mBeam, x + s2, 0.2, z + 0.32, Math.PI / 2);
      K.add(GEO.snowCap, mSnow, x, 0, z, 0, 0, 0, 1.4, 0.3, 1.0);
      glows.push([x, 0.95, z + 0.35, 1.0]); life.perches.push([x + 0.3, 1.48, z]);
    } else if (lm.type === 'slide') {
      const [x, z] = centre(lm);
      K.add(rbox(0.5, 0.5, 1.1, 0.04), M('metal', '#c8584a'), x - 0.3, 0, z); K.add(rbox(0.3, 1.3, 0.06, 0.02), M('metal', '#d99a3e'), x + 0.25, 0.55, z + 0.3, -0.75, 0, 0); K.add(rbox(0.32, 1.1, 0.12, 0.05), mSnow, x + 0.25, 0.62, z + 0.3, -0.75, 0, 0); K.add(GEO.snowCap, mSnow, x - 0.3, 1.1, z, 0, 0, 0, 0.32, 0.18, 0.32);
    } else if (lm.type === 'swings') {
      const [x, z] = centre(lm);
      for (const s of [-0.45, 0.45]) K.add(new CylinderGeometry(0.05, 0.05, 1.5, 6), M('metal', '#4f6fa8'), x + s, 0.75, z);
      K.add(new CylinderGeometry(0.05, 0.05, 1.0, 6), M('metal', '#4f6fa8'), x, 1.5, z, 0, 0, Math.PI / 2); K.add(new CapsuleGeometry(0.06, 0.9, 3, 6), mSnow, x, 1.58, z, 0, 0, Math.PI / 2);
      for (const s of [-0.2, 0.2]) K.add(rbox(0.25, 0.12, 0.04, 0.01), mWood, x + s, 0.45, z);
    } else if (lm.type === 'giant-snowman') { // the builders' project: a giant snowman with a ladder
      const [x, z] = centre(lm);
      K.add(new SphereGeometry(1.0, 16, 12), mSnow, x, 0.85, z); K.add(new SphereGeometry(0.72, 16, 12), mSnow, x, 2.2, z); K.add(new SphereGeometry(0.5, 16, 12), mSnow, x, 3.2, z);
      K.add(new ConeGeometry(0.1, 0.5, 8), M('glow', '#f08a24'), x, 3.2, z + 0.62, Math.PI / 2);
      K.add(new TorusGeometry(0.55, 0.12, 6, 16), M('fabric', '#c8584a'), x, 2.7, z, Math.PI / 2);
      for (const s of [-0.18, 0.18]) K.add(new CylinderGeometry(0.03, 0.03, 3.0, 6), mWood, x + 1.0 + s, 1.4, z + 0.5, 0, 0, 0.25);
      for (let k = 0; k < 6; k++) K.add(new CylinderGeometry(0.025, 0.025, 0.4, 6), mWood, x + 0.95 - k * 0.07, 0.3 + k * 0.45, z + 0.5, 0, 0, Math.PI / 2);
      shovel(x - 1.1, z + 0.4, 0.4); barrel(x + 1.3, z - 0.6);
    }
  }
}
