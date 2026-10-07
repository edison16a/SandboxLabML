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

/** World position of the vertex after the sway, for the grain below. */
const WORLD = [
  '#ifdef USE_INSTANCING',
  '  vLeaf = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;',
  '#else',
  '  vLeaf = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;',
  '#endif',
].join('\n');

/**
 * Clumps of needles and leaves: the color breaks up in world space into
 * darker gaps and sunlit tufts, so a crown reads as foliage rather than a
 * smooth painted shape. Fades out with distance, where it would only shimmer.
 */
const GRAIN = [
  '#include <color_fragment>',
  'vec4 leafA = texture2D( uGrain, ( vLeaf.xz + vLeaf.y * 0.7 ) * 0.9 );',
  'vec4 leafB = texture2D( uGrain, vec2( vLeaf.x - vLeaf.z, vLeaf.y ) * 0.45 + 0.3 );',
  'float leafFade = 1.0 - smoothstep( 40.0, 160.0, length( vViewPosition ) );',
  'diffuseColor.rgb *= 1.0 + ( ( leafA.r - 0.5 ) * 0.55 + ( leafB.g - 0.5 ) * 0.35 ) * leafFade;',
].join('\n');

/**
 * Foliage material: vertex colored, rough, with the wind patch and the
 * world's haze. `height` is the plant's height at scale 1 and `bend` the
 * sway at its top in meters. With a `grain` noise texture the foliage gets
 * clumpy world space detail up close.
 */
export function createWindMaterial(height: number, bend: number, grain: THREE.Texture | null = null): WindMaterial {
  const time = { value: 0 };
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, envMapIntensity: 0.8 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.uniforms.uWindDir = { value: WIND_DIR };
    shader.uniforms.uWindHeight = { value: height };
    shader.uniforms.uWindBend = { value: bend };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec2 uWindDir;\nuniform float uWindHeight;\nuniform float uWindBend;\nvarying vec3 vLeaf;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${WIND}\n${WORLD}`);
    if (!grain) return;
    shader.uniforms.uGrain = { value: grain };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uGrain;\nvarying vec3 vLeaf;')
      .replace('#include <color_fragment>', GRAIN);
  };
  m.customProgramCacheKey = () => `wind-${grain ? 'grain' : 'plain'}`;
  return { material: withHaze(m), time };
}
