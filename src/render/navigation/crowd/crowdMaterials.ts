import * as THREE from 'three';
import { crowdGaitMaterial } from '@/render/hideseek/grid/crowdGait';

/** The crowd's material settings: the glossy gummy body of the grid characters. */
const BODY: THREE.MeshStandardMaterialParameters = { roughness: 0.28, metalness: 0, envMapIntensity: 1.1 };

/** The solid crowd: Hide and Seek's walking crowd material, as is. */
export function crowdSolidMaterial(): THREE.MeshStandardMaterial {
  return crowdGaitMaterial(BODY);
}

/**
 * The same material for characters fading out (fallen, finished, out of
 * time) or melted back near the champion: a per instance opacity (aFade)
 * on top of the walk. Drawn in its own small pass after the solid crowd,
 * so only the few fading characters pay for transparency. It writes depth,
 * so each body's own parts (eyes, hands, feet) do not show through each
 * other, but it draws last of all (see CrowdAgents), so that depth can
 * never hide the champion's face, its sensors or its rings, nor set off
 * its x-ray outline.
 */
export function crowdFadeMaterial(): THREE.MeshStandardMaterial {
  const m = crowdGaitMaterial({ ...BODY, transparent: true, depthWrite: true });
  const gait = m.onBeforeCompile.bind(m);
  m.onBeforeCompile = (shader, renderer) => {
    gait(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aFade;\nvarying float vFade;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFade = aFade;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFade;')
      .replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\ndiffuseColor.a *= vFade;');
  };
  m.customProgramCacheKey = () => 'nav-crowd-fade';
  return m;
}

/**
 * What the fading crowd casts into the sun's shadow map: the body shrunk
 * toward its feet with its opacity, so a fading character's shadow dwindles
 * with it instead of vanishing the moment it starts to fade. Shrinking
 * keeps the shadow's edge as clean as any other; a dithered alpha test
 * would speckle the floor under a see-through body.
 */
export function crowdFadeShadowMaterial(): THREE.MeshDepthMaterial {
  const m = new THREE.MeshDepthMaterial();
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aFade;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed *= smoothstep(0.05, 0.75, aFade);');
  };
  m.customProgramCacheKey = () => 'nav-crowd-fade-shadow';
  return m;
}

/** A per instance float attribute for `count` instances, rewritten every frame. */
export function instanceFloats(count: number, size = 1): THREE.InstancedBufferAttribute {
  return new THREE.InstancedBufferAttribute(new Float32Array(count * size), size).setUsage(THREE.DynamicDrawUsage);
}
