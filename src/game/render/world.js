// Builds the snowy miniature city from arena data: a few merged meshes for speed.
// Look: chunky low-poly toy buildings in pastel Istanbul colours, snow on every roof with
// warm terracotta edges showing, warm window lights, pale blue cleared streets.
import {
  BufferGeometry, Float32BufferAttribute, Mesh, MeshLambertMaterial, Color, CanvasTexture, RepeatWrapping,
  SRGBColorSpace, ShapeUtils, Vector2, Group, SphereGeometry, CylinderGeometry, ConeGeometry, InstancedMesh,
  Object3D, IcosahedronGeometry, Sprite, SpriteMaterial, PlaneGeometry, MeshBasicMaterial,
} from 'three';
import { addCutout } from './cutout.js';

const FLOOR = 1.5;           // world units per storey (3 m at scale 0.5)
const BAY = 1.6;             // window bay width
const WALLS = ['#f1e3c8', '#f3d9a0', '#e9b08f', '#cbd8e2', '#d3e6d4', '#e7a58c', '#f5efe4', '#e8cfe0', '#f0c987', '#c9c2b6'];
const EAVE = '#c8603e';      // terracotta roof edge
const SNOW = '#f7fbff';

const col = hex => new Color(hex);
const hash = (a, b) => { let h = Math.imul(Math.round(a * 13) ^ 0x9e3779b9, 2654435761) ^ Math.imul(Math.round(b * 17), 1597334677); h ^= h >>> 15; return (h >>> 0) / 4294967296; };

class Builder { // accumulates triangles with position, normal, colour, uv
  constructor() { this.p = []; this.n = []; this.c = []; this.uv = []; }
  tri(a, b, c, color, uvs) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (const v of [a, b, c]) { this.p.push(v[0], v[1], v[2]); this.n.push(nx, ny, nz); this.c.push(color.r, color.g, color.b); }
    this.uv.push(...(uvs || [0, 0, 0, 0, 0, 0]));
  }
  quad(a, b, c, d, color, uvs) { // a b c d counter-clockwise seen from the front
    this.tri(a, b, c, color, uvs && [uvs[0], uvs[1], uvs[2], uvs[3], uvs[4], uvs[5]]);
    this.tri(a, c, d, color, uvs && [uvs[0], uvs[1], uvs[4], uvs[5], uvs[6], uvs[7]]);
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

// Window texture: 8 bays × 8 floors, some windows lit warm. A matching emissive map makes them glow.
function windowTextures() {
  const S = 512, cells = 8, cs = S / cells;
  const make = lit => { const c = document.createElement('canvas'); c.width = c.height = S; return [c, c.getContext('2d')]; };
  const [mc, m] = make(), [ec, e] = make();
  m.fillStyle = '#ffffff'; m.fillRect(0, 0, S, S);
  e.fillStyle = '#000000'; e.fillRect(0, 0, S, S);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
    const x = i * cs, y = j * cs, w = cs * 0.46, h = cs * 0.52, wx = x + (cs - w) / 2, wy = y + cs * 0.2;
    m.fillStyle = 'rgba(0,0,0,0.10)'; m.fillRect(x, y + cs - 3, cs, 3); // storey line
    m.fillStyle = '#e9e4da'; m.fillRect(wx - 3, wy - 3, w + 6, h + 6); // frame
    const lit = rnd() < 0.28;
    m.fillStyle = lit ? '#ffd68a' : '#6f8296'; m.fillRect(wx, wy, w, h);
    m.fillStyle = 'rgba(255,255,255,0.35)'; m.fillRect(wx, wy, w * 0.4, h * 0.3);
    m.fillStyle = '#f4f8fb'; m.fillRect(wx - 4, wy + h + 2, w + 8, 5); // snow on the sill
    if (lit) { e.fillStyle = '#b07a2a'; e.fillRect(wx, wy, w, h); }
  }
  const tex = c => { const t = new CanvasTexture(c); t.wrapS = t.wrapT = RepeatWrapping; t.colorSpace = SRGBColorSpace; t.anisotropy = 2; return t; };
  return { map: tex(mc), emissiveMap: tex(ec) };
}

function snowNoise() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 2600; k++) { const v = 228 + Math.floor(rnd() * 27); g.fillStyle = `rgb(${v},${v + 2 > 255 ? 255 : v + 2},255)`; g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 3, 1 + rnd() * 2); }
  const t = new CanvasTexture(c); t.wrapS = t.wrapT = RepeatWrapping; t.colorSpace = SRGBColorSpace; return t;
}

