import { PathBuilder } from '../geometry/builder';
import { projection, type Path } from '../geometry/path';
import { CROSSWALK_MID, CURB_RADIUS, DIR_X, DIR_Y, ROAD_HALF, SIDEWALK, WALK_LINE, type Dir } from './dimensions';
import type { CityBlock, CityNode, Crosswalk } from './types';

const STEP = 1;

/**
 * A walking loop: a rectangle with rounded corners, counterclockwise.
 * `inset` is how far the walking line sits inside the outline and `r` the
 * outline's corner radius.
 */
function loop(x0: number, x1: number, y0: number, y1: number, inset: number, r: number): Path {
  const rr = Math.max(0.5, r - inset);
  const ax = x0 + r;
  const bx = x1 - r;
  const ay = y0 + r;
  const by = y1 - r;
  const b = new PathBuilder(STEP);
  b.moveTo(ax, y0 + inset).lineTo(bx, y0 + inset);
  b.arc(bx, ay, rr, -Math.PI / 2, 0).lineTo(x1 - inset, by);
  b.arc(bx, by, rr, 0, Math.PI / 2).lineTo(ax, y1 - inset);
  b.arc(ax, by, rr, Math.PI / 2, Math.PI).lineTo(x0 + inset, ay);
  b.arc(ax, ay, rr, Math.PI, Math.PI * 1.5);
  return b.build(true);
}

/**
 * Sidewalk loops people walk along: one around every block, following the
 * curb in the middle of the sidewalk, plus one big loop around the outside
 * of the whole grid (always the last). The outer loop has tight corners,
 * since the streets meet there at a sharp outside corner.
 */
export function buildRings(blocks: CityBlock[], bounds: { minX: number; maxX: number; minY: number; maxY: number }): Path[] {
  const rings = blocks.map((k) => loop(k.x0, k.x1, k.y0, k.y1, SIDEWALK / 2, CURB_RADIUS));
  const out = SIDEWALK / 2;
  rings.push(loop(bounds.minX - out * 2, bounds.maxX + out * 2, bounds.minY - out * 2, bounds.maxY + out * 2, out, out + 1.5));
  return rings;
}

/** The loop a sidewalk point lies on, and where along it. */
function locate(rings: Path[], x: number, y: number): [number, number] {
  const p = projection();
  let best = -1;
  let bestD = Infinity;
  let bestS = 0;
  rings.forEach((ring, k) => {
    ring.project(x, y, 0, ring.n, p);
    const d = Math.abs(p.lateral);
    if (p.distance < 3 && d < bestD) {
      bestD = d;
      best = k;
      bestS = p.s;
    }
  });
  if (best < 0 || bestD > 0.5) throw new Error(`No sidewalk at (${x.toFixed(1)}, ${y.toFixed(1)})`);
  return [best, bestS];
}

/**
 * A zebra crossing over every arm of every signalized intersection. Each
 * end sits on the walking line of the sidewalk it joins, so a person can
 * step off one loop, cross and carry on along the other.
 */
export function buildCrosswalks(nodes: CityNode[], rings: Path[]): Crosswalk[] {
  const out: Crosswalk[] = [];
  for (const node of nodes) {
    if (node.signal < 0) continue;
    for (let a = 0; a < 4; a++) {
      const arm = a as Dir;
      if (!node.arms[arm]) continue;
      const cx = node.x + DIR_X[arm] * CROSSWALK_MID;
      const cy = node.y + DIR_Y[arm] * CROSSWALK_MID;
      // Left of the arm direction, then right: the two sidewalks either side of the street.
      const px = -DIR_Y[arm];
      const py = DIR_X[arm];
      const ax = cx + px * WALK_LINE;
      const ay = cy + py * WALK_LINE;
      const bx = cx - px * WALK_LINE;
      const by = cy - py * WALK_LINE;
      const [ringA, sA] = locate(rings, ax, ay);
      const [ringB, sB] = locate(rings, bx, by);
      // Crossing the east or west arm means crossing the east west street, which is safe while north south has green.
      out.push({ id: out.length, node: node.id, arm, x: cx, y: cy, ax, ay, bx, by, ringA, sA, ringB, sB, walkAxis: arm % 2 === 0 ? 0 : 1 });
    }
  }
  return out;
}

/** Half width of the street a crossing spans: people are in the road while within this of its center. */
export const CROSSING_HALF = ROAD_HALF;
