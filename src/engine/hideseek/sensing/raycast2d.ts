/**
 * Exact 2D ray casts against the shapes in a room. Every solid is a
 * vertical prism standing on the floor (walls and boxes are boxes, agents
 * are round at ray height) and sensor rays are horizontal, so a 2D cast
 * gives the same distance as a 3D one. Doing it in plain TypeScript skips
 * a WASM round trip per ray, which made sensor rays the most expensive part
 * of a tick. A test checks these results against Rapier's own ray casts.
 *
 * Every function takes a unit direction (dx, dz) and returns the distance
 * to the first hit, 0 when the origin is already inside the shape, or
 * Infinity on a miss.
 */

/** Ray against an axis-aligned box centered on (cx, cz) with half sizes (hx, hz), by the slab method. */
export function rayAabb(ox: number, oz: number, dx: number, dz: number, cx: number, cz: number, hx: number, hz: number): number {
  const rx = ox - cx;
  const rz = oz - cz;
  let tmin = -Infinity;
  let tmax = Infinity;
  if (dx !== 0) {
    const a = (-hx - rx) / dx;
    const b = (hx - rx) / dx;
    tmin = a < b ? a : b;
    tmax = a < b ? b : a;
  } else if (rx < -hx || rx > hx) {
    return Infinity;
  }
  if (dz !== 0) {
    const a = (-hz - rz) / dz;
    const b = (hz - rz) / dz;
    tmin = Math.max(tmin, a < b ? a : b);
    tmax = Math.min(tmax, a < b ? b : a);
  } else if (rz < -hz || rz > hz) {
    return Infinity;
  }
  if (tmax < 0 || tmin > tmax) return Infinity;
  return tmin > 0 ? tmin : 0;
}

/**
 * Ray against a box turned by some yaw (see frame.ts), given as its cos and
 * sin so a caller casting many rays computes them once per box. The ray is
 * moved into the box frame, where the box is axis aligned.
 */
export function rayBox(
  ox: number,
  oz: number,
  dx: number,
  dz: number,
  cx: number,
  cz: number,
  hx: number,
  hz: number,
  cos: number,
  sin: number,
): number {
  const rx = ox - cx;
  const rz = oz - cz;
  return rayAabb(rx * cos - rz * sin, rx * sin + rz * cos, dx * cos - dz * sin, dx * sin + dz * cos, 0, 0, hx, hz);
}

/** Ray against a circle, which is what an agent is at ray height. */
export function rayCircle(ox: number, oz: number, dx: number, dz: number, cx: number, cz: number, r: number): number {
  const rx = ox - cx;
  const rz = oz - cz;
  const c = rx * rx + rz * rz - r * r;
  if (c <= 0) return 0;
  const b = rx * dx + rz * dz;
  if (b > 0) return Infinity;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  return -b - Math.sqrt(disc);
}
