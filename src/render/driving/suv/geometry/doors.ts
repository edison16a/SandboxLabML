import type * as THREE from 'three';
import { bodyStrip, onBody } from './body';
import { FLARE_REACH, skinAt } from './flares';
import { bothSides, gridGeometry, type Vec3 } from './grid';
import { SHUT, type PartBin } from './parts';
import { ARCH, AXLES } from './profile';
import { rockerY } from './lines';
import { warp } from './warp';

/**
 * Where the doors are cut, m: the front door's leading edge, clear of the
 * front flare, the B pillar, and the rear door's trailing edge at the
 * belt, right under the window divider. Below the belt the rear door's
 * edge wraps round the rear flare, so the rear door reads as a full door
 * and the window graphic and the doors agree.
 */
export const DOOR = { front: 0.95, pillar: -0.43, rear: -1.34 };
const HALF = SHUT.width / 2;
const LIFT = SHUT.lift;
/** Paint left between the rear door's edge and the rear flare's outer edge, m. */
const CLEAR = 0.008;
/** How long each leg of the rounded corner is, where the rear door's edge turns off the arch and up to the belt, m. */
const CORNER = 0.035;
/** The flush handles' spans along the car, m, one on each door. */
const HANDLES = [0.12, -1.08];

type P2 = [number, number];

/** A point on the side skin at (x, y), below the shoulder, lifted off the paint. */
function onSide(x: number, y: number): Vec3 {
  const s = skinAt(x, y);
  return warp([x, y + s.ny * LIFT, s.z + s.nz * LIFT]);
}

/** Points up the side at x from the cladding's top to the belt, taken on the section itself so they follow the crease. */
function upSide(x: number): Vec3[] {
  const pts: Vec3[] = [];
  for (const band of [1, 2, 3, 4]) for (let k = band === 1 ? 0 : 1; k <= 6; k++) pts.push(onBody(x, band, k / 6, LIFT));
  return pts;
}

/** The two edges of a shut line, bottom to top: the left of travel first (toward the tail on a straight cut), so the strip faces out. */
type Edges = [Vec3[], Vec3[]];

/** Edges either side of a straight cut up the side at x. */
function straightEdges(pts: Vec3[]): Edges {
  return [pts.map(([x, y, z]): Vec3 => [x - HALF, y, z]), pts.map(([x, y, z]): Vec3 => [x + HALF, y, z])];
}

/** Edges either side of a path in (x, y) on the skin below the shoulder, each point stepped out across the path. */
function pathEdges(path: P2[]): Edges {
  const edges: Edges = [[], []];
  path.forEach(([x, y], i) => {
    const [ax, ay] = path[Math.max(0, i - 1)];
    const [bx, by] = path[Math.min(path.length - 1, i + 1)];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    // Across the path, to the right of travel: walking up and back round the arch, that is away from the wheel.
    const [ux, uy] = [(by - ay) / len, -(bx - ax) / len];
    edges[0].push(onSide(x - ux * HALF, y - uy * HALF));
    edges[1].push(onSide(x + ux * HALF, y + uy * HALF));
  });
  return edges;
}

/**
 * The rear door's trailing cut as a path in (x, y), bottom to top: from
 * the cladding's top round the rear flare, a fixed gap off its outer
 * edge, into a rounded corner and on up to where the straight part
 * takes over at x = DOOR.rear.
 */
function rearPath(): { path: P2[]; top: number } {
  const [cx, cy] = [AXLES[1], ARCH.centerY];
  const r = ARCH.radius + FLARE_REACH + CLEAR;
  const meet = Math.acos((DOOR.rear - cx) / r);
  const arcEnd = meet - CORNER / r;
  const start = Math.asin(Math.max(0, rockerY(cx + r) + 0.003 - cy) / r);
  const path: P2[] = [];
  const steps = 22;
  for (let i = 0; i <= steps; i++) {
    const a = start + ((arcEnd - start) * i) / steps;
    path.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  // The corner: a quadratic from the arc to the straight part, through the point where they would meet.
  const s = path[path.length - 1];
  const c: P2 = [DOOR.rear, cy + r * Math.sin(meet)];
  const e: P2 = [DOOR.rear, c[1] + CORNER];
  for (let i = 1; i <= 5; i++) {
    const t = i / 5;
    const u = 1 - t;
    path.push([u * u * s[0] + 2 * u * t * c[0] + t * t * e[0], u * u * s[1] + 2 * u * t * c[1] + t * t * e[1]]);
  }
  return { path, top: e[1] };
}

/** One dark strip from a pair of edges, on both sides of the car. */
const shutLine = ([back, front]: Edges): THREE.BufferGeometry => bothSides(gridGeometry([back, front]));

/**
 * Door shut lines and flush handles. The front door runs from just
 * behind the front flare to the B pillar, the rear door from there to the
 * window divider and round the rear arch, so the two doors split the side
 * in the same rhythm as the glass above them.
 */
export function addDoors(bin: PartBin): void {
  bin.add('liner', shutLine(straightEdges(upSide(DOOR.front))), shutLine(straightEdges(upSide(DOOR.pillar))));
  const { path, top } = rearPath();
  const [arcLeft, arcRight] = pathEdges(path);
  const [upLeft, upRight] = straightEdges(upSide(DOOR.rear).filter(([, y]) => y > top + 0.005));
  bin.add('liner', shutLine([[...arcLeft, ...upLeft], [...arcRight, ...upRight]]));
  for (const x of HANDLES) bin.add('trim', bodyStrip(2, [[0.86, 0.003], [0.9, 0.003]], x, x + 0.17, 4));
}
