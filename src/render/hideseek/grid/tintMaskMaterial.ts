import * as THREE from 'three';

/**
 * Sets a per vertex tint mask on a geometry: 1 where the instance color
 * should tint it, 0 where its own vertex color stays as it is.
 */
export function setTintMask(g: THREE.BufferGeometry, mask: number): THREE.BufferGeometry {
  g.setAttribute('aTint', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(mask), 1));
  return g;
}

/**
 * A standard material for instanced meshes whose instance color should
 * only tint part of each mesh: a character's body but not its face, a
 * crate's braces but not its gold panels. The mesh carries its own colors
 * as vertex colors, and the aTint attribute picks where the instance color
 * applies. One draw call still covers every instance.
 */
export function tintMaskMaterial(params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ ...params, vertexColors: true });
  m.onBeforeCompile = (shader) => {
    // Stands in for three's color_vertex chunk; vertex colors are always on for this material.
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float aTint;').replace(
      '#include <color_vertex>',
      `vColor = vec4(1.0);
      vColor.rgb *= color;
      #ifdef USE_INSTANCING_COLOR
        vColor.rgb *= mix(vec3(1.0), instanceColor.rgb, aTint);
      #endif`,
    );
  };
  m.customProgramCacheKey = () => 'hs-tint-mask';
  return m;
}
