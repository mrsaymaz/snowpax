// See-through buildings: any building or tree fragment that is in front of the student's
// character (closer to the camera) and near the character on screen is dissolved with a
// dither pattern, so the character is never hidden. Works on merged meshes.
import { Vector2 } from 'three';

export const CUT = {
  center: { value: new Vector2(-9999, -9999) }, // character position on screen, in device pixels
  radius: { value: 0 },                           // device pixels
  depth: { value: 0 },                            // character view-space z (+ margin)
};

export function addCutout(material) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uCutCenter = CUT.center;
    shader.uniforms.uCutRadius = CUT.radius;
    shader.uniforms.uCutDepth = CUT.depth;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vCutViewZ;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCutViewZ = mvPosition.z;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec2 uCutCenter; uniform float uCutRadius; uniform float uCutDepth; varying float vCutViewZ;
float cutBayer(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  float i = q.x + q.y * 4.0;
  // 4x4 Bayer matrix, row-major
  float m[16] = float[16](0.0,8.0,2.0,10.0, 12.0,4.0,14.0,6.0, 3.0,11.0,1.0,9.0, 15.0,7.0,13.0,5.0);
  for (int k = 0; k < 16; k++) if (float(k) == i) return (m[k] + 0.5) / 16.0;
  return 0.5;
}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
if (uCutRadius > 0.0 && vCutViewZ > uCutDepth) {
  float d = distance(gl_FragCoord.xy, uCutCenter);
  float a = 1.0 - smoothstep(uCutRadius * 0.55, uCutRadius, d);
  if (a * 0.85 > cutBayer(gl_FragCoord.xy)) discard;
}`);
  };
  material.customProgramCacheKey = () => 'cutout';
}
