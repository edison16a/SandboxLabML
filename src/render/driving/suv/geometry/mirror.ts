import type * as THREE from 'three';
import { bothSides, gridGeometry, merge, polygonGeometry, type Vec3 } from './grid';
import type { Detail } from './parts';
import { beltAt } from './profile';

/**
 * The door mirror's housing, m, in the car's frame before mirroring: the
 * flat back that holds the glass at `back`, how far the rounded front
 * reaches ahead of it, the half height, and where the housing starts
 * and ends across the car, measured out from the belt. The outer end
 * kicks up by `kick`.
 */
const HOUSING = { back: 0.655, depth: [0.064, 0.082], half: [0.034, 0.042], from: 0.05, to: 0.245, kick: 0.012, lift: 0.068 };

/** Where along the housing its outer end starts to round off. */
const DOME = 0.7;

/** How much of the full section the housing keeps at u along its length: a flat inner end, a rounded outer one. */
function size(u: number): number {
  return u <= DOME ? 1 : Math.sqrt(Math.max(0, 1 - ((u - DOME) / (1 - DOME)) ** 2));
}

/** Stations along the housing: even along its body, then by angle round the dome, so the end stays round. */
function stations(rows: number): number[] {
  const body = Math.max(2, Math.round(rows * 0.45));
  const dome = rows - body;
  return [
    ...Array.from({ length: body }, (_, i) => (DOME * i) / body),
    ...Array.from({ length: dome + 1 }, (_, i) => DOME + (1 - DOME) * Math.sin((Math.PI / 2) * (i / dome))),
  ];
}

/**
 * A point on the housing's skin: u along its length, v round its section
 * from the top of the back edge, over the front and under to the bottom
 * of the back edge. The section is a D: a flat back where the glass sits,
 * a full rounded front and a flatter top and bottom.
 */
function skin(u: number, v: number, base: Vec3): Vec3 {
  const k = Math.max(size(u), 0.02);
  const depth = HOUSING.depth[0] + (HOUSING.depth[1] - HOUSING.depth[0]) * u;
  const half = HOUSING.half[0] + (HOUSING.half[1] - HOUSING.half[0]) * u;
  const a = Math.PI / 2 - Math.PI * v;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const y = base[1] + HOUSING.kick * u * u + half * k * Math.sign(s) * Math.abs(s) ** 0.75;
  return [HOUSING.back + depth * k * c ** 0.7, y, base[2] + HOUSING.from + (HOUSING.to - HOUSING.from) * u];
}

/** The back edge at u: its top and bottom, inset by `inset` m, a hair behind the housing so the glass and rim sit on it. */
function backEdge(u: number, base: Vec3, inset: number, behind: number): [Vec3, Vec3] {
  const top = skin(u, 0, base);
  const bottom = skin(u, 1, base);
  const k = Math.min(1, inset / Math.max((top[1] - bottom[1]) / 2, 1e-4));
  const mid = (top[1] + bottom[1]) / 2;
  const x = HOUSING.back - behind;
  return [[x, top[1] - (top[1] - mid) * k, top[2]], [x, bottom[1] + (mid - bottom[1]) * k, bottom[2]]];
}

/**
 * A slim wing from `root` on the door to `tip` under the housing: an
 * oval section that narrows and thins along its length, wide and flat
 * where it meets the door, so it reads as a shaped arm.
 */
function stalk(root: Vec3, tip: Vec3, n: number): THREE.BufferGeometry {
  const rows: Vec3[][] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    rows.push(([[root, 0.13, 0.02], [tip, 0.07, 0.013]] as const).map(([[bx, by, bz], chord, thick]) => [bx + (Math.cos(a) * chord) / 2, by + (Math.sin(a) * thick) / 2, bz] as Vec3));
  }
  return gridGeometry(rows);
}

/**
 * A door mirror: a lofted painted housing with a flat inner end, a full
 * rounded front, a crisp edge round the flat back and a slight upward
 * kick at its outer end; dark glass in the back inside a thin painted rim;
 * on a wide, flat stalk from the door at the window line. Built on the
 * left and mirrored.
 */
export function mirrorParts(detail: Detail): { cap: THREE.BufferGeometry; arm: THREE.BufferGeometry; glass: THREE.BufferGeometry } {
  const x = 0.74;
  const [bz, by] = beltAt(x);
  const base: Vec3 = [x, by + HOUSING.lift, bz];
  const rows = detail.fine ? 14 : detail.brakes ? 8 : 4;
  const cols = detail.fine ? 16 : detail.brakes ? 10 : 4;
  const us = stations(rows);
  // Rows run out along +z and columns over the front from the top down: that faces out of the housing.
  const shell = gridGeometry(us.map((u) => Array.from({ length: cols + 1 }, (_, j) => skin(u, j / cols, base))));
  const inner = polygonGeometry(Array.from({ length: cols + 1 }, (_, j) => skin(0, j / cols, base)), [0, 0, -1]);
  const strip = (inset: number, behind: number) => gridGeometry(us.map((u) => backEdge(u, base, inset, behind)).map(([t, b]) => [b, t]));
  const tip = skin(0.4, 1, base);
  const arm = stalk([x - 0.005, by + 0.008, bz - 0.01], [tip[0] - 0.012, tip[1] + 0.004, tip[2]], detail.fine ? 12 : 6);
  return { cap: bothSides(merge([shell, inner, strip(0, 0.0004)])), arm: bothSides(arm), glass: bothSides(strip(0.006, 0.0012)) };
}
