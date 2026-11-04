// The "v2" look (stage sample, ?look=v2): bold, game-like readability on top of the diorama warmth.
//   - cartoon shading: 3-tone light with a soft bright rim on characters and props
//   - dark outlines on everything you interact with (inverted hull, pushed out along normals)
//   - sparkling snow (glints that twinkle as the camera moves)
//   - glow on lanterns, fires and golden snowflakes, plus a colour grade and soft vignette
//     (Medium and High only; Low keeps today's look)
//   - a painted backdrop of snowy rooftops, trees and minarets beyond the stage's snowbanks
import {
  DataTexture, RedFormat, NearestFilter, MeshToonMaterial, MeshBasicMaterial, BackSide, Vector2, Color, Group, InstancedMesh, Object3D,
  BoxGeometry, SphereGeometry, ConeGeometry, CylinderGeometry, BufferAttribute, MeshLambertMaterial, Mesh, CircleGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export const LOOK = { v2: false, time: { value: 0 } };

let grad = null;
export function toonGradient() { // three light bands: shade, mid, lit
  if (!grad) { grad = new DataTexture(new Uint8Array([105, 185, 238]), 3, 1, RedFormat); grad.minFilter = grad.magFilter = NearestFilter; grad.needsUpdate = true; }
  return grad;
}
// a toon material with a soft bright rim (fresnel), chaining any earlier shader changes (the see-through cut-out)
export function toon(params) {
  const m = new MeshToonMaterial({ gradientMap: toonGradient(), ...params });
  return m;
}
export function addRim(material, strength = 0.35, color = '#fff6e8') {
  const prev = material.onBeforeCompile, rimCol = new Color(color);
  material.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.uniforms.uRim = { value: strength }; sh.uniforms.uRimCol = { value: rimCol };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uRim; uniform vec3 uRimCol;')
      .replace('#include <opaque_fragment>', 'float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);\noutgoingLight += uRimCol * rimF * uRim;\n#include <opaque_fragment>');
  };
  material.customProgramCacheKey = () => 'rim' + strength + (prev ? 'c' : '');
  return material;
}

// outlines: the same geometry drawn slightly fatter, back faces only, in dark ink
const inkCache = new Map();
export function outlineMaterial(thickness = 0.035, color = '#1c2340', cutout = null) {
  const key = thickness + color + (cutout ? 'c' : ''); if (inkCache.has(key)) return inkCache.get(key);
  const m = new MeshBasicMaterial({ color, side: BackSide });
  if (cutout) cutout(m);
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.uniforms.uInk = { value: thickness };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uInk;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * uInk;');
  };
  m.customProgramCacheKey = () => 'ink' + key;
  inkCache.set(key, m); return m;
}

// sparkling snow: tiny glints that twinkle as the camera moves (for the terrain's snow)
export function addSparkle(material, amount = 0.9) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.uniforms.uTime = LOOK.time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform float uTime;\nfloat hsh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }')
      .replace('#include <opaque_fragment>', `vec2 cell = floor(vWP.xz * 9.0); float h = hsh(cell);
float tw = step(0.965, h) * pow(max(0.0, sin(uTime * 2.3 + h * 60.0 + vWP.x * 0.7)), 18.0);
outgoingLight += vec3(1.0, 0.98, 0.92) * tw * ${amount.toFixed(2)};
#include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => 'sparkle' + (prev ? 'c' : '');
  return material;
}

// ---------- post: glow, colour grade, vignette ----------
const Grade = {
  uniforms: { tDiffuse: { value: null }, uSat: { value: 1.18 }, uCon: { value: 1.08 }, uVig: { value: 0.3 }, uTint: { value: new Color('#fbfcff') } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat, uCon, uVig; uniform vec3 uTint; varying vec2 vUv;
void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb;
  float l = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(vec3(l), col, uSat); col = (col - 0.5) * uCon + 0.5; col *= uTint;
  float d = distance(vUv, vec2(0.5)); col *= 1.0 - uVig * smoothstep(0.45, 0.85, d);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a); }`,
};
export function makePost(renderer, quality) {
  const size = renderer.getSize(new Vector2());
  const composer = new EffectComposer(renderer); composer.setPixelRatio(renderer.getPixelRatio());
  const pass = new RenderPass(null, null); composer.addPass(pass);
  const bloom = new UnrealBloomPass(new Vector2(size.x / 2, size.y / 2), quality === 'high' ? 0.22 : 0.16, 0.25, 0.98); composer.addPass(bloom);
  const grade = new ShaderPass(Grade); composer.addPass(new OutputPass()); composer.addPass(grade); // grade the final (sRGB) image
  return {
    render(scene, camera) { pass.scene = scene; pass.camera = camera; composer.render(); },
    setGrade({ tint = '#fbfcff', sat = 1.18 } = {}) { grade.uniforms.uTint.value.set(tint); grade.uniforms.uSat.value = sat; }, // per stage: the time of day
    setSize(w, h) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2); },
  };
}

