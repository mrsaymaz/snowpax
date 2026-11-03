// Builds the snowy miniature city from arena data in the chosen art style (render/style.js).
// A few merged meshes for speed; buildings and trees dissolve in front of the student.
import {
  BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, ShapeUtils, Vector2, Group, SphereGeometry,
  CylinderGeometry, ConeGeometry, InstancedMesh, Object3D, IcosahedronGeometry, Sprite, SpriteMaterial, PlaneGeometry,
  CanvasTexture, SRGBColorSpace, Shape, ExtrudeGeometry, BackSide, DoubleSide, Color,
} from 'three';
import { addCutout } from './cutout.js';
import { styleOf, makeMaterial, windowTextures, color } from './style.js';
import { Grid, GRID } from '../grid.mjs';

// Soft contact shadows (RGBA vertex colours, dark inside → clear outside).
class Shade {
  constructor() { this.p = []; this.c = []; }
  ring(inner, outer, y, rgb, alpha) {
    for (let i = 0; i < inner.length; i++) {
      const j = (i + 1) % inner.length, a = inner[i], b = inner[j], A = outer[i], B = outer[j];
      const v = (q, al) => { this.p.push(q[0], y, q[1]); this.c.push(rgb.r, rgb.g, rgb.b, al); };
      v(a, alpha); v(A, 0); v(B, 0); v(a, alpha); v(B, 0); v(b, alpha);
    }
  }
  mesh() {
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(this.p, 3)); g.setAttribute('color', new Float32BufferAttribute(this.c, 4));
    const m = new Mesh(g, new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false })); m.renderOrder = 1; return m;
  }
}
function blobTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(70,90,125,0.42)'); gr.addColorStop(1, 'rgba(70,90,125,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new CanvasTexture(c); return t;
}
// Door shape: arched top. Built in the wall's local frame (x along the wall, y up, z out).
function doorGeometry(w = 1.0, h = 1.55) {
  const sh = new Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(-w / 2, h - w / 2); sh.absarc(0, h - w / 2, w / 2, Math.PI, 0, true); sh.lineTo(w / 2, 0); sh.lineTo(-w / 2, 0);
  return new ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 8 });
}
function roundedBox(w, d, h, r = 0.12) {
  const sh = new Shape(), x = -w / 2, y = -d / 2;
  sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + d - r); sh.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  sh.lineTo(x + r, y + d); sh.quadraticCurveTo(x, y + d, x, y + d - r); sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
  const g = new ExtrudeGeometry(sh, { depth: h, bevelEnabled: true, bevelThickness: r * 0.6, bevelSize: r * 0.6, bevelSegments: 2, curveSegments: 3 });
  g.rotateX(-Math.PI / 2); return g;
}

const hash = (a, b) => { let h = Math.imul(Math.round(a * 13) ^ 0x9e3779b9, 2654435761) ^ Math.imul(Math.round(b * 17), 1597334677); h ^= h >>> 15; return (h >>> 0) / 4294967296; };

class Builder { // non-indexed triangles with position, normal, colour, uv
  constructor() { this.p = []; this.n = []; this.c = []; this.uv = []; }
  get count() { return this.p.length / 3; }
  tri(a, b, c, col, uvs) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (const v of [a, b, c]) { this.p.push(v[0], v[1], v[2]); this.n.push(nx, ny, nz); this.c.push(col.r, col.g, col.b); }
    this.uv.push(...(uvs || [0, 0, 0, 0, 0, 0]));
  }
  quad(a, b, c, d, col, uvs) {
    this.tri(a, b, c, col, uvs && [uvs[0], uvs[1], uvs[2], uvs[3], uvs[4], uvs[5]]);
    this.tri(a, c, d, col, uvs && [uvs[0], uvs[1], uvs[4], uvs[5], uvs[6], uvs[7]]);
  }
  // Append a three.js geometry (non-indexed or indexed) with one colour; uv optionally rescaled per vertex.
  add(geom, col, uvFn = null) {
    const g = geom.index ? geom.toNonIndexed() : geom;
    const P = g.attributes.position.array, N = g.attributes.normal.array, U = g.attributes.uv?.array;
    for (let i = 0; i < P.length / 3; i++) {
      this.p.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); this.n.push(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]); this.c.push(col.r, col.g, col.b);
      if (U && uvFn) { const [u, v] = uvFn(U[i * 2], U[i * 2 + 1], N[i * 3 + 1]); this.uv.push(u, v); } else this.uv.push(0, 0);
    }
  }
  // Copy triangles [from, count) into `out`, pushed outward from (cx, cz): an outline hull.
  hullInto(out, from, cx, cz, r, h, width) {
    const k = 1 + width / Math.max(0.5, r), ky = 1 + width / Math.max(1, h);
    for (let i = from; i < this.count; i++) {
      const x = this.p[i * 3], y = this.p[i * 3 + 1], z = this.p[i * 3 + 2];
      out.p.push(cx + (x - cx) * k, y * ky + (y > 0.01 ? 0 : -0.02), cz + (z - cz) * k); out.n.push(this.n[i * 3], this.n[i * 3 + 1], this.n[i * 3 + 2]); out.c.push(1, 1, 1); out.uv.push(0, 0);
    }
  }
  geometry() {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    return g;
  }
}

