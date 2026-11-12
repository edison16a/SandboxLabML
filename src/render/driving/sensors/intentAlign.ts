import { pathPoint, projection, type Path } from '@/engine/driving/geometry/path';
import type { Prediction } from './intentPath';

/** Share of the route lane the first chevron takes, before the next ones lean on it more and more. */
const NEAR_PULL = 0.3;
/** Share of the marks over which the pull grows to the whole lane: past it they lie on the lane. */
const PULL_SPAN = 0.6;
/**
 * Below this speed every mark lies on the lane, m/s. A car standing at a
 * light can hold its wheel at full lock, and the forecast of that would
 * curl into a tight circle; where it will go once it moves is the lane.
 */
const SLOW = 6;
/** How far a chevron may sit from the lane center once aligned, m: a little past the lane's own edge, short of the far lane, else it hides. */
const LANE_HALF = 1.9;
/** A car further than this from its route is off it (a wrong turn, a spin): the forecast alone shows where it heads, m. */
const OFF_ROUTE = 3.5;

/** Route samples searched either side of the last match when the car is found again on its route. */
const WINDOW = 24;

const at = pathPoint();
const proj = projection();

/**
 * Leans a raw forecast onto the route the SUV follows. A brain steers in
 * small saturated corrections, and the forecast of a moment's wheel, held
 * for seconds, draws a circle into the oncoming lane. Where a driver plans
 * to go is mostly the lane ahead, so the nearest chevron stays close to
 * the forecast (it shows how the car reacts right now) and each one
 * further out takes more of the lane, the far half fully on it. A mark
 * past the destination, or one still off the lane after the blend, is
 * dropped, so the arrows never point across the center line or into a
 * wall. Allocation free; edits `pred` in place.
 *
 * `car` is the SUV's position in sim meters and its speed. It is found on the route by
 * projecting it there, searching round `car.index`, the sample it matched
 * last time (-1 searches the whole route, for a new car or a new trip);
 * the match is written back. `first` and `spacing` are the forecast's arc
 * lengths and `total` how many marks a full forecast has.
 */
export function alignToRoute(pred: Prediction, path: Path, car: { x: number; y: number; speed: number; index: number }, destS: number, first: number, spacing: number, total: number): Prediction {
  const full = car.index < 0;
  path.project(car.x, car.y, full ? 0 : car.index, full ? path.n : WINDOW, proj);
  // A slow frame can let the car run past the window round the last match: then search the whole route.
  if (!full && proj.distance > OFF_ROUTE) path.project(car.x, car.y, 0, path.n, proj);
  car.index = proj.index;
  if (Math.abs(proj.lateral) > OFF_ROUTE) return pred;
  const progress = proj.s;
  const near = NEAR_PULL + (1 - NEAR_PULL) * Math.max(0, 1 - Math.abs(car.speed) / SLOW);
  at.index = Math.max(0, proj.index - 1);
  let n = 0;
  for (let k = 0; k < pred.count; k++) {
    const s = progress + first + k * spacing;
    if (s > destS) break;
    path.sample(s, at, at.index);
    const w = near + (1 - near) * Math.min(1, k / Math.max(1, (total - 1) * PULL_SPAN));
    const x = pred.x[k] + (at.x - pred.x[k]) * w;
    const y = pred.y[k] + (at.y - pred.y[k]) * w;
    // Distance from the lane center, across the lane.
    const off = (x - at.x) * -at.ty + (y - at.y) * at.tx;
    if (Math.abs(off) > LANE_HALF) break;
    const lane = Math.atan2(at.ty, at.tx);
    const turn = Math.atan2(Math.sin(lane - pred.heading[k]), Math.cos(lane - pred.heading[k]));
    pred.x[n] = x;
    pred.y[n] = y;
    pred.heading[n] = pred.heading[k] + turn * w;
    n++;
  }
  pred.count = n;
  return pred;
}
