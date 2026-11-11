import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Rect } from '@/engine/navigation/course/types';

/** Height of a spike pad's base plate, m. */
export const SPIKE_BASE = 0.05;
/** A spike: a square pyramid this wide and tall, m, set this far apart and this far in from the trim. */
export const SPIKE_WIDTH = 0.2;
export const SPIKE_HEIGHT = 0.3;
const SPIKE_PITCH = 0.27;
const SPIKE_INSET = 0.16;
/** Width and height of the red trim round each pad, m. */
const TRIM = 0.07;
const TRIM_HEIGHT = 0.065;

/** One spike standing on the base plate: a four sided pyramid squared to the grid, tip up. */
export function spikeGeometry(): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(SPIKE_WIDTH / Math.SQRT2, SPIKE_HEIGHT, 4, 1, true);
  g.rotateY(Math.PI / 4);
  g.translate(0, SPIKE_BASE + SPIKE_HEIGHT / 2 - 0.01, 0);
  return g;
}

/** Where every spike of the pads stands, as x, z pairs: a grid over each pad inside its trim. */
export function spikeSpots(pads: readonly Rect[]): Float32Array {
  const spots: number[] = [];
  for (const p of pads) {
    const nx = Math.max(1, Math.floor((2 * (p.hx - SPIKE_INSET)) / SPIKE_PITCH) + 1);
    const nz = Math.max(1, Math.floor((2 * (p.hz - SPIKE_INSET)) / SPIKE_PITCH) + 1);
    const sx = nx > 1 ? (2 * (p.hx - SPIKE_INSET)) / (nx - 1) : 0;
    const sz = nz > 1 ? (2 * (p.hz - SPIKE_INSET)) / (nz - 1) : 0;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) spots.push(p.x - (nx > 1 ? p.hx - SPIKE_INSET : 0) + i * sx, p.z - (nz > 1 ? p.hz - SPIKE_INSET : 0) + j * sz);
  }
  return Float32Array.from(spots);
}

/** The base plates of every pad, merged: dark slabs with softly rounded edges. */
export function spikeBaseGeometry(pads: readonly Rect[]): THREE.BufferGeometry | null {
  if (pads.length === 0) return null;
  const parts = pads.map((p) => new RoundedBoxGeometry(p.hx * 2, SPIKE_BASE, p.hz * 2, 1, 0.012).translate(p.x, SPIKE_BASE / 2, p.z));
  const merged = mergeGeometries(parts) as THREE.BufferGeometry;
  parts.forEach((g) => g.dispose());
  return merged;
}

/** The red trim round every pad, merged: four thin bars per pad, standing a little proud of the plate. */
export function spikeTrimGeometry(pads: readonly Rect[]): THREE.BufferGeometry | null {
  if (pads.length === 0) return null;
  const parts: THREE.BufferGeometry[] = [];
  const bar = (x: number, z: number, lx: number, lz: number) => parts.push(new RoundedBoxGeometry(lx, TRIM_HEIGHT, lz, 1, 0.015).translate(x, TRIM_HEIGHT / 2, z));
  for (const p of pads) {
    bar(p.x, p.z - p.hz + TRIM / 2, p.hx * 2, TRIM);
    bar(p.x, p.z + p.hz - TRIM / 2, p.hx * 2, TRIM);
    bar(p.x - p.hx + TRIM / 2, p.z, TRIM, p.hz * 2 - TRIM * 2);
    bar(p.x + p.hx - TRIM / 2, p.z, TRIM, p.hz * 2 - TRIM * 2);
  }
  const merged = mergeGeometries(parts) as THREE.BufferGeometry;
  parts.forEach((g) => g.dispose());
  return merged;
}
