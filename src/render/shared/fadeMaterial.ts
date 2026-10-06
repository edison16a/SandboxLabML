import * as THREE from 'three';

/**
 * A MeshStandardMaterial that reads a per-instance opacity attribute, so one
 * instanced draw call can show ghosts at different transparencies. three.js
 * has per-instance color but not alpha, so the shader is patched to multiply
 * the fragment alpha by `instanceOpacity`.
 */
export function createFadeMaterial(params: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, ...params });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float instanceOpacity;\nvarying float vInstanceOpacity;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInstanceOpacity = instanceOpacity;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vInstanceOpacity;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= vInstanceOpacity;');
  };
  m.customProgramCacheKey = () => 'fade-instanced';
  return m;
}

/** Adds the opacity attribute to an instanced geometry, one float per instance. */
export function attachOpacity(geometry: THREE.BufferGeometry, count: number): THREE.InstancedBufferAttribute {
  const attr = new THREE.InstancedBufferAttribute(new Float32Array(count).fill(1), 1);
  attr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('instanceOpacity', attr);
  return attr;
}
