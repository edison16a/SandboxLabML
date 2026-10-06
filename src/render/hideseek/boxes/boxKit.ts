import type * as THREE from 'three';
import type { BoxSize } from '@/engine/hideseek/physics';
import { floorQuad, sharedBlobTexture } from '../grid/gridGeometry';
import { bracedBox, type BracedBoxParts } from './bracedBox';
import { padlockBodyGeometry, padlockShackleGeometry } from './padlock';

const crates = new Map<string, BracedBoxParts>();
let shared: { lockBody: THREE.BufferGeometry; lockShackle: THREE.BufferGeometry; blob: THREE.BufferGeometry; blobMap: THREE.Texture } | null = null;

/**
 * Crate meshes for a size, built on first use and kept for the page's life,
 * so any number of crates of the same size share one copy.
 */
export function crateParts(size: BoxSize): BracedBoxParts {
  const key = `${size.length}:${size.width}:${size.height}`;
  let parts = crates.get(key);
  if (!parts) {
    parts = bracedBox(size);
    crates.set(key, parts);
  }
  return parts;
}

/** The padlock and the soft floor shadow, shared by every crate. */
export function crateExtras() {
  shared ??= { lockBody: padlockBodyGeometry(), lockShackle: padlockShackleGeometry(), blob: floorQuad(1), blobMap: sharedBlobTexture() };
  return shared;
}
