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
import { addSparkle } from './look.js';

const paint = (size, fn) => { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); fn(g, size); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping; t.anisotropy = 4; return t; };
const blot = (g, x, y, r, rgb, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };

export function buildSnowtown(ctx) {
  const { arena, K, M, T, PAL, GEO, rbox, prism, rnd, at, group, glows, smokeSources, lights, low, lantern, pine, rock, barrel, crate, firewood, shovel,
    mSnow, mStone, mStoneDark, mBeam, mWood, mMetal, mIce, mGlass, sign, life, pools, look } = ctx;
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
  const trod = c => ('_+ds'.includes(c) ? 1 : '=c'.includes(c) ? 0.8 : 'POf#jYhr'.includes(c) ? 0.9 : 0);
  const quads = { snow: [], plaza: [], yard: [], ice: [] };
  const corner = (i, j) => { let n = 0; for (const [a, b] of [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]]) if ('HSKQCGR'.includes(ch(a, b))) n++; return n; };
  const wear = (i, j) => (trod(ch(i - 1, j - 1)) + trod(ch(i, j - 1)) + trod(ch(i - 1, j)) + trod(ch(i, j))) / 4;
  const TRODDEN = look === 'v2' ? [0.52, 0.58, 0.86] : [0.6, 0.62, 0.85]; // v2: cooler, deeper lanes for contrast
  // trodden lanes are sunk into the snow: the deep snow beside them stands a little higher
  const DEEP = 0.17;
  const wearAt = (x, z) => { const fx = x - arena.x0, fz = z - arena.z0, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j; return (wear(i, j) * (1 - u) + wear(i + 1, j) * u) * (1 - v) + (wear(i, j + 1) * (1 - u) + wear(i + 1, j + 1) * u) * v; };
  const snowH = (x, z) => ground(x, z) + DEEP * (1 - wearAt(x, z));
  const snowNormal = (x, z) => { const e = 0.25, dx = (snowH(x + e, z) - snowH(x - e, z)) / (2 * e), dz = (snowH(x, z + e) - snowH(x, z - e)) / (2 * e), l = Math.hypot(dx, 1, dz); return [-dx / l, 1 / l, -dz / l]; };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (ch(i, j) !== '~') quads[cat(ch(i, j))].push([i, j]); // '~': outside a stage build
  for (const [name, list] of Object.entries(quads)) {
    if (!list.length) continue;
    const P = [], N = [], U = [], Cc = [];
    const uvs = name === 'ice' ? 0.16 : 0.5;
    const SUN = (() => { const v = [-11, 14, 7], l = Math.hypot(...v); return v.map(c => c / l); })();
    const vert = (x, z, ao, w) => {
      let y = 0, n = [0, 1, 0];
      if (name === 'snow') { y = snowH(x, z); n = snowNormal(x, z); const d = n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2]; ao *= (0.78 + 0.3 * Math.max(0, d)) / 0.9975 + (y > 1.6 ? 0.04 : 0); } // slopes facing away from the sun read darker
      if (name === 'snow') { const ww = wearAt(x, z); ao *= 1 + 0.1 * 4 * ww * (1 - ww) * (ww < 0.5 ? 1 : 0); } // a bright lip of snow along the lane edge
      P.push(x, y, z); N.push(...n); U.push(x * uvs, -z * uvs); const s = 1 - w; Cc.push(ao * (0.97 * s + TRODDEN[0] * w), ao * (0.97 * s + TRODDEN[1] * w), Math.min(1, ao * (1.02 * s + TRODDEN[2] * w))); };
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
      if ((name === 'snow' || name === 'ice') && !arena.clip) {
        const E = 45, out = [];
        if (i === 0) out.push([x0 - E, z0, x0, z0 + 1]); if (i === W - 1) out.push([x0 + 1, z0, x0 + 1 + E, z0 + 1]);
        if (j === 0) out.push([x0, z0 - E, x0 + 1, z0]); if (j === H - 1) out.push([x0, z0 + 1, x0 + 1, z0 + 1 + E]);
        if (i === 0 && j === 0) out.push([x0 - E, z0 - E, x0, z0]); if (i === W - 1 && j === 0) out.push([x0 + 1, z0 - E, x0 + 1 + E, z0]);
        if (i === 0 && j === H - 1) out.push([x0 - E, z0 + 1, x0, z0 + 1 + E]); if (i === W - 1 && j === H - 1) out.push([x0 + 1, z0 + 1, x0 + 1 + E, z0 + 1 + E]);
        for (const [ax, az, bx, bz] of out) for (const [x, z] of [[ax, az], [bx, bz], [bx, az], [ax, az], [ax, bz], [bx, bz]]) vert(x, z, name === 'ice' ? 0.9 : 1, 0);
      }
    }
    const geo = new BufferGeometry(); geo.setAttribute('position', new Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new Float32BufferAttribute(N, 3)); geo.setAttribute('uv', new Float32BufferAttribute(U, 2)); geo.setAttribute('color', new Float32BufferAttribute(Cc, 3));
    const tmat = new MeshLambertMaterial({ map: TEX[name], vertexColors: true }); if (look === 'v2' && name === 'snow') addSparkle(tmat);
    const mesh = new Mesh(geo, tmat); mesh.receiveShadow = true; group.add(mesh);
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

  // ---------- trees: plane trees on the boulevard, birch, rowan with red berries, spruce; pines and
  //            cypresses come from the shared helpers ----------
  const bark = M('wood', '#a4968c'), barkLight = M('plaster', '#d9cdb4');
  const treeGeo = { trunk: new CylinderGeometry(0.1, 0.16, 1, 7), blob: new SphereGeometry(0.5, 8, 5), cone: new ConeGeometry(1, 1, 8), twig: new CylinderGeometry(0.03, 0.05, 1, 5), berry: new SphereGeometry(0.06, 5, 4) };
  const mBirch = M('plaster', '#f1efe8'), mBirchMark = M('plaster', '#3a3a46'), mBirchLeaf = M('plaster', '#d9b65a'), mRowan = M('wood', '#6a4a3a'), mBerry = M('glow', '#e0463c'), mSpruce = M('plaster', '#2f6f6a'), mSpruce2 = M('plaster', '#3c8079');
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const c = ch(i, j); if (!'Tvyx'.includes(c)) continue;
    const [x, z] = at(i, j), s2 = 0.85 + rnd(i * 3, j * 7) * 0.35, rot = rnd(i, j) * 6.28;
    if (c === 'T') { // plane tree: mottled trunk, wide bare crown under clumps of snow
      K.put('planeTrunk', treeGeo.trunk, bark, x, 1.0 * s2, z, rot, 2.2 * s2, 2.0 * s2, 2.2 * s2);
      K.put('planePatch', treeGeo.blob, barkLight, x + 0.12, 0.9 * s2, z + 0.16, rot, 0.18, 0.3, 0.1);
      for (let k = 0; k < 4; k++) { const an = rot + k * 1.57, ox = Math.sin(an) * 0.55 * s2, oz = Math.cos(an) * 0.55 * s2;
        K.put('planeBranch', treeGeo.twig, bark, x + ox * 0.5, 2.25 * s2, z + oz * 0.5, 0, 2.4, 1.2 * s2, 2.4, Math.cos(an) * 0.8, -Math.sin(an) * 0.8);
        K.put('planeSnow', treeGeo.blob, mSnow, x + ox, 2.75 * s2, z + oz, an, 1.1 * s2, 0.55 * s2, 1.1 * s2); }
      K.put('planeTop', treeGeo.blob, mSnow, x, 3.0 * s2, z, rot, 1.2 * s2, 0.6 * s2, 1.2 * s2);
    } else if (c === 'v') { // birch: white trunk with dark marks, a few golden leaves left
      K.put('birchTrunk', treeGeo.trunk, mBirch, x, 1.1 * s2, z, rot, 0.9 * s2, 2.2 * s2, 0.9 * s2);
      for (const y of [0.6, 1.2, 1.7]) K.put('birchMark', treeGeo.trunk, mBirchMark, x, y * s2, z, rot, 0.95 * s2, 0.06, 0.95 * s2);
      for (let k = 0; k < 3; k++) { const an = rot + k * 2.1; K.put('birchLeaf', treeGeo.blob, mBirchLeaf, x + Math.sin(an) * 0.35, (2.1 + k * 0.25) * s2, z + Math.cos(an) * 0.35, an, 0.8 * s2, 0.7 * s2, 0.8 * s2); }
      K.put('birchSnow', treeGeo.blob, mSnow, x, 2.75 * s2, z, rot, 0.75 * s2, 0.32 * s2, 0.75 * s2);
    } else if (c === 'y') { // rowan: a small dark tree with bright red berries and snow on top
      K.put('rowanTrunk', treeGeo.trunk, mRowan, x, 0.7 * s2, z, rot, 1.1 * s2, 1.4 * s2, 1.1 * s2);
      for (let k = 0; k < 5; k++) { const an = rot + k * 1.26; K.put('rowanTwig', treeGeo.twig, mRowan, x + Math.sin(an) * 0.25, 1.65 * s2, z + Math.cos(an) * 0.25, 0, 1.4, 1.0 * s2, 1.4, Math.cos(an) * 0.6, -Math.sin(an) * 0.6);
        for (let b = 0; b < 3; b++) K.put('berry', treeGeo.berry, mBerry, x + Math.sin(an + b * 0.3) * (0.5 + b * 0.08) * s2, (1.9 + b * 0.12) * s2, z + Math.cos(an + b * 0.3) * (0.5 + b * 0.08) * s2, 0, 1.2); }
      K.put('rowanSnow', treeGeo.blob, mSnow, x, 2.15 * s2, z, rot, 1.1 * s2, 0.4 * s2, 1.1 * s2);
    } else { // spruce: tall, narrow, blue-green, heavy with snow
      K.put('spruceTrunk', treeGeo.trunk, mWood, x, 0.35, z, rot, 1.2, 0.7, 1.2);
      [[0.9, 0.85, 1.2], [1.65, 0.68, 1.05], [2.35, 0.5, 0.95], [2.95, 0.32, 0.8]].forEach(([y, r, h], k) => {
        K.put('spruceTier' + (k % 2), treeGeo.cone, k % 2 ? mSpruce : mSpruce2, x, y * s2, z, rot + k, r * s2, h * s2, r * s2);
        K.put('spruceSnow', GEO.snowCap, mSnow, x, (y + h * 0.12) * s2, z, rot, r * s2 * 1.0, h * s2 * 0.45, r * s2 * 1.0);
      });
    }
  }

  // ---------- fingerposts at junctions, in English, pointing to the outposts and Our School ----------
  const arrowFor = a => { const d = ((a * 180 / Math.PI) + 360) % 360; return ['↓', '↘', '→', '↗', '↑', '↖', '←', '↙'][Math.round(d / 45) % 8]; }; // angle measured from +z (south) toward +x (east)
  const smallSign = (text) => { const c = document.createElement('canvas'); c.width = 320; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#6a4a3a'; g.beginPath(); g.roundRect(2, 2, 316, 60, 12); g.fill(); g.fillStyle = '#f4ead6'; g.beginPath(); g.roundRect(7, 7, 306, 50, 9); g.fill(); g.fillStyle = '#2b3556'; g.textAlign = 'center'; g.textBaseline = 'middle'; let fs = 30; g.font = `800 ${fs}px system-ui, sans-serif`; while (g.measureText(text).width > 290 && fs > 16) { fs -= 2; g.font = `800 ${fs}px system-ui, sans-serif`; } g.fillText(text, 160, 33); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return new Mesh(new PlaneGeometry(1.5, 0.3), new MeshLambertMaterial({ map: t, transparent: true })); };
  for (const sp of arena.signposts || []) {
    const x = arena.x0 + sp.i + 0.5, z = arena.z0 + sp.j + 0.5;
    K.put('signPost', GEO.post, mWood, x, 1.1, z, 0, 1.2, 2.2, 1.2); K.put('signPostCap', GEO.snowCap, mSnow, x, 2.2, z, 0, 0.16, 0.08, 0.16); K.put('signMound', lowCap, mSnow, x, 0, z, 0, 0.7, 0.3, 0.6);
    sp.arrows.forEach((a, k) => { const m = smallSign(`${arrowFor(a.ang)} ${a.label}`); m.position.set(x, 1.95 - k * 0.34, z + 0.06); group.add(m); });
  }

  // ---------- the outposts: each one is its landmark ----------
  const tileTex = paint(128, (g, S) => { // blue-and-turquoise wall tiles with white tulip-like flowers
    g.fillStyle = '#f4f7fb'; g.fillRect(0, 0, S, S);
    for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) { const cx = a * 64 + 32, cy = b * 64 + 32; g.fillStyle = '#2d6fb5'; g.fillRect(a * 64 + 3, b * 64 + 3, 58, 58); g.fillStyle = '#35b0b0'; g.beginPath(); g.arc(cx, cy, 20, 0, 7); g.fill(); g.fillStyle = '#ffffff'; for (let k = 0; k < 6; k++) { const an = k / 6 * Math.PI * 2; g.beginPath(); g.ellipse(cx + Math.cos(an) * 11, cy + Math.sin(an) * 11, 6, 3, an, 0, 7); g.fill(); } g.fillStyle = '#d9443a'; g.beginPath(); g.arc(cx, cy, 5, 0, 7); g.fill(); }
  });
  const letterTex = ch2 => paint(64, (g, S) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S); g.strokeStyle = '#9ec3e8'; g.lineWidth = 4; g.strokeRect(3, 3, S - 6, S - 6); g.fillStyle = '#2d6fb5'; g.font = '900 46px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch2, S / 2, S / 2 + 2); });
  const flagAt = (id, x, y, z) => { K.add(new CylinderGeometry(0.035, 0.035, 1.8, 8), mWood, x, y - 0.6, z); ctx.centreFlags.set(id, ctx.makeFlag(x, y, z)); };

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
    } else if (lm.type === 'archers-lodge') { // ARCHERY GROUND outpost: an Ottoman archers' lodge in white marble, lead domes, red-and-white arches, a golden bow
      const [x, z] = centre(lm), lead = M('metal', '#8492b4'), marble = M('plaster', '#f8f4fb'), gold = M('glow', '#e8b84a'), red = M('fabric', '#c8443c');
      K.add(rbox(4.4, 4.4, 0.32, 0.08), mStone, x, 0, z);
      K.add(rbox(4.0, 2.3, 2.1, 0.06), marble, x, 0.3, z - 0.75);
      K.add(rbox(4.2, 2.5, 0.16, 0.05), mStone, x, 2.4, z - 0.75);
      for (const dx of [-1.25, 0, 1.25]) { const big = dx === 0 ? 1.25 : 1;
        K.add(new CylinderGeometry(0.46 * big, 0.5 * big, 0.3, 16), marble, x + dx, 2.7, z - 0.75);
        K.add(new SphereGeometry(0.5 * big, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), lead, x + dx, 2.85, z - 0.75);
        K.add(new SphereGeometry(0.52 * big, 16, 4, 0, Math.PI * 2, 0, Math.PI / 4.2), mSnow, x + dx, 2.87, z - 0.75);
        K.add(new SphereGeometry(0.07, 8, 6), gold, x + dx, 2.88 + 0.52 * big, z - 0.75); K.add(new ConeGeometry(0.035, 0.26, 6), gold, x + dx, 3.06 + 0.52 * big, z - 0.75);
      }
      K.add(rbox(4.1, 1.5, 0.14, 0.03), mStone, x, 0.32, z + 1.15);
      for (let k = 0; k < 5; k++) { const cx = x - 1.7 + k * 0.85; K.add(new CylinderGeometry(0.09, 0.1, 1.35, 10), marble, cx, 1.13, z + 1.7); K.add(rbox(0.24, 0.24, 0.1, 0.02), mStone, cx, 1.8, z + 1.7); }
      for (let k = 0; k < 4; k++) { const cx = x - 1.275 + k * 0.85; K.add(new TorusGeometry(0.36, 0.09, 6, 12, Math.PI), M('plaster', '#d0573f'), cx, 1.85, z + 1.7); K.add(new TorusGeometry(0.36, 0.092, 6, 12, Math.PI / 3), marble, cx, 1.85, z + 1.7, 0, 0, Math.PI / 3); lantern(cx, 1.6, z + 1.55); }
      K.add(rbox(4.2, 1.5, 0.12, 0.03), M('wood', '#a5714f'), x, 2.25, z + 1.12, 0.16); K.add(rbox(4.15, 1.45, 0.16, 0.08, 3), mSnow, x, 2.34, z + 1.12, 0.16);
      for (let k = 0; k < 4; k++) { const wx = x - 1.275 + k * 0.85; K.add(new PlaneGeometry(0.46, 0.72), mGlass, wx, 1.05, z + 0.41); K.add(new CircleGeometry(0.23, 12, 0, Math.PI), mGlass, wx, 1.41, z + 0.411); }
      K.add(new TorusGeometry(1.05, 0.08, 6, 26, Math.PI * 0.8), gold, x, 2.7, z + 1.95, 0, 0, Math.PI * 0.1); // the golden bow over the porch
      K.add(rbox(2.0, 0.025, 0.025, 0.005), M('glow', '#fff3d6'), x, 2.72, z + 1.96);
      for (const r of [0.6, -0.6]) { K.add(new CylinderGeometry(0.03, 0.03, 2.1, 6), gold, x, 3.05, z + 1.98, 0, 0, r); K.add(new ConeGeometry(0.09, 0.22, 4), gold, x - Math.sin(r) * 1.1, 3.05 + Math.cos(r) * 1.1, z + 1.98, 0, 0, r); }
      const sg = sign("Archers' Lodge", 1.6); sg.position.set(x, 2.55, z + 2.05); group.add(sg);
      for (const sx of [-2.0, 2.0]) { K.put('flagPole', GEO.post, mMetal, x + sx, 1.7, z + 1.9, 0, 0.8, 3.4, 0.8);
        const pen = new BufferGeometry(); pen.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0.9, -0.22, 0, 0, -0.45, 0], 3)); pen.computeVertexNormals();
        K.add(pen, sx < 0 ? red : M('fabric', '#e8b84a'), x + sx, 3.35, z + 1.9); }
      flagAt(lm.outpost, x, 4.4, z - 0.75); lights.push([x, 1.8, z + 2.3]);
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
    } else if (lm.type === 'fountain') { // KIZILAY SQUARE outpost: an octagonal fountain kiosk with blue tiles, brass taps, wide eaves and a lead dome
      const [x, z] = centre(lm), marble = M('plaster', '#f6f2f8'), tiles = new MeshLambertMaterial({ map: tileTex }), lead = M('metal', '#8a96b8'), gold = M('glow', '#e8b84a'), brass = M('metal', '#d9a640'), eave = M('wood', '#6b4e5e');
      K.add(new CylinderGeometry(2.15, 2.25, 0.26, 8), M('stone', '#9a9cb6'), x, 0.13, z, 0, Math.PI / 8); K.add(new CylinderGeometry(1.85, 1.9, 0.22, 8), mStone, x, 0.37, z, 0, Math.PI / 8);
      K.add(new CylinderGeometry(1.4, 1.42, 2.1, 8), marble, x, 1.53, z, 0, Math.PI / 8);
      for (let k = 0; k < 8; k++) {
        const an = k / 8 * Math.PI * 2, fx = Math.sin(an), fz = Math.cos(an), px = x + fx * 1.31, pz = z + fz * 1.31;
        K.add(new PlaneGeometry(0.78, 1.2), tiles, px + fx * 0.01, 1.62, pz + fz * 0.01, 0, an);
        K.add(rbox(0.86, 0.06, 0.08, 0.02), gold, px + fx * 0.02, 2.24, pz + fz * 0.02, 0, an);
        if (k % 2 === 0) { // a brass tap with a frozen trickle and a little basin
          K.add(new CylinderGeometry(0.05, 0.05, 0.2, 8), brass, px + fx * 0.12, 0.98, pz + fz * 0.12, Math.PI / 2, an);
          K.add(new ConeGeometry(0.06, 0.4, 6), mIce, px + fx * 0.22, 0.76, pz + fz * 0.22, Math.PI);
          K.add(rbox(0.6, 0.32, 0.18, 0.05), M('stone', '#c9c6dc'), px + fx * 0.25, 0.48, pz + fz * 0.25, 0, an);
          K.add(rbox(0.5, 0.24, 0.05, 0.02), mIce, px + fx * 0.25, 0.64, pz + fz * 0.25, 0, an);
        }
      }
      K.add(new CylinderGeometry(2.45, 2.2, 0.18, 8), eave, x, 2.7, z, 0, Math.PI / 8); K.add(new CylinderGeometry(2.4, 2.45, 0.2, 8), mSnow, x, 2.86, z, 0, Math.PI / 8);
      for (let k = 0; k < 24; k++) { const an = k / 24 * Math.PI * 2; K.put('drip', GEO.drip, mSnow, x + Math.sin(an) * 2.32, 2.62, z + Math.cos(an) * 2.32, 0, 1.1, 0.9, 1.1); }
      K.add(new CylinderGeometry(0.95, 1.0, 0.35, 16), marble, x, 3.1, z);
      K.add(new SphereGeometry(1.0, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), lead, x, 3.27, z); K.add(new SphereGeometry(1.02, 18, 4, 0, Math.PI * 2, 0, Math.PI / 4.5), mSnow, x, 3.3, z);
      K.add(new SphereGeometry(0.12, 10, 8), gold, x, 4.32, z); K.add(new ConeGeometry(0.05, 0.4, 6), gold, x, 4.6, z);
      for (let k = 0; k < 8; k++) { const an = (k + 0.5) / 8 * Math.PI * 2, tx = x + Math.sin(an) * 2.0, tz = z + Math.cos(an) * 2.0; // tulips in the snow round the steps
        K.put('tulipStem', GEO.post, M('plaster', '#4f8a5a'), tx, 0.45, tz, 0, 0.4, 0.5, 0.4); K.put('tulip', GEO.cone, M('fabric', k % 2 ? '#e8584a' : '#e889b5'), tx, 0.72, tz, Math.PI, 0.09, 0.16, 0.09); }
      const sg = sign('Kızılay Square', 1.6); sg.position.set(x, 3.15, z + 2.45); group.add(sg);
      flagAt(lm.outpost, x, 5.4, z); lights.push([x, 2.0, z + 2.2]); glows.push([x, 1.0, z + 1.6, 1.2]);
    } else if (lm.type === 'plane-tree') { // a huge old plane tree, branches heavy with snow
      const [x, z] = centre(lm);
      K.add(new CylinderGeometry(0.28, 0.42, 2.2, 10), M('wood', '#9a8c84'), x, 1.1, z);
      for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28, r = k ? 0.85 : 0, y = 2.5 + (k % 2) * 0.35; K.add(new SphereGeometry(0.75, 10, 7), M('plaster', '#5d6f7a'), x + Math.cos(a) * r, y, z + Math.sin(a) * r); K.add(GEO.snowCap, mSnow, x + Math.cos(a) * r, y + 0.2, z + Math.sin(a) * r, 0, 0, 0, 1.45, 0.75, 1.45); }
    } else if (lm.type === 'admiral') { // WATERFRONT PARK outpost: Cezayirli Gazi Hasan Paşa and his lion on a tall pedestal, a ship's bell, a mast with signal flags
      const [x, z] = centre(lm), bronze = M('plaster', '#6fae9f'), bronzeD = M('plaster', '#4f8a80'), granite = M('stone', '#8f93ac'), pale = M('stone', '#dcd8e8'), iron = M('metal', '#3d4a6b'), brass = M('metal', '#d9a640');
      K.add(new CylinderGeometry(2.1, 2.2, 0.26, 20), granite, x, 0.13, z); K.add(new CylinderGeometry(1.55, 1.6, 0.3, 20), granite, x, 0.41, z);
      K.add(new CylinderGeometry(0.72, 0.8, 1.9, 8), pale, x, 1.5, z - 0.2, 0, Math.PI / 8);
      for (const y of [0.75, 2.3]) K.add(new CylinderGeometry(0.84, 0.84, 0.12, 8), M('metal', '#9a7b3e'), x, y, z - 0.2, 0, Math.PI / 8);
      K.add(new CylinderGeometry(0.95, 0.85, 0.18, 8), granite, x, 2.5, z - 0.2, 0, Math.PI / 8);
      const T0 = 2.6, ax = x, az = z - 0.2, S2 = 1.35; // the admiral, a third bigger than life on his column
      K.add(new ConeGeometry(0.42 * S2, 1.15 * S2, 12), bronze, ax, T0 + 0.58 * S2, az); K.add(new CylinderGeometry(0.2 * S2, 0.26 * S2, 0.5 * S2, 12), bronze, ax, T0 + 1.3 * S2, az);
      K.add(new TorusGeometry(0.24 * S2, 0.05 * S2, 6, 14), bronzeD, ax, T0 + 1.12 * S2, az, Math.PI / 2);
      K.add(new SphereGeometry(0.18 * S2, 12, 10), bronze, ax, T0 + 1.72 * S2, az); K.add(new ConeGeometry(0.12 * S2, 0.26 * S2, 8), bronzeD, ax, T0 + 1.55 * S2, az + 0.12, Math.PI);
      K.add(new CylinderGeometry(0.19 * S2, 0.2 * S2, 0.34 * S2, 12), bronze, ax, T0 + 2.0 * S2, az); K.add(new TorusGeometry(0.21 * S2, 0.07 * S2, 6, 14), bronzeD, ax, T0 + 1.88 * S2, az, Math.PI / 2);
      K.add(new CapsuleGeometry(0.07 * S2, 0.55 * S2, 3, 8), bronze, ax - 0.55, T0 + 1.5 * S2, az + 0.14, 0, 0, Math.PI / 2.4);
      K.add(new CapsuleGeometry(0.07 * S2, 0.45 * S2, 3, 8), bronze, ax + 0.36, T0 + 1.15 * S2, az + 0.14, 0, 0, -0.35);
      K.add(GEO.snowCap, mSnow, ax, T0 + 2.18 * S2, az, 0, 0, 0, 0.56, 0.26, 0.56);
      const lx = x, lz = z + 1.15, ly = 0.56, L = 1.35; // his lion on the front step, with the kids' red scarf
      K.add(new CapsuleGeometry(0.22 * L, 0.32 * L, 4, 10), bronze, lx, ly + 0.32 * L, lz - 0.1, -0.5);
      for (const sx of [-0.15, 0.15]) K.add(new CylinderGeometry(0.07, 0.08, 0.55, 8), bronze, lx + sx, ly + 0.27, lz + 0.16);
      K.add(new SphereGeometry(0.3 * L, 14, 10), bronzeD, lx, ly + 0.72 * L, lz + 0.05);
      for (let k = 0; k < 9; k++) { const ang = k / 9 * Math.PI * 2; K.add(new SphereGeometry(0.12, 8, 6), bronzeD, lx + Math.cos(ang) * 0.36, ly + 0.72 * L + Math.sin(ang) * 0.36, lz + 0.04); }
      K.add(new SphereGeometry(0.19 * L, 12, 10), bronze, lx, ly + 0.72 * L, lz + 0.24); K.add(new SphereGeometry(0.1, 8, 6), bronzeD, lx, ly + 0.66 * L, lz + 0.47);
      for (const sx of [-0.17, 0.17]) K.add(new SphereGeometry(0.08, 6, 5), bronze, lx + sx, ly + 0.92 * L, lz + 0.16);
      K.add(new TorusGeometry(0.27, 0.08, 6, 14), M('fabric', '#d9443a'), lx, ly + 0.66, lz + 0.12, Math.PI / 2 - 0.3); K.add(rbox(0.15, 0.06, 0.42, 0.02), M('fabric', '#d9443a'), lx + 0.16, ly + 0.48, lz + 0.34, 0.3);
      K.add(GEO.snowCap, mSnow, lx, ly + 1.3, lz + 0.02, 0, 0, 0, 0.46, 0.18, 0.4);
      // the ship's bell on a wooden frame: it rings when you answer well
      const bx = x + 1.45, bz = z + 0.75;
      for (const sx of [-0.32, 0.32]) K.add(rbox(0.1, 0.1, 1.5, 0.02), mWood, bx + sx, 0.55, bz); K.add(rbox(0.8, 0.12, 0.12, 0.02), mWood, bx, 2.05, bz);
      K.add(new CylinderGeometry(0.13, 0.24, 0.36, 14, 1, true), brass, bx, 1.75, bz); K.add(new SphereGeometry(0.13, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), brass, bx, 1.92, bz); K.add(new SphereGeometry(0.05, 6, 5), iron, bx, 1.55, bz);
      K.add(GEO.snowCap, mSnow, bx, 2.11, bz, 0, 0, 0, 0.5, 0.1, 0.16);
      for (const sx of [-1.65, 1.65]) { if (sx > 0) continue; const fx = x + sx, fz = z + 0.6; // an anchor
        K.add(new CylinderGeometry(0.06, 0.06, 1.2, 8), iron, fx, 1.15, fz); K.add(new TorusGeometry(0.13, 0.04, 6, 10), iron, fx, 1.82, fz); K.add(rbox(0.5, 0.08, 0.08, 0.02), iron, fx, 1.5, fz);
        K.add(new TorusGeometry(0.38, 0.05, 6, 12, Math.PI), iron, fx, 0.95, fz, 0, 0, Math.PI); for (const k of [-1, 1]) K.add(new ConeGeometry(0.09, 0.22, 4), iron, fx + k * 0.38, 0.98, fz, 0, 0, k * 0.6); }
      // a mast behind with a yardarm, the outpost flag on top and strings of signal flags
      const mz = z - 1.55; K.add(new CylinderGeometry(0.07, 0.09, 5.2, 8), M('wood', '#e8e4ee'), x, 2.6, mz); K.add(rbox(2.4, 0.08, 0.08, 0.02), M('wood', '#e8e4ee'), x, 4.2, mz);
      const SIG = ['#e8584a', '#f2c14e', '#4f6fa8', '#ffffff', '#7cc47a', '#e889b5'];
      for (const sgn of [-1, 1]) for (let k = 1; k <= 6; k++) { const t = k / 7, fx = x + sgn * 1.15 * (1 - t) + sgn * t * 2.0, fy = 4.2 - t * 3.5 - Math.sin(Math.PI * t) * 0.3, fz2 = mz + t * 1.4;
        const tri = new BufferGeometry(); tri.setAttribute('position', new Float32BufferAttribute([-0.13, 0, 0, 0.13, 0, 0, 0, -0.3, 0], 3)); tri.computeVertexNormals(); K.add(tri, M('fabric', SIG[(k + (sgn > 0 ? 3 : 0)) % SIG.length]), fx, fy, fz2); }
      const sg = sign('Waterfront Park', 1.7); sg.position.set(x, 0.72, z + 2.25); group.add(sg);
      lantern(x - 1.2, 1.0, z + 1.6, true); lantern(x + 0.8, 1.0, z + 1.75);
      flagAt(lm.outpost, x, 5.8, mz); life.perches.push([ax, T0 + 2.35 * S2, az], [lx, ly + 1.35, lz], [x + 1.1, 4.3, mz], [x - 1.1, 4.3, mz]);
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
    } else if (lm.type === 'treehouse') { // BOULEVARD PARK outpost: a treehouse fort in a giant old plane tree, a rope ladder, a tyre swing, fairy lights
      const [x, z] = centre(lm), red = M('wood', '#c8584a'), wood = M('wood', '#b9845a'), dark = M('wood', '#6a4a3a');
      for (let k = 0; k < 5; k++) { const an = k / 5 * Math.PI * 2 + 0.3; K.add(new CapsuleGeometry(0.22, 0.9, 3, 8), bark, x + Math.sin(an) * 0.75, 0.15, z + Math.cos(an) * 0.75, Math.PI / 2 - 0.25, an); }
      K.add(new CylinderGeometry(0.62, 0.9, 3.4, 12), bark, x, 1.7, z);
      for (let k = 0; k < 9; k++) { const an = k * 2.3, y = 0.6 + (k * 0.37) % 2.6; K.add(new SphereGeometry(0.22, 7, 5), k % 2 ? barkLight : M('plaster', '#8c8a6a'), x + Math.sin(an) * 0.66, y, z + Math.cos(an) * 0.66, 0, an, 0, 1, 1.3, 0.35); } // plane-tree bark patches
      for (let k = 0; k < 4; k++) { const an = k / 4 * Math.PI * 2 + Math.PI / 4; K.add(rbox(0.12, 0.12, 1.5, 0.02), dark, x + Math.sin(an) * 0.95, 2.2, z + Math.cos(an) * 0.95, Math.cos(an) * 0.55, 0, -Math.sin(an) * 0.55); }
      K.add(new CylinderGeometry(2.05, 2.05, 0.2, 12), wood, x, 3.1, z); K.add(new CylinderGeometry(2.0, 2.0, 0.12, 12), mSnow, x, 3.24, z);
      for (let k = 0; k < 14; k++) { const an = k / 14 * Math.PI * 2; K.put('railPost', GEO.post, dark, x + Math.sin(an) * 1.95, 3.55, z + Math.cos(an) * 1.95, 0, 0.8, 0.7, 0.8); }
      K.add(new TorusGeometry(1.95, 0.045, 4, 28), dark, x, 3.9, z, Math.PI / 2);
      K.add(rbox(1.8, 1.5, 1.35, 0.05), red, x, 3.2, z - 0.25); K.add(rbox(0.5, 0.06, 0.85, 0.02), dark, x, 3.2, z + 0.51);
      K.add(new CircleGeometry(0.2, 14), mGlass, x + 0.55, 4.0, z + 0.511); K.add(new TorusGeometry(0.2, 0.04, 5, 14), dark, x + 0.55, 4.0, z + 0.52);
      K.add(ridge, M('shingle', '#4f5a86'), x, 4.5, z - 0.25, Math.PI / 2, 1.8, 1.7, 2.1); K.add(ridge, mSnow, x, 4.6, z - 0.25, Math.PI / 2, 1.75, 1.6, 2.0);
      K.add(rbox(0.3, 0.3, 0.8, 0.03), mStoneDark, x - 0.6, 4.6, z - 0.55); smokeSources.push([x - 0.6, 5.5, z - 0.55]);
      for (const [an, len, up] of [[0.4, 2.2, 0.9], [1.9, 2.0, 0.7], [3.3, 2.3, 1.0], [4.6, 1.9, 0.8], [5.6, 2.1, 0.75]]) { // bare branches, heavy with snow
        const bx = x + Math.sin(an) * len * 0.5, bz = z + Math.cos(an) * len * 0.5;
        K.add(new CapsuleGeometry(0.12, len, 3, 8), bark, bx, 4.3 + up * 0.5, bz, Math.cos(an) * (1.2 - up * 0.4), 0, -Math.sin(an) * (1.2 - up * 0.4));
        K.add(new SphereGeometry(0.38, 9, 6), mSnow, x + Math.sin(an) * len, 4.4 + up, z + Math.cos(an) * len, 0, 0, 0, 1.3, 0.6, 1.3);
        glows.push([x + Math.sin(an) * len * 0.7, 4.3 + up * 0.8, z + Math.cos(an) * len * 0.7, 0.45]);
      }
      for (const sx of [-0.25, 0.25]) K.add(new CylinderGeometry(0.025, 0.025, 3.1, 5), M('fabric', '#d9c08a'), x + sx, 1.55, z + 2.05); // rope ladder
      for (let k = 0; k < 7; k++) K.add(rbox(0.55, 0.08, 0.06, 0.01), wood, x, 0.3 + k * 0.42, z + 2.05);
      K.add(new CylinderGeometry(0.02, 0.02, 2.1, 5), M('fabric', '#d9c08a'), x + 1.7, 3.3, z - 1.5); K.add(new TorusGeometry(0.3, 0.12, 6, 14), M('metal', '#2b2f45'), x + 1.7, 2.1, z - 1.5); // tyre swing
      const sg = sign('Boulevard Park', 1.7); sg.position.set(x, 3.75, z + 2.0); group.add(sg);
      lantern(x - 0.85, 3.5, z + 0.6, true); lantern(x + 1.4, 3.5, z + 1.2);
      flagAt(lm.outpost, x, 6.25, z - 0.25); life.perches.push([x + 1.6, 5.3, z + 0.5], [x - 1.6, 5.1, z - 0.6]);
    } else if (lm.type === 'snow-castle') { // SURURI PARK outpost: a snow castle being built: towers with bright roofs, ice windows, scaffolding, a little crane and letter blocks
      const [x, z] = centre(lm), ice = M('glow', '#bfeeff'), wood = M('wood', '#b9845a'), snowB = M('snow', '#f2f6ff');
      K.add(rbox(3.2, 3.2, 1.9, 0.12), snowB, x, 0, z);
      for (let r = 0; r < 3; r++) for (const sgn of [-1, 1]) { K.add(rbox(3.22, 0.04, 0.04, 0.01), M('plaster', '#c9d3ee'), x, 0.6 + r * 0.6, z + sgn * 1.6); K.add(rbox(0.04, 3.22, 0.04, 0.01), M('plaster', '#c9d3ee'), x + sgn * 1.6, 0.6 + r * 0.6, z); }
      for (let k = 0; k < 5; k++) for (const sgn of [-1, 1]) { const u = -1.2 + k * 0.6; K.put('merlon', boxGeo, snowB, x + u, 1.9, z + sgn * 1.45, 0, 0.36, 0.38, 0.3); K.put('merlon', boxGeo, snowB, x + sgn * 1.45, 1.9, z + u, 0, 0.3, 0.38, 0.36); }
      const ROOFS = ['#7cc4f0', '#f3a6c8', '#8fdcb5', '#f6d365'];
      [[-1.55, -1.55], [1.55, -1.55], [-1.55, 1.55], [1.55, 1.55]].forEach(([sx, sz], k) => {
        const tx = x + sx, tz = z + sz, big = k === 0 ? 1.25 : 1;
        K.add(new CylinderGeometry(0.58, 0.64, 2.9 * big, 12), snowB, tx, 1.45 * big, tz);
        K.add(new CylinderGeometry(0.7, 0.7, 0.2, 12), snowB, tx, 2.95 * big, tz);
        K.add(new ConeGeometry(0.78, 1.25, 12), M('plaster', ROOFS[k]), tx, 2.95 * big + 0.72, tz); K.add(new ConeGeometry(0.42, 0.55, 12), mSnow, tx, 2.95 * big + 1.15, tz);
        K.add(new PlaneGeometry(0.24, 0.36), ice, tx + (sz > 0 ? 0 : 0), 2.1 * big, tz + 0.65, 0, 0);
        if (k) { const pen = new BufferGeometry(); pen.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0.6, -0.15, 0, 0, -0.3, 0], 3)); pen.computeVertexNormals(); K.add(new CylinderGeometry(0.02, 0.02, 0.6, 5), mWood, tx, 2.95 * big + 1.55, tz); K.add(pen, M('fabric', ROOFS[(k + 1) % 4]), tx, 2.95 * big + 1.85, tz); }
      });
      K.add(rbox(0.9, 0.08, 1.2, 0.04), M('glow', '#2b3556'), x, 0, z + 1.61); K.add(new TorusGeometry(0.5, 0.12, 6, 14, Math.PI), ice, x, 1.2, z + 1.63); // gate with an ice arch
      for (const wx of [-0.9, 0.9]) K.add(new PlaneGeometry(0.3, 0.42), ice, x + wx, 1.2, z + 1.61);
      // scaffolding and a little wooden crane lifting a snow block
      for (const [px, pz] of [[1.75, -0.9], [1.75, 0.6], [2.25, -0.9], [2.25, 0.6]]) K.add(new CylinderGeometry(0.04, 0.04, 2.4, 6), wood, x + px, 1.2, z + pz);
      for (const y of [0.9, 1.8]) K.add(rbox(0.6, 1.7, 0.06, 0.02), wood, x + 2.0, y, z - 0.15);
      K.add(new CylinderGeometry(0.05, 0.06, 3.4, 6), wood, x - 2.1, 1.7, z - 1.0); K.add(rbox(1.7, 0.08, 0.08, 0.02), wood, x - 1.5, 3.35, z - 1.0);
      K.add(new CylinderGeometry(0.01, 0.01, 1.2, 4), M('fabric', '#d9c08a'), x - 0.75, 2.75, z - 1.0); K.add(rbox(0.5, 0.4, 0.4, 0.06), snowB, x - 0.75, 1.95, z - 1.0);
      // giant letter blocks: build words!
      [['A', -1.0, 2.3, 0], ['B', -0.45, 2.45, 0], ['C', -0.72, 2.35, 0.5]].forEach(([L, bx, bz, by]) => { const m = new MeshLambertMaterial({ map: letterTex(L) }); K.add(new BoxGeometry(0.5, 0.5, 0.5), m, x + bx, 0.25 + by, z + bz, 0, (bx * 7) % 0.5); });
      shovel(x + 1.2, z + 2.2, 0.5); barrel(x + 1.65, z + 1.9);
      const sg = sign('Sururi Park', 1.6); sg.position.set(x, 2.35, z + 1.66); group.add(sg);
      lantern(x - 0.7, 1.7, z + 1.75, true); lantern(x + 0.7, 1.7, z + 1.75);
      flagAt(lm.outpost, x - 1.55, 6.2, z - 1.55); glows.push([x, 1.2, z + 1.8, 1.0]);
    } else if (lm.type === 'stall') { // a winter street stall: striped awning, warm light, steam (roasted chestnuts, çay, salep)
      const [x, z] = centre(lm), K2 = lm.kind, wood = M('wood', '#a5714f'), awn = { cay: '#2d6fb5', salep: '#7a4fa0', simit: '#c8443c', corn: '#e0a800', fish: '#2d8a8a' }[K2] || '#c8443c';
      K.add(rbox(1.8, 0.8, 0.9, 0.05), wood, x, 0, z); K.add(rbox(1.9, 0.9, 0.08, 0.02), M('wood', '#c99a6e'), x, 0.9, z);
      for (const sx of [-0.85, 0.85]) K.add(new CylinderGeometry(0.05, 0.05, 1.5, 6), wood, x + sx, 1.3, z - 0.35);
      for (let k = 0; k < 6; k++) K.add(rbox(0.32, 0.95, 0.06, 0.01), M('fabric', k % 2 ? '#f4f1ea' : awn), x - 0.8 + k * 0.32, 2.0, z + 0.05, -0.35);
      K.add(rbox(1.95, 0.95, 0.14, 0.06, 3), mSnow, x, 2.12, z + 0.02, -0.35);
      if (K2 === 'chestnut') { K.add(new CylinderGeometry(0.32, 0.26, 0.2, 14), M('metal', '#2b2f45'), x - 0.3, 1.02, z); for (let k = 0; k < 9; k++) K.add(new SphereGeometry(0.06, 6, 4), M('wood', '#6a3a22'), x - 0.3 + Math.cos(k) * 0.18, 1.14, z + Math.sin(k) * 0.18); glows.push([x - 0.3, 1.15, z, 0.9]); smokeSources.push([x - 0.3, 1.3, z]); }
      if (K2 === 'cay') { K.add(new CylinderGeometry(0.16, 0.2, 0.5, 12), M('metal', '#d9a640'), x - 0.4, 1.2, z); K.add(new SphereGeometry(0.1, 8, 6), M('metal', '#d9a640'), x - 0.4, 1.5, z); for (let k = 0; k < 4; k++) K.add(new CylinderGeometry(0.04, 0.03, 0.1, 6), M('glow', '#c4502c'), x + 0.1 + k * 0.14, 0.99, z + 0.2); life.steam.push([x - 0.4, 1.6, z]); }
      if (K2 === 'salep') { K.add(new CylinderGeometry(0.22, 0.22, 0.45, 12), M('metal', '#c9c6dc'), x - 0.35, 1.17, z); for (let k = 0; k < 3; k++) K.add(new CylinderGeometry(0.06, 0.05, 0.12, 8), M('plaster', '#f4ead6'), x + 0.2 + k * 0.16, 1.0, z + 0.2); life.steam.push([x - 0.35, 1.45, z]); }
      if (K2 === 'simit') { for (let k = 0; k < 7; k++) K.add(new TorusGeometry(0.11, 0.035, 6, 12), M('wood', '#b8743c'), x - 0.5 + (k % 4) * 0.24, 0.98 + Math.floor(k / 4) * 0.07, z + 0.05 + Math.floor(k / 4) * 0.04, Math.PI / 2); K.add(rbox(0.5, 0.05, 0.4, 0.02), M('wood', '#8a5a3a'), x + 0.45, 0.93, z); for (let k = 0; k < 3; k++) K.add(new TorusGeometry(0.1, 0.03, 6, 12), M('wood', '#c9853f'), x + 0.32 + k * 0.13, 1.0, z, Math.PI / 2); }
      if (K2 === 'corn') { K.add(rbox(0.9, 0.12, 0.45, 0.03), M('metal', '#2b2f45'), x - 0.15, 0.98, z); for (let k = 0; k < 5; k++) K.add(new CylinderGeometry(0.045, 0.04, 0.32, 8), M('glow', '#f2c14e'), x - 0.45 + k * 0.15, 1.1, z, 0, 0, Math.PI / 2); glows.push([x - 0.15, 1.1, z, 0.8]); smokeSources.push([x - 0.15, 1.3, z]); }
      if (K2 === 'fish') { K.add(rbox(0.9, 0.12, 0.45, 0.03), M('metal', '#2b2f45'), x - 0.2, 0.98, z); for (let k = 0; k < 3; k++) { K.add(new SphereGeometry(0.07, 8, 6), M('metal', '#8fa3b8'), x - 0.45 + k * 0.25, 1.09, z, 0, 0, 0, 2.2, 0.7, 1); K.add(new ConeGeometry(0.05, 0.1, 4), M('metal', '#8fa3b8'), x - 0.3 + k * 0.25, 1.09, z, 0, 0, -Math.PI / 2); } for (let k = 0; k < 2; k++) K.add(new SphereGeometry(0.1, 8, 6), M('wood', '#d9a35f'), x + 0.4 + k * 0.22, 1.0, z + 0.1, 0, 0, 0, 1.7, 0.8, 0.9); glows.push([x - 0.2, 1.1, z, 0.8]); smokeSources.push([x - 0.2, 1.3, z]); }
      lantern(x + 0.7, 1.6, z + 0.35, true); pools.push([x, z + 0.8, 2.0]);
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