const pts = flat => { const out = []; for (let k = 0; k < flat.length; k += 2) out.push([flat[k], flat[k + 1]]); return out; };
const signedArea = p => { let a = 0; for (let i = 0; i < p.length; i++) { const [x1, z1] = p[i], [x2, z2] = p[(i + 1) % p.length]; a += x1 * z2 - x2 * z1; } return a / 2; };
const centroid = p => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];

function flatPolygon(B, p, y, color) {
  const tris = ShapeUtils.triangulateShape(p.map(([x, z]) => new Vector2(x, z)), []);
  for (const [i, j, k] of tris) {
    const a = [p[i][0], y, p[i][1]], b = [p[j][0], y, p[j][1]], c = [p[k][0], y, p[k][1]];
    // face up
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (ny >= 0) B.tri(a, b, c, color); else B.tri(a, c, b, color);
  }
}

function walls(W, p, y0, y1, color, uOffset, textured = true) {
  let u = uOffset;
  for (let k = 0; k < p.length; k++) {
    const a = p[k], b = p[(k + 1) % p.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u1 = u + L / BAY / 8, v0 = y0 / FLOOR / 8, v1 = y1 / FLOOR / 8;
    W.quad([a[0], y0, a[1]], [a[0], y1, a[1]], [b[0], y1, b[1]], [b[0], y0, b[1]], color, textured ? [u, v0, u, v1, u1, v1, u1, v0] : null);
    u = u1;
  }
}

// Gable roof on a rectangle: ridge along the longer side, snow on top, terracotta edge below.
function gableRoof(R, p, h, eaveColor, snowColor, wallColor) {
  const L01 = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]), L12 = Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1]);
  const q = L01 >= L12 ? p : [p[1], p[2], p[3], p[0]];
  const short = Math.min(L01, L12), rise = Math.min(1.4, short * 0.32);
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const r0 = mid(q[0], q[3]), r1 = mid(q[1], q[2]);
  const V = (xz, y) => [xz[0], y, xz[1]];
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  // two slopes, each a terracotta strip at the eave and snow above
  for (const [e0, e1, s0, s1] of [[q[0], q[1], r0, r1], [q[2], q[3], r1, r0]]) {
    const t = 0.22, m0 = lerp(e0, s0, t), m1 = lerp(e1, s1, t);
    const face = (a, b, c, d, color) => {
      // orient upward
      const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      if (ny <= 0) R.quad(a, b, c, d, color); else R.quad(a, d, c, b, color);
    };
    face(V(e0, h), V(e1, h), V(m1, h + rise * t), V(m0, h + rise * t), eaveColor);
    face(V(m0, h + rise * t), V(m1, h + rise * t), V(s1, h + rise), V(s0, h + rise), snowColor);
  }
  // gable ends
  const cx = (q[0][0] + q[2][0]) / 2, cz = (q[0][1] + q[2][1]) / 2;
  for (const [a, b, top] of [[q[3], q[0], r0], [q[1], q[2], r1]]) {
    const A = V(a, h), Bv = V(b, h), T = V(top, h + rise);
    // normal of (A, B, T); flip so it points away from the house centre
    const ux = Bv[0] - A[0], uy = 0, uz = Bv[2] - A[2], vx = T[0] - A[0], vy = T[1] - A[1], vz = T[2] - A[2];
    const nx = uy * vz - uz * vy, nz = ux * vy - uy * vx;
    const out = nx * ((a[0] + b[0]) / 2 - cx) + nz * ((a[1] + b[1]) / 2 - cz);
    if (out >= 0) R.tri(A, Bv, T, wallColor); else R.tri(A, T, Bv, wallColor);
  }
}

