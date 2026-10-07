/**
 * A small mutable 3D vector for the motion code, which stays free of
 * three.js so it can run and be tested anywhere. Every helper writes into
 * an `out` the caller owns, so a frame of motion allocates nothing.
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function setVec(out: Vec3, x: number, y: number, z: number): Vec3 {
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

export function copyVec(out: Vec3, v: Vec3): Vec3 {
  return setVec(out, v.x, v.y, v.z);
}

export function lerpVec(out: Vec3, a: Vec3, b: Vec3, t: number): Vec3 {
  return setVec(out, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
}

export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * Turns `v` by the body's rotation, in the order three.js uses for an
 * Euler of (roll, twist, -lean) in 'YXZ' order: lean first (forward
 * pitch, top toward +x), then roll (top toward +z), then twist about y.
 * The character poser sets its body bone with exactly that Euler, so
 * points worked out here land where the mesh draws them.
 */
export function rotateBody(v: Vec3, lean: number, roll: number, twist: number, out: Vec3): Vec3 {
  const cl = Math.cos(-lean);
  const sl = Math.sin(-lean);
  // About z.
  const x1 = v.x * cl - v.y * sl;
  const y1 = v.x * sl + v.y * cl;
  const z1 = v.z;
  // About x.
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const y2 = y1 * cr - z1 * sr;
  const z2 = y1 * sr + z1 * cr;
  // About y.
  const ct = Math.cos(twist);
  const st = Math.sin(twist);
  return setVec(out, x1 * ct + z2 * st, y2, -x1 * st + z2 * ct);
}

/** World floor offset (dx, dz) into a character's frame turned by `yaw`: x ahead, z to its right. */
export function toLocal(dx: number, dz: number, yaw: number, out: { x: number; z: number }): { x: number; z: number } {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  out.x = dx * c - dz * s;
  out.z = dx * s + dz * c;
  return out;
}

/** The inverse of toLocal: a character frame offset back to a world floor offset. */
export function toWorld(lx: number, lz: number, yaw: number, out: { x: number; z: number }): { x: number; z: number } {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  out.x = lx * c + lz * s;
  out.z = -lx * s + lz * c;
  return out;
}
