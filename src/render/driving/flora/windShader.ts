import * as THREE from 'three';

/** The breeze blows from the south west, across most tracks' main straight. */
export const WIND_DIR = new THREE.Vector2(0.8, 0.6);

/**
 * Bends each instance with the wind in the vertex shader. Sway grows with
 * the square of height, so trunks stay planted and crowns move; gusts roll
 * across the landscape as a wave in world space, so neighboring trees lean
 * together a moment apart instead of in lockstep. A faster, smaller flutter
 * rides on top for the needles and leaves. Works on `transformed`, before
 * any billboard offset, so a foliage card sways with the point it hangs on.
 */
export const WIND_GLSL = /* glsl */ `
#ifdef USE_INSTANCING
  vec3 windRoot = instanceMatrix[3].xyz;
  vec3 windLocal = (vec4(uWindDir.x, 0.0, uWindDir.y, 0.0) * instanceMatrix).xyz;
  windLocal = normalize(windLocal + vec3(1e-5));
#else
  vec3 windRoot = vec3(0.0);
  vec3 windLocal = vec3(uWindDir.x, 0.0, uWindDir.y);
#endif
float windH = max(transformed.y, 0.0) / uWindHeight;
float wave = dot(windRoot.xz, uWindDir) * 0.035 - uTime * 1.1;
float gust = 0.55 + 0.45 * sin(wave) + 0.2 * sin(wave * 2.3 + windRoot.x * 0.1);
transformed += windLocal * windH * windH * gust * uWindBend;
transformed.xz += sin(uTime * 5.3 + transformed.y * 2.7 + windRoot.x) * 0.035 * windH;
`;

export const WIND_PARS = 'uniform float uTime;\nuniform vec2 uWindDir;\nuniform float uWindHeight;\nuniform float uWindBend;';

/** Shared wind uniforms for a plant `height` m tall at scale 1 whose top sways `bend` m. */
export function windUniforms(time: { value: number }, height: number, bend: number): Record<string, { value: unknown }> {
  return { uTime: time, uWindDir: { value: WIND_DIR }, uWindHeight: { value: height }, uWindBend: { value: bend } };
}
