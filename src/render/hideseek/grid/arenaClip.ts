import * as THREE from 'three';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import type { Lattice } from '../layout/gridLattice';

/** Uniforms that describe the arena lattice to a clipped material. */
export interface ArenaClip {
  uClipPitch: { value: number };
  uClipOffset: { value: THREE.Vector2 };
  uClipHalf: { value: number };
}

export function createArenaClip(): ArenaClip {
  return { uClipPitch: { value: 1 }, uClipOffset: { value: new THREE.Vector2() }, uClipHalf: { value: DEFAULT_HIDESEEK_PHYSICS.arena.size / 2 } };
}

/**
 * Points the clip at a lattice. Arena centers sit a whole pitch apart and,
 * with an even count of columns or rows, half a pitch off the origin, so
 * the nearest center to any point is a modulo away.
 */
export function updateArenaClip(clip: ArenaClip, lattice: Lattice): void {
  clip.uClipPitch.value = lattice.pitch;
  clip.uClipOffset.value.x = lattice.cols % 2 === 0 ? lattice.pitch / 2 : 0;
  clip.uClipOffset.value.y = lattice.rows % 2 === 0 ? lattice.pitch / 2 : 0;
}

/**
 * Makes a material drop every fragment outside the floor of the arena it
 * lies over, so a grid vision cone near a wall stops at the room instead of
 * spilling onto the ground outside. Works on instanced meshes.
 */
export function clipToArenas<T extends THREE.Material>(material: T, clip: ArenaClip): T {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, clip);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vClipWorld;').replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      {
        vec4 w = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          w = instanceMatrix * w;
        #endif
        vClipWorld = (modelMatrix * w).xz;
      }`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vClipWorld;\nuniform float uClipPitch;\nuniform vec2 uClipOffset;\nuniform float uClipHalf;')
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        vec2 cell = mod(vClipWorld - uClipOffset + 0.5 * uClipPitch, uClipPitch) - 0.5 * uClipPitch;
        if (max(abs(cell.x), abs(cell.y)) > uClipHalf) discard;`,
      );
  };
  material.customProgramCacheKey = () => 'hs-arena-clip';
  return material;
}
