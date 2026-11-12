import * as THREE from 'three';

/**
 * A plain standard material that darkens toward the floor, like the soft
 * occlusion where a wall or a block meets the ground. It works from the
 * world height of each fragment, so a 2.5 m wall and a 12 m tower get the
 * same band at their foot, and it works on instanced meshes. `foot` is the
 * brightness right at the floor and `reach` how high the shade climbs, m.
 */
export function groundedMaterial(params: THREE.MeshStandardMaterialParameters, foot = 0.72, reach = 0.9): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vGroundY;').replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      {
        vec4 w = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          w = instanceMatrix * w;
        #endif
        vGroundY = (modelMatrix * w).y;
      }`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGroundY;')
      .replace('#include <map_fragment>', `#include <map_fragment>\ndiffuseColor.rgb *= mix(${foot.toFixed(3)}, 1.0, smoothstep(0.0, ${reach.toFixed(3)}, vGroundY));`);
  };
  m.customProgramCacheKey = () => `hs-grounded-${foot}-${reach}`;
  return m;
}
