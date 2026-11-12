import type * as THREE from 'three';
import { bodyStrip, onBody } from './body';
import { FLARE_REACH, skinAt } from './flares';
import { bothSides, type Vec3 } from './grid';
import type { PartBin } from './parts';
import { ARCH, AXLES } from './profile';
import { rockerY } from './lines';
import { SEAM, SEAM_LIFT as LIFT, seamGeometry } from './seams';
import { warp } from './warp';

/**
 * Where the doors are cut, m: the front door's leading edge, clear of the
 * front flare, the B pillar, and the rear door's trailing edge at the
 * belt, right under the window divider. Below the belt the rear door's
 * edge wraps round the rear flare, so the rear door reads as a full door
 * and the window graphic and the doors agree.
 */
export const DOOR = { front: 0.95, pillar: -0.43, rear: -1.34 };
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

/** Steps up each band a shut line crosses: the curved lower side and door get more, the crease and shelf fewer. */
const UP_STEPS: Record<number, number> = { 1: 5, 2: 6, 3: 3, 4: 4 };

/** Points up the side at x from the cladding's top to the belt, taken on the section itself so they follow the crease. */
function upSide(x: number): Vec3[] {
  const pts: Vec3[] = [];
  for (const band of [1, 2, 3, 4]) {
    const n = UP_STEPS[band];
    for (let k = band === 1 ? 0 : 1; k <= n; k++) pts.push(onBody(x, band, k / n, LIFT));
  }
  return pts;
}

/**
 * A gap's rows across its width, one per SEAM entry, each running bottom
 * to top: from left of travel to right (toward the nose on a straight
 * cut), so the strip faces out.
 */
type Rows = Vec3[][];

/** Rows across a straight cut up the side, stepped along the car. */
function straightRows(pts: Vec3[]): Rows {
  return SEAM.map(([d]) => pts.map(([x, y, z]): Vec3 => [x + d, y, z]));
}

/** Rows across a path in (x, y) on the skin below the shoulder, each point stepped out across the path. */
function pathRows(path: P2[]): Rows {
  const rows: Rows = SEAM.map(() => []);
  path.forEach(([x, y], i) => {
    const [ax, ay] = path[Math.max(0, i - 1)];
    const [bx, by] = path[Math.min(path.length - 1, i + 1)];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    // Across the path, to the right of travel: walking up and back round the arch, that is away from the wheel.
    const [ux, uy] = [(by - ay) / len, -(bx - ax) / len];
    SEAM.forEach(([d], k) => rows[k].push(onSide(x + ux * d, y + uy * d)));
  });
  return rows;
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
  const steps = 16;
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

/** One soft dark line from its rows, on both sides of the car. */
const shutLine = (rows: Rows): THREE.BufferGeometry => bothSides(seamGeometry(rows));

/**
 * Door shut lines and flush handles. The front door runs from just
 * behind the front flare to the B pillar, the rear door from there to the
 * window divider and round the rear arch, so the two doors split the side
 * in the same rhythm as the glass above them.
 */
export function addDoors(bin: PartBin): void {
  bin.add('seam', shutLine(straightRows(upSide(DOOR.front))), shutLine(straightRows(upSide(DOOR.pillar))));
  const { path, top } = rearPath();
  const arc = pathRows(path);
  const up = straightRows(upSide(DOOR.rear).filter(([, y]) => y > top + 0.01));
  bin.add('seam', shutLine(arc.map((row, k) => [...row, ...up[k]])));
  for (const x of HANDLES) bin.add('trim', bodyStrip(2, [[0.86, 0.003], [0.9, 0.003]], x, x + 0.17, 4));
}
