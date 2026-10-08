/**
 * The stadium's sizes in plain numbers, kept apart from the geometry
 * builders so layout and cameras can use them without three.js (the world
 * is laid out in a worker, where three cannot load).
 */

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

/** Height of row `r`'s tread, m. */
export function rowHeight(r: number): number {
  return PODIUM + r * ROW_RISE;
}

/** Height of the back wall's top, where the roof sits, m. */
export const BACK = rowHeight(ROWS) + 3.6;
/** How far the roof reaches from the back wall toward the track, and its downward slope, rad. */
export const REACH = BOWL_DEPTH + 2.6;
export const SLOPE = 0.06;

/** Where the roof's front edge sits, for the fascia board: y and z in the stand's frame. */
export function roofFront(): { y: number; z: number } {
  return { y: BACK + 0.45 - Math.sin(SLOPE) * (REACH / 2) - 0.45, z: BOWL_DEPTH - REACH + 0.6 };
}

/** The roof's back edge, for the flag poles along it. */
export function roofBack(): { y: number; z: number } {
  return { y: BACK + 1.6, z: BOWL_DEPTH + 0.5 };
}

/** The pit building's floor heights, m. */
export const PIT_GROUND = 4.6;
export const PIT_TOP = 8.6;
/** How far the roof's canopy reaches over the pit lane, and the lane's width, m. */
export const PIT_CANOPY = 4.2;
export const PIT_LANE = 7.2;
