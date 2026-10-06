/**
 * The simulations are 2D in (x, y) with heading measured counterclockwise
 * from +x. three.js is Y-up, so sim (x, y) maps to world (x, 0, -y), and a
 * sim heading maps to a rotation of the same angle about +Y. Keeping this in
 * one file means nothing else has to think about it.
 */
export function simToWorldX(x: number): number {
  return x;
}

export function simToWorldZ(y: number): number {
  return -y;
}

/** Rotation about +Y for a sim heading. */
export function headingToYaw(heading: number): number {
  return heading;
}
