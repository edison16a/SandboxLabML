import * as THREE from 'three';
import { tintMaskMaterial } from '../shared/tintMask';

/**
 * Which limb a vertex of the baked crowd character belongs to: 1 the left
 * leg, -1 the right, 2 the left arm, -2 the right, 0 the trunk and head.
 */
export const LIMB = { leftLeg: 1, rightLeg: -1, leftArm: 2, rightArm: -2, none: 0 } as const;

/**
 * Swings each limb of an instanced crowd character about its hip or
 * shoulder in the vertex shader, from a per instance phase and amplitude
 * (aGait), so a hundred grid characters walk with their legs and arms for
 * the price of one sine each. Arms swing against the leg on their side.
 * The mesh carries aLimb (see LIMB) and aPivot, the height its limb turns
 * about.
 */
const GAIT_VERTEX = /* glsl */ `
if (aLimb != 0.0) {
  float side = aLimb > 0.0 ? 0.0 : 3.14159265;
  float arm = abs(aLimb) > 1.5 ? -0.75 : 1.0;
  float swing = aGait.y * arm * sin(aGait.x + side);
  float c = cos(swing);
  float s = sin(swing);
  vec2 p = vec2(transformed.x, transformed.y - aPivot);
  transformed.xy = vec2(p.x * c - p.y * s, p.x * s + p.y * c + aPivot);
}
`;

/** tintMaskMaterial (team color on the body, the face's own colors) with the limb swing added. */
export function crowdGaitMaterial(params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  const m = tintMaskMaterial(params);
  const tint = m.onBeforeCompile.bind(m);
  m.onBeforeCompile = (shader, renderer) => {
    tint(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aLimb;\nattribute float aPivot;\nattribute vec2 aGait;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${GAIT_VERTEX}`);
  };
  m.customProgramCacheKey = () => 'hs-crowd-gait';
  return m;
}

/** A per instance (phase, amplitude) attribute for `count` instances, rewritten every frame. */
export function gaitAttribute(count: number): THREE.InstancedBufferAttribute {
  return new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2).setUsage(THREE.DynamicDrawUsage);
}
