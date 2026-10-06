import type * as THREE from 'three';
import { sharedBlobTexture } from '../shared/blobShadow';
import { FACES, faceGeometry, type FaceKey } from './characterFace';
import { armGeometry, blobGeometry, bodyGeometry, headGeometry } from './characterGeometry';
import type { CharacterDetail } from './types';

/** Meshes every character of one detail level shares. */
export interface CharacterKit {
  body: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  arm: THREE.BufferGeometry;
  faces: Record<FaceKey, THREE.BufferGeometry>;
  blob: THREE.BufferGeometry;
  blobMap: THREE.Texture;
}

const kits = new Map<CharacterDetail, CharacterKit>();

/**
 * The shared meshes for a detail level, built on first use and kept for the
 * page's life. A crowd of characters then costs one copy of each mesh, and
 * mounting one more character builds nothing.
 */
export function characterKit(detail: CharacterDetail): CharacterKit {
  let kit = kits.get(detail);
  if (!kit) {
    kit = {
      body: bodyGeometry(detail),
      head: headGeometry(detail),
      arm: armGeometry(detail),
      faces: Object.fromEntries(FACES.map((f) => [f, faceGeometry(f)])) as Record<FaceKey, THREE.BufferGeometry>,
      blob: blobGeometry(),
      blobMap: sharedBlobTexture(),
    };
    kits.set(detail, kit);
  }
  return kit;
}
