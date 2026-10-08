import * as THREE from 'three';

/**
 * The light of the racing world, in one place: a warm sun about 27 degrees
 * up, a deep blue sky and a height fog that turns distant hills blue grey.
 * The sky dome, the ground haze and the lights all read these values, so
 * far hills melt into the horizon with no seam.
 */
export const SUN_DIR = new THREE.Vector3(0.62, 0.43, 0.47).normalize();

export const ATMOSPHERE = {
  sun: new THREE.Color('#ffd9a8'),
  zenith: new THREE.Color('#2a63b8'),
  horizon: new THREE.Color('#a9c3df'),
  /** Haze looking away from the sun, and toward it, where it glows warm. */
  haze: new THREE.Color('#bccad6'),
  sunHaze: new THREE.Color('#f3dcbd'),
  /** Fog density at ground level, per meter, and how fast it thins with height. */
  density: 0.0004,
  falloff: 1 / 240,
};

/** Uniforms shared by every material the haze patch touches. Values never change, so all canvases can share them. */
export const hazeUniforms = {
  uHazeColor: { value: ATMOSPHERE.haze },
  uSunHazeColor: { value: ATMOSPHERE.sunHaze },
  uHazeSun: { value: SUN_DIR },
  uHazeDensity: { value: ATMOSPHERE.density },
  uHazeFalloff: { value: ATMOSPHERE.falloff },
};

/**
 * Aerial perspective in GLSL. Integrates an exponential height fog along the
 * view ray, so a mountain's foot hazes more than its peak, and tints the haze
 * warm toward the sun. `viewVec` is the camera to fragment vector in view
 * space; `viewMatrix` and `cameraPosition` are three's built in uniforms.
 */
export const HAZE_GLSL = /* glsl */ `
uniform vec3 uHazeColor;
uniform vec3 uSunHazeColor;
uniform vec3 uHazeSun;
uniform float uHazeDensity;
uniform float uHazeFalloff;
float hazeAmount(vec3 dir, float dist) {
  float k = uHazeFalloff;
  float y0 = max(cameraPosition.y, 0.0);
  float dy = dir.y * dist;
  float depth = abs(dy) > 0.05
    ? exp(-k * y0) * (1.0 - exp(-k * dy)) / (k * dir.y)
    : exp(-k * y0) * dist;
  return 1.0 - exp(-uHazeDensity * max(depth, 0.0));
}
vec3 hazeColor(vec3 dir) {
  float sunAmt = pow(max(dot(dir, uHazeSun), 0.0), 5.0);
  return mix(uHazeColor, uSunHazeColor, sunAmt);
}
vec3 applyHaze(vec3 color, vec3 viewVec) {
  float dist = length(viewVec);
  vec3 dir = (vec4(viewVec, 0.0) * viewMatrix).xyz / max(dist, 1e-3);
  return mix(color, hazeColor(dir), hazeAmount(dir, dist));
}
`;

type Patchable = THREE.MeshStandardMaterial | THREE.MeshLambertMaterial | THREE.MeshPhysicalMaterial;

/**
 * Swaps three's flat fog for the aerial perspective above. Stacks on any
 * onBeforeCompile already set. Materials patched this way ignore the
 * scene fog, which only stays for the cars and crowd, all near the camera.
 */
export function withHaze<T extends Patchable>(material: T): T {
  const before = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    before(shader, renderer);
    Object.assign(shader.uniforms, hazeUniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${HAZE_GLSL}`)
      // Haze goes on in linear light before tone mapping, like the sky's own, so the two match at the horizon.
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.rgb = applyHaze( gl_FragColor.rgb, -vViewPosition );')
      .replace('#include <fog_fragment>', '');
  };
  material.customProgramCacheKey = () => `${key()}|haze`;
  return material;
}
