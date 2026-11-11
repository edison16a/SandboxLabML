/**
 * Circle against axis aligned rectangle, the only collision test the
 * course needs. Rectangles come packed in flat arrays as x, z, hx, hz.
 */

/** A push or a position on the floor, written in place. */
export interface Vec2 {
  x: number;
  z: number;
}

/**
 * How deep the circle at (px, pz) of radius r reaches into the rectangle,
 * m, with the shortest push that frees it written to `out` (zero when it
 * does not touch). A center inside the rectangle is pushed out through the
 * nearest side.
 */
export function circleRect(px: number, pz: number, r: number, rx: number, rz: number, hx: number, hz: number, out: Vec2): number {
  const cx = px < rx - hx ? rx - hx : px > rx + hx ? rx + hx : px;
  const cz = pz < rz - hz ? rz - hz : pz > rz + hz ? rz + hz : pz;
  const dx = px - cx;
  const dz = pz - cz;
  const d2 = dx * dx + dz * dz;
  out.x = 0;
  out.z = 0;
  if (d2 >= r * r) return 0;
  if (d2 > 1e-18) {
    const d = Math.sqrt(d2);
    const depth = r - d;
    out.x = (dx / d) * depth;
    out.z = (dz / d) * depth;
    return depth;
  }
  // The center is inside: leave by the closest side.
  const left = px - (rx - hx);
  const right = rx + hx - px;
  const back = pz - (rz - hz);
  const front = rz + hz - pz;
  const m = Math.min(left, right, back, front);
  if (m === left) out.x = -(left + r);
  else if (m === right) out.x = right + r;
  else if (m === back) out.z = -(back + r);
  else out.z = front + r;
  return m + r;
}

const scratch: Vec2 = { x: 0, z: 0 };

/** Deepest overlap of the circle with any of `count` packed rectangles, m. */
export function deepestOverlap(px: number, pz: number, r: number, rects: Float64Array, count: number): number {
  let worst = 0;
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    const d = circleRect(px, pz, r, rects[o], rects[o + 1], rects[o + 2], rects[o + 3], scratch);
    if (d > worst) worst = d;
  }
  return worst;
}

/**
 * Pushes the circle at p out of every packed rectangle it touches, a few
 * passes over all of them so corners settle. Returns true when anything
 * pushed. In a gap too narrow for it the pushes fight and it stays in;
 * callers check deepestOverlap afterwards and fall back.
 */
export function pushOut(p: Vec2, r: number, rects: Float64Array, count: number, passes = 4): boolean {
  let touched = false;
  for (let pass = 0; pass < passes; pass++) {
    let moved = false;
    for (let i = 0; i < count; i++) {
      const o = i * 4;
      if (circleRect(p.x, p.z, r, rects[o], rects[o + 1], rects[o + 2], rects[o + 3], scratch) > 0) {
        p.x += scratch.x;
        p.z += scratch.z;
        moved = true;
      }
    }
    if (!moved) break;
    touched = true;
  }
  return touched;
}

/** Whether the circle overlaps any of `count` packed rectangles by more than `depth`. */
export function overlapsAny(px: number, pz: number, r: number, rects: Float64Array, count: number, depth: number): boolean {
  return deepestOverlap(px, pz, r, rects, count) > depth;
}
