import type { PreviewBounds } from '../../env/hooks';
import { DIR_X, DIR_Y, LANE_OFFSET, PROPERTY, ROAD_HALF, STOP_LINE, type Dir } from '../city/dimensions';
import type { City } from '../city/types';
import type { Route } from '../route/route';

/**
 * The still parts of a Driving lesson or test run preview, as plain data
 * posted from a worker: the streets, the blocks, the zebra crossings, the
 * lamps of every signal and the route. The Studio's drawer paints the city
 * from it and the moving parts (lights, cars, people) from the world block
 * of each recorded tick. Meters, y up, as in the simulation.
 */
export interface DrivingPreviewScene {
  /** Street centerlines: vertical streets at xs, horizontal ones at ys. */
  xs: number[];
  ys: number[];
  /** Centerline to curb, m. */
  roadHalf: number;
  /** City extent, curb to curb. */
  extent: PreviewBounds;
  /** Block curb outlines as [x0, y0, x1, y1] runs. */
  blocks: number[];
  /** Zebra crossings as [x, y, arm] runs: the center and the arm of the junction it crosses (0 east, 1 north, 2 west, 3 south). */
  crosswalks: number[];
  /** Signal lamps as [signal, travel direction, x, y] runs, at the stop line of each approach. */
  lamps: number[];
  /** The route as [x, y] pairs, start to destination, every few meters. */
  route: number[];
  /** Stop lines on the route as [x, y, heading] runs. */
  stops: number[];
  start: { x: number; y: number; heading: number };
  destination: { x: number; y: number; heading: number };
}

/** Route samples kept for the drawing, m apart. Enough for smooth turns at preview scale. */
const ROUTE_STEP = 2;

function poseOn(route: Route, s: number) {
  const i = route.path.indexAt(s);
  return { x: route.path.x[i], y: route.path.y[i], heading: Math.atan2(route.path.ty[i], route.path.tx[i]) };
}

/** The preview scene of one trip in its city. */
export function drivingPreviewScene(city: City, route: Route): DrivingPreviewScene {
  const blocks = city.blocks.flatMap((b) => [b.x0, b.y0, b.x1, b.y1]);
  const crosswalks = city.crosswalks.flatMap((c) => [c.x, c.y, c.arm]);
  const lamps: number[] = [];
  city.signals.forEach((nodeId, k) => {
    const node = city.nodes[nodeId];
    for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
      // Traffic heading in direction d arrives from the arm opposite it.
      if (!node.arms[(d + 2) % 4]) continue;
      const tx = DIR_X[d];
      const ty = DIR_Y[d];
      lamps.push(k, d, node.x - tx * STOP_LINE + ty * LANE_OFFSET, node.y - ty * STOP_LINE - tx * LANE_OFFSET);
    }
  });
  const points: number[] = [];
  for (let s = route.startS; s < route.destS; s += ROUTE_STEP) {
    const p = poseOn(route, s);
    points.push(p.x, p.y);
  }
  const end = poseOn(route, route.destS);
  points.push(end.x, end.y);
  const stops = route.stops.flatMap((st) => {
    const p = poseOn(route, st.s);
    return [p.x, p.y, p.heading];
  });
  const b = city.bounds;
  return {
    xs: [...city.xs],
    ys: [...city.ys],
    roadHalf: ROAD_HALF,
    extent: { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY },
    blocks,
    crosswalks,
    lamps,
    route: points,
    stops,
    start: poseOn(route, route.startS),
    destination: end,
  };
}

/** How much city to show around the route, m: enough to see the next junction and the people waiting at it. */
const MARGIN = 28;

/** The part of the city a preview fits: the route with a margin, kept inside the city and its sidewalks. */
export function drivingPreviewBounds(city: City, route: Route): PreviewBounds {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (let s = route.startS; s <= route.destS; s += ROUTE_STEP) {
    const p = poseOn(route, s);
    b.minX = Math.min(b.minX, p.x);
    b.maxX = Math.max(b.maxX, p.x);
    b.minY = Math.min(b.minY, p.y);
    b.maxY = Math.max(b.maxY, p.y);
  }
  const c = city.bounds;
  return {
    minX: Math.max(c.minX - PROPERTY, b.minX - MARGIN),
    minY: Math.max(c.minY - PROPERTY, b.minY - MARGIN),
    maxX: Math.min(c.maxX + PROPERTY, b.maxX + MARGIN),
    maxY: Math.min(c.maxY + PROPERTY, b.maxY + MARGIN),
  };
}
