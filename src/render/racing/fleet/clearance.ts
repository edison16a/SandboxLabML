import type * as THREE from 'three';

/** 0 below a, 1 above b, linear between. Module level, so the per car call below builds no closure. */
function ramp(v: number, a: number, b: number): number {
  return Math.min(1, Math.max(0, (v - a) / (b - a)));
}

/**
 * How much of a car at (x, z) to keep in views about one car: none right
 * at the lens or across the line of sight to the followed car, and little
 * when it sits on top of it, where late in training a whole generation
 * drives the same line.
 */
export function clearance(x: number, z: number, focus: THREE.Vector3, cam: THREE.Vector3): number {
  const cx = x - cam.x;
  const cz = z - cam.z;
  const fx = focus.x - cam.x;
  const fz = focus.z - cam.z;
  const fLen = Math.hypot(fx, fz) || 1e-3;
  const along = (cx * fx + cz * fz) / fLen;
  let keep = ramp(Math.hypot(cx, cz), 5.6, 6.4);
  // Across the line of sight in front of the followed car: it would veil it.
  if (along > 0 && along < fLen - 1.2) keep = Math.min(keep, ramp(Math.abs(cx * fz - cz * fx) / fLen, 2.3, 2.7));
  if (along < fLen + 0.5) keep = Math.min(keep, ramp(Math.hypot(x - focus.x, z - focus.z), 3, 3.6));
  return keep;
}
