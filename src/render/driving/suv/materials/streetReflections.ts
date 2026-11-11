import * as THREE from 'three';

/**
 * How much open sky a reflection sees. The city's environment map is the
 * sky alone, but a real street is lined with buildings: a reflection that
 * runs low toward the horizon would see facades, not bright haze. Without
 * this the hood and doors mirror a white horizon and the paint turns milky.
 */
const STREET_SKY = /* glsl */ `
float streetSky( const in vec3 r ) {
  return mix( 0.42, 1.0, smoothstep( 0.04, 0.62, r.y ) );
}
`;

/**
 * Dims a material's environment reflections where they would point into
 * the street canyon, so glossy paint and glass keep their color under an
 * open sky map. The sky overhead still reflects in full.
 */
export function withStreetReflections<T extends THREE.MeshStandardMaterial>(material: T): T {
  const before = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey.bind(material);
  const chunk = THREE.ShaderChunk.envmap_physical_pars_fragment.replace(
    'return envMapColor.rgb * envMapIntensity;',
    'return envMapColor.rgb * envMapIntensity * streetSky( reflectVec );',
  );
  material.onBeforeCompile = (shader, renderer) => {
    before(shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <envmap_physical_pars_fragment>', `${STREET_SKY}\n${chunk}`);
  };
  material.customProgramCacheKey = () => `${key()}|street-sky`;
  return material;
}
