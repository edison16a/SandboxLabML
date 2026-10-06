import { CAR } from '../dimensions';
import { between, profile, smooth } from './curve';

/**
 * The body's design, written as profiles along its length (x, in meters,
 * nose at +2.24). A cross-section at any x is eight key points from under
 * the sill up and over to the centerline, each a sharp crease:
 *
 * 0 under the sill, 1 top of the carbon skirt, 2 rocker, 3 the rising side
 * crease, 4 shoulder, 5 hood edge (where paint meets carbon), 6 hood facet,
 * 7 center ridge.
 */
export const BODY = { nose: 2.24, tail: -2.24 };

const halfWidth = profile([[-2.24, 0.8], [-2.12, 0.885], [-1.9, 0.94], [-1.55, 0.966], [-1.32, 0.968], [-1.0, 0.955], [-0.6, 0.92], [-0.1, 0.9], [0.5, 0.91], [1.0, 0.94], [1.38, 0.952], [1.75, 0.94], [2.0, 0.885], [2.15, 0.81], [2.24, 0.73]]);
/** The crease that climbs from the front arch to the rear haunch, the line most wedge cars are drawn around. */
const creaseY = profile([[-2.24, 0.64], [-1.95, 0.7], [-1.1, 0.7], [-0.4, 0.65], [0.4, 0.58], [1.0, 0.54], [1.8, 0.46], [2.24, 0.4]]);
const shoulderZ = profile([[-2.24, 0.74], [-2.1, 0.83], [-1.9, 0.885], [-1.35, 0.915], [-0.75, 0.87], [0.1, 0.83], [0.9, 0.85], [1.4, 0.875], [1.85, 0.83], [2.1, 0.74], [2.24, 0.65]]);
const shoulderY = profile([[-2.24, 0.86], [-1.95, 0.93], [-1.35, 0.95], [-0.75, 0.895], [0.0, 0.815], [0.8, 0.805], [1.38, 0.795], [1.85, 0.67], [2.24, 0.51]]);
const hoodZ = profile([[-2.24, 0.46], [-1.6, 0.54], [-0.8, 0.6], [0.95, 0.62], [1.4, 0.56], [1.9, 0.46], [2.24, 0.34]]);
/** Centerline of the hood and deck: one straight wedge from the nose up to the windshield. */
const centerY = profile([[-2.24, 0.86], [-1.95, 0.9], [-1.0, 0.87], [0.96, 0.835], [1.2, 0.785], [2.24, 0.53]]);

/** The side scoop behind the door that feeds the side intake: the rocker pulls in, the crease above stays out. */
export const SCOOP = { from: -0.98, to: -0.4, depth: 0.11 };
export const scoop = (x: number) => between(x, SCOOP.from, SCOOP.to, 0.24);

export interface Section {
  keys: Array<[number, number]>;
  /** Outward bow of each band between consecutive keys, in meters. */
  bulge: number[];
}

export function sectionAt(x: number): Section {
  const w = halfWidth(x);
  const s = scoop(x);
  const c = centerY(x);
  const hz = hoodZ(x);
  // Behind the rear wheels the lower edge climbs, leaving room for the diffuser under the tail.
  const lift = 0.19 * smooth((-x - 1.78) / 0.42);
  const keys: Array<[number, number]> = [
    [w - 0.075, 0.12 + lift],
    [w - 0.016, 0.245 + lift * 0.62],
    [w - s * SCOOP.depth, 0.36 + lift * 0.3],
    [w - 0.01, Math.max(creaseY(x), 0.38)],
    [shoulderZ(x), shoulderY(x)],
    [hz, c - 0.045],
    [hz * 0.42, c - 0.016],
    [0, c],
  ];
  // Near the nose the bands flatten out so the front face gets a clean, straight top edge.
  const flat = 1 - 0.75 * smooth((x - 1.85) / 0.39);
  const bulge = [0.004, 0.006, 0.014 - s * 0.034, 0.02, 0.024, 0.01, 0.006].map((b) => b * flat);
  return { keys, bulge };
}

/**
 * Wheel arches with a flat top and straight flanks, rounded at the corners.
 * The trapezoid is a signature of wedge supercars; a plain circle reads as
 * an ordinary coupe.
 */
export const ARCH = { top: 0.752, flat: 0.16, foot: 0.425, round: 0.09, centerY: CAR.wheelRadius };
export const AXLES = [CAR.axleFront, CAR.axleRear];

/**
 * Lowest y the side skin may reach at this x: the arch line over the
 * wheels, or -1 between them. Below the wheel center the arch runs straight
 * down to the sill.
 */
export function archFloor(x: number): number {
  const slope = (ARCH.top - ARCH.centerY) / (ARCH.foot - ARCH.flat);
  for (const axle of AXLES) {
    const d = Math.abs(x - axle) - ARCH.flat;
    if (d > ARCH.foot - ARCH.flat) continue;
    const r = ARCH.round;
    const ramp = d < -r ? 0 : d > r ? d : ((d + r) * (d + r)) / (4 * r);
    return ARCH.top - slope * ramp;
  }
  return -1;
}

/**
 * Stations along the car where sections are taken: even spacing, plus extra
 * stations across each arch so its corners stay round, and a pair at each
 * foot so the arch drops straight to the sill.
 */
export function stations(count: number, archSteps: number): number[] {
  const xs: number[] = [];
  for (let i = 0; i <= count; i++) xs.push(BODY.tail + ((BODY.nose - BODY.tail) * i) / count);
  for (const axle of AXLES) {
    for (let i = 0; i <= archSteps; i++) xs.push(axle - ARCH.foot + 0.0005 + ((2 * ARCH.foot - 0.001) * i) / archSteps);
    xs.push(axle - ARCH.foot - 0.0005, axle + ARCH.foot + 0.0005);
  }
  xs.sort((a, b) => a - b);
  return xs.filter((x, i) => i === 0 || x - xs[i - 1] > 0.0003);
}
