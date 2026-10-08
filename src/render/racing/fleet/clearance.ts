import type * as THREE from 'three';

/** 0 below a, 1 above b, linear between. Module level, so the per car call below builds no closure. */
function ramp(v: number, a: number, b: number): number {
  return Math.min(1, Math.max(0, (v - a) / (b - a)));
}

/**
 * How much of a car at (x, z) to keep beside the followed car, which faces
 * `yaw`: none where the two bodies overlap, measured along and across the
 * followed car, so the detailed model never shares its space with a copy
 * or a ghost driving the same line. Cars in the next lane stay.
 */
export function apart(x: number, z: number, focus: THREE.Vector3, yaw: number): number {
  const dx = x - focus.x;
  const dz = z - focus.z;
  const fx = Math.cos(yaw);
  const fz = -Math.sin(yaw);
  const along = Math.abs(dx * fx + dz * fz);
  const across = Math.abs(dz * fx - dx * fz);
  return Math.max(ramp(along, 4.3, 4.9), ramp(across, 1.9, 2.3));
}

/** How much of a car at (x, z) to keep near the lens: none within about 6 m, where it would fill the frame or clip. */
export function atLens(x: number, z: number, cam: THREE.Vector3): number {
  return ramp(Math.hypot(x - cam.x, z - cam.z), 5.6, 6.4);
}

/**
 * How much of a car at (x, z) to keep in views about one car: none right
 * at the lens, across the line of sight to the followed car, or overlapping
 * it, where late in training a whole generation drives the same line.
 */
export function clearance(x: number, z: number, focus: THREE.Vector3, yaw: number, cam: THREE.Vector3): number {
  const cx = x - cam.x;
  const cz = z - cam.z;
  const fx = focus.x - cam.x;
  const fz = focus.z - cam.z;
  const fLen = Math.hypot(fx, fz) || 1e-3;
  const along = (cx * fx + cz * fz) / fLen;
  let keep = Math.min(atLens(x, z, cam), apart(x, z, focus, yaw));
  // Across the line of sight in front of the followed car: it would veil it.
  if (along > 0 && along < fLen - 1.2) keep = Math.min(keep, ramp(Math.abs(cx * fz - cz * fx) / fLen, 2.3, 2.7));
  return keep;
}
