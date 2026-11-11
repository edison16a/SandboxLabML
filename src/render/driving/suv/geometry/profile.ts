import { BODY, WHEEL } from '../dimensions';
import { between, profile, smooth } from './curve';
import { deg, key, type Key } from './section';

/**
 * The SUV's body, written as profiles along its length (x, nose at
 * +2.45). A cross section at any x is seven keys from under the sill up
 * and over to the centerline:
 *
 * 0 under the sill, 1 top of the gloss black rocker, 2 the lower door
 * sculpt, 3 the shoulder (widest, swelling over the rear haunches), 4 the
 * belt where the glass sits, which ahead of the windshield is the fender
 * peak, 5 the edge of the hood's valley, 6 the centerline.
 *
 * The spans between keys are smooth curves. Only the rocker and the door
 * sculpt are creases; the shoulder rolls over in one clean radius.
 */
const halfWidth = profile([[-2.45, 0.965], [-2.3, 0.979], [-1.9, 0.996], [-1.42, 1.0], [-1.0, 0.988], [-0.55, 0.962], [0.0, 0.955], [0.6, 0.958], [1.1, 0.976], [1.48, 0.985], [1.9, 0.975], [2.2, 0.956], [2.45, 0.94]]);
const shoulderY = profile([[-2.45, 0.99], [-2.2, 0.962], [-1.9, 0.942], [-1.42, 0.936], [-0.6, 0.912], [0.6, 0.9], [1.48, 0.918], [1.95, 0.9], [2.25, 0.85], [2.45, 0.8]]);
/** The lower door sculpt: low at the front door, rising toward the rear haunch. */
const creaseY = profile([[-2.45, 0.6], [-1.42, 0.655], [-0.95, 0.645], [1.0, 0.575], [1.48, 0.57], [2.45, 0.55]]);
/** The belt line, which carries on ahead of the windshield as the fender peak and falls toward the nose, so the hood reads low and sporty. */
const beltY = profile([[-2.45, 1.18], [-2.3, 1.19], [-1.8, 1.176], [-1.0, 1.14], [0.0, 1.11], [1.0, 1.1], [1.5, 1.085], [1.95, 1.045], [2.25, 0.995], [2.45, 0.955]]);
/** How far the belt sits in from the shoulder: the tumblehome shelf, widest over the haunches and the front fenders. */
const beltInset = profile([[-2.45, 0.17], [-2.2, 0.2], [-1.42, 0.205], [-0.8, 0.18], [0.0, 0.166], [0.9, 0.172], [1.5, 0.2], [2.2, 0.185], [2.45, 0.15]]);

export const NOSE = BODY.nose;
export const TAIL = BODY.tail;

/**
 * How the ends round off. Over the last `plan` m the sides curl in until
 * they face straight forward (or back), a corner radius in plan view,
 * while the top drops by `roll`, so the hood rolls down into the face.
 * The face then meets the body with no crease anywhere round its edge.
 */
export const ROUND = { nose: { plan: 0.22, roll: 0.06 }, tail: { plan: 0.18, roll: 0.025 } };

/** How far the end rounding pulls the section at x in (plan) and down (roll), m. */
export function endRound(x: number): { inset: number; drop: number } {
  const end = x > 0 ? ROUND.nose : ROUND.tail;
  const into = x > 0 ? x - NOSE + end.plan : TAIL + end.plan - x;
  if (into <= 0) return { inset: 0, drop: 0 };
  // A quarter circle in plan and a quarter ellipse in side view, both reaching vertical at the end.
  const s = Math.min(1, into / end.plan);
  const k = 1 - Math.sqrt(1 - s * s);
  return { inset: end.plan * k, drop: end.roll * k };
}

/** Height of the bottom edge: an SUV's ground clearance, climbing past the wheels for the approach and departure angles. */
export function sillY(x: number): number {
  return 0.28 + 0.045 * smooth((x - 2.0) / 0.45) + 0.08 * smooth((-x - 1.95) / 0.5);
}

