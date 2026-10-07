import * as THREE from 'three';

/** Uniforms the fade reads: on or off, and where the followed car is. */
export interface NearFade {
  strength: { value: number };
  focus: { value: THREE.Vector3 };
}

export function nearFade(): NearFade {
  return { strength: { value: 0 }, focus: { value: new THREE.Vector3(0, -1000, 0) } };
}

const VERTEX = [
  '#include <project_vertex>',
  '#ifdef USE_INSTANCING',
  '  vec4 carCenter = modelMatrix * instanceMatrix * vec4( 0.0, 0.6, 0.0, 1.0 );',
  '  vec3 toCar = carCenter.xyz - cameraPosition;',
  '  vec3 toFocus = uFadeFocus + vec3( 0.0, 0.6, 0.0 ) - cameraPosition;',
  '  float focusDist = max( length( toFocus ), 1e-3 );',
  '  float along = dot( toCar, toFocus ) / focusDist;',
  '  vCarNear = length( toCar );',
  // Only cars between the lens and the followed car can hide it; ones beyond it stay solid.
  '  float nearer = step( along, focusDist - 1.2 ) * step( 0.0, along );',
  '  vCarSight = mix( 100.0, length( toCar - toFocus * ( along / focusDist ) ), nearer );',
  '  vCarFocus = mix( 100.0, distance( carCenter.xz, uFadeFocus.xz ), step( along, focusDist + 0.5 ) );',
  '#else',
  '  vCarNear = 100.0;',
  '  vCarSight = 100.0;',
  '  vCarFocus = 100.0;',
  '#endif',
].join('\n');

const FRAGMENT = [
  '#include <clipping_planes_fragment>',
  'if ( uNearFade > 0.0 ) {',
  // A 4 by 4 Bayer threshold, from two levels of the 2 by 2 pattern (0 2 / 3 1).
  '  vec2 cell = mod( floor( gl_FragCoord.xy ), 4.0 );',
  '  vec2 lo = mod( cell, 2.0 );',
  '  vec2 hi = floor( cell * 0.5 );',
  '  float bayer = ( 4.0 * mod( 2.0 * lo.x + 3.0 * lo.y, 4.0 ) + mod( 2.0 * hi.x + 3.0 * hi.y, 4.0 ) + 0.5 ) / 16.0;',
  // Gone at the lens, across the line of sight to the followed car, and where clones sit on top of it.
  // Narrow bands: a car only shows the dither for the moment it takes to cross one.
  '  float keep = min( min( smoothstep( 5.6, 6.4, vCarNear ), smoothstep( 2.3, 2.7, vCarSight ) ), smoothstep( 3.0, 3.6, vCarFocus ) );',
  '  if ( bayer > mix( 1.0, keep, uNearFade ) ) discard;',
  '}',
].join('\n');

/**
 * Dissolves instanced cars that would get in the way of the followed car,
 * in a fine ordered dither: cars right at the lens, cars across the line of
 * sight between the camera and the followed car, and clones driving on top
 * of it (late in training a whole generation takes the same line). The cars stay opaque, so there is no sorting or
 * blending cost; pixels simply drop out in a pattern. Strength 0 turns it
 * off for cameras that want the whole pack, like orbit.
 */
export function withNearFade<T extends THREE.Material>(material: T, fade: NearFade): T {
  const before = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    before(shader, renderer);
    shader.uniforms.uNearFade = fade.strength;
    shader.uniforms.uFadeFocus = fade.focus;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uFadeFocus;\nvarying float vCarNear;\nvarying float vCarSight;\nvarying float vCarFocus;')
      .replace('#include <project_vertex>', VERTEX);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNearFade;\nvarying float vCarNear;\nvarying float vCarSight;\nvarying float vCarFocus;')
      .replace('#include <clipping_planes_fragment>', FRAGMENT);
  };
  material.customProgramCacheKey = () => `${key()}|near-fade`;
  return material;
}
