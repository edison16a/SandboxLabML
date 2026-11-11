import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng } from '@/engine/core/rng';

/** Canvas colors shops choose, in sRGB: deep greens, wine, navy, charcoal and a cream. */
const CANVAS = ['#24503c', '#5d1f2a', '#1e2f4f', '#2b2d31', '#d8cdb3', '#7a3b22', '#3f5f5a'].map((c) => new THREE.Color(c));

/** Bay width the facade shader uses for storefronts, m: awnings must sit over its windows. */
export const SHOP_BAY = 5.2;

/**
 * A fabric awning over a shop window: a sloped canvas with a short valance
 * along its front edge. Built along +x (the wall), sloping out along +z.
 */
function awning(width: number, color: THREE.Color): THREE.BufferGeometry {
  const depth = 1.25;
  const drop = 0.42;
  const canvas = new THREE.PlaneGeometry(width, Math.hypot(depth, drop)).rotateX(-Math.PI / 2 + Math.atan2(drop, depth)).translate(0, -drop / 2, depth / 2);
  const valance = new THREE.PlaneGeometry(width, 0.22).translate(0, -drop - 0.11, depth);
  const sides = [-1, 1].map((s) => new THREE.PlaneGeometry(depth, 0.22).rotateY((s * Math.PI) / 2).translate((s * width) / 2, -drop - 0.11, depth / 2));
  const parts = [canvas, valance, ...sides].map((g) => {
    const geo = g.toNonIndexed();
    g.dispose();
    const n = geo.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([color.r, color.g, color.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.deleteAttribute('uv');
    return geo;
  });
  const out = mergeGeometries(parts) as THREE.BufferGeometry;
  parts.forEach((p) => p.dispose());
  return out;
}

/**
 * Awnings over about half the shop windows of a street facing wall from
 * (ax, ay) to (bx, by) in sim coordinates, its outward normal (nx, ny).
 * Bays match the facade shader's, so each awning sits over its window.
 */
export function wallAwnings(out: THREE.BufferGeometry[], ax: number, ay: number, bx: number, by: number, nx: number, ny: number, seed: number): void {
  const len = Math.hypot(bx - ax, by - ay);
  const bays = Math.max(1, Math.floor(len / SHOP_BAY));
  const bw = len / bays;
  const rng = new Rng(Math.floor(seed * 1e6) ^ Math.floor(len * 100));
  const color = CANVAS[rng.int(CANVAS.length)];
  // Turn the awning's outward axis (+z) onto the wall's outward normal, in world space (x, -y).
  const yaw = Math.atan2(nx, -ny);
  for (let k = 0; k < bays; k++) {
    if (!rng.chance(0.55)) continue;
    const t = (k + 0.5) / bays;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    const g = awning(bw * 0.84, color).rotateY(yaw).translate(x + nx * 0.02, 3.55, -(y + ny * 0.02));
    out.push(g);
  }
}
