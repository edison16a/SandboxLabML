import * as THREE from 'three';
import { ColoredParts } from './coloredParts';
import { PIT_CANOPY, PIT_GROUND, PIT_TOP } from './dimensions';

const WHITE = new THREE.Color('#e8e9e7');
const GREY = new THREE.Color('#9da3a9');
const DARK = new THREE.Color('#202429');
const GARAGE = new THREE.Color('#3b4047');
const BLUE = new THREE.Color('#2f6fd0');

/** Garage width along the building, m. */
const BAY = 5.2;

/**
 * The pit building's shell in its own frame (x along the road, z away from
 * it, front facade at z = 0): a row of garages with dark open doors, a
 * glazed upper floor set back behind white slab edges, and a flat roof
 * whose canopy reaches out over the pit lane.
 */
export function pitShell(length: number, depth: number): THREE.BufferGeometry {
  const b = new ColoredParts();
  b.box(length, PIT_GROUND, depth - 1.4, 0, PIT_GROUND / 2, 1.4 + (depth - 1.4) / 2, WHITE);
  const bays = Math.floor(length / BAY);
  const start = -(bays * BAY) / 2;
  for (let k = 0; k <= bays; k++) b.box(0.7, PIT_GROUND, 1.4, start + k * BAY, PIT_GROUND / 2, 0.7, WHITE);
  for (let k = 0; k < bays; k++) {
    const x = start + (k + 0.5) * BAY;
    // Open garage: a dark interior, a lighter back wall and a blue stripe over the door.
    b.box(BAY - 0.7, PIT_GROUND - 0.9, 0.1, x, (PIT_GROUND - 0.9) / 2, 1.35, GARAGE);
    b.box(BAY - 0.7, 0.9, 1.4, x, PIT_GROUND - 0.45, 0.7, WHITE);
    b.box(BAY - 0.7, 0.18, 0.05, x, PIT_GROUND - 0.6, -0.02, BLUE);
  }
  // Slab edges and the upper floor's solid ends.
  b.box(length + 0.4, 0.5, 0.6, 0, PIT_GROUND + 0.25, 0.3, WHITE);
  b.box(length, PIT_TOP - PIT_GROUND, depth - 2, 0, (PIT_GROUND + PIT_TOP) / 2, 2 + (depth - 2) / 2, GREY);
  for (const s of [-1, 1]) b.box(1.2, PIT_TOP - PIT_GROUND, depth, (s * (length - 1.2)) / 2, (PIT_GROUND + PIT_TOP) / 2, depth / 2, WHITE);
  // The end walls face down the straight: a glazed stair tower, a grey slab band and the blue stripe, so they never read as a blank box.
  for (const s of [-1, 1]) {
    const x = s * (length / 2 + 0.04);
    b.box(0.1, PIT_TOP - 1.2, 2.2, x, PIT_TOP / 2, depth * 0.62, DARK);
    b.box(0.12, 0.5, depth - 1.6, x, PIT_GROUND + 0.25, depth / 2 + 0.6, GREY);
    b.box(0.12, 0.18, depth - 1.6, x, PIT_GROUND - 0.6, depth / 2 + 0.6, BLUE);
    for (let z = 2.2; z < depth - 1; z += 2.4) b.box(0.16, PIT_TOP - PIT_GROUND - 0.6, 0.14, x, (PIT_GROUND + PIT_TOP) / 2 + 0.1, z, GREY);
  }
  // Roof deck and a cantilevered canopy over the pit lane, with a dark fascia; no posts, so a pit lane camera has a clear view.
  b.box(length + 1.2, 0.45, depth + PIT_CANOPY, 0, PIT_TOP + 0.22, (depth - PIT_CANOPY) / 2, WHITE);
  b.box(length + 1.2, 0.9, 0.12, 0, PIT_TOP + 0.1, -PIT_CANOPY, DARK);
  return b.build();
}

/** The upper floor's glass, one band along the front behind the slab edge. */
export function pitGlass(length: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(length - 2.4, PIT_TOP - PIT_GROUND - 0.5, 0.08).translate(0, (PIT_GROUND + PIT_TOP) / 2 + 0.25, 1.4);
}

/** Thin mullions over the glass, every 2.6 m. */
export function pitMullions(length: number): THREE.BufferGeometry {
  const b = new ColoredParts();
  for (let x = -length / 2 + 1.2; x <= length / 2 - 1.2; x += 2.6) b.box(0.08, PIT_TOP - PIT_GROUND - 0.5, 0.12, x, (PIT_GROUND + PIT_TOP) / 2 + 0.25, 1.32, DARK);
  return b.build();
}
