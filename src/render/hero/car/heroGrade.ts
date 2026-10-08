import * as THREE from 'three';
import { GRADE } from '@/render/racing/post/raceEffects';

/** GLSL float literal, so a whole number still compiles as a float. */
const f = (v: number) => v.toFixed(4);

/**
 * The lab's High look for the hero's racing pane, which has no effect
 * composer: ACES, then the same warmth, saturation and soft contrast curve
 * as the lab's grade pass. It runs per pixel as each surface writes its
 * color, so it costs no extra pass and no render target, and it matches
 * the pass on everything opaque.
 */
const CURVE = /* glsl */ `
vec3 CustomToneMapping( vec3 color ) {
  vec3 c = ACESFilmicToneMapping( color ) * vec3( ${GRADE.warmth.map(f).join(', ')} );
  float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
  c = mix( vec3( l ), c, ${f(GRADE.saturation)} );
  c = clamp( c, 0.0, 1.0 );
  return mix( c, c * c * ( 3.0 - 2.0 * c ), ${f(GRADE.contrast)} );
}`;

const STOCK = 'vec3 CustomToneMapping( vec3 color ) { return color; }';

/**
 * Installs the graded curve as three's custom tone mapping, once. Only
 * materials drawn with CustomToneMapping use it, which on this site is the
 * hero's racing pane alone, so every other scene keeps its own curve.
 */
export function installHeroGrade(): void {
  const chunk = THREE.ShaderChunk.tonemapping_pars_fragment;
  if (chunk.includes(STOCK)) THREE.ShaderChunk.tonemapping_pars_fragment = chunk.replace(STOCK, CURVE);
}
