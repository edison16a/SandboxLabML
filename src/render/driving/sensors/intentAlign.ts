import { pathPoint, type Path } from '@/engine/driving/geometry/path';
import type { Prediction } from './intentPath';

/** Share of the route lane the first chevron takes, before the next ones lean on it more and more. */
const NEAR_PULL = 0.3;
/** Share of the marks over which the pull grows to the whole lane: past it they lie on the lane. */
const PULL_SPAN = 0.6;
/** How far a chevron may sit from the lane center once aligned, m: past it the arrow would lie on the other lane or the curb, so it hides. */
const LANE_HALF = 2.4;
/** A car further than this from its route is off it (a wrong turn, a spin): the forecast alone shows where it heads, m. */
const OFF_ROUTE = 3.5;

const at = pathPoint();

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
 * `car` is the SUV's position and route arc length (sim meters), with the
 * route sample it is at as a search hint. `first` and `spacing` are the
 * forecast's arc lengths and `total` how many marks a full forecast has.
 */
export function alignToRoute(pred: Prediction, path: Path, car: { x: number; y: number; progress: number; index: number }, destS: number, first: number, spacing: number, total: number): Prediction {
  path.sample(car.progress, at, Math.max(0, car.index - 2));
  if (Math.abs((car.x - at.x) * -at.ty + (car.y - at.y) * at.tx) > OFF_ROUTE) return pred;
  const progress = car.progress;
  let n = 0;
  for (let k = 0; k < pred.count; k++) {
    const s = progress + first + k * spacing;
    if (s > destS) break;
    path.sample(s, at, at.index);
    const w = NEAR_PULL + (1 - NEAR_PULL) * Math.min(1, k / Math.max(1, (total - 1) * PULL_SPAN));
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