const pts = flat => { const out = []; for (let k = 0; k < flat.length; k += 2) out.push([flat[k], flat[k + 1]]); return out; };
const signedArea = p => { let a = 0; for (let i = 0; i < p.length; i++) { const [x1, z1] = p[i], [x2, z2] = p[(i + 1) % p.length]; a += x1 * z2 - x2 * z1; } return a / 2; };
const centroid = p => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];

function flatPolygon(B, p, y, col) {
  const tris = ShapeUtils.triangulateShape(p.map(([x, z]) => new Vector2(x, z)), []);
  for (const [i, j, k] of tris) {
    const a = [p[i][0], y, p[i][1]], b = [p[j][0], y, p[j][1]], c = [p[k][0], y, p[k][1]];
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (ny >= 0) B.tri(a, b, c, col); else B.tri(a, c, b, col);
  }
}
function walls(W, p, y0, y1, col, uOff, bay, floor, textured = true) {
  let u = uOff;
  for (let k = 0; k < p.length; k++) {
    const a = p[k], b = p[(k + 1) % p.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u1 = u + L / bay / 8, v0 = y0 / floor / 8, v1 = y1 / floor / 8;
    W.quad([a[0], y0, a[1]], [a[0], y1, a[1]], [b[0], y1, b[1]], [b[0], y0, b[1]], col, textured ? [u, v0, u, v1, u1, v1, u1, v0] : null);
    u = u1;
  }
}
// Polygon pushed outward by d (miter offset, clamped) — for overhanging snow.
function inflate(p, d) {
  return p.map((q, i) => {
    const a = p[(i + p.length - 1) % p.length], b = p[(i + 1) % p.length];
    const n1 = [q[1] - a[1], -(q[0] - a[0])], n2 = [b[1] - q[1], -(b[0] - q[0])];
    const l1 = Math.hypot(...n1) || 1, l2 = Math.hypot(...n2) || 1;
    let nx = n1[0] / l1 + n2[0] / l2, nz = n1[1] / l1 + n2[1] / l2; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    const cos = (n1[0] / l1) * nx + (n1[1] / l1) * nz, m = Math.min(2, 1 / Math.max(0.3, cos));
    return [q[0] + nx * d * m, q[1] + nz * d * m];
  });
}
// Horizontal extruded slab/body from a footprint, from y0 up by depth, optional rounded bevel.
function extrude(p, y0, depth, bevel = 0, segs = 2) {
  const shape = new Shape(p.map(([x, z]) => new Vector2(x, -z)));
  const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel * 0.6, bevelSegments: segs, curveSegments: 4 });
  g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
  return g;
}
function gableRoof(R, p, h, eaveCol, snowCol, wallCol) {
  const L01 = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]), L12 = Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1]);
  const q = L01 >= L12 ? p : [p[1], p[2], p[3], p[0]];
  const short = Math.min(L01, L12), rise = Math.min(1.8, short * 0.4);
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const r0 = mid(q[0], q[3]), r1 = mid(q[1], q[2]), V = (xz, y) => [xz[0], y, xz[1]];
  for (const [e0, e1, s0, s1] of [[q[0], q[1], r0, r1], [q[2], q[3], r1, r0]]) {
    const t = 0.3, m0 = lerp(e0, s0, t), m1 = lerp(e1, s1, t);
    const face = (a, b, c, d, col) => { const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]); if (ny >= 0) R.quad(a, b, c, d, col); else R.quad(a, d, c, b, col); };
    face(V(e0, h), V(e1, h), V(m1, h + rise * t), V(m0, h + rise * t), eaveCol);
    face(V(m0, h + rise * t), V(m1, h + rise * t), V(s1, h + rise), V(s0, h + rise), snowCol);
  }
  const cx = (q[0][0] + q[2][0]) / 2, cz = (q[0][1] + q[2][1]) / 2;
  for (const [a, b, top] of [[q[3], q[0], r0], [q[1], q[2], r1]]) {
    const A = V(a, h), Bv = V(b, h), T = V(top, h + rise);
    const ux = Bv[0] - A[0], uz = Bv[2] - A[2], vx = T[0] - A[0], vy = T[1] - A[1], vz = T[2] - A[2];
    const nx = -uz * vy, nz = ux * vy;
    if (nx * ((a[0] + b[0]) / 2 - cx) + nz * ((a[1] + b[1]) / 2 - cz) >= 0) R.tri(A, Bv, T, wallCol); else R.tri(A, T, Bv, wallCol);
  }
  return rise;
}

