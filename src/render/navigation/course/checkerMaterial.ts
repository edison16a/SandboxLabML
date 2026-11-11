import * as THREE from 'three';
import { NAV_COLORS } from '../palette';

/**
 * A lit checkered material, the pattern made in the shader from the mesh's
 * own position, so it needs no texture and stays crisp up close. `coords`
 * is GLSL picking the two local axes the checks run along (from `p`, the
 * local position, and `n`, the local normal); faces where `onFace` is
 * false take the dark color plain. Checks are `cell` m square and box
 * filtered, so they fade to grey far away instead of shimmering.
 */
export function checkerMaterial(cell: number, coords: string, onFace: string, params: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.45, metalness: 0, envMapIntensity: 0.8, ...params });
  const dark = new THREE.Color(NAV_COLORS.checkerDark);
  const light = new THREE.Color(NAV_COLORS.checkerLight);
  const vec = (c: THREE.Color) => `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCheckP;\nvarying vec3 vCheckN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCheckP = position;\nvCheckN = normal;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vCheckP;\nvarying vec3 vCheckN;').replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      {
        vec3 p = vCheckP;
        vec3 n = vCheckN;
        vec2 q = (${coords}) / ${cell.toFixed(4)};
        vec2 w = max(fwidth(q), vec2(1e-4));
        // Box filtered checks: the integral of a square wave over the pixel footprint.
        vec2 i = 2.0 * (abs(fract((q - 0.5 * w) * 0.5) - 0.5) - abs(fract((q + 0.5 * w) * 0.5) - 0.5)) / w;
        float c = 0.5 - 0.5 * i.x * i.y;
        vec3 check = mix(${vec(dark)}, ${vec(light)}, c);
        diffuseColor.rgb *= (${onFace}) ? check : ${vec(dark)};
      }`,
    );
  };
  m.customProgramCacheKey = () => `nav-checker-${cell}-${coords}-${onFace}`;
  return m;
}
