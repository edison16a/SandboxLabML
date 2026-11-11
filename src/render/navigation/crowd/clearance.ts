/** How far toward the camera, and how wide, the strip kept clear in front of the champion runs, m: from the follow shot a crowd member standing there would hide its legs or its ring. */
export const SIGHT_LENGTH = 2.4;
export const SIGHT_WIDTH = 0.95;

/**
 * Whether a crowd member at (x, z) stands where it would hide the champion
 * at (cx, cz): within `radius` of it, or in the strip between it and a
 * camera whose direction over the floor from the champion is the unit
 * vector (dx, dz). The camera looks down at an angle, so only a short
 * strip toward it matters. Pure, and cheap enough to run for every member
 * every frame.
 */
export function hidesChampion(x: number, z: number, cx: number, cz: number, dx: number, dz: number, radius: number): boolean {
  const rx = x - cx;
  const rz = z - cz;
  if (rx * rx + rz * rz < radius * radius) return true;
  const along = rx * dx + rz * dz;
  if (along <= 0 || along > SIGHT_LENGTH) return false;
  return Math.abs(rx * dz - rz * dx) < SIGHT_WIDTH;
}