export function buildWorld(arena, { quality = 'medium' } = {}) {
  const group = new Group();
  const H = arena.half;
  const tex = windowTextures();

  // Ground
  const groundTex = snowNoise(); groundTex.repeat.set(H / 6, H / 6);
  const ground = new Mesh(new PlaneGeometry(2 * H + 200, 2 * H + 200), new MeshLambertMaterial({ color: '#ffffff', map: groundTex }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; group.add(ground);

  // Flat things: areas, zones, roads
  const F = new Builder();
  const AREA = { park: '#e6f2e4', pitch: '#e1efe0', playground: '#eef4e2', wood: '#dcebd9', cemetery: '#e8e4dc', schoolyard: '#f6efde', ourYard: '#fbf0d4' };
  for (const a of arena.areas) flatPolygon(F, pts(a.p), 0.01, col(AREA[a.k] || '#eeeeee'));
  const zoneCol = col('#ece6f8');
  for (const z of arena.zones) {
    if (z.c) { const n = 18, ring = []; for (let k = 0; k < n; k++) ring.push([z.c[0] + Math.cos(k / n * 6.283) * z.r, z.c[1] + Math.sin(k / n * 6.283) * z.r]); flatPolygon(F, ring, 0.012, zoneCol); }
    else flatPolygon(F, z.p, 0.012, zoneCol);
  }
  const ROAD = { primary: '#c9d5e0', primary_link: '#c9d5e0', secondary: '#ccd8e2', tertiary: '#cfdae4', footway: '#e2e9ef', steps: '#dde5ec', path: '#e4eaf0' };
  for (const r of arena.roads) {
    const p = pts(r.p), w = r.w / 2, color = col(ROAD[r.c] || '#d3dde6'), y = r.c === 'primary' ? 0.02 : 0.025;
    for (let k = 0; k + 1 < p.length; k++) {
      const [x0, z0] = p[k], [x1, z1] = p[k + 1], L = Math.hypot(x1 - x0, z1 - z0) || 1, nx = -(z1 - z0) / L * w, nz = (x1 - x0) / L * w;
      flatPolygon(F, [[x0 + nx, z0 + nz], [x1 + nx, z1 + nz], [x1 - nx, z1 - nz], [x0 - nx, z0 - nz]], y, color);
    }
    for (const [x, z] of p) { const n = 8, ring = []; for (let k = 0; k < n; k++) ring.push([x + Math.cos(k / n * 6.283) * w, z + Math.sin(k / n * 6.283) * w]); flatPolygon(F, ring, y, color); }
  }
  const flat = new Mesh(F.geometry(), new MeshLambertMaterial({ vertexColors: true }));
  flat.receiveShadow = true; group.add(flat);

  // Buildings, in chunks so the camera can skip far ones.
  const CH = 4, chunk = (x, z) => Math.min(CH - 1, Math.max(0, Math.floor((x + H) / (2 * H) * CH))) + CH * Math.min(CH - 1, Math.max(0, Math.floor((z + H) / (2 * H) * CH)));
  const wallB = Array.from({ length: CH * CH }, () => new Builder()), roofB = Array.from({ length: CH * CH }, () => new Builder());
  const eave = col(EAVE), snow = col(SNOW), domes = [], signs = [];
  for (const b of arena.buildings) {
    let p = pts(b.p); if (p.length < 3) continue;
    if (signedArea(p) < 0) p = p.reverse();
    const [cx, cz] = centroid(p), k = chunk(cx, cz), h = b.l * FLOOR, r = hash(cx, cz);
    let wall = col(WALLS[Math.floor(r * WALLS.length)]);
    if (b.k === 'worship') wall = col('#f2efe8');
    if (b.k === 'ourSchool') wall = col('#f6d38b');
    if (b.k === 'school') wall = col('#efd9b0');
    walls(wallB[k], p, 0, h, wall, r * 8, b.k !== 'worship');
    const pitched = p.length === 4 && !b.o && b.k === 'house';
    if (pitched) { walls(roofB[k], p, h - 0.15, h, eave, 0, false); gableRoof(roofB[k], p, h, eave, snow, wall); }
    else {
      walls(roofB[k], p, h - 0.2, h + 0.18, eave, 0, false); // parapet with a terracotta cap
      flatPolygon(roofB[k], p, h + 0.18, snow);
    }
    if (b.k === 'worship') domes.push({ x: cx, z: cz, h, r: Math.min(5, Math.sqrt(Math.abs(signedArea(p))) * 0.32), p });
    if (b.k === 'ourSchool') signs.push({ x: cx, z: cz, h, area: Math.abs(signedArea(p)) });
  }
  const wallMat = new MeshLambertMaterial({ vertexColors: true, map: tex.map, emissiveMap: tex.emissiveMap, emissive: new Color('#ffffff'), emissiveIntensity: 0.55 });
  const roofMat = new MeshLambertMaterial({ vertexColors: true });
  addCutout(wallMat); addCutout(roofMat);
  const buildingMeshes = [];
  for (let k = 0; k < CH * CH; k++) {
    if (wallB[k].p.length) { const m = new Mesh(wallB[k].geometry(), wallMat); m.castShadow = true; m.receiveShadow = true; group.add(m); buildingMeshes.push(m); }
    if (roofB[k].p.length) { const m = new Mesh(roofB[k].geometry(), roofMat); m.castShadow = true; m.receiveShadow = true; group.add(m); buildingMeshes.push(m); }
  }

  // Domes and minarets (scenery; no-snowball zones around them).
  const domeMat = new MeshLambertMaterial({ color: '#9aa9b8' }), stoneMat = new MeshLambertMaterial({ color: '#f2efe8' }), snowMat = new MeshLambertMaterial({ color: SNOW });
  addCutout(domeMat); addCutout(stoneMat); addCutout(snowMat);
  for (const d of domes) {
    const dome = new Mesh(new SphereGeometry(d.r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), domeMat); dome.position.set(d.x, d.h, d.z); group.add(dome);
    const cap = new Mesh(new SphereGeometry(d.r * 1.01, 16, 4, 0, Math.PI * 2, 0, Math.PI / 5), snowMat); cap.position.set(d.x, d.h, d.z); group.add(cap);
    const corner = d.p.reduce((best, q) => (Math.hypot(q[0] - d.x, q[1] - d.z) > Math.hypot(best[0] - d.x, best[1] - d.z) ? q : best), d.p[0]);
    const mx = corner[0] + (d.x - corner[0]) * 0.15, mz = corner[1] + (d.z - corner[1]) * 0.15, mh = d.h + d.r * 2.8 + 3;
    const shaft = new Mesh(new CylinderGeometry(0.32, 0.38, mh, 10), stoneMat); shaft.position.set(mx, mh / 2, mz); group.add(shaft);
    const balcony = new Mesh(new CylinderGeometry(0.55, 0.55, 0.25, 10), snowMat); balcony.position.set(mx, mh * 0.78, mz); group.add(balcony);
    const tip = new Mesh(new ConeGeometry(0.36, 1.6, 10), domeMat); tip.position.set(mx, mh + 0.8, mz); group.add(tip);
  }

  // Trees: dark green cones with snow caps.
  const treeN = arena.trees.length;
  const foliage = new InstancedMesh(new ConeGeometry(1.0, 2.4, 7), new MeshLambertMaterial({ color: '#2f6b46' }), treeN * 2);
  const caps = new InstancedMesh(new ConeGeometry(0.62, 1.0, 7), new MeshLambertMaterial({ color: SNOW }), treeN * 2);
  const trunks = new InstancedMesh(new CylinderGeometry(0.14, 0.18, 1.0, 5), new MeshLambertMaterial({ color: '#7a5636' }), treeN);
  addCutout(foliage.material); addCutout(caps.material);
  const o = new Object3D(); let fi = 0;
  arena.trees.forEach(([x, z], i) => {
    const s = 0.8 + hash(x, z) * 0.6;
    o.position.set(x, 0.5 * s, z); o.scale.set(s, s, s); o.rotation.set(0, hash(z, x) * 6, 0); o.updateMatrix(); trunks.setMatrixAt(i, o.matrix);
    for (const [y, sc] of [[1.9, 1], [3.0, 0.72]]) {
      o.position.set(x, y * s, z); o.scale.set(s * sc, s * sc, s * sc); o.updateMatrix(); foliage.setMatrixAt(fi, o.matrix);
      o.position.set(x, (y + 0.75 * sc) * s, z); o.updateMatrix(); caps.setMatrixAt(fi, o.matrix); fi++;
    }
  });
  for (const m of [foliage, caps, trunks]) { m.castShadow = true; group.add(m); }

  // Snowdrifts: ammo pickups that shrink while they refill.
  const drifts = new InstancedMesh(new IcosahedronGeometry(1, 1), new MeshLambertMaterial({ color: '#ffffff' }), arena.drifts.length);
  drifts.receiveShadow = true; drifts.castShadow = quality !== 'low';
  const setDrift = (i, x, z, t) => { o.position.set(x, -0.2 + 0.25 * t, z); o.scale.set(1.15, 0.35 + 0.4 * t, 0.95); o.rotation.set(0, i, 0); o.updateMatrix(); drifts.setMatrixAt(i, o.matrix); };
  arena.drifts.forEach(([x, z], i) => setDrift(i, x, z, 1));
  group.add(drifts);

  // "Our School" sign above the school.
  if (signs.length) {
    const s = signs.reduce((a, b) => (b.area > a.area ? b : a));
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#1b3a5c'; g.beginPath(); g.roundRect(8, 8, 496, 112, 30); g.fill();
    g.fillStyle = '#ffffff'; g.font = 'bold 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Our School', 256, 68);
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
    const sp = new Sprite(new SpriteMaterial({ map: t, depthTest: false })); sp.scale.set(8, 2, 1); sp.position.set(s.x, s.h + 3, s.z); sp.renderOrder = 5;
    group.add(sp);
  }

  return {
    group, buildingMeshes,
    updateDrift(i, t) { const [x, z] = arena.drifts[i]; setDrift(i, x, z, t); drifts.instanceMatrix.needsUpdate = true; },
  };
}
