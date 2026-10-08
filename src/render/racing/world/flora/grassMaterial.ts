import * as THREE from 'three';
import { withHaze } from '../atmosphere';
import { WIND_GLSL, WIND_PARS, windUniforms } from './windShader';

/**
 * Grass sinks into the ground with distance from the camera: whole clumps
 * shrink to nothing between `uFadeNear` and `uFadeFar`, so the verge is
 * thick around the car and there is no shimmer of tiny cards far away.
 */
const FADE = /* glsl */ `
#ifdef USE_INSTANCING
  float grassDist = distance( ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz, cameraPosition );
#else
  float grassDist = distance( ( modelMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz, cameraPosition );
#endif
transformed *= 1.0 - smoothstep( uFadeNear, uFadeFar, grassDist );
`;

export interface GrassMaterial {
  material: THREE.MeshStandardMaterial;
  time: { value: number };
}

/**
 * Dry grass cards: the clump texture cut out by its alpha, both faces lit
 * by the same upward normal as the ground under them (a card seen from
 * behind does not go dark), swaying in the breeze and fading with
 * distance. `fade` is where clumps start and finish shrinking, m.
 */
export function createGrassMaterial(map: THREE.Texture, fade: [number, number], coverage = false): GrassMaterial {
  const time = { value: 0 };
  const uniforms = { ...windUniforms(time, 0.6, 0.08), uFadeNear: { value: fade[0] }, uFadeFar: { value: fade[1] } };
  const m = new THREE.MeshStandardMaterial({ map, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, metalness: 0, envMapIntensity: 0.7, alphaToCoverage: coverage });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${WIND_PARS}\nuniform float uFadeNear;\nuniform float uFadeFar;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${FADE}\n${WIND_GLSL}`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize( vNormal );\nnonPerturbedNormal = normal;');
  };
  m.customProgramCacheKey = () => `grass-${coverage ? 'a2c' : 'cut'}`;
  return { material: withHaze(m), time };
}
