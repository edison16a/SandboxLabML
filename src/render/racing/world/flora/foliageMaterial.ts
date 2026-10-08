import * as THREE from 'three';
import { ATMOSPHERE, SUN_DIR, withHaze } from '../atmosphere';
import { WIND_GLSL, WIND_PARS, windUniforms } from './windShader';

/**
 * Lays foliage cards out facing the camera. Each card's corners share one
 * pivot (after the wind has moved it); the `corner` attribute pushes each
 * corner out along the camera's right and up axes, scaled with the
 * instance. Solid parts have a zero corner and draw as ordinary geometry.
 * In a shadow pass the "camera" is the sun, so the cards turn to it and
 * cast full shapes. The world position, corner included, feeds shadows.
 */
const BILLBOARD = /* glsl */ `
vec4 foliageWorld = vec4( transformed, 1.0 );
float foliageScale = 1.0;
#ifdef USE_INSTANCING
  foliageWorld = instanceMatrix * foliageWorld;
  foliageScale = length( instanceMatrix[0].xyz );
#endif
foliageWorld = modelMatrix * foliageWorld;
vec3 camRight = vec3( viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0] );
vec3 camUp = vec3( viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1] );
foliageWorld.xyz += ( camRight * corner.x + camUp * corner.y ) * foliageScale;
vec4 mvPosition = viewMatrix * foliageWorld;
gl_Position = projectionMatrix * mvPosition;
`;

/**
 * Mipmaps average a card's alpha down, so with a fixed cut off distant
 * foliage thins to nothing. The cut off is eased by how far down the mip
 * chain the texture is read, which keeps far crowns full.
 */
const MIP_ALPHA = /* glsl */ `
#ifdef USE_MAP
  vec2 foliageTexel = vMapUv * vec2( textureSize( map, 0 ) );
  vec2 fdx = dFdx( foliageTexel );
  vec2 fdy = dFdy( foliageTexel );
  float foliageLod = 0.5 * log2( max( max( dot( fdx, fdx ), dot( fdy, fdy ) ), 1.0 ) );
  diffuseColor.a *= 1.0 + foliageLod * 0.3;
#endif
`;

/** Sunlight passing through leaves when the camera looks toward the sun, warmest on the thin outer cards. */
const THROUGH = /* glsl */ `
#include <emissivemap_fragment>
vec3 toFrag = normalize( vFoliageWorld - cameraPosition );
float through = pow( max( dot( toFrag, uSunDir ), 0.0 ), 4.0 ) * vFoliageCard;
totalEmissiveRadiance += diffuseColor.rgb * uSunColor * through * 0.55;
`;

export interface FoliageMaterial {
  material: THREE.MeshStandardMaterial;
  /** The shadow pass's material, with the same wind and cards so shadows sway with the trees. */
  depth: THREE.MeshDepthMaterial;
  /** Seconds, advanced by the scene every frame. */
  time: { value: number };
}

/** Adds the wind and the card layout to any material's vertex shader. */
function patchVertex(shader: THREE.WebGLProgramParametersWithUniforms, extra = ''): void {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${WIND_PARS}\nattribute vec2 corner;\n${extra}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n${WIND_GLSL}`)
    .replace('#include <project_vertex>', BILLBOARD)
    .replace('#include <worldpos_vertex>', 'vec4 worldPosition = foliageWorld;');
}

/**
 * The material every tree and shrub shares: the foliage atlas cut out by
 * its alpha, vertex shade times the instance tint, the wind, camera facing
 * cards, light through the leaves and the world's haze. `height` is the
 * plant's height at scale 1 and `bend` the sway at its top, m.
 */
export function createFoliageMaterial(atlas: THREE.Texture, height: number, bend: number, coverage = false): FoliageMaterial {
  const time = { value: 0 };
  const uniforms = windUniforms(time, height, bend);
  const m = new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, alphaTest: 0.42, roughness: 0.82, metalness: 0, envMapIntensity: 0.75, alphaToCoverage: coverage });
  m.shadowSide = THREE.DoubleSide;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, { uSunDir: { value: SUN_DIR }, uSunColor: { value: ATMOSPHERE.sun } });
    patchVertex(shader, 'varying vec3 vFoliageWorld;\nvarying float vFoliageCard;');
    shader.vertexShader = shader.vertexShader.replace('vec4 worldPosition = foliageWorld;', 'vec4 worldPosition = foliageWorld;\nvFoliageWorld = foliageWorld.xyz;\nvFoliageCard = step( 1e-4, dot( corner, corner ) );');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSunDir;\nuniform vec3 uSunColor;\nvarying vec3 vFoliageWorld;\nvarying float vFoliageCard;')
      .replace('#include <alphatest_fragment>', `${MIP_ALPHA}\n#include <alphatest_fragment>`)
      .replace('#include <emissivemap_fragment>', THROUGH);
  };
  m.customProgramCacheKey = () => `foliage-${coverage ? 'a2c' : 'cut'}`;
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: atlas, alphaTest: 0.42 });
  depth.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    patchVertex(shader);
  };
  depth.customProgramCacheKey = () => 'foliage-depth';
  return { material: withHaze(m), depth, time };
}
