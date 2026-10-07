import * as THREE from 'three';
import { withHaze } from '../world/atmosphere';

/**
 * Asphalt, worked out per pixel: fine aggregate with pale stones, patches
 * of newer and older tarmac, sealed cracks, dust along the edges, and the
 * dark rubbered racing line with the twin streaks of the tires. Rubber is
 * a touch glossier, so it catches the low sun. Everything is sampled in
 * world meters, so the grain never stretches round a bend.
 */
const ASPHALT = /* glsl */ `
vec4 asphalt(vec2 uv, vec3 wp, vec2 line, float dist) {
  vec4 fine = texture2D(uDetail, wp.xz * 0.9);
  vec4 grit = texture2D(uDetail, wp.xz * 3.7 + 0.5);
  vec4 blot = texture2D(uDetail, wp.xz * 0.045);
  float near = 1.0 - smoothstep(25.0, 140.0, dist);
  vec3 c = vec3(0.15, 0.152, 0.158);
  c *= 0.86 + blot.g * 0.3;
  c *= 1.0 + ((fine.r - 0.5) * 0.28 + (grit.r - 0.5) * 0.3) * near;
  // Pale aggregate stones catching the light.
  c += vec3(0.07) * smoothstep(0.82, 0.95, grit.r) * near;
  // A few sealed cracks: faint thin lines where the blotch noise crosses its middle.
  c *= 1.0 - 0.18 * smoothstep(0.006, 0.0, abs(blot.b - 0.5)) * near;
  // Dust and grit swept to the edges, where nobody drives.
  float edge = min(uv.x, 1.0 - uv.x);
  c = mix(c, vec3(0.2, 0.19, 0.175), (1.0 - smoothstep(0.0, 0.09, edge)) * 0.55);
  // Rubber: a band the width of a car round the line, darkest in the two tire tracks.
  float off = abs(uv.x - line.x) * uRoadWidth;
  float band = 1.0 - smoothstep(0.6, 1.7, off);
  float tracks = exp(-pow((off - 0.78) / 0.32, 2.0));
  float streak = texture2D(uDetail, vec2(uv.x * uRoadWidth * 0.6, uv.y * 0.05)).b;
  float rubber = line.y * clamp(band * 0.55 + tracks * 0.6 * (0.6 + streak * 0.8), 0.0, 1.0);
  c = mix(c, vec3(0.05, 0.05, 0.055), rubber * 0.8);
  float rough = mix(0.9, 0.62, rubber) - smoothstep(0.82, 0.95, grit.r) * 0.25 * near;
  return vec4(c, rough);
}
`;

/** Patches a standard material with a world position and the road's uv for the shaders above. */
function roadVaryings(shader: THREE.WebGLProgramParametersWithUniforms, extra: string, assign: string): void {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\nvarying vec3 vRoadWorld;\nvarying vec2 vRoadUv;\n${extra}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\nvRoadWorld = transformed;\nvRoadUv = uv;\n${assign}`);
}

export function createAsphaltMaterial(noise: THREE.Texture, roadWidth: number): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, envMapIntensity: 0.7 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uDetail = { value: noise };
    shader.uniforms.uRoadWidth = { value: roadWidth };
    roadVaryings(shader, 'attribute vec2 line;\nvarying vec2 vLine;', 'vLine = line;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform sampler2D uDetail;\nuniform float uRoadWidth;\nvarying vec3 vRoadWorld;\nvarying vec2 vRoadUv;\nvarying vec2 vLine;\n${ASPHALT}`)
      .replace('#include <map_fragment>', 'vec4 road = asphalt( vRoadUv, vRoadWorld, vLine, length( vViewPosition ) );\ndiffuseColor.rgb = road.rgb;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = road.a;');
  };
  m.customProgramCacheKey = () => 'racing-asphalt';
  return withHaze(m);
}

/**
 * Run-off: a gravel trap of pale pebbles where the road bends, blending to
 * mown grass along the straights. The `corner` attribute picks between them.
 */
export function createRunoffMaterial(noise: THREE.Texture): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, envMapIntensity: 0.7 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uDetail = { value: noise };
    roadVaryings(shader, 'attribute float corner;\nvarying float vCorner;', 'vCorner = corner;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;\nvarying vec3 vRoadWorld;\nvarying vec2 vRoadUv;\nvarying float vCorner;')
      .replace(
        '#include <map_fragment>',
        [
          'vec4 pebble = texture2D( uDetail, vRoadWorld.xz * 4.1 );',
          'vec4 clump = texture2D( uDetail, vRoadWorld.xz * 0.35 );',
          'vec3 gravel = vec3( 0.52, 0.44, 0.33 ) * ( 0.7 + pebble.r * 0.55 ) * ( 0.9 + clump.g * 0.2 );',
          'vec3 grass = vec3( 0.2, 0.25, 0.09 ) * ( 0.8 + clump.r * 0.35 + pebble.g * 0.15 );',
          'diffuseColor.rgb = mix( grass, gravel, smoothstep( 0.2, 0.6, vCorner + ( clump.g - 0.5 ) * 0.3 ) );',
        ].join('\n'),
      );
  };
  m.customProgramCacheKey = () => 'racing-runoff';
  return withHaze(m);
}

/** White line paint: slightly worn, so the road shows through in places. */
export function createPaintMaterial(noise: THREE.Texture, color = '#e9e8e2'): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uDetail = { value: noise };
    roadVaryings(shader, '', '');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;\nvarying vec3 vRoadWorld;\nvarying vec2 vRoadUv;')
      .replace('#include <map_fragment>', 'vec4 wear = texture2D( uDetail, vRoadWorld.xz * 1.7 );\ndiffuseColor.rgb *= mix( 0.42, 1.0, smoothstep( 0.18, 0.4, wear.r * 0.6 + wear.g * 0.5 ) );');
  };
  m.customProgramCacheKey = () => 'racing-paint';
  return withHaze(m);
}
