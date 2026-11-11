import { profile, smooth } from './curve';

/**
 * The SUV's main lines along its length, before the end bend (see warp.ts).
 * Each is a smooth profile through a few key points, so the design reads
 * as numbers a person can check against a drawing. x is forward.
 */

/** Half width at the shoulder crease: 0.965 over the front wheel, pulled in at the doors, 1.0 over the rear haunch. */
export const shoulderZ = profile([[-2.3, 0.966], [-2.1, 0.986], [-1.8, 0.998], [-1.42, 1.0], [-1.05, 0.986], [-0.75, 0.962], [-0.4, 0.947], [0.3, 0.945], [0.9, 0.953], [1.48, 0.965], [1.9, 0.962], [2.4, 0.955]]);

/** Height of the shoulder crease: from the top of the headlight, level along the doors, rising over the rear haunch. */
export const shoulderY = profile([[-2.3, 1.075], [-1.9, 1.062], [-1.42, 1.045], [-1.0, 1.018], [-0.4, 1.002], [0.6, 0.998], [1.2, 0.99], [1.7, 0.974], [2.1, 0.956], [2.4, 0.946]]);

/** The belt, where the side glass sits on the body: 1.08 at the A pillar's foot, rising gently toward the tail. */
const beltLine = profile([[-2.3, 1.172], [-2.0, 1.152], [-1.7, 1.14], [-1.0, 1.12], [-0.45, 1.1], [0.3, 1.088], [0.85, 1.08], [1.3, 1.078]]);

/** How far the belt sits in from the shoulder: the tumblehome shelf, widest over the rear haunch. */
const beltInset = profile([[-2.3, 0.17], [-1.9, 0.152], [-1.42, 0.14], [-0.9, 0.122], [-0.4, 0.106], [0.4, 0.105], [0.9, 0.112], [1.3, 0.112]]);

/**
 * The hood's centerline: one parabola, level at the windshield's foot and
 * falling 15.5 cm to the leading edge. A single curve has no knots, so its
 * reflections run clean the whole length of the hood.
 */
export function hoodY(x: number): number {
  const t = Math.max(0, (x - 0.9) / 1.46);
  return 1.06 - 0.155 * t * t;
}

/**
 * How far the hood's centerline sits below the fender peaks: 4 cm at the
 * cowl easing to 6 cm at the lamps. Behind the cowl the body top hides
 * under the glass; there it domes a little (negative) so the tail deck crowns.
 */
export function valleyDepth(x: number): number {
  const hood = 0.04 + 0.02 * smooth((x - 0.9) / 1.1);
  const dome = -0.048 * smooth((-x - 0.5) / 1.8);
  const w = smooth((x - 0.2) / 0.5);
  return hood * w + dome * (1 - w);
}

/**
 * Height of the body's top at the centerline: the hood ahead of the
 * cowl, and behind it a low dome under the glass that rises to the tail's
 * deck. The two meet under the windshield, where nobody sees the join.
 */
export function deckLine(x: number): number {
  const behind = beltLine(x) - valleyDepth(x);
  return behind + (hoodY(x) - behind) * smooth((x - 0.5) / 0.35);
}

/** Half width of the fender peaks running along each side of the hood. */
const PEAK_Z = 0.72;

/** 0 behind the A pillar's foot, 1 on the hood: where the belt hands over to the fender peak. */
export const onHood = (x: number) => smooth((x - 0.78) / 0.42);

/** The belt key at x before any end rounding, as (z, y): the glass's foot along the cabin, the fender peak on the hood. */
export function beltKey(x: number): [number, number] {
  const t = onHood(x);
  const bz = shoulderZ(x) - beltInset(x);
  const peakY = hoodY(x) + valleyDepth(x);
  return [bz + (PEAK_Z - bz) * t, beltLine(x) + (peakY - beltLine(x)) * t];
}

/** Height of the bottom edge: 0.21 m of ground clearance between the wheels, climbing at each end for the approach and departure angles. */
export function sillY(x: number): number {
  return 0.21 + 0.09 * smooth((x - 1.75) / 0.62) + 0.11 * smooth((-x - 1.62) / 0.68);
}

/** Top of the gloss black sill trim. At the nose it is the central intake's floor. */
export function rockerY(x: number): number {
  return 0.36 + 0.04 * smooth((-x - 1.8) / 0.5);
}

/** Where the lower side starts to tuck under. At the nose it is the fold over the central intake. */
export function tuckY(x: number): number {
  return 0.6 - 0.04 * smooth((x - 1.95) / 0.4);
}
