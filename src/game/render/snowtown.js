// The Arena 1 world under heavy snow: real Kasımpaşa streets as trodden footpaths through open
// snow. Most of the town is buried: only roof ridges and chimneys poke out of the drifts, and a
// few snowed-in houses near the outposts still show their fronts. Buried cars, the
// frozen Golden Horn, places of worship and the cemetery as quiet scenery, and one
// recognisable landmark at each outpost. Called by buildVillage with its shared helpers.
import {
  BufferGeometry, Float32BufferAttribute, Mesh, MeshLambertMaterial, BoxGeometry, SphereGeometry, CylinderGeometry, ConeGeometry,
  PlaneGeometry, TorusGeometry, CapsuleGeometry, CanvasTexture, RepeatWrapping, SRGBColorSpace, Color,
} from 'three';

const paint = (size, fn) => { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); fn(g, size); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping; t.anisotropy = 4; return t; };
const blot = (g, x, y, r, rgb, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };

export function buildSnowtown(ctx) {
  const { arena, K, M, T, PAL, GEO, rbox, prism, rnd, at, group, glows, smokeSources, lights, low, lantern, pine, rock, barrel, crate, firewood, shovel,
    mSnow, mStone, mStoneDark, mBeam, mWood, mMetal, mIce, mGlass, sign } = ctx;
  const rows = arena.rows, W = arena.w, H = arena.h;
  const ch = (i, j) => (i < 0 || j < 0 || i >= W || j >= H ? 'H' : rows[j][i]);
  const solid = c => 'HSKQCWGctO#fRD'.includes(c);
  const walkPath = c => '_+d'.includes(c);

  // ---------- terrain: tiled surfaces with soft darkening near anything solid ----------
  const TEX = {
    snow: T.snow(),
    plaza: paint(256, (g, S) => { g.fillStyle = '#9ea4c0'; g.fillRect(0, 0, S, S); for (let b = 0; b < 8; b++) for (let a = 0; a < 9; a++) { const k = a * 13 + b, x = a * S / 8 - (b % 2) * S / 16, y = b * S / 8, v = 140 + Math.floor(rnd(k, 1) * 55); g.fillStyle = `rgb(${v - 14},${v - 6},${v + 24})`; g.beginPath(); g.ellipse(x + S / 16, y + S / 16, S / 17, S / 21, rnd(k, 2) - 0.5, 0, 7); g.fill(); } for (let k = 0; k < 10; k++) blot(g, rnd(k, 3) * S, rnd(k, 4) * S, 40, '255,255,255', 0.6); }),
    yard: paint(256, (g, S) => { g.fillStyle = '#c8c3dd'; g.fillRect(0, 0, S, S); for (let b = 0; b < 4; b++) for (let a = 0; a < 4; a++) { const v = 205 + Math.floor(rnd(a, b) * 25); g.fillStyle = `rgb(${v - 5},${v - 8},${v + 10})`; g.beginPath(); g.roundRect(a * S / 4 + 3, b * S / 4 + 3, S / 4 - 6, S / 4 - 6, 8); g.fill(); } for (let k = 0; k < 8; k++) blot(g, rnd(k, 5) * S, rnd(k, 6) * S, 50, '255,255,255', 0.55); }),
    ice: paint(256, (g, S) => { g.fillStyle = '#a9cdea'; g.fillRect(0, 0, S, S); for (let k = 0; k < 18; k++) blot(g, rnd(k, 11) * S, rnd(k, 12) * S, 30 + rnd(k, 13) * 60, '255,255,255', 0.55); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.5; for (let k = 0; k < 10; k++) { g.beginPath(); let x = rnd(k, 14) * S, y = rnd(k, 15) * S; g.moveTo(x, y); for (let s = 0; s < 4; s++) { x += (rnd(k, s) - 0.5) * 60; y += (rnd(s, k) - 0.5) * 60; g.lineTo(x, y); } g.stroke(); } }),
  };
  // Open snow, footpaths and the boulevard share one mesh: trodden lanes are a vertex tint that
  // fades into the snow, so the paths read as soft trampled tracks, not tiles.
  const cat = c => (c === 'W' ? 'ice' : 'POf#j'.includes(c) ? 'plaza' : 'YShrK'.includes(c) ? 'yard' : 'snow');
  const trod = c => ('_+d'.includes(c) ? 1 : '=c'.includes(c) ? 0.8 : 'POf#jYhr'.includes(c) ? 0.9 : 0);
  const quads = { snow: [], plaza: [], yard: [], ice: [] };
  const corner = (i, j) => { let n = 0; for (const [a, b] of [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]]) if ('HSKQCGR'.includes(ch(a, b))) n++; return n; };
  const wear = (i, j) => (trod(ch(i - 1, j - 1)) + trod(ch(i, j - 1)) + trod(ch(i - 1, j)) + trod(ch(i, j))) / 4;
  const TRODDEN = [0.66, 0.66, 0.87];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) quads[cat(ch(i, j))].push([i, j]);
  for (const [name, list] of Object.entries(quads)) {
    if (!list.length) continue;
    const P = [], N = [], U = [], Cc = [];
    const vert = (x, z, ao, w) => { P.push(x, 0, z); N.push(0, 1, 0); U.push(x * 0.5, -z * 0.5); const s = 1 - w; Cc.push(ao * (0.97 * s + TRODDEN[0] * w), ao * (0.97 * s + TRODDEN[1] * w), Math.min(1, ao * (1.02 * s + TRODDEN[2] * w))); };
    for (const [i, j] of list) {
      const [x0, z0] = at(i, j).map(v => v - 0.5);
      const v = [[x0, z0, i, j], [x0 + 1, z0, i + 1, j], [x0 + 1, z0 + 1, i + 1, j + 1], [x0, z0 + 1, i, j + 1]];
      const ao = v.map(([, , ci, cj]) => (name === 'ice' ? 1 : 1 - corner(ci, cj) * 0.09));
      const w = v.map(([, , ci, cj]) => (name === 'snow' ? wear(ci, cj) : 0));
      const mine = name === 'snow' ? trod(ch(i, j)) : 0;
      if (name === 'snow' && w.some(q => Math.abs(q - mine) > 0.01)) { // an edge cell: fan from the centre for a softer edge
        const cAo = (ao[0] + ao[1] + ao[2] + ao[3]) / 4;
        for (let k = 0; k < 4; k++) { const a = v[k], b = v[(k + 1) % 4]; vert(x0 + 0.5, z0 + 0.5, cAo, mine); vert(b[0], b[1], ao[(k + 1) % 4], w[(k + 1) % 4]); vert(a[0], a[1], ao[k], w[k]); }
      } else for (const k of [0, 2, 1, 0, 3, 2]) vert(v[k][0], v[k][1], ao[k], w[k]); // upward winding
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
  const rimTints = ['#5f6b95', '#6d6a9c', '#56709a', '#4f5a82', '#76749f'];
  let lanternCount = 0, chimneyGlow = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (ch(i, j) !== 'H' || used.has(key(i, j))) continue;
    let len = 1; const max = 1 + Math.floor(rnd(i, j) * 3);
    while (len < max && ch(i + len, j) === 'H' && !used.has(key(i + len, j))) len++;
    for (let k = 0; k < len; k++) used.add(key(i + k, j));
    const [ax, az] = at(i, j), cx = ax + (len - 1) / 2, cz = az, w = len - 0.08, d = 0.92;
    const h = 0.62 + rnd(j, i) * 0.4 + (rnd(i * 5, j) < 0.1 ? 0.35 : 0); // snowed in up to the windows
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
      if (!low && lanternCount < 120 && rnd(i + k, j + dz * 3) < 0.12) { lantern(x + 0.34, h - 0.35, z + dz * 0.1); lanternCount++; }
    }
    if (rnd(i * 7, j) < 0.22) {
      const chx = cx + (rnd(i, j * 11) - 0.5) * (w - 0.4);
      K.put('bh-chim', boxGeo, mStoneDark, chx, h, cz - 0.1, 0, 0.3, 0.85, 0.3);
      K.put('bh-chimCap', capGeo, mSnow, chx, h + 0.85, cz - 0.1, 0, 0.4, 0.2, 0.4);
      if (!low && chimneyGlow < 90 && rnd(j, i * 13) < 0.4) { glows.push([chx, h + 0.92, cz - 0.1, 0.5]); chimneyGlow++; }
    }
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
    } else if (lm.type === 'archers-lodge') { // stone lodge with a columned porch and a tiled hip roof
      const [x, z] = centre(lm);
      K.add(rbox(2.9, 2.6, 0.5, 0.08), mStone, x, 0, z); K.add(rbox(2.6, 2.2, 1.7, 0.06), stoneLight, x, 0.45, z);
      for (let k = 0; k < 4; k++) { K.add(new CylinderGeometry(0.1, 0.12, 1.5, 10), M('stone', '#e2deea'), x - 1.05 + k * 0.7, 1.2, z + 1.35); }
      K.add(rbox(2.9, 0.5, 0.18, 0.05), mBeam, x, 1.95, z + 1.25);
      K.add(new ConeGeometry(2.3, 1.1, 4), M('shingle', '#8a6a63'), x, 2.7, z, 0, Math.PI / 4); K.add(new ConeGeometry(2.0, 0.95, 4), mSnow, x, 2.85, z, 0, Math.PI / 4);
      ctx.windows(x, z + 1.1, 'x', 2.6, [0, 1], 0.75, 0, 0.1);
      const sg = sign("Archers' Lodge", 1.9); sg.position.set(x, 2.25, z + 1.55); group.add(sg);
      lantern(x - 1.4, 1.5, z + 1.4); lantern(x + 1.4, 1.5, z + 1.4, true);
    } else if (lm.type === 'target') { // straw archery target on an easel, rings, snow on top
      const [x, z] = centre(lm), rings = ['#f4efe2', '#2f2f3a', '#4f6fa8', '#c8584a', '#e6b93e'];
      for (const dx of [-0.25, 0.25]) K.add(new CylinderGeometry(0.04, 0.04, 1.4, 6), mWood, x + dx, 0.65, z - 0.15, 0.2);
      rings.forEach((col, k) => K.add(new CylinderGeometry(0.5 - k * 0.1, 0.5 - k * 0.1, 0.12 + k * 0.01, 20), M('fabric', col), x, 0.85, z, Math.PI / 2 - 0.15));
      K.add(new CapsuleGeometry(0.1, 0.7, 3, 8), mSnow, x, 1.36, z - 0.06, 0, 0, Math.PI / 2);
    } else if (lm.type === 'marker-stone') { // a tall archery record stone on a plinth
      const [x, z] = centre(lm);
      K.add(rbox(0.6, 0.6, 0.3, 0.05), mStone, x, 0, z); K.add(new CylinderGeometry(0.13, 0.17, 2.2, 10), M('stone', '#e2deea'), x, 1.4, z);
      K.add(new SphereGeometry(0.17, 10, 6), M('stone', '#e2deea'), x, 2.55, z); K.add(GEO.snowCap, mSnow, x, 2.62, z, 0, 0, 0, 0.36, 0.2, 0.36);
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
    } else if (lm.type === 'admiral') { // the admiral's monument with his lion, on a stepped pedestal
      const [x, z] = centre(lm), bronze = M('metal', '#566476');
      K.add(rbox(1.9, 1.9, 0.3, 0.06), mStone, x, 0, z); K.add(rbox(1.5, 1.5, 0.3, 0.06), mStone, x, 0.3, z); K.add(rbox(0.9, 0.9, 1.2, 0.05), M('stone', '#e2deea'), x, 0.6, z);
      K.add(new CapsuleGeometry(0.25, 0.6, 4, 10), bronze, x, 2.25, z); K.add(new SphereGeometry(0.2, 12, 8), bronze, x, 2.85, z); K.add(new CylinderGeometry(0.24, 0.24, 0.08, 12), bronze, x, 3.02, z); K.add(new CylinderGeometry(0.14, 0.18, 0.22, 12), bronze, x, 3.15, z);
      K.add(new CapsuleGeometry(0.07, 0.45, 3, 6), bronze, x + 0.32, 2.45, z + 0.1, 0, 0, -0.6);
      K.add(new CapsuleGeometry(0.2, 0.55, 4, 8), bronze, x - 0.15, 1.95, z + 0.45, 0, 0, Math.PI / 2); K.add(new SphereGeometry(0.2, 10, 8), bronze, x - 0.55, 2.1, z + 0.45); K.add(new SphereGeometry(0.26, 10, 8), bronze, x - 0.6, 2.15, z + 0.45);
      K.add(GEO.snowCap, mSnow, x, 3.2, z, 0, 0, 0, 0.32, 0.14, 0.32); K.add(GEO.snowCap, mSnow, x, 1.82, z, 0, 0, 0, 0.95, 0.12, 0.95);
      const sg = sign('Waterfront Park', 1.9); sg.position.set(x, 1.15, z + 0.8); group.add(sg);
    } else if (lm.type === 'pier') { // wooden pier over the ice with bollards and lamps
      const [x, z] = centre(lm), L = lm.h;
      K.add(rbox(2.1, L + 0.4, 0.22, 0.04), mWood, x, 0.12, z); K.add(rbox(1.9, L, 0.12, 0.06), M('snow', '#e6ecf8'), x, 0.34, z);
      for (let k = 0; k <= L; k += 1.5) for (const s of [-1, 1]) { K.put('pierPost', new CylinderGeometry(0.1, 0.1, 0.8, 8), mWood, x + s * 1.0, 0.1, z - L / 2 + k); K.put('bollard', new CylinderGeometry(0.09, 0.11, 0.3, 8), mMetal, x + s * 0.85, 0.48, z - L / 2 + k); }
      lantern(x - 0.9, 1.5, z + L / 2 - 0.3, true); K.put('lampPost', GEO.post, mMetal, x - 0.9, 0.85, z + L / 2 - 0.3, 0, 1, 1.3, 1);
    } else if (lm.type === 'ferry') { // a Golden Horn ferry stuck in the ice, snow on the deck, warm cabin windows
      const [x, z] = centre(lm);
      K.add(rbox(4.0, 1.8, 0.8, 0.3, 3), M('metal', '#e8e4ee'), x, -0.15, z); K.add(rbox(4.05, 1.85, 0.18, 0.06), M('metal', '#3d4a6b'), x, 0.05, z);
      K.add(rbox(2.6, 1.3, 0.75, 0.1), M('plaster', '#f0ecf4'), x, 0.65, z); K.add(rbox(2.7, 1.4, 0.12, 0.05), M('metal', '#3d4a6b'), x, 1.4, z); K.add(rbox(2.6, 1.3, 0.25, 0.12, 3), mSnow, x, 1.5, z);
      for (let k = 0; k < 4; k++) K.add(new PlaneGeometry(0.4, 0.32), mGlass, x - 0.9 + k * 0.6, 1.0, z + 0.66);
      K.add(new CylinderGeometry(0.18, 0.2, 0.7, 12), M('metal', '#c8584a'), x + 0.6, 1.9, z); K.add(new CylinderGeometry(0.22, 0.22, 0.12, 12), mSnow, x + 0.6, 2.28, z);
      smokeSources.push([x + 0.6, 2.4, z]);
    } else if (lm.type === 'pavilion') { // an octagonal park pavilion under a heavy snow roof
      const [x, z] = centre(lm);
      K.add(new CylinderGeometry(1.2, 1.25, 0.25, 8), mStone, x, 0.12, z);
      for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28 + 0.39; K.add(new CylinderGeometry(0.07, 0.07, 1.6, 8), mBeam, x + Math.cos(a) * 1.0, 1.05, z + Math.sin(a) * 1.0); }
      K.add(new CylinderGeometry(1.3, 1.3, 0.14, 8), mBeam, x, 1.85, z); K.add(new ConeGeometry(1.55, 1.0, 8), M('shingle', '#56709a'), x, 2.4, z); K.add(new ConeGeometry(1.35, 0.95, 8), mSnow, x, 2.55, z);
      K.add(new SphereGeometry(0.12, 8, 6), M('metal', '#c9a24a'), x, 3.05, z);
      const sg = sign('Sururi Park', 1.7); sg.position.set(x, 3.4, z); group.add(sg);
      lantern(x, 1.6, z, true);
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
