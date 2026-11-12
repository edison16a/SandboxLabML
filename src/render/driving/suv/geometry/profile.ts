import { BODY, WHEEL } from '../dimensions';
import { smooth } from './curve';
import { endPull, NOSE, ROUND, TAIL } from './ends';
import { beltKey, deckLine, onHood, rockerY, shoulderY, shoulderZ, sillY, tuckY } from './lines';
import { deg, key, type Key } from './section';

export { NOSE, TAIL } from './ends';
export { sillY } from './lines';

/**
 * A cross section of the body at x is eight keys from under the sill up
 * and over to the centerline:
 *
 * 0 under the sill, 1 top of the satin black sill cladding, which stands
 * nearly upright so it reads from the side as a band and rolls in at its
 * top (rockerLean), 2 where the lower side starts to tuck under, 3 and 4
 * either end of the shoulder crease's small radius, 5 the belt where the
 * glass sits (ahead of the windshield, the fender peak), 6 the edge of the
 * hood's valley, 7 the centerline.
 *
 * The spans between keys are smooth curves. Below the shoulder the side
 * stands nearly upright and only gently full; above it a shelf leans in
 * to the glass. The shoulder itself turns over a 1.5 cm radius, sharp
 * enough to draw one clean line of light down the whole car.
 */
export interface Section {
  keys: Key[];
}

/** The shoulder crease's radius, m. */
const SHOULDER_R = 0.015;

/**
 * How far the sill cladding's top leans in where it meets the paint. The
 * cladding swells out low and rolls back in at the top, so its upper part
 * faces the sky and shows a satin sheen above the dark shadow under the
 * car instead of merging with it. The roll fades out round the ends, so
 * the lip and the diffuser keep their own shape.
 */
function rockerLean(x: number): number {
  return deg(-6 + 28 * smooth((2.2 - x) / 0.25) * smooth((x + 2.15) / 0.25));
}

/** The belt line at x as (z, y), after the end rounding: where the cabin's glass sits on the body. */
export function beltAt(x: number): [number, number] {
  const [bz, by] = beltKey(x);
  const pull = endPull(x);
  // At the nose the fender peak only half drops into the face, easing from the unrolled shoulder to the rolled hood.
  return [bz - pull.peak, by - pull.drop * (x > 0 ? 0.5 : 1)];
}

/** Height of the body's top at the centerline: the hood's valley floor, or the tail's deck. */
export function deckY(x: number): number {
  return deckLine(x) - endPull(x).drop;
}

export function sectionAt(x: number): Section {
  const pull = endPull(x);
  const w = shoulderZ(x) - pull.side;
  // How far round the nose corner the section is, 0 to 1: the shoulder turns over more and more toward the face.
  const turn = x > 0 ? (pull.side / ROUND.nose.plan) ** 1.5 : 0;
  // At both ends the shoulder keeps its height: it rolls over into the nose face and runs into the tail lamps; only the top drops.
  const ys = shoulderY(x);
  const [bz, by] = beltAt(x);
  const v = by - deckY(x);
  // The shoulder: the side arrives upright, the shelf leaves leaning in, a little flatter on the front fender.
  // Round the nose's corner the shelf flattens until it runs level into the fender peak, which has come down
  // to the shoulder's height by the face, and the crease softens a little. The face's top outline then rises
  // from the valley, runs level over the lamp and turns down into the side over one small radius.
  const up = deg(-3);
  const shelf = deg(58 + 8 * onHood(x) + 26 * turn);
  const r = SHOULDER_R * (1 + (x > 0 ? 0.4 * (pull.side / ROUND.nose.plan) : 0));
  const t = r * Math.tan((shelf - up) / 2);
  // Along the cabin the shelf ends under the glass; on the hood it crests flat at the fender peak, and the tail's deck flattens too.
  const crest = deg(72 + 18 * onHood(x) + 8 * smooth((-x - 2.0) / 0.3));
  // On the hood the peak is a soft crease, so a line of light runs along each fender from the A pillar to the
  // lamp. Over the lamp it melts into a round crest, so the hood's leading edge has no notch where it meets.
  const crease = deg(12) * smooth((x - 0.9) / 0.45) * (1 - smooth((x - NOSE + ROUND.nose.plan) / 0.3));
  // The valley falls from the peak to a floor on the centerline like half a cosine wave: flat at both ends, one U, no ridge.
  const fall = Math.atan((Math.PI / 2) * Math.sin(0.45 * Math.PI) * (v / Math.max(bz, 0.2)));
  const keys: Key[] = [
    key(w - 0.085, sillY(x), deg(-70)),
    key(w - 0.032, rockerY(x), rockerLean(x), deg(-10)),
    key(w - 0.014, tuckY(x), deg(-5)),
    key(w + t * Math.sin(up), ys - t * Math.cos(up), up),
    key(w - t * Math.sin(shelf), ys + t * Math.cos(shelf), shelf),
    key(bz, by, crest, crest + crease),
    key(bz * 0.45, by - v + v * 0.5 * (1 - Math.cos(0.45 * Math.PI)), deg(90) + fall),
    key(0, by - v, deg(90)),
  ];
  return { keys };
}

/**
 * Round wheel arches, cut 4.7 cm clear of the tire, so the body wraps the
 * big wheels. Over each wheel the side skin stops at a circle round the
 * wheel center; below the center the opening runs straight down to the sill.
 */
export const ARCH = { radius: WHEEL.radius + 0.047, centerY: WHEEL.radius };
export const AXLES = [BODY.axleFront, BODY.axleRear];
/** Bands low enough to meet the wheels: the sill trim, the lower side and the side up to the shoulder. */
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
 * Outside each arch's end the side skin runs on full height. Stations
 * there step out from the arch's own tight ones in growing gaps, so the
 * spacing blends into the even run instead of jumping from millimeters
 * to centimeters, which would show as a line in the reflections.
 */
const ARCH_EXIT = [0.0005, 0.009, 0.03];

/**
 * Stations where sections are taken: even spacing, plus dense stations
 * over each arch so its curve stays round and round each end's curl.
 */
export function stations(count: number, archSteps: number): number[] {
  const xs: number[] = [];
  // The far population keeps only the first step out of each arch: it has no stations to spare.
  const exits = archSteps >= 10 ? ARCH_EXIT : ARCH_EXIT.slice(0, 1);
  const margin = exits.length > 1 ? exits[exits.length - 1] + 0.02 : 0.01;
  // Over an arch or an end only its own stations are used: mixing two spacings there streaks the reflections.
  const overArch = (x: number) => AXLES.some((a) => Math.abs(x - a) < ARCH.radius + margin);
  const atEnd = (x: number) => x > NOSE - ROUND.nose.plan - 0.01 || x < TAIL + ROUND.tail.plan + 0.01;
  for (let i = 0; i <= count; i++) {
    const x = TAIL + ((NOSE - TAIL) * i) / count;
    if (!overArch(x) && !atEnd(x)) xs.push(x);
  }
  // Spaced by angle round each curl, so the tight end gets as many sections as the gentle start.
  const steps = Math.max(3, Math.round(archSteps / 2));
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
    for (const d of exits) xs.push(axle - ARCH.radius - d, axle + ARCH.radius + d);
  }
  xs.sort((a, b) => a - b);
  return xs.filter((x, i) => i === 0 || x - xs[i - 1] > 0.0003);
}