function rockerY(x: number): number {
  return 0.37 + 0.035 * smooth((x - 1.95) / 0.45) + 0.06 * smooth((-x - 1.9) / 0.5);
}

/** How deep the hood's valley sits below the fender peaks; negative domes the short rear deck instead. */
function valley(x: number): number {
  return 0.04 * smooth((x - 0.3) / 0.4) + 0.045 * smooth((x - 1.6) / 0.85) - 0.03 * smooth((-x - 2.2) / 0.15);
}

export interface Section {
  keys: Key[];
}

/** The belt line at x as (z, y): where the cabin's glass sits on the body. */
export function beltAt(x: number): [number, number] {
  const r = endRound(x);
  return [halfWidth(x) - r.inset - beltInset(x), beltY(x) - r.drop];
}

/** Height of the body's top at the centerline: the hood's valley floor, or the rear deck. */
export function deckY(x: number): number {
  return beltY(x) - valley(x) + 0.006 - endRound(x).drop;
}

export function sectionAt(x: number): Section {
  const w = halfWidth(x) - endRound(x).inset;
  const [bz, by] = beltAt(x);
  const v = valley(x);
  // The sculpt only dishes the doors between the arches; it fades out over the fenders.
  const c = between(x, -0.95, 1.05, 0.3);
  // Along the cabin the shoulder ends on a shelf under the glass; on the hood it crests flat at the fender peak.
  const crest = deg(72 + 18 * smooth((x - 0.85) / 0.3) + 8 * smooth((-x - 2.3) / 0.12));
  const keys: Key[] = [
    key(w - 0.085, sillY(x), deg(-75)),
    key(w - 0.045, rockerY(x), deg(-22), deg(-8 + 9 * c)),
    key(w - 0.012, creaseY(x), deg(-8 - 16 * c), deg(-5)),
    key(w, shoulderY(x), deg(1)),
    key(bz, by, crest),
    key(bz * 0.36, by - v, deg(90)),
    key(0, by - v + 0.006, deg(90)),
  ];
  return { keys };
}

/**
 * Round wheel arches, cut close round the tire (its radius plus 4.5 cm) so
 * the big wheels fill them. Over each wheel the side skin stops at a circle
 * round the wheel center; below the center the opening runs straight down
 * to the sill.
 */
export const ARCH = { radius: WHEEL.radius + 0.045, centerY: WHEEL.radius };
export const AXLES = [BODY.axleFront, BODY.axleRear];
/** Bands low enough to meet the wheels: the rocker, the lower door and the side up to the shoulder. */
export const ARCHED_BANDS = 3;

/** Lowest height the side skin may reach at x: the arch line over a wheel, or -1 between them. */
export function archFloor(x: number): number {
  for (const axle of AXLES) {
    const d = Math.abs(x - axle);
    if (d <= ARCH.radius) return ARCH.centerY + Math.sqrt(ARCH.radius * ARCH.radius - d * d);
  }
  return -1;
}

/**
 * Stations where sections are taken: even spacing, plus dense stations
 * over each arch so its curve stays round and round each end's curl.
 */
export function stations(count: number, archSteps: number): number[] {
  const xs: number[] = [];
  // Over an arch or an end only its own stations are used: mixing two spacings there streaks the reflections.
  const overArch = (x: number) => AXLES.some((a) => Math.abs(x - a) < ARCH.radius + 0.01);
  const atEnd = (x: number) => x > NOSE - ROUND.nose.plan - 0.01 || x < TAIL + ROUND.tail.plan + 0.01;
  for (let i = 0; i <= count; i++) {
    const x = TAIL + ((NOSE - TAIL) * i) / count;
    if (!overArch(x) && !atEnd(x)) xs.push(x);
  }
  // Spaced by angle round each curl, so the tight end gets as many sections as the gentle start.
  const steps = Math.max(2, Math.round(archSteps / 2));
  for (let i = 0; i <= steps; i++) {
    const s = Math.sin((Math.PI / 2) * (i / steps));
    xs.push(NOSE - ROUND.nose.plan * (1 - s), TAIL + ROUND.tail.plan * (1 - s));
  }
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
