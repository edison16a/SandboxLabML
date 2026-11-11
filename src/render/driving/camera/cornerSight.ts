import { DIR_X, DIR_Y, LANE_OFFSET, PROPERTY, STOP_LINE } from '@/engine/driving/city/dimensions';
import type { City } from '@/engine/driving/city/types';
import { streetscapeFor, type Spot } from '../city/streetscape/layout';

/** Camera height on its corner, m, and the raised height used when both corners are cluttered. */
export const CORNER_HEIGHT = 3.4;
const RAISED_HEIGHT = 5.5;
/** How far the camera moves out along the cross street when it has to dodge the corner furniture, m. */
const DODGE = 1.5;
/** A pole, lamp or trunk blocks a sight line passing within this of its center, m; a tree crown more. */
const POLE = 0.4;
const CROWN = 1.6;
/** Height of a tree crown's underside, m: a sight line below it only meets the trunk. */
const CROWN_BASE = 2.5;
/** Points along the approach the camera must see: the stop line and up to 30 m back. */
const SAMPLES = [0, 7.5, 15, 22.5, 30];

/** A camera spot on a corner, in sim meters, and its height. */
export interface CornerSpot {
  x: number;
  y: number;
  height: number;
}

/** Whether the sight line from (px, py, ph) to (tx, ty, 1 m up) passes an obstacle of radius r at (cx, cy) with a crown above `crown` m. */
function blocks(px: number, py: number, ph: number, tx: number, ty: number, c: Spot, r: number, crown: number): boolean {
  const dx = tx - px;
  const dy = ty - py;
  const len2 = dx * dx + dy * dy || 1;
  const t = ((c.x - px) * dx + (c.y - py) * dy) / len2;
  if (t < 0.03 || t > 0.97) return false;
  const h = ph + (1 - ph) * t;
  const reach = h > crown ? r : POLE;
  const ex = px + dx * t - c.x;
  const ey = py + dy * t - c.y;
  return ex * ex + ey * ey < reach * reach;
}

/** How many of the approach's sample points the spot cannot see past poles, lamps and trees. */
function blockedSamples(city: City, spot: CornerSpot, node: number, dir: number): number {
  const s = streetscapeFor(city);
  const n = city.nodes[node];
  const fx = DIR_X[dir];
  const fy = DIR_Y[dir];
  // The approach lane: behind the node against the travel direction, on the right of travel.
  const rx = fy;
  const ry = -fx;
  let blocked = 0;
  for (const back of SAMPLES) {
    const tx = n.x - fx * (STOP_LINE + back) + rx * LANE_OFFSET;
    const ty = n.y - fy * (STOP_LINE + back) + ry * LANE_OFFSET;
    let hit = false;
    for (const g of s.signals) hit ||= blocks(spot.x, spot.y, spot.height, tx, ty, g.pole, POLE + 0.2, Infinity);
    for (const w of s.walks) hit ||= blocks(spot.x, spot.y, spot.height, tx, ty, w, POLE, Infinity);
    for (const l of s.lamps) hit ||= blocks(spot.x, spot.y, spot.height, tx, ty, l, POLE, Infinity);
    for (const tr of s.trees) hit ||= blocks(spot.x, spot.y, spot.height, tx, ty, tr, CROWN, CROWN_BASE);
    if (hit) blocked++;
  }
  return blocked;
}

/**
 * Where the street corner camera stands for a car arriving at `node`
 * travelling in `dir` and turning `turn`. It tries the two far corners,
 * the one on the outside of the turn first, and keeps the one with the
 * clearer view down the approach past the signal poles, lamps and trees.
 * If both are cluttered it climbs higher and steps out along the cross
 * street, away from the corner furniture.
 */
export function pickCornerSpot(city: City, node: number, dir: number, turn: number): CornerSpot {
  const n = city.nodes[node];
  const fx = DIR_X[dir];
  const fy = DIR_Y[dir];
  const d = PROPERTY - 1.2;
  const first = turn === 1 ? 1 : -1;
  let best: CornerSpot | null = null;
  let bestBlocked = Infinity;
  let bestSide = first;
  for (const side of [first, -first]) {
    const lx = -fy * side;
    const ly = fx * side;
    const spot = { x: n.x + fx * d + lx * d, y: n.y + fy * d + ly * d, height: CORNER_HEIGHT };
    const blocked = blockedSamples(city, spot, node, dir);
    if (blocked < bestBlocked) {
      best = spot;
      bestBlocked = blocked;
      bestSide = side;
    }
    if (blocked === 0) break;
  }
  if (bestBlocked <= 1) return best!;
  const lx = -fy * bestSide;
  const ly = fx * bestSide;
  return { x: best!.x + lx * DODGE, y: best!.y + ly * DODGE, height: RAISED_HEIGHT };
}
