import { BODY, WHEEL } from '../dimensions';
import { profile, smooth } from './curve';

/**
 * The SUV's body, written as profiles along its length (x, nose at
 * +2.45). A cross section at any x is seven key points from under the sill
 * up and over to the centerline, each a crease:
 *
 * 0 under the sill, 1 top of the dark lower cladding, 2 the door's
 * character line, 3 the shoulder (widest over the rear haunches), 4 the
 * belt line where the glass or the hood begins, 5 halfway across the
 * hood or deck, 6 the centerline.
 */
const halfWidth = profile([[-2.45, 0.8], [-2.38, 0.89], [-2.2, 0.96], [-1.95, 0.992], [-1.45, 1.0], [-0.95, 0.968], [-0.3, 0.946], [0.5, 0.946], [1.1, 0.962], [1.48, 0.972], [1.9, 0.955], [2.2, 0.915], [2.38, 0.85], [2.45, 0.78]]);
const shoulderY = profile([[-2.45, 1.0], [-2.0, 1.04], [-1.45, 1.03], [-0.7, 0.99], [0.4, 0.975], [1.3, 0.98], [1.9, 0.96], [2.3, 0.92], [2.45, 0.87]]);
const beltY = profile([[-2.45, 1.1], [-2.3, 1.125], [-2.0, 1.12], [-1.5, 1.105], [-0.8, 1.08], [0.2, 1.06], [1.05, 1.045], [1.6, 1.035], [2.1, 1.01], [2.35, 0.97], [2.45, 0.93]]);
/** How far the belt line sits in from the shoulder: the cabin tucks in, the hood edge less so. */
const beltInset = profile([[-2.45, 0.12], [-2.0, 0.13], [-1.2, 0.125], [0.6, 0.115], [1.2, 0.095], [2.45, 0.08]]);
const creaseY = profile([[-2.45, 0.8], [-1.4, 0.78], [0.6, 0.75], [2.45, 0.72]]);

export const NOSE = BODY.nose;
export const TAIL = BODY.tail;

/** Height of the bottom edge: it climbs past the wheels for the approach and departure angles. */
function sillY(x: number): number {
  return 0.29 + 0.06 * smooth((x - 2.0) / 0.45) + 0.11 * smooth((-x - 1.95) / 0.5);
}

export interface Section {
  keys: Array<[number, number]>;
  /** Outward bow of each band between consecutive keys, m. */
  bulge: number[];
}

/** The belt line at x as (z, y): where the cabin's glass sits on the body. */
export function beltAt(x: number): [number, number] {
  return [halfWidth(x) - beltInset(x), beltY(x)];
}

export function sectionAt(x: number): Section {
  const w = halfWidth(x);
  const [bz, by] = beltAt(x);
  // The hood and the rear deck dome a little toward the middle; near the nose the dome flattens into the front.
  const dome = 0.032 * (1 - smooth((x - 2.2) / 0.25));
  const keys: Array<[number, number]> = [
    [w - 0.075, sillY(x)],
    [w - 0.028, 0.5 + 0.05 * smooth((x - 2.0) / 0.4)],
    [w - 0.006, creaseY(x)],
    [w, shoulderY(x)],
    [bz, by],
    [bz * 0.5, by + dome * 0.7],
    [0, by + dome],
  ];
  const ends = 1 - 0.7 * smooth((Math.abs(x) - 2.2) / 0.25);
  const bulge = [0.006, 0.01, 0.022, 0.016, 0.012, 0.004].map((b) => b * ends);
  return { keys, bulge };
}

/**
 * Round wheel arches. Over each wheel the side skin stops at a circle
 * round the wheel center; inside it, below the center, the opening runs
 * straight down to the sill.
 */
export const ARCH = { radius: 0.47, centerY: WHEEL.radius };
export const AXLES = [BODY.axleFront, BODY.axleRear];
/** Bands low enough to meet the wheels: the cladding, the lower door and the band up to the shoulder. */
export const ARCHED_BANDS = 3;

/** Lowest height the side skin may reach at x: the arch line over a wheel, or -1 between them. */
export function archFloor(x: number): number {
  for (const axle of AXLES) {
    const d = Math.abs(x - axle);
    if (d <= ARCH.radius) return ARCH.centerY + Math.sqrt(ARCH.radius * ARCH.radius - d * d);
  }
  return -1;
}

/** Stations where sections are taken: even spacing plus dense stations over each arch so its curve stays round. */
export function stations(count: number, archSteps: number): number[] {
  const xs: number[] = [];
  for (let i = 0; i <= count; i++) xs.push(TAIL + ((NOSE - TAIL) * i) / count);
  for (const axle of AXLES) {
    for (let i = 0; i <= archSteps; i++) {
      // Spaced by angle round the arch, so the steep ends get as many points as the crown.
      const a = Math.PI * (i / archSteps);
      xs.push(axle - Math.cos(a) * (ARCH.radius - 0.0005));
    }
    xs.push(axle - ARCH.radius - 0.0005, axle + ARCH.radius + 0.0005);
  }
  xs.sort((a, b) => a - b);
  return xs.filter((x, i) => i === 0 || x - xs[i - 1] > 0.0003);
}
