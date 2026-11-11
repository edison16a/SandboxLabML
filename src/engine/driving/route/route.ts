import { Path } from '../geometry/path';
import { axisOf } from '../signals/plan';
import { ELEMENT_CONNECTOR, type City } from '../city/types';

/** A stop line on the route: where it is, and which signal and axis govern it. */
export interface RouteStop {
  /** Route arc length of the stop line, m. */
  s: number;
  node: number;
  /** Index into City.signals. */
  signal: number;
  axis: number;
}

/** A turn (or a straight run) through an intersection on the route. */
export interface RouteTurn {
  /** Route arc length where the connector starts (the stop line), m. */
  s: number;
  end: number;
  node: number;
  turn: -1 | 0 | 1;
  element: number;
}

/**
 * One trip through the city: the road elements in order, their paths
 * joined into one polyline, and everything a driver needs to know along it.
 * Every learner of a generation drives the same Route, built once, so the
 * per tick work is lookups on shared typed arrays.
 */
export interface Route {
  elements: number[];
  path: Path;
  /** Route arc length where each element begins. */
  elementStart: Float64Array;
  /** For each path sample, the position in `elements` it belongs to. */
  sampleElement: Int32Array;
  /** Speed limit at each path sample, m/s. */
  sampleLimit: Float64Array;
  stops: RouteStop[];
  turns: RouteTurn[];
  /** Zebra crossings the route passes over, in route arc length. */
  crossings: Array<{ crosswalk: number; s0: number; s1: number }>;
  /** Where the trip starts and where the destination zone is centered, in route arc length. */
  startS: number;
  destS: number;
  length: number;
}

/** Half length of the destination zone, m: stop with the car's center inside it to arrive. */
export const DEST_HALF = 7;

/**
 * Joins a chain of elements into a Route. `startS` is how far into the
 * first element the trip starts, and `destS` how far into the last one the
 * destination sits.
 */
export function buildRoute(city: City, elements: number[], startS: number, destS: number): Route {
  const xs: number[] = [];
  const ys: number[] = [];
  const owner: number[] = [];
  const limits: number[] = [];
  const elementStart = new Float64Array(elements.length);
  let s = 0;
  elements.forEach((id, k) => {
    const p = city.elements[id].path;
    elementStart[k] = s;
    // Each element starts where the last one ended, so the shared point is kept once.
    for (let i = k === 0 ? 0 : 1; i < p.n; i++) {
      xs.push(p.x[i]);
      ys.push(p.y[i]);
      owner.push(k);
      limits.push(city.elements[id].speedLimit);
    }
    s += p.length;
  });
  const path = new Path(xs, ys);
  const stops: RouteStop[] = [];
  const turns: RouteTurn[] = [];
  const crossings: Route['crossings'] = [];
  elements.forEach((id, k) => {
    const e = city.elements[id];
    for (const c of e.crossings) crossings.push({ crosswalk: c.crosswalk, s0: elementStart[k] + c.s0, s1: elementStart[k] + c.s1 });
    if (e.kind === ELEMENT_CONNECTOR) {
      turns.push({ s: elementStart[k], end: elementStart[k] + e.path.length, node: e.from, turn: e.turn, element: id });
    } else if (e.stopLine && k < elements.length - 1) {
      const node = city.nodes[e.to];
      stops.push({ s: elementStart[k] + e.path.length, node: node.id, signal: node.signal, axis: axisOf(e.dir) });
    }
  });
  const last = elements.length - 1;
  return {
    elements,
    path,
    elementStart,
    sampleElement: Int32Array.from(owner),
    sampleLimit: Float64Array.from(limits),
    stops,
    turns,
    crossings,
    startS: startS,
    destS: elementStart[last] + destS,
    length: path.length,
  };
}
