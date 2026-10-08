import * as THREE from 'three';
import { withHaze } from '../world/atmosphere';

/** Flag size, m. */
export const FLAG = { w: 2.4, h: 1.5 };

/** The lab's colors plus white and navy, cycled along each roof. */
export const FLAG_COLORS = ['#2f6fd0', '#ff9f43', '#f2f2ef', '#0f1a2c', '#2f6fd0'];

/** The breeze's heading: every flag streams the same way, downwind, like real ones do. */
export const FLAG_YAW = -Math.atan2(0.6, 0.8);

/** A flag cloth hanging from its pole edge at x = 0, finely divided so it can ripple. */
export function flagGeometry(): THREE.BufferGeometry {
  return new THREE.PlaneGeometry(FLAG.w, FLAG.h, 12, 4).translate(FLAG.w / 2, -FLAG.h / 2, 0);
}

/**
 * Flag cloth that ripples in the vertex shader: waves run from the pole to
 * the free edge and grow along it, with a little lift and flutter. Each
 * flag's phase comes from its position, so no two wave in step.
 */
export function createFlagMaterial(): { material: THREE.MeshLambertMaterial; time: { value: number } } {
  const time = { value: 0 };
  const m = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      // Normals first (three computes them before positions): the wave's slope bends each one so the cloth shades.
      .replace(
        '#include <beginnormal_vertex>',
        [
          '#include <beginnormal_vertex>',
          `float fAlong = clamp( position.x / ${FLAG.w.toFixed(2)}, 0.0, 1.0 );`,
          'vec3 fRoot = instanceMatrix[3].xyz;',
          'float fW = uTime * 6.0 + fRoot.x * 0.37 + fRoot.z * 0.23;',
          'objectNormal = normalize( objectNormal + vec3( -cos( position.x * 2.4 - fW ) * 0.53 * fAlong, 0.0, 0.0 ) );',
        ].join('\n'),
      )
      .replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          'transformed.z += ( sin( position.x * 2.4 - fW ) * 0.22 + sin( position.x * 5.1 - fW * 1.7 ) * 0.05 ) * fAlong;',
          'transformed.y += sin( position.x * 1.6 - fW * 0.7 ) * 0.07 * fAlong;',
        ].join('\n'),
      );
  };
  m.customProgramCacheKey = () => 'racing-flag';
  return { material: withHaze(m), time };
}