export function buildWorld(arena, { quality = 'medium', style = 'toybox' } = {}) {
  const S = styleOf(style), group = new Group(), H = arena.half;
  const tex = windowTextures(style);
  const outline = S.outline, outlineMat = outline ? new MeshBasicMaterial({ color: outline.color, side: BackSide }) : null;
  if (outlineMat) addCutout(outlineMat);

  // Ground
  const ground = new Mesh(new PlaneGeometry(2 * H + 200, 2 * H + 200), makeMaterial(style, { color: S.ground }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; group.add(ground);

  // Flat things: areas, zones, roads
  const F = new Builder();
  for (const a of arena.areas) flatPolygon(F, pts(a.p), 0.01, color(S.areas[a.k] || S.ground));
  const zc = color(S.zone);
  for (const z of arena.zones) {
    if (z.c) { const n = 18, ring = []; for (let k = 0; k < n; k++) ring.push([z.c[0] + Math.cos(k / n * 6.283) * z.r, z.c[1] + Math.sin(k / n * 6.283) * z.r]); flatPolygon(F, ring, 0.012, zc); }
    else flatPolygon(F, z.p, 0.012, zc);
  }
  for (const r of arena.roads) {
    const p = pts(r.p), w = r.w / 2, main = r.c === 'primary' || r.c === 'primary_link';
    const col = color(r.c === 'footway' || r.c === 'steps' || r.c === 'path' ? S.ground : main ? S.roadMain : S.road), y = main ? 0.02 : 0.025;
    if (r.c === 'footway' || r.c === 'path') continue;
    for (let k = 0; k + 1 < p.length; k++) {
      const [x0, z0] = p[k], [x1, z1] = p[k + 1], L = Math.hypot(x1 - x0, z1 - z0) || 1, nx = -(z1 - z0) / L * w, nz = (x1 - x0) / L * w;
      flatPolygon(F, [[x0 + nx, z0 + nz], [x1 + nx, z1 + nz], [x1 - nx, z1 - nz], [x0 - nx, z0 - nz]], y, col);
    }
    for (const [x, z] of p) { const n = 8, ring = []; for (let k = 0; k < n; k++) ring.push([x + Math.cos(k / n * 6.283) * w, z + Math.sin(k / n * 6.283) * w]); flatPolygon(F, ring, y, col); }
  }
  const flat = new Mesh(F.geometry(), makeMaterial(style, { vertexColors: true }));
  flat.receiveShadow = true; group.add(flat);

  // Buildings in chunks
  const CH = 4, chunk = (x, z) => Math.min(CH - 1, Math.max(0, Math.floor((x + H) / (2 * H) * CH))) + CH * Math.min(CH - 1, Math.max(0, Math.floor((z + H) / (2 * H) * CH)));
  const mk = () => Array.from({ length: CH * CH }, () => new Builder());
  const wallB = mk(), roofB = mk(), hullB = outline ? mk() : null;
  const eave = color(S.eave), snow = color(S.snow), domes = [], signs = [], icicles = [];
  const [lmin, lmax] = S.levels, FLOOR = S.floor, BAY = S.bay;
  const DT = S.details || null, shade = new Shade(), aoCol = color('#5d6f8f');
  const DOORS = ['#8a5a3b', '#2f6f8f', '#b5473a', '#3f7a52', '#6b4f8f'];
  // nearest-street lookup (for doors): bucketed road segments
  const segs = new Map(), SB = 16;
  for (const rd of arena.roads) { if (rd.c === 'footway' || rd.c === 'path' || rd.c === 'steps') continue; for (let k2 = 0; k2 + 2 < rd.p.length; k2 += 2) { const sg = [rd.p[k2], rd.p[k2 + 1], rd.p[k2 + 2], rd.p[k2 + 3], rd.w / 2]; const bx = Math.floor(sg[0] / SB), bz = Math.floor(sg[1] / SB); const key = bx + ',' + bz; if (!segs.has(key)) segs.set(key, []); segs.get(key).push(sg); } }
  const roadDist = (x, z) => { let best = Infinity; const bx = Math.floor(x / SB), bz = Math.floor(z / SB); for (let i = bx - 1; i <= bx + 1; i++) for (let j = bz - 1; j <= bz + 1; j++) for (const [x0, z0, x1, z1, hw] of segs.get(i + ',' + j) || []) { const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz || 1e-9, t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / L2)); best = Math.min(best, Math.hypot(x - x0 - t * dx, z - z0 - t * dz) - hw); } return best; };
  for (const b of arena.buildings) {
    let p = pts(b.p); if (p.length < 3) continue;
    if (signedArea(p) < 0) p = p.reverse();
    const [cx, cz] = centroid(p), k = chunk(cx, cz), r = hash(cx, cz);
    const levels = b.k === 'worship' ? 2 : b.k === 'ourSchool' ? 3 : lmin + Math.floor(hash(cz, cx) * (lmax - lmin + 1));
    const h = levels * FLOOR, rad = Math.max(...p.map(q => Math.hypot(q[0] - cx, q[1] - cz)));
    let wall = color(S.walls[Math.floor(r * S.walls.length)]);
    if (b.k === 'worship') wall = color('#f4f1ea');
    if (b.k === 'ourSchool') wall = color('#ffd166');
    if (b.k === 'school') wall = color('#f1dcb1');
    const w0 = wallB[k].count, r0 = roofB[k].count;
    if (S.rounded) {
      const body = extrude(p, 0, h - 0.3, 0.3, 3);
      wallB[k].add(body, wall, (u, v, ny) => (Math.abs(ny) < 0.5 ? [u / BAY / 8 + r * 8, (1 - v) / FLOOR / 8] : [0.999, 0.999]));
    } else walls(wallB[k], p, 0, h, wall, r * 8, BAY, FLOOR, b.k !== 'worship');

    let top = h;
    const pitchedHere = S.mixedRoofs && p.length === 4 && b.k === 'house' && !b.o;
    if ((S.roof === 'pillow' || S.roof === 'blob') && !pitchedHere) {
      const bevel = S.roof === 'blob' ? 0.45 : 0.32;
      if (S.roof === 'pillow') walls(roofB[k], p, h - 0.18, h, eave, 0, BAY, FLOOR, false);
      roofB[k].add(extrude(inflate(p, S.roof === 'blob' ? 0.2 : 0.5), h, S.roof === 'blob' ? 0.25 : 0.25, S.roof === 'blob' ? bevel : 0.45, 4), snow);
      top = h + 0.6;
      if (S.roof === 'pillow' && r < 0.55 && b.k === 'house') {
        // icicles along the longest edge
        let best = 0, bl = 0; for (let e = 0; e < p.length; e++) { const L = Math.hypot(p[(e + 1) % p.length][0] - p[e][0], p[(e + 1) % p.length][1] - p[e][1]); if (L > bl) { bl = L; best = e; } }
        const a = p[best], c = p[(best + 1) % p.length], n = Math.min(6, Math.floor(bl / 1.2));
        const nx = (c[1] - a[1]) / bl, nz = -(c[0] - a[0]) / bl;
        for (let i = 1; i <= n; i++) { const t = i / (n + 1); icicles.push([a[0] + (c[0] - a[0]) * t + nx * 0.42, h + 0.05, a[1] + (c[1] - a[1]) * t + nz * 0.42, 0.6 + hash(i, cx) * 0.6]); }
      }
    } else if (pitchedHere) {
      walls(roofB[k], inflate(p, 0.14), h - 0.25, h + 0.05, eave, 0, BAY, FLOOR, false);
      top = h + gableRoof(roofB[k], inflate(p, 0.32), h + 0.04, eave, snow, wall);
      const q = p, L01 = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), L12 = Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1]);
      const e = L01 >= L12 ? [q[0], q[1]] : [q[1], q[2]], [a, c] = e, bl = Math.max(L01, L12), n = Math.min(7, Math.floor(bl / 1.0));
      const ex = (c[1] - a[1]) / bl, ez = -(c[0] - a[0]) / bl;
      for (let i = 1; i <= n; i++) { const t = i / (n + 1); icicles.push([a[0] + (c[0] - a[0]) * t + ex * 0.36, h + 0.05, a[1] + (c[1] - a[1]) * t + ez * 0.36, 0.45 + hash(i, cx) * 0.6]); }
    } else { // gable on rectangles, flat roof with a snow top elsewhere
      if (p.length === 4 && b.k !== 'ourSchool' && b.k !== 'worship') { walls(roofB[k], p, h - 0.2, h, eave, 0, BAY, FLOOR, false); top = h + gableRoof(roofB[k], p, h, eave, snow, wall); }
      else { walls(roofB[k], p, h - 0.25, h + 0.22, eave, 0, BAY, FLOOR, false); flatPolygon(roofB[k], p, h + 0.22, snow); top = h + 0.22; }
    }
    if (DT) {
      const dark = wall.clone().multiplyScalar(0.82);
      if (DT.plinth) walls(roofB[k], inflate(p, S.rounded ? 0.16 : 0.05), -0.05, 0.42, dark, 0, BAY, FLOOR, false);
      if (DT.ao) shade.ring(inflate(p, 0.1), inflate(p, 1.3), 0.03, aoCol, 0.38);
      // door on the wall that faces the nearest street, with a snowy step
      if (DT.doors && b.k !== 'worship') {
        let best = null, bd = Infinity;
        for (let e = 0; e < p.length; e++) {
          const a = p[e], c = p[(e + 1) % p.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 2.2) continue;
          const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2, nx = (c[1] - a[1]) / L, nz = -(c[0] - a[0]) / L;
          const d = roadDist(mx + nx * 1.5, mz + nz * 1.5); if (d < bd) { bd = d; best = { mx, mz, nx, nz }; }
        }
        if (best && bd < 8) {
          const ang = Math.atan2(best.nx, best.nz), out = S.rounded ? 0.2 : 0.04;
          const door = doorGeometry(); door.rotateY(ang); door.translate(best.mx + best.nx * out, 0.18, best.mz + best.nz * out);
          roofB[k].add(door, color(DOORS[Math.floor(r * 37) % DOORS.length]));
          const step = roundedBox(1.5, 0.7, 0.14, 0.12); step.rotateY(ang); step.translate(best.mx + best.nx * (out + 0.35), 0.02, best.mz + best.nz * (out + 0.35));
          roofB[k].add(step, snow);
        }
      }
      // chimney with a snow cap
      if (DT.chimneys && b.k === 'house' && hash(cx * 3, cz) < DT.chimneys) {
        const q = p[Math.floor(hash(cz, cx * 5) * p.length)], ix = cx + (q[0] - cx) * 0.55, iz = cz + (q[1] - cz) * 0.55;
        const ch = roundedBox(0.7, 0.7, 1.3, 0.1); ch.translate(ix, h, iz); roofB[k].add(ch, color('#c8735a'));
        const cap = roundedBox(0.95, 0.95, 0.22, 0.12); cap.translate(ix, h + 1.35, iz); roofB[k].add(cap, snow);
      }
    }
    if (outline) { wallB[k].hullInto(hullB[k], w0, cx, cz, rad, h, outline.width); roofB[k].hullInto(hullB[k], r0, cx, cz, rad, top, outline.width); }
    if (b.k === 'worship') domes.push({ x: cx, z: cz, h, r: Math.min(5, Math.sqrt(Math.abs(signedArea(p))) * 0.32), p });
    if (b.k === 'ourSchool') signs.push({ x: cx, z: cz, h: top, area: Math.abs(signedArea(p)) });
  }
  const wallMat = makeMaterial(style, { vertexColors: true, map: tex.map, emissiveMap: tex.emissiveMap, emissive: new Color('#ffffff'), emissiveIntensity: 0.6, noGrain: true });
  const roofMat = makeMaterial(style, { vertexColors: true });
  addCutout(wallMat); addCutout(roofMat);
  for (let k = 0; k < CH * CH; k++) {
    for (const [B, m] of [[wallB[k], wallMat], [roofB[k], roofMat]]) if (B.count) { const mesh = new Mesh(B.geometry(), m); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); }
    if (hullB && hullB[k].count) group.add(new Mesh(hullB[k].geometry(), outlineMat));
  }
  if (DT && DT.ao) group.add(shade.mesh());
  const o2 = new Object3D(), blobs = [];
  if (DT && (DT.lamps || DT.banks)) {
    const grid = new Grid(arena);
    // street lamps with a warm glow, along the bigger streets
    if (DT.lamps) {
      const L = [];
      for (const rd of arena.roads) {
        if (!['primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street'].includes(rd.c)) continue;
        const pp = pts(rd.p); let acc = 7, side = 1;
        for (let k2 = 0; k2 + 1 < pp.length; k2++) {
          const [x0, z0] = pp[k2], [x1, z1] = pp[k2 + 1], Ls = Math.hypot(x1 - x0, z1 - z0); if (Ls < 0.1) continue;
          const ux = (x1 - x0) / Ls, uz = (z1 - z0) / Ls;
          for (let t = acc; t < Ls; t += 13) {
            const x = x0 + ux * t - uz * side * (rd.w / 2 + 0.5), z = z0 + uz * t + ux * side * (rd.w / 2 + 0.5); side = -side;
            if (!grid.blocked(x, z) && !grid.has(x, z, GRID.ROAD) && !L.some(q => Math.hypot(q[0] - x, q[1] - z) < 8)) L.push([x, z]);
            acc = t + 13 - Ls;
          }
          if (acc < 0) acc = 0;
        }
      }
      const post = new InstancedMesh(new CylinderGeometry(0.07, 0.1, 2.6, 6), makeMaterial(style, { color: '#3b4a63' }), L.length);
      const head = new InstancedMesh(new SphereGeometry(0.26, 12, 8), makeMaterial(style, { color: '#ffe2a6', emissive: new Color('#ffc566'), emissiveIntensity: 1.2 }), L.length);
      const lcap = new InstancedMesh(new SphereGeometry(0.3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), makeMaterial(style, { color: S.snow }), L.length);
      L.forEach(([x, z], i) => {
        o2.rotation.set(0, 0, 0); o2.scale.setScalar(1);
        o2.position.set(x, 1.3, z); o2.updateMatrix(); post.setMatrixAt(i, o2.matrix);
        o2.position.set(x, 2.75, z); o2.updateMatrix(); head.setMatrixAt(i, o2.matrix);
        o2.position.set(x, 2.84, z); o2.updateMatrix(); lcap.setMatrixAt(i, o2.matrix);
        blobs.push([x, z, 0.7]);
      });
      for (const m of [post, head, lcap]) { m.castShadow = true; addCutout(m.material); group.add(m); }
    }
    // soft snowbanks along street edges
    if (DT.banks && quality !== 'low') {
      const B = [];
      for (const rd of arena.roads) {
        if (!['primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'service'].includes(rd.c)) continue;
        const pp = pts(rd.p);
        for (let k2 = 0; k2 + 1 < pp.length; k2++) {
          const [x0, z0] = pp[k2], [x1, z1] = pp[k2 + 1], Ls = Math.hypot(x1 - x0, z1 - z0); if (Ls < 0.1) continue;
          const ux = (x1 - x0) / Ls, uz = (z1 - z0) / Ls, ang = Math.atan2(ux, uz);
          for (let t = 1; t < Ls; t += 1.7) for (const side of [1, -1]) {
            const off = rd.w / 2 + 0.25, x = x0 + ux * t - uz * side * off, z = z0 + uz * t + ux * side * off;
            if (B.length < 3600 && !grid.blocked(x, z) && !grid.has(x, z, GRID.ROAD) && !grid.has(x, z, GRID.ZONE)) B.push([x, z, ang, 0.8 + hash(x, z) * 0.6]);
          }
        }
      }
      const bank = new InstancedMesh(new SphereGeometry(1, 10, 6), makeMaterial(style, { color: '#ffffff' }), B.length);
      B.forEach(([x, z, a, sc], i) => { o2.position.set(x, 0, z); o2.rotation.set(0, a, 0); o2.scale.set(0.34 * sc, 0.2 * sc, 1.05 * sc); o2.updateMatrix(); bank.setMatrixAt(i, o2.matrix); });
      bank.receiveShadow = true; group.add(bank);
    }
  }
  const withOutline = (mesh, s = 1.08) => {
    group.add(mesh);
    if (outlineMat) { const o = new Mesh(mesh.geometry, outlineMat); o.position.copy(mesh.position); o.rotation.copy(mesh.rotation); o.scale.copy(mesh.scale).multiplyScalar(s); group.add(o); }
    return mesh;
  };

  // Icicles (toybox)
  if (icicles.length) {
    const ic = new InstancedMesh(new ConeGeometry(0.09, 1, 5), makeMaterial(style, { color: '#dff3ff', transparent: true, opacity: 0.9 }), icicles.length);
    const o = new Object3D();
    icicles.forEach(([x, y, z, l], i) => { o.position.set(x, y - l / 2, z); o.rotation.set(Math.PI, 0, 0); o.scale.set(1, l, 1); o.updateMatrix(); ic.setMatrixAt(i, o.matrix); });
    addCutout(ic.material); group.add(ic);
  }

  // Domes and minarets (scenery; no-snowball zones around them)
  const domeMat = makeMaterial(style, { color: style === 'cartoon' ? '#6fb1ff' : style === 'toybox' ? '#a9c7ff' : '#9aa9b8' }), stoneMat = makeMaterial(style, { color: '#f4f1ea' }), snowMat = makeMaterial(style, { color: S.snow });
  for (const m of [domeMat, stoneMat, snowMat]) addCutout(m);
  for (const d of domes) {
    const dome = new Mesh(new SphereGeometry(d.r, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), domeMat); dome.position.set(d.x, d.h, d.z); withOutline(dome, 1.05);
    const cap = new Mesh(new SphereGeometry(d.r * 1.02, 18, 4, 0, Math.PI * 2, 0, Math.PI / 5), snowMat); cap.position.set(d.x, d.h, d.z); group.add(cap);
    const corner = d.p.reduce((best, q) => (Math.hypot(q[0] - d.x, q[1] - d.z) > Math.hypot(best[0] - d.x, best[1] - d.z) ? q : best), d.p[0]);
    const mx = corner[0] + (d.x - corner[0]) * 0.15, mz = corner[1] + (d.z - corner[1]) * 0.15, mh = d.h + d.r * 2.2 + 2.5;
    const shaft = new Mesh(new CylinderGeometry(0.34, 0.4, mh, 10), stoneMat); shaft.position.set(mx, mh / 2, mz); withOutline(shaft, 1.15);
    const balcony = new Mesh(new CylinderGeometry(0.6, 0.6, 0.28, 10), snowMat); balcony.position.set(mx, mh * 0.78, mz); group.add(balcony);
    const tip = new Mesh(new ConeGeometry(0.38, 1.6, 10), domeMat); tip.position.set(mx, mh + 0.8, mz); withOutline(tip, 1.12);
  }

  // Trees in the style's shape
  const T = arena.trees, o = new Object3D(), treeMeshes = [];
  const inst = (geom, mat, n, shadow = true) => { const m = new InstancedMesh(geom, mat, n); m.castShadow = shadow; addCutout(m.material); group.add(m); treeMeshes.push(m); return m; };
  const greens = ['#2e8b57', '#3aa36a', '#27794c'];
  if (S.trees === 'lollipop' || S.trees === 'blob') {
    const ball = inst(new IcosahedronGeometry(1, S.trees === 'blob' ? 2 : 1), makeMaterial(style, { color: '#ffffff' }), T.length * (S.trees === 'blob' ? 2 : 1));
    const cap = inst(new SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.6), makeMaterial(style, { color: S.snow }), T.length);
    const trunk = inst(new CylinderGeometry(0.16, 0.22, 1.4, 6), makeMaterial(style, { color: '#8a5a3b' }), T.length);
    let bi = 0;
    T.forEach(([x, z], i) => {
      const s = 0.85 + hash(x, z) * 0.5;
      o.rotation.set(0, 0, 0); o.position.set(x, 0.7 * s, z); o.scale.set(s, s, s); o.updateMatrix(); trunk.setMatrixAt(i, o.matrix);
      const blobs = S.trees === 'blob' ? [[0, 1.9, 1.05], [0.25, 2.7, 0.75]] : [[0, 2.1, 1.15]];
      for (const [dx, y, r] of blobs) { o.position.set(x + dx * s, y * s, z); o.scale.setScalar(r * s); o.updateMatrix(); ball.setMatrixAt(bi, o.matrix); ball.setColorAt(bi, color(greens[(i + bi) % 3])); bi++; }
      const [, ty, tr] = blobs[blobs.length - 1];
      o.position.set(x + (blobs.length > 1 ? 0.25 * s : 0), (ty + tr * 0.25) * s, z); o.scale.setScalar(tr * s * 1.02); o.updateMatrix(); cap.setMatrixAt(i, o.matrix);
    });
    ball.instanceColor.needsUpdate = true;
  } else if (S.trees === 'cutout') {
    // two crossed card triangles with a white tip
    const tri = new BufferGeometry(); tri.setAttribute('position', new Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 0, 2.6, 0], 3)); tri.setAttribute('normal', new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3)); tri.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
    const tip = new BufferGeometry(); tip.setAttribute('position', new Float32BufferAttribute([-0.42, 1.52, 0.01, 0.42, 1.52, 0.01, 0, 2.6, 0.01], 3)); tip.setAttribute('normal', new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3)); tip.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
    const card = inst(tri, makeMaterial(style, { color: '#ffffff', side: DoubleSide }), T.length * 2);
    const tips = inst(tip, makeMaterial(style, { color: S.snow, side: DoubleSide }), T.length * 2);
    let ci = 0;
    T.forEach(([x, z], i) => {
      const s = 1 + hash(x, z) * 0.6;
      for (const ry of [0.4, 0.4 + Math.PI / 2]) { o.position.set(x, 0, z); o.rotation.set(0, ry, 0); o.scale.set(s, s, s); o.updateMatrix(); card.setMatrixAt(ci, o.matrix); tips.setMatrixAt(ci, o.matrix); card.setColorAt(ci, color(['#6b9a5b', '#7fae6a', '#5d8a4f'][i % 3])); ci++; }
    });
    card.instanceColor.needsUpdate = true;
  } else { // cones
    const fol = inst(new ConeGeometry(1.0, 2.4, 7), makeMaterial(style, { color: '#2fa35a' }), T.length * 2);
    const caps = inst(new ConeGeometry(0.62, 1.0, 7), makeMaterial(style, { color: S.snow }), T.length * 2);
    const trunk = inst(new CylinderGeometry(0.15, 0.2, 1.0, 6), makeMaterial(style, { color: '#7a5636' }), T.length);
    const hull = outlineMat ? inst(new ConeGeometry(1.0, 2.4, 7), outlineMat, T.length * 2, false) : null;
    let fi = 0;
    T.forEach(([x, z], i) => {
      const s = 0.85 + hash(x, z) * 0.55;
      o.rotation.set(0, hash(z, x) * 6, 0); o.position.set(x, 0.5 * s, z); o.scale.setScalar(s); o.updateMatrix(); trunk.setMatrixAt(i, o.matrix);
      for (const [y, sc] of [[1.9, 1], [3.0, 0.72]]) {
        o.position.set(x, y * s, z); o.scale.setScalar(s * sc); o.updateMatrix(); fol.setMatrixAt(fi, o.matrix);
        if (hull) { o.scale.setScalar(s * sc * 1.12); o.updateMatrix(); hull.setMatrixAt(fi, o.matrix); }
        o.position.set(x, (y + 0.75 * sc) * s, z); o.scale.setScalar(s * sc); o.updateMatrix(); caps.setMatrixAt(fi, o.matrix); fi++;
      }
    });
  }

  if (DT && DT.ao) {
    for (const [x, z] of T) blobs.push([x, z, 1.6]);
    const bm = new InstancedMesh(new PlaneGeometry(2, 2), new MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }), blobs.length);
    blobs.forEach(([x, z, r], i) => { o2.position.set(x, 0.035, z); o2.rotation.set(-Math.PI / 2, 0, 0); o2.scale.set(r, r, 1); o2.updateMatrix(); bm.setMatrixAt(i, o2.matrix); });
    bm.renderOrder = 1; group.add(bm);
  }

  // Snowdrifts: ammo pickups that shrink while they refill
  const drifts = new InstancedMesh(new IcosahedronGeometry(1, 2), makeMaterial(style, { color: '#ffffff', noGrain: true }), arena.drifts.length);
  drifts.receiveShadow = true; drifts.castShadow = quality !== 'low';
  const setDrift = (i, x, z, t) => { o.rotation.set(0, i, 0); o.position.set(x, -0.2 + 0.25 * t, z); o.scale.set(1.15, 0.35 + 0.4 * t, 0.95); o.updateMatrix(); drifts.setMatrixAt(i, o.matrix); };
  arena.drifts.forEach(([x, z], i) => setDrift(i, x, z, 1));
  group.add(drifts);
  if (outlineMat) { const dh = new InstancedMesh(drifts.geometry, outlineMat, arena.drifts.length); arena.drifts.forEach(([x, z], i) => { o.rotation.set(0, i, 0); o.position.set(x, -0.2 + 0.25, z); o.scale.set(1.25, 0.82, 1.05); o.updateMatrix(); dh.setMatrixAt(i, o.matrix); }); group.add(dh); }

  // "Our School" sign
  if (signs.length) {
    const s = signs.reduce((a, b) => (b.area > a.area ? b : a));
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
    g.fillStyle = style === 'cartoon' ? '#1d1b2e' : '#1b3a5c'; g.beginPath(); g.roundRect(8, 8, 496, 112, 30); g.fill();
    g.fillStyle = '#ffffff'; g.font = 'bold 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Our School', 256, 68);
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
    const sp = new Sprite(new SpriteMaterial({ map: t, depthTest: false })); sp.scale.set(8, 2, 1); sp.position.set(s.x, s.h + 2.6, s.z); sp.renderOrder = 5;
    group.add(sp);
  }

  return { group, updateDrift(i, t) { const [x, z] = arena.drifts[i]; setDrift(i, x, z, t); drifts.instanceMatrix.needsUpdate = true; } };
}
