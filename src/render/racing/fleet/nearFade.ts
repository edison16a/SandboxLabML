import type * as THREE from 'three';

/**
 * Dissolves instanced cars that come close to the camera, in a fine
 * ordered dither, so a pack of cars between the chase camera and the car
 * it follows never fills the screen. The cars stay opaque (no sorting, no
 * blending cost); pixels simply drop out in a pattern as a car gets close.
 * `strength` is 0 to switch it off (orbit and free cameras want to get close).
 */
export function withNearFade<T extends THREE.Material>(material: T, strength: { value: number }): T {
  const before = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    before(shader, renderer);
    shader.uniforms.uNearFade = strength;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vCarNear;')
      .replace(
        '#include <project_vertex>',
        ['#include <project_vertex>', '#ifdef USE_INSTANCING', '  vCarNear = length( ( modelViewMatrix * instanceMatrix * vec4( 0.0, 0.6, 0.0, 1.0 ) ).xyz );', '#else', '  vCarNear = 100.0;', '#endif'].join('\n'),
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNearFade;\nvarying float vCarNear;')
      .replace(
        '#include <clipping_planes_fragment>',
        [
          '#include <clipping_planes_fragment>',
          'if ( uNearFade > 0.0 ) {',
          // A 4 by 4 Bayer threshold from two levels of the 2 by 2 pattern (0 2 / 3 1).
          '  vec2 cell = mod( floor( gl_FragCoord.xy ), 4.0 );',
          '  vec2 lo = mod( cell, 2.0 );',
          '  vec2 hi = floor( cell * 0.5 );',
          '  float bayer = ( 4.0 * mod( 2.0 * lo.x + 3.0 * lo.y, 4.0 ) + mod( 2.0 * hi.x + 3.0 * hi.y, 4.0 ) + 0.5 ) / 16.0;',
          '  float keep = mix( 1.0, smoothstep( 3.5, 8.5, vCarNear ), uNearFade );',
          '  if ( bayer > keep ) discard;',
          '}',
        ].join('\n'),
      );
  };
  material.customProgramCacheKey = () => `${key()}|near-fade`;
  return material;
}
