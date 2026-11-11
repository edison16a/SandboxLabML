import * as THREE from 'three';
import { detailTier, type DrivingTier } from '../../quality';
import { NOISE_GLSL } from '../../shaders/noise';
import { ASPHALT_TILE, asphaltMaps, PAVING_TILE, pavingMaps } from '../../textures/groundTextures';
import { withHaze } from '../../world/atmosphere';

/** Adds a world space varying for shaders that need the ground position (macro variation, wear). */
function withWorldPos(material: THREE.Material, key: string, fragment: (shader: THREE.WebGLProgramParametersWithUniforms) => void): void {
  const before = material.onBeforeCompile.bind(material);
  const cache = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    before(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCityWorld;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvCityWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vCityWorld;\n${NOISE_GLSL}`);
    fragment(shader);
  };
  material.customProgramCacheKey = () => `${cache()}|${key}`;
}

const repeat = <T extends THREE.Texture>(t: T, meters: number): T => {
  t.repeat.set(1 / meters, 1 / meters);
  return t;
};

export interface GroundMaterials {
  asphalt: THREE.MeshStandardMaterial;
  walk: THREE.MeshStandardMaterial;
  curb: THREE.MeshStandardMaterial;
  paint: THREE.MeshStandardMaterial;
  wear: THREE.MeshBasicMaterial;
  dispose(): void;
}

/**
 * The street surfaces. Asphalt and paving use computed textures, broken up
 * by large scale world noise so no tile ever repeats visibly; paint wears
 * at its edges and thins in patches; tire tracks darken and polish the
 * middle of each lane. Low skips the normal maps.
 */
export function createGroundMaterials(tier: DrivingTier): GroundMaterials {
  const d = detailTier(tier);
  const size = d === 'high' ? 1024 : 512;
  const textures: THREE.Texture[] = [];
  const keep = <T extends THREE.Texture>(t: T) => (textures.push(t), t);
  const a = asphaltMaps(size);
  const asphalt = withHaze(new THREE.MeshStandardMaterial({ map: keep(repeat(a.map, ASPHALT_TILE)), roughnessMap: keep(repeat(a.rough, ASPHALT_TILE)), roughness: 1, metalness: 0, envMapIntensity: 0.32 }));
  if (d !== 'low') {
    asphalt.normalMap = keep(repeat(a.normal, ASPHALT_TILE));
    asphalt.normalScale.set(0.7, 0.7);
  } else keep(a.normal).dispose();
  withWorldPos(asphalt, 'asphalt-macro', (shader) => {
    // Big soft patches of older and newer surface, and a slight sheen variation, so the road never tiles.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      float patchy = cityFbm(vCityWorld.xz * 0.045);
      float fine = cityNoise(vCityWorld.xz * 0.6);
      diffuseColor.rgb *= mix(0.82, 1.12, smoothstep(0.25, 0.75, patchy)) * mix(0.96, 1.03, fine);`,
    );
  });
  const p = pavingMaps(d === 'low' ? 512 : 1024);
  const walk = withHaze(new THREE.MeshStandardMaterial({ map: keep(repeat(p.map, PAVING_TILE)), roughness: 0.86, metalness: 0, envMapIntensity: 0.38 }));
  if (d !== 'low') {
    walk.normalMap = keep(repeat(p.normal, PAVING_TILE));
    walk.normalScale.set(0.8, 0.8);
  } else keep(p.normal).dispose();
  withWorldPos(walk, 'walk-macro', (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      diffuseColor.rgb *= mix(0.88, 1.06, cityFbm(vCityWorld.xz * 0.08));`,
    );
  });
  const curb = withHaze(new THREE.MeshStandardMaterial({ color: '#b9b6ae', roughness: 0.78, metalness: 0, envMapIntensity: 0.55 }));
  withWorldPos(curb, 'curb-grain', (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      diffuseColor.rgb *= mix(0.84, 1.04, cityNoise(vCityWorld.xz * 2.3 + vCityWorld.y * 7.0)) * mix(0.9, 1.0, cityFbm(vCityWorld.xz * 0.15));`,
    );
  });
  const paint = withHaze(new THREE.MeshStandardMaterial({ color: '#ecebe4', roughness: 0.62, metalness: 0, envMapIntensity: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  withWorldPos(paint, 'paint-wear', (shader) => {
    // Worn paint: patches where the asphalt shows through, thickest wear at the edges of each mark.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      float wearN = cityFbm(vCityWorld.xz * 1.7);
      float worn = smoothstep(0.38, 0.62, wearN);
      diffuseColor.rgb = mix(vec3(0.19, 0.19, 0.2), diffuseColor.rgb, 0.55 + 0.45 * worn);`,
    );
  });
  const wear = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.16, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  withWorldPos(wear, 'tire-wear', (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWearUv;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvWearUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWearUv;')
      .replace('#include <opaque_fragment>', `float across = sin(vWearUv.y * 3.14159);\ndiffuseColor.a *= across * across * (0.5 + 0.7 * cityFbm(vCityWorld.xz * 0.12));\n#include <opaque_fragment>`);
  });
  return {
    asphalt,
    walk,
    curb,
    paint,
    wear,
    dispose: () => {
      [asphalt, walk, curb, paint, wear].forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
