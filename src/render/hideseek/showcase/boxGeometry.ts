import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BoxSize } from '@/engine/hideseek/physics';

/** A crate with softly rounded edges, standing on the floor, length along local x. */
export function crateGeometry(size: BoxSize): THREE.BufferGeometry {
  const g = new RoundedBoxGeometry(size.length, size.height, size.width, 4, 0.055);
  g.translate(0, size.height / 2, 0);
  return g;
}

/**
 * Twelve thin bars along the edges of a crate, a hair outside it. Drawn
 * emissive amber when the crate is locked, so with bloom the edges glow.
 */
export function edgeFrameGeometry(size: BoxSize, thickness = 0.032): THREE.BufferGeometry {
  const L = size.length + 0.012;
  const H = size.height + 0.012;
  const W = size.width + 0.012;
  const t = thickness;
  const bars: THREE.BufferGeometry[] = [];
  const bar = (sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    g.translate(x, y + size.height / 2, z);
    bars.push(g);
  };
  for (const y of [-H / 2, H / 2]) {
    for (const z of [-W / 2, W / 2]) bar(L + t, t, t, 0, y, z);
    for (const x of [-L / 2, L / 2]) bar(t, t, W + t, x, y, 0);
  }
  for (const x of [-L / 2, L / 2]) for (const z of [-W / 2, W / 2]) bar(t, H, t, x, 0, z);
  const merged = mergeGeometries(bars) as THREE.BufferGeometry;
  bars.forEach((b) => b.dispose());
  return merged;
}

/** A small padlock body, sitting on the crate top. */
export function padlockBodyGeometry(): THREE.BufferGeometry {
  const g = new RoundedBoxGeometry(0.22, 0.17, 0.09, 3, 0.03);
  g.translate(0, 0.085, 0);
  return g;
}

/** The padlock's shackle: a half ring whose feet sit on the body top. */
export function shackleGeometry(): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(0.07, 0.02, 10, 24, Math.PI);
  g.translate(0, 0.17, 0);
  return g;
}
