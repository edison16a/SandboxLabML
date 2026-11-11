import { PathBuilder, quarterTurn } from '../geometry/builder';
import type { Path } from '../geometry/path';
import {
  BEND_OUTER_RADIUS,
  CROSSWALK_FAR,
  CROSSWALK_NEAR,
  DIR_X,
  DIR_Y,
  LANE_OFFSET,
  LEFT_TURN_RADIUS,
  RIGHT_TURN_RADIUS,
  ROAD_HALF,
  SLOW_LIMIT,
  STOP_LINE,
  TOWN_LIMIT,
  opposite,
  turnBetween,
  type Dir,
} from './dimensions';
import { ELEMENT_CONNECTOR, ELEMENT_LANE, type CityNode, type CitySpec, type CrossingSpan, type RoadElement } from './types';

/** Sample spacing for lanes and for the tighter connectors, m. */
const LANE_STEP = 1;
const TURN_STEP = 0.5;

/** Neighbor of a node one street over in direction d, or -1 past the edge. */
function neighbor(nodes: CityNode[], nx: number, node: CityNode, d: Dir): number {
  if (!node.arms[d]) return -1;
  return (node.j + DIR_Y[d]) * (nx + 1) + node.i + DIR_X[d];
}

function laneElement(id: number, a: CityNode, b: CityNode, dir: Dir, limit: number): RoadElement {
  // Right hand traffic: the lane sits to the right of the street's centerline.
  const ox = DIR_Y[dir] * LANE_OFFSET;
  const oy = -DIR_X[dir] * LANE_OFFSET;
  const path = new PathBuilder(LANE_STEP)
    .moveTo(a.x + DIR_X[dir] * STOP_LINE + ox, a.y + DIR_Y[dir] * STOP_LINE + oy)
    .lineTo(b.x - DIR_X[dir] * STOP_LINE + ox, b.y - DIR_Y[dir] * STOP_LINE + oy)
    .build();
  return { id, kind: ELEMENT_LANE, path, next: [], from: a.id, to: b.id, dir, exitDir: dir, turn: 0, speedLimit: limit, stopLine: b.signal >= 0, opposite: -1, fromLane: -1, toLane: -1, crossings: [] };
}

/**
 * Every lane in the city: two per street segment, one each way, running
 * between the stop lines at either end. Lanes come in pairs so each knows
 * the lane opposite it.
 */
export function buildLanes(spec: CitySpec, nodes: CityNode[], nx: number): RoadElement[] {
  const lanes: RoadElement[] = [];
  const slowV = new Set(spec.slow?.vertical ?? []);
  const slowH = new Set(spec.slow?.horizontal ?? []);
  for (const node of nodes) {
    for (const d of [0, 1] as const) {
      const other = neighbor(nodes, nx, node, d);
      if (other < 0) continue;
      const b = nodes[other];
      const slow = d === 0 ? slowH.has(node.j) : slowV.has(node.i);
      const limit = slow ? SLOW_LIMIT : TOWN_LIMIT;
      const forward = laneElement(lanes.length, node, b, d, limit);
      const back = laneElement(lanes.length + 1, b, node, opposite(d), limit);
      forward.opposite = back.id;
      back.opposite = forward.id;
      lanes.push(forward, back);
    }
  }
  return lanes;
}

/** The arc length span where a connector's path lies on a zebra crossing of `arm`, or null. */
function crossingSpan(path: Path, node: CityNode, arm: Dir): [number, number] | null {
  let s0 = -1;
  let s1 = -1;
  for (let i = 0; i < path.n; i++) {
    const dx = path.x[i] - node.x;
    const dy = path.y[i] - node.y;
    const along = dx * DIR_X[arm] + dy * DIR_Y[arm];
    const across = Math.abs(dx * -DIR_Y[arm] + dy * DIR_X[arm]);
    if (along >= CROSSWALK_NEAR && along <= CROSSWALK_FAR && across <= ROAD_HALF) {
      if (s0 < 0) s0 = path.s[i];
      s1 = path.s[i];
    }
  }
  return s0 < 0 ? null : [s0, s1];
}

/** Radius of a turn through a node: right turns hug the curb, left turns sweep wide, except round a plain bend. */
function turnRadius(node: CityNode, turn: -1 | 1): number {
  if (turn === 1) return RIGHT_TURN_RADIUS;
  return node.armCount === 2 ? BEND_OUTER_RADIUS : LEFT_TURN_RADIUS;
}

/**
 * Turn connectors through every intersection: from each lane arriving at a
 * node into each lane leaving it, except a U turn back the way it came.
 * Right turns hug the curb, left turns sweep wide through the middle.
 * `crosswalkAt` gives the crossing on an arm of a node, or -1.
 */
export function buildConnectors(nodes: CityNode[], lanes: RoadElement[], crosswalkAt: (node: number, arm: Dir) => number): RoadElement[] {
  const into = nodes.map(() => [] as RoadElement[]);
  const outOf = nodes.map(() => [] as RoadElement[]);
  for (const lane of lanes) {
    into[lane.to].push(lane);
    outOf[lane.from].push(lane);
  }
  const connectors: RoadElement[] = [];
  let id = lanes.length;
  for (const node of nodes) {
    for (const a of into[node.id]) {
      for (const b of outOf[node.id]) {
        const turn = turnBetween(a.dir, b.dir);
        if (turn === 2) continue;
        const start = a.path.n - 1;
        const builder = new PathBuilder(TURN_STEP);
        if (turn === 0) builder.moveTo(a.path.x[start], a.path.y[start]).lineTo(b.path.x[0], b.path.y[0]);
        else quarterTurn(builder, a.path.x[start], a.path.y[start], (a.dir * Math.PI) / 2, b.path.x[0], b.path.y[0], (b.dir * Math.PI) / 2, turnRadius(node, turn));
        const path = builder.build();
        const crossings: CrossingSpan[] = [];
        for (const arm of [opposite(a.dir), b.dir]) {
          const cw = crosswalkAt(node.id, arm);
          const span = cw >= 0 ? crossingSpan(path, node, arm) : null;
          if (span) crossings.push({ crosswalk: cw, s0: span[0], s1: span[1] });
        }
        const limit = Math.min(a.speedLimit, b.speedLimit);
        connectors.push({ id: id++, kind: ELEMENT_CONNECTOR, path, next: [b.id], from: node.id, to: node.id, dir: a.dir, exitDir: b.dir, turn, speedLimit: limit, stopLine: false, opposite: -1, fromLane: a.id, toLane: b.id, crossings });
        a.next.push(id - 1);
      }
    }
  }
  return connectors;
}
