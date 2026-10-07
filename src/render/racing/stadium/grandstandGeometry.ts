import * as THREE from 'three';
import { ColoredParts } from './coloredParts';

/** Seating rows, their depth and rise, m. The first row sits on a podium above the fence. */
export const ROWS = 14;
export const ROW_DEPTH = 0.85;
export const ROW_RISE = 0.42;
export const PODIUM = 1.4;
/** Distance from the stand's front edge to the first row, m. */
export const FRONT = 0.9;
/** Aisles every this many meters along the stand. */
export const AISLE_EVERY = 11;
/** Depth of the seating bowl, m. */
export const BOWL_DEPTH = FRONT + ROWS * ROW_DEPTH;

const CONCRETE = new THREE.Color('#b8bab9');
const STEP = new THREE.Color('#9ea1a3');
const SEAT_BLUE = new THREE.Color('#2f6fd0');
const SEAT_GREY = new THREE.Color('#d7dadf');
const SEAT_DARK = new THREE.Color('#1b2533');
const STEEL = new THREE.Color('#3a414b');
const DECK = new THREE.Color('#dfe2e5');

/** Height of row `r`'s tread, m. */
export function rowHeight(r: number): number {
  return PODIUM + r * ROW_RISE;
}

/** Height of the back wall's top, where the roof sits, m. */
const BACK = rowHeight(ROWS) + 3.6;
/** How far the roof reaches from the back wall toward the track, and its downward slope, rad. */
const REACH = BOWL_DEPTH + 2.6;
const SLOPE = 0.06;

/**
 * The concrete bowl of a stand `length` meters long, in its own frame:
 * x along the road, z away from it, y up. Stepped rows with a band of
 * seat backs on each, blue blocks with a pale stripe, aisles of bare
 * steps, a podium wall at the front and a dark clad back wall.
 */
export function bowlGeometry(length: number): THREE.BufferGeometry {
  const b = new ColoredParts();
  b.box(length, PODIUM, FRONT + 0.4, 0, PODIUM / 2, (FRONT + 0.4) / 2, CONCRETE);
  for (let r = 0; r < ROWS; r++) {
    const y = rowHeight(r);
    const z = FRONT + r * ROW_DEPTH;
    // Tread and riser in one block reaching down to the ground.
    b.box(length, y, ROW_DEPTH, 0, y / 2, z + ROW_DEPTH / 2, STEP);
    const color = r === 5 || r === 6 ? SEAT_GREY : r >= ROWS - 2 ? SEAT_DARK : SEAT_BLUE;
    for (let x = -length / 2 + 0.4; x < length / 2 - 0.4; x += AISLE_EVERY) {
      const run = Math.min(AISLE_EVERY - 1.4, length / 2 - 0.4 - x);
      b.box(run, 0.42, 0.12, x + run / 2, y + 0.21, z + ROW_DEPTH - 0.1, color);
    }
  }
  b.box(length, BACK, 0.4, 0, BACK / 2, BOWL_DEPTH + 0.2, SEAT_DARK);
  for (const s of [-1, 1]) b.box(0.4, BACK, BOWL_DEPTH, (s * (length + 0.4)) / 2, BACK / 2, BOWL_DEPTH / 2, CONCRETE);
  return b.build();
}

/**
 * The roof: a thin cantilevered deck sloping gently toward the track, held
 * by raking steel beams from posts at the back. Posts sit behind the last
 * row, so nothing blocks the view of the road.
 */
export function roofGeometry(length: number): THREE.BufferGeometry {
  const b = new ColoredParts();
  const center = BOWL_DEPTH - REACH / 2 + 0.6;
  b.add(new THREE.BoxGeometry(length + 1.2, 0.28, REACH).rotateX(-SLOPE).translate(0, BACK + 0.45, center), DECK);
  const bays = Math.max(2, Math.round(length / 9));
  for (let k = 0; k <= bays; k++) {
    const x = -length / 2 + (k * length) / bays;
    b.box(0.4, BACK + 1.6, 0.4, x, (BACK + 1.6) / 2, BOWL_DEPTH + 0.5, STEEL);
    b.add(new THREE.BoxGeometry(0.25, 0.5, REACH).rotateX(-SLOPE * 1.9).translate(x, BACK + 1.25, center), STEEL);
  }
  return b.build();
}

/** Where the roof's front edge sits, for the fascia board: y and z in the stand's frame. */
export function roofFront(): { y: number; z: number } {
  return { y: BACK + 0.45 - Math.sin(SLOPE) * (REACH / 2) - 0.45, z: BOWL_DEPTH - REACH + 0.6 };
}

/** The roof's back edge, for the flag poles along it. */
export function roofBack(): { y: number; z: number } {
  return { y: BACK + 1.6, z: BOWL_DEPTH + 0.5 };
}
