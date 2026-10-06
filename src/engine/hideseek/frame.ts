/**
 * Coordinate conventions shared by the engine and the renderer.
 *
 * World units are meters. The floor is the plane y = 0, +x points right and
 * +z points toward the viewer. Seen from above (looking down -y with -z at
 * the top of the screen) the room reads like a map.
 *
 * Yaw is a rotation about +y. Yaw 0 faces +x, and positive yaw turns the
 * agent counterclockwise when seen from above, so yaw PI/2 faces -z. The
 * facing vector is (cos yaw, 0, -sin yaw). That is exactly what three.js
 * does for `object.rotation.y = yaw` on a model that faces +x, so the
 * renderer can copy yaw straight across.
 *
 * Angles measured from an agent (rays, bearings) are positive to its left.
 */

export interface Pose {
  x: number;
  z: number;
  yaw: number;
}

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

/** Distance ahead of a facing `yaw` for a world offset (dx, dz). */
export function localAhead(dx: number, dz: number, yaw: number): number {
  return dx * Math.cos(yaw) - dz * Math.sin(yaw);
}

/** Distance to the left of a facing `yaw` for a world offset (dx, dz). */
export function localLeft(dx: number, dz: number, yaw: number): number {
  return -dx * Math.sin(yaw) - dz * Math.cos(yaw);
}

/** Direction of a world offset relative to a facing, in (-PI, PI], left positive. */
export function bearing(dx: number, dz: number, yaw: number): number {
  return Math.atan2(localLeft(dx, dz, yaw), localAhead(dx, dz, yaw));
}

/** Quaternion for a pure yaw rotation, written into `out` to avoid allocation. */
export function yawToQuat(yaw: number, out: Quat): Quat {
  out.x = 0;
  out.y = Math.sin(yaw / 2);
  out.z = 0;
  out.w = Math.cos(yaw / 2);
  return out;
}

/**
 * Yaw of a body's rotation, read from where it sends the +x axis. Bodies
 * only rotate about y, but this stays correct if tiny tilts creep in.
 */
export function quatToYaw(q: Quat): number {
  return Math.atan2(2 * (q.w * q.y - q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z));
}
