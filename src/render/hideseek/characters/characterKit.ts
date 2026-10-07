import * as THREE from 'three';
import { sharedBlobTexture } from '../shared/blobShadow';
import { bodyGeometry } from './rig/bodyParts';
import { faceGeometry } from './rig/faceParts';
import type { CharacterDetail } from './types';

/** Meshes every character of one detail level shares. */
export interface CharacterKit {
  /** The skinned body in the team color, and the skinned face (eyes and mouths) in its own colors. */
  body: THREE.BufferGeometry;
  face: THREE.BufferGeometry;
  blob: THREE.BufferGeometry;
  blobMap: THREE.Texture;
  /** A flat square for the glowing ring at a seeker's feet. */
  ring: THREE.BufferGeometry;
}

/** Side of the square the seeker ring is drawn on, m. */
export const RING_SIZE = 1.7;

const kits = new Map<CharacterDetail, CharacterKit>();

/**
 * The shared meshes for a detail level, built on first use and kept for
 * the page's life. A crowd of characters then costs one copy of each mesh,
 * and mounting one more character builds nothing.
 */
export function characterKit(detail: CharacterDetail): CharacterKit {
  let kit = kits.get(detail);
  if (!kit) {
    const blob = new THREE.CircleGeometry(0.42, 32);
    blob.rotateX(-Math.PI / 2);
    blob.translate(0, 0.006, 0);
    const ring = new THREE.PlaneGeometry(RING_SIZE, RING_SIZE);
    ring.rotateX(-Math.PI / 2);
    ring.translate(0, 0.012, 0);
    kit = { body: bodyGeometry(detail), face: faceGeometry(detail), blob, blobMap: sharedBlobTexture(), ring };
    kits.set(detail, kit);
  }
  return kit;
}
