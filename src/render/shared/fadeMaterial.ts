import * as THREE from 'three';

/**
 * Makes any lit material read a per-instance opacity attribute, so one
 * instanced draw call can show cars at different transparencies. three.js
 * has per-instance color but not alpha, so the shader is patched to multiply
 * the fragment alpha by `instanceOpacity`. Stacks on an existing patch.
 */
export function withInstanceOpacity<T extends THREE.Material>(material: T): T {
  const before = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey.bind(material);
  material.transparent = true;
  material.depthWrite = false;
  material.onBeforeCompile = (shader, renderer) => {
    before(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float instanceOpacity;\nvarying float vInstanceOpacity;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInstanceOpacity = instanceOpacity;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vInstanceOpacity;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= vInstanceOpacity;');
  };
  material.customProgramCacheKey = () => `${key()}|fade-instanced`;
  return material;
}

/** A MeshStandardMaterial with per-instance opacity, for the ghosts. */
export function createFadeMaterial(params: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return withInstanceOpacity(new THREE.MeshStandardMaterial(params));
}

/** Adds the opacity attribute to an instanced geometry, one float per instance. */
export function attachOpacity(geometry: THREE.BufferGeometry, count: number): THREE.InstancedBufferAttribute {
  const attr = new THREE.InstancedBufferAttribute(new Float32Array(count).fill(1), 1);
  attr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('instanceOpacity', attr);
  return attr;
}
