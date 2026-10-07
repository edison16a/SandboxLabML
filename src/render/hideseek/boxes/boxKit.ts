import type * as THREE from 'three';
import type { BoxKind, BoxSize } from '@/engine/hideseek/physics';
import { floorQuad } from '../shared/basicGeometry';
import { sharedBlobTexture } from '../shared/blobShadow';
import { bracedBox, type BracedBoxParts } from './bracedBox';
import { bracedRamp } from './bracedRamp';
import { padlockBodyGeometry, padlockShackleGeometry } from './padlock';

const built = new Map<string, BracedBoxParts>();
let shared: { lockBody: THREE.BufferGeometry; lockShackle: THREE.BufferGeometry; blob: THREE.BufferGeometry; blobMap: THREE.Texture } | null = null;

/**
 * Meshes of a box (a crate, or the wedge for a ramp) of a size, built on
 * first use and kept for the page's life, so any number of boxes of the
 * same shape share one copy.
 */
export function boxParts(kind: BoxKind, size: BoxSize): BracedBoxParts {
  const ramp = kind === 'ramp';
  const key = `${ramp ? 'ramp' : 'crate'}:${size.length}:${size.width}:${size.height}`;
  let parts = built.get(key);
  if (!parts) {
    parts = ramp ? bracedRamp(size) : bracedBox(size);
    built.set(key, parts);
  }
  return parts;
}

/** The padlock and the soft floor shadow, shared by every box. */
export function crateExtras() {
  shared ??= { lockBody: padlockBodyGeometry(), lockShackle: padlockShackleGeometry(), blob: floorQuad(1), blobMap: sharedBlobTexture() };
  return shared;
}
