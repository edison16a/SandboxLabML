import { keysAt, planShare } from '../body/frame';
import type { Pt } from '../body/section';
import type { CarShape, Region } from './types';

/** Heights of the belt and the rail's side edge at x, and the rail's top edge out from the centerline. */
const belt = (s: CarShape, x: number) => keysAt(s, x)[4].y;
const rail = (s: CarShape, x: number) => keysAt(s, x)[5].y;
const edge = (s: CarShape, x: number) => keysAt(s, x)[6].z * planShare(s, x);

/** n + 1 values from a to b. */
const steps = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

/**
 * The side glass in side view: along the belt below, under the roof rail
 * above, from where the A pillar meets the belt back to a C pillar that
 * runs from `cTop` on the rail down to `rearTip` on the belt. The front
 * tip is found where the rail comes down to meet the belt, so the glass
 * always closes to a point under the A pillar.
 */
export function sideGlass(s: CarShape, o: { cTop: number; rearTip: number; gap?: number; drop?: number }): Region {
  const gap = o.gap ?? 0.014;
  const drop = o.drop ?? 0.024;
  const room = (x: number) => rail(s, x) - drop - (belt(s, x) + gap);
  let front = o.cTop;
  while (front < s.length / 2 - 0.5 && room(front + 0.01) > 0.012) front += 0.01;
  const bottom: Pt[] = steps(front, o.rearTip, 12).map((x) => [x, belt(s, x) + gap]);
  const top: Pt[] = steps(front, o.cTop, 10).map((x) => [x, Math.max(belt(s, x) + gap, rail(s, x) - drop)]);
  top.push([o.rearTip, belt(s, o.rearTip) + gap]);
  return { view: 'side', bottom, top };
}

/** A slim pillar standing across the side glass at x, leaning back by `lean` at the top. */
export function pillar(s: CarShape, x: number, width: number, lean: number): Region {
  const y0 = belt(s, x) + 0.004;
  const y1 = rail(s, x - lean) - 0.012;
  return { view: 'side', bottom: [[x - width / 2, y0], [x - lean - width / 2, y1]], top: [[x + width / 2, y0], [x - lean + width / 2, y1]] };
}

/**
 * A window on the car's top seen from above: between a lower edge at
 * `low` and an upper edge at `high` (x on the centerline), out to the
 * rail's top edge less `margin`. Both edges bow by `bow` toward the
 * pillars, as glass always does.
 */
export function topGlass(s: CarShape, o: { low: number; high: number; bow: number; margin: number }): Region {
  const dir = Math.sign(o.high - o.low);
  const lowEnd = o.low + dir * o.bow;
  const highEnd = o.high - dir * o.bow * 0.35;
  const z = (x: number) => edge(s, x) - o.margin;
  const curve = (x0: number, x1: number): Pt[] => steps(0, 1, 4).map((t) => [x0 + (x1 - x0) * t * t, z(x1) * t]);
  return {
    view: 'top',
    bottom: curve(o.low, lowEnd),
    top: curve(o.high, highEnd),
    right: steps(lowEnd, highEnd, 8).map((x) => [x, z(x)]),
  };
}

/** A slim strip in any view from a lower curve and a height, for lamps, lines and badges. */
export function strip(view: Region['view'], bottom: Pt[], height: number | Pt[]): Region {
  return { view, bottom, top: typeof height === 'number' ? bottom.map(([a, b]) => [a, b + height] as Pt) : height };
}

/** A thin vertical line on the side from (x0, y0) up to (x1, y1), like a door's shut line. */
export function shutLine(x0: number, y0: number, x1: number, y1: number, width = 0.007): Region {
  return { view: 'side', bottom: [[x0 - width / 2, y0], [x1 - width / 2, y1]], top: [[x0 + width / 2, y0], [x1 + width / 2, y1]] };
}
