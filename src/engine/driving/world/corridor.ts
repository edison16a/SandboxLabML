import { ELEMENT_LANE, type City } from '../city/types';

/** Share of new cars and people placed near the route rather than anywhere in town. */
export const CORRIDOR_SHARE = 0.7;

/**
 * The part of town around one trip: every lane that touches a junction on
 * the route (the streets it drives and the ones it crosses), and the blocks
 * at those junctions. The world puts most of its cars and people here when
 * an episode starts, so the trip runs through busy streets while the counts
 * (and the cost of stepping them) stay the same.
 */
export interface Corridor {
  /** Lane ids near the route, and the rest. */
  nearLanes: number[];
  farLanes: number[];
  /** Sidewalk loops (indices into City.rings) near the route. */
  nearRings: number[];
}

/** The corridor of a trip through `elements` (lanes and connectors in order), counting lanes longer than `minLaneLength`. */
export function corridorOf(city: City, elements: readonly number[], minLaneLength = 0): Corridor {
  const onRoute = new Uint8Array(city.nodes.length);
  for (const id of elements) {
    onRoute[city.elements[id].from] = 1;
    onRoute[city.elements[id].to] = 1;
  }
  const nearLanes: number[] = [];
  const farLanes: number[] = [];
  for (const e of city.elements) {
    if (e.kind !== ELEMENT_LANE || e.path.length <= minLaneLength) continue;
    (onRoute[e.from] || onRoute[e.to] ? nearLanes : farLanes).push(e.id);
  }
  const nearRings: number[] = [];
  const nx = city.xs.length;
  city.blocks.forEach((b, r) => {
    const corners = [b.j * nx + b.i, b.j * nx + b.i + 1, (b.j + 1) * nx + b.i, (b.j + 1) * nx + b.i + 1];
    if (corners.some((n) => onRoute[n])) nearRings.push(r);
  });
  return { nearLanes, farLanes, nearRings };
}
