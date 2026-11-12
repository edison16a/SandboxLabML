import { DIR_X, DIR_Y, LANE_OFFSET, PROPERTY, ROAD_HALF, SIDEWALK, STOP_LINE } from '@/engine/driving/city/dimensions';
import type { City } from '@/engine/driving/city/types';
import { pathPoint } from '@/engine/driving/geometry/path';
import type { Route } from '@/engine/driving/route/route';
import { crowdedLens, sees, sightWorld, type SightWorld } from './sightLines';

/** Camera height on its corner, m, and the raised heights used when the corner is cluttered. */
export const CORNER_HEIGHT = 3.4;
const RAISED_HEIGHT = 5.5;
const HIGH_HEIGHT = 8;
/** How far a spot moves out along the cross street to dodge the corner furniture, m. */
const DODGE = 1.5;
/** How far a spot steps on along the far sidewalk, away from the junction, to clear a pole beside it, m. */
const CLEAR_STEP = 3.2;
/** Points along the approach the camera must see: the stop line and up to 30 m back. */
const APPROACH = [0, 7.5, 15, 22.5, 30];
/** Points along the exit it pans to as the car leaves the junction, m past the far stop line. */
const EXIT = [0, 6, 12];
/**
 * How much wider street furniture counts close to the lens, m (see sees):
 * a trunk or a crown grazing the line a few meters out fills the frame.
 * The camera uses the same margin to decide it has lost the car.
 */
export const CLUTTER = 1.4;
/** Where the camera may wait for the car's arrival: this far past the destination, looking back down the street, m. */
const PAST_DEST = [14, 10, 18, 22];
/** Points before the destination it must see, m. */
const ARRIVAL = [0, 10, 20, 30];

/** A camera spot on a corner, in sim meters, and its height. */
export interface CornerSpot {
  x: number;
  y: number;
  height: number;
}

/** The points the camera has to see for one maneuver: down the approach, the middle of the junction and out along the exit, 1 m up. */
function viewPoints(city: City, node: number, dir: number, turn: number): Array<[number, number]> {
  const n = city.nodes[node];
  const fx = DIR_X[dir];
  const fy = DIR_Y[dir];
  const out: Array<[number, number]> = [];
  // The approach lane: behind the node against the travel direction, on the right of travel.
  for (const back of APPROACH) out.push([n.x - fx * (STOP_LINE + back) + fy * LANE_OFFSET, n.y - fy * (STOP_LINE + back) - fx * LANE_OFFSET]);
  out.push([n.x, n.y]);
  // A right turn (1) leaves to the right of travel, a left one (-1) to the left.
  const ex = turn === 0 ? fx : turn === 1 ? fy : -fy;
  const ey = turn === 0 ? fy : turn === 1 ? -fx : fx;
  for (const s of EXIT) out.push([n.x + ex * (STOP_LINE + s) + ey * LANE_OFFSET, n.y + ey * (STOP_LINE + s) - ex * LANE_OFFSET]);
  return out;
}

/** How many of the maneuver's points the spot cannot see; every one of them when furniture crowds the lens. */
function blockedPoints(w: SightWorld, spot: CornerSpot, points: ReadonlyArray<[number, number]>): number {
  if (crowdedLens(w, spot.x, spot.y, spot.height)) return points.length + 1;
  let blocked = 0;
  for (const [x, y] of points) if (!sees(w, spot.x, spot.y, spot.height, x, y, 1, CLUTTER)) blocked++;
  return blocked;
}

/**
 * Every spot the street corner camera may stand on for a car arriving at
 * `node` travelling in `dir` and turning `turn`, best first. The two far
 * corners come first, the one on the outside of the turn ahead of the
 * other, then each stepped along its sidewalk, then raised and dodged out
 * along the cross street, then high above the corner. They are ranked by
 * how many points of the maneuver they see past the poles, signal heads,
 * lamps, trees and buildings, over the whole pan from the approach through
 * the junction to the exit; a spot where furniture fills the lens comes
 * last. The camera takes the first and moves down the list if the car
 * ever stays hidden from it (see cornerCam).
 */
export function rankCornerSpots(city: City, node: number, dir: number, turn: number): CornerSpot[] {
  const w = sightWorld(city);
  const n = city.nodes[node];
  const fx = DIR_X[dir];
  const fy = DIR_Y[dir];
  const d = PROPERTY - 1.2;
  const first = turn === 1 ? 1 : -1;
  const spots: CornerSpot[] = [];
  for (const side of [first, -first]) {
    const lx = -fy * side;
    const ly = fx * side;
    const x = n.x + fx * d + lx * d;
    const y = n.y + fy * d + ly * d;
    spots.push({ x, y, height: CORNER_HEIGHT });
    spots.push({ x: x + fx * CLEAR_STEP, y: y + fy * CLEAR_STEP, height: CORNER_HEIGHT });
    spots.push({ x: x + lx * DODGE, y: y + ly * DODGE, height: RAISED_HEIGHT });
    spots.push({ x: x + fx * CLEAR_STEP, y: y + fy * CLEAR_STEP, height: RAISED_HEIGHT });
    spots.push({ x, y, height: HIGH_HEIGHT });
  }
  return ranked(w, spots, viewPoints(city, node, dir, turn));
}

/** Spots best first: fewest points hidden, then the order they were tried in. */
function ranked(w: SightWorld, spots: CornerSpot[], points: ReadonlyArray<[number, number]>): CornerSpot[] {
  const score = spots.map((s, i) => ({ s, blocked: blockedPoints(w, s, points), i }));
  score.sort((a, b) => a.blocked - b.blocked || a.i - b.i);
  return score.map((e) => e.s);
}

const at = pathPoint();

/**
 * Spots for the last stretch, once the car is through its last junction:
 * on either sidewalk a little past the destination, looking back down the
 * street at the car rolling in, the same spots raised, and high over the
 * middle of the road. Ranked like the corner spots, on the points before
 * the destination.
 */
export function rankArrivalSpots(city: City, route: Route): CornerSpot[] {
  const p = route.path;
  // The path runs down the middle of the lane: the right sidewalk is past the near curb, the left one past the far curb.
  // On each, the walking line and a spot nearer the buildings, clear of the trees and lamps by the curb.
  const sides = [ROAD_HALF - LANE_OFFSET + SIDEWALK / 2, PROPERTY - LANE_OFFSET - 0.6, -(ROAD_HALF + LANE_OFFSET + SIDEWALK / 2), -(PROPERTY + LANE_OFFSET - 0.6)];
  const spots: CornerSpot[] = [];
  for (const height of [CORNER_HEIGHT, RAISED_HEIGHT]) {
    for (const past of PAST_DEST) {
      p.sample(Math.min(route.destS + past, p.length), at);
      for (const off of sides) spots.push({ x: at.x + at.ty * off, y: at.y - at.tx * off, height });
    }
  }
  // Last, high over the middle of the road, as from a gantry: nothing stands between it and the lane.
  for (const past of PAST_DEST) {
    p.sample(Math.min(route.destS + past, p.length), at);
    spots.push({ x: at.x - at.ty * LANE_OFFSET, y: at.y + at.tx * LANE_OFFSET, height: RAISED_HEIGHT });
  }
  const points: Array<[number, number]> = ARRIVAL.map((back) => {
    p.sample(Math.max(0, route.destS - back), at);
    return [at.x, at.y];
  });
  return ranked(sightWorld(city), spots, points);
}

/** The best spot for the street corner camera (see rankCornerSpots). */
export function pickCornerSpot(city: City, node: number, dir: number, turn: number): CornerSpot {
  return rankCornerSpots(city, node, dir, turn)[0];
}
