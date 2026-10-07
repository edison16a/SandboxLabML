import * as THREE from 'three';
import { withHaze } from '../atmosphere';

/** The breeze blows from the south west, across most tracks' main straight. */
const WIND_DIR = new THREE.Vector2(0.8, 0.6);

/**
 * Bends each instance with the wind in the vertex shader. Sway grows with
 * the square of height, so trunks stay planted and crowns move; gusts roll
 * across the landscape as a wave in world space, so neighboring trees lean
 * together a moment apart instead of in lockstep. A faster, smaller flutter
 * rides on top for the needles and leaves.
 */
const WIND = /* glsl */ `
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

export interface WindMaterial {
  material: THREE.MeshStandardMaterial;
  /** Seconds, advanced by the scene every frame. */
  time: { value: number };
}

/**
 * Foliage material: vertex colored, rough, with the wind patch and the
 * world's haze. `height` is the plant's height at scale 1 and `bend` the
 * sway at its top in meters.
 */
export function createWindMaterial(height: number, bend: number, flat = false): WindMaterial {
  const time = { value: 0 };
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, flatShading: flat, envMapIntensity: 0.8 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.uniforms.uWindDir = { value: WIND_DIR };
    shader.uniforms.uWindHeight = { value: height };
    shader.uniforms.uWindBend = { value: bend };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec2 uWindDir;\nuniform float uWindHeight;\nuniform float uWindBend;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${WIND}`);
  };
  m.customProgramCacheKey = () => `wind-${flat}`;
  return { material: withHaze(m), time };
}
