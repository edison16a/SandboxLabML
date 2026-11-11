import { hinge, smooth } from './curve';
import { NOSE, TAIL } from './ends';
import type { Vec3 } from './grid';

/**
 * A final bend applied to every point on the body. Sections are easiest
 * to draw upright and the end faces flat, but a real nose leans back
 * above a forward fold and tucks under below it, and a real tail leans in
 * from its bumper up to the roof's lip. Running the body, its faces and
 * every lamp through the same bend keeps them glued together. The bend
 * only moves points along x, near the ends, and every ramp eases in and
 * out, so it never puts a slope break (and a line of light) into the paint.
 */
export function warp(p: Vec3): Vec3 {
  const [x, y, z] = p;
  let dx = 0;
  if (x > NOSE_BEND.from) dx += smooth((x - NOSE_BEND.from) / (NOSE - NOSE_BEND.from)) * (noseLean(y) + noseBow(z));
  if (x < TAIL_BEND.from) dx -= smooth((TAIL_BEND.from - x) / (TAIL_BEND.from - TAIL)) * (tailLean(y) + ledge(y, z));
  return [x + dx, y, z];
}

/**
 * The nose in side view: the face leans back 14 degrees from a soft fold
 * at `apex` up to the hood's edge at `top`, and below the fold the bumper
 * tucks back toward the lip at `under` m per m. The bend starts behind
 * the front wheel arch, so the arch stays round. The fold under the hood's
 * edge turns over about as wide as the hood's own 4 cm roll, so the two
 * read as one rounded edge.
 */
const NOSE_BEND = { from: 1.96, top: 0.9, apex: 0.567, lean: 0.25, under: 0.55, edge: 0.035, fold: 0.045 };

/** How far the nose face sits ahead of its upright station at height y, m. */
export function noseLean(y: number): number {
  const b = NOSE_BEND;
  return b.lean * hinge(b.top - y, b.edge) - (b.lean + b.under) * hinge(b.apex - y, b.fold);
}

/**
 * The nose in plan view: the face bows forward a little at the middle, so
 * it reads taut and alive instead of flat, and the hood's edge follows it
 * in a gentle arc. It fades out before the corners.
 */
export const NOSE_BOW = 0.015;

function noseBow(z: number): number {
  const t = Math.min(1, (z / 0.97) ** 2);
  return NOSE_BOW * (1 - t) * (1 - t);
}

/**
 * The tail in side view: from the roof's lip at `lip` the tailgate leans
 * out and down to the bumper's top at `bumper`, the bumper stands upright,
 * and below `diffuser` it tucks back in to the diffuser's floor. Above the
 * lip nothing moves, so the roofline is exactly the cabin's.
 */
const TAIL_BEND = { from: -1.9, lip: 1.22, bumper: 0.885, diffuser: 0.55, gate: 0.444, tuck: 0.66 };

/** How far the tail sits behind its upright station at height y, m. */
export function tailLean(y: number): number {
  const b = TAIL_BEND;
  return b.gate * (hinge(b.lip - y, 0.02) - hinge(b.bumper - y, 0.03)) - b.tuck * hinge(b.diffuser - y, 0.05);
}

/**
 * The bumper's crease: just under the tailgate's shut line the bumper's
 * lower half stands `step` m further out over a tight fold, so it reads
 * as its own volume. It runs across the tailgate and fades out before the
 * corners, where the face curls into the sides.
 */
export const LEDGE = { y: 0.6, step: 0.01, r: 0.008, half: 0.45, fade: 0.15 };

function ledge(y: number, z: number): number {
  const across = smooth((LEDGE.half + LEDGE.fade - Math.abs(z)) / LEDGE.fade);
  return LEDGE.step * smooth((LEDGE.y + LEDGE.r - y) / (2 * LEDGE.r)) * across;
}
