import type * as THREE from 'three';
import { onCap } from './body';
import { bothSides, gridGeometry, type Vec3 } from './grid';
import type { Detail, PartBin } from './parts';
import { capFill, facing, rounded } from './recess';
import { tailBand } from './rear';
import type { Pt } from './section';

/**
 * The tailgate's outline on the tail face, m: it opens from the bumper
 * line up to the light band, between two vertical cuts. The plate area
 * sits in its lower half.
 */
const GATE = { side: 0.6, bottom: 0.715, corner: 0.06 };
const PLATE: Pt[] = [[-0.26, 0.75], [0.26, 0.75], [0.26, 0.88], [-0.26, 0.88]];

/** A dark hairline along a path on the tail face, `width` m wide, so a panel gap reads as a real cut. */
function cut(path: Pt[], width: number): THREE.BufferGeometry {
  const rows: Vec3[][] = path.map((p, i) => {
    const a = path[Math.max(0, i - 1)];
    const b = path[Math.min(path.length - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const n: Pt = [(-(b[1] - a[1]) / len) * (width / 2), ((b[0] - a[0]) / len) * (width / 2)];
    return [onCap(-1, p[0] - n[0], p[1] - n[1], 0.0015), onCap(-1, p[0] + n[0], p[1] + n[1], 0.0015)];
  });
  return facing(gridGeometry(rows), [-1, 0, 0]);
}

/** The left half of the tailgate's shut line: from under the light band, down the side, round the corner and across to the middle. */
function gatePath(steps: number): Pt[] {
  const { side, bottom, corner } = GATE;
  const top = tailBand(side).lo - 0.004;
  const path: Pt[] = [];
  for (let i = 0; i <= 4; i++) path.push([side, top + (bottom + corner - top) * (i / 4)]);
  for (let i = 1; i <= steps; i++) {
    const a = (Math.PI / 2) * (i / steps);
    path.push([side - corner + Math.cos(a) * corner, bottom + corner - Math.sin(a) * corner]);
  }
  for (let i = 1; i <= 4; i++) path.push([(side - corner) * (1 - i / 4), bottom]);
  return path;
}

/**
 * The tailgate: a shut line that separates it from the bumper below and
 * the body at each side, and a gloss black plate area set into its lower
 * half. With the shoulder fold above, the bumper and the tailgate read as
 * two volumes instead of one blank slab.
 */
export function addTailgate(bin: PartBin, detail: Detail): void {
  if (detail.fine || detail.brakes) bin.add('liner', bothSides(cut(gatePath(detail.fine ? 6 : 3), 0.0045)));
  const corner = detail.fine ? 4 : detail.brakes ? 2 : 1;
  bin.add('trim', capFill(-1, rounded(PLATE, 0.02, corner), 0.003, detail.fine ? 3 : 1));
}
