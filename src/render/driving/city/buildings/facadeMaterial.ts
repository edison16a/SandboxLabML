import * as THREE from 'three';
import { TIERS, type DrivingTier } from '../../quality';
import { NOISE_GLSL } from '../../shaders/noise';
import { withHaze } from '../../world/atmosphere';
import { FACADE_GLSL } from './facadeGlsl';

/**
 * The one material every building shares: a standard PBR material whose
 * albedo, roughness, metalness and emission come from the facade shader
 * per pixel. Glass gets its reflections from the scene's environment map,
 * so towers mirror the sky; lit rooms add a warm glow. The haze patch
 * fades far towers into the horizon.
 */
export function createFacadeMaterial(tier: DrivingTier): THREE.MeshStandardMaterial {
  const m = withHaze(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, metalness: 0, envMapIntensity: 1 }));
  const detail = TIERS[tier].facadeDetail;
  const before = m.onBeforeCompile.bind(m);
  m.onBeforeCompile = (shader, renderer) => {
    before(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aFacade;\nattribute float aTop;\nflat varying vec4 vFacade;\nvarying vec2 vFacadeUv;\nflat varying float vTop;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvFacade = aFacade;\nvFacadeUv = uv;\nvTop = aTop;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nflat varying vec4 vFacade;\nvarying vec2 vFacadeUv;\nflat varying float vTop;\n${NOISE_GLSL}\n${FACADE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\nFacade fac = facadeAt(vFacadeUv, fwidth(vFacadeUv), vFacade, vTop, ${detail.toFixed(1)});\ndiffuseColor.rgb = fac.albedo;`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = fac.rough;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = fac.metal;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += fac.emit;');
  };
  const key = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${key()}|facade-${detail}`;
  return m;
}