// ---------- painted backdrop beyond the stage ----------
function bake(parts) {
  const o = new Object3D();
  return mergeGeometries(parts.map(([geo, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx]) => {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()); for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
    o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); o.updateMatrix(); g.applyMatrix4(o.matrix);
    const c = new Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new BufferAttribute(a, 3)); return g;
  }));
}
// rooftops with snow, plane trees, pines and a few minarets on rings round the stage (fog does the rest)
export function buildBackdrop(cx, cz, { rIn = 16, rOut = 36, seed = 1, avoid = null } = {}) {
  let s = seed * 9301 + 49297; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const W = '#f6f8ff', g = new Group(), mat = new MeshLambertMaterial({ vertexColors: true, emissive: new Color('#b8c3e0'), emissiveIntensity: 0.55 }); // washed pale, like a painted backdrop
  const kinds = [
    bake([[new BoxGeometry(2.6, 1.8, 2.2), '#c9c3e0', 0, 0.9, 0], [new ConeGeometry(2.1, 1.2, 4), '#55608e', 0, 2.4, 0, 0, Math.PI / 4, 0, 1, 1, 0.9], [new ConeGeometry(1.9, 1.0, 4), W, 0, 2.6, 0, 0, Math.PI / 4, 0, 1, 1, 0.9], [new BoxGeometry(0.4, 0.5, 0.06), '#ffcf7a', -0.6, 1.0, 1.12], [new BoxGeometry(0.4, 0.5, 0.06), '#ffcf7a', 0.6, 1.0, 1.12]]),
    bake([[new BoxGeometry(3.4, 2.8, 2.4), '#d6c6b8', 0, 1.4, 0], [new BoxGeometry(3.7, 0.25, 2.7), '#6d6a9c', 0, 2.9, 0], [new SphereGeometry(1, 10, 4), W, 0, 3.0, 0, 0, 0, 0, 1.9, 0.5, 1.4], ...[-1, 0, 1].map(x => [new BoxGeometry(0.45, 0.55, 0.06), '#ffcf7a', x, 1.6, 1.22])]),
    bake([[new CylinderGeometry(0.22, 0.32, 2.2, 7), '#9a8c84', 0, 1.1, 0], [new SphereGeometry(1.3, 9, 6), W, 0, 3.0, 0, 0, 0, 0, 1.2, 0.8, 1.2]]),
    bake([[new CylinderGeometry(0.12, 0.16, 0.8, 6), '#7a5a46', 0, 0.4, 0], [new ConeGeometry(1.1, 1.4, 7), '#2e5f5e', 0, 1.2, 0], [new ConeGeometry(0.8, 1.2, 7), '#3a7370', 0, 2.0, 0], [new SphereGeometry(0.5, 7, 4), W, 0, 2.6, 0, 0, 0, 0, 0.9, 0.5, 0.9]]),
    bake([[new CylinderGeometry(0.35, 0.42, 7.5, 10), '#e4e0ee', 0, 3.75, 0], [new CylinderGeometry(0.6, 0.6, 0.3, 10), W, 0, 6.0, 0], [new ConeGeometry(0.42, 1.6, 10), '#8a7fc0', 0, 8.3, 0]]),
  ];
  const ground = new Mesh(new CircleGeometry(rOut + 20, 48), new MeshLambertMaterial({ color: '#eef2fb' })); ground.rotation.x = -Math.PI / 2; ground.position.set(cx, -0.06, cz); g.add(ground);
  const counts = [70, 34, 40, 46, 3], o = new Object3D();
  kinds.forEach((geo, k) => {
    const im = new InstancedMesh(geo, mat, counts[k]); let n = 0;
    for (let t = 0; t < counts[k] * 4 && n < counts[k]; t++) {
      const a = rnd() * Math.PI * 2, r = k === 4 ? rOut - 4 - rnd() * 6 : rIn + rnd() * (rOut - rIn), x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r;
      if (avoid && avoid(x, z)) continue;
      o.position.set(x, -0.05, z); o.rotation.set(0, rnd() * 6.28, 0); const sc = (0.8 + rnd() * 0.6) * (k === 4 ? 1 : 0.85); o.scale.set(sc, sc * (k < 2 ? 0.8 + rnd() * 0.6 : 1), sc); o.updateMatrix(); im.setMatrixAt(n++, o.matrix);
    }
    im.count = n; im.receiveShadow = false; g.add(im);
  });
  return g;
}
