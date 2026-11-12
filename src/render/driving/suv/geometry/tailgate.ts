import type * as THREE from 'three';
import { onCap } from './cap';
import { bothSides, type Vec3 } from './grid';
import type { Detail, PartBin } from './parts';
import type { FaceCut } from './face';
import { capFill, facing, recess, rounded } from './recess';
import { tailBand } from './rear';
import { SEAM, SEAM_LIFT, seamGeometry } from './seams';
import type { Pt } from './section';
import { LEDGE } from './warp';

/**
 * The tailgate's outline on the tail face, m: it opens from the light
 * band down to the top of the bumper's crease, between two upright cuts.
 */
const GATE = { side: 0.6, bottom: LEDGE.y + LEDGE.r, corner: 0.06 };

/** The plate's pocket in the tailgate's lower half: a rounded rectangle, 1.5 cm deep. */
const PLATE = { half: 0.265, y0: 0.695, y1: 0.825, corner: 0.016, depth: 0.015 };

/** The hole the tail face leaves for the plate's pocket. */
export const plateCut = (): FaceCut => ({ y0: PLATE.y0, y1: PLATE.y1, half: () => PLATE.half });

/** Rows the tail face adds so the bumper's crease is drawn as a tight fold, not a long slope. */
export const LEDGE_ROWS = [LEDGE.y - LEDGE.r, LEDGE.y + LEDGE.r];

/** A soft dark line along a path on the tail face, so a panel gap reads as a real cut (seams.ts). */
function cut(path: Pt[]): THREE.BufferGeometry {
  const rows: Vec3[][] = SEAM.map(([d]) =>
    path.map((p, i) => {
      const a = path[Math.max(0, i - 1)];
      const b = path[Math.min(path.length - 1, i + 1)];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return onCap(-1, p[0] - ((b[1] - a[1]) / len) * d, p[1] + ((b[0] - a[0]) / len) * d, SEAM_LIFT);
    }),
  );
  return facing(seamGeometry(rows), [-1, 0, 0]);
}

/** The left half of the tailgate's shut line: from under the light band, down the side, round the corner and across to the middle. */
function gatePath(steps: number): Pt[] {
  const { side, bottom, corner } = GATE;
  const top = tailBand(side).lo - 0.004;
  const path: Pt[] = [];
  for (let i = 0; i <= 8; i++) path.push([side, top + (bottom + corner - top) * (i / 8)]);
  for (let i = 1; i <= steps; i++) {
    const a = (Math.PI / 2) * (i / steps);
    path.push([side - corner + Math.cos(a) * corner, bottom + corner - Math.sin(a) * corner]);
  }
  for (let i = 1; i <= 6; i++) path.push([(side - corner) * (1 - i / 6), bottom]);
  return path;
}

/**
 * The tailgate: a shut line that separates it from the bumper below and
 * the body at each side, and the plate set into a pocket in its lower
 * half: a rounded body colored edge, walls running back 1.5 cm and a
 * gloss black plate at the bottom. With the bumper's crease under it,
 * the tail reads as shaped volumes instead of one blank slab. The far
 * population draws the plate flat.
 */
export function addTailgate(bin: PartBin, detail: Detail): void {
  const open = detail.fine || detail.brakes;
  if (open) bin.add('seam', bothSides(cut(gatePath(detail.fine ? 6 : 3))));
  const corner = detail.fine ? 4 : detail.brakes ? 2 : 1;
  const { half, y0, y1 } = PLATE;
  const outline = rounded([[-half, y0], [half, y0], [half, y1], [-half, y1]], PLATE.corner, corner);
  if (!open) {
    bin.add('trim', capFill(-1, outline, 0.003, 1));
    return;
  }
  const step = detail.fine ? 0.03 : 0.05;
  const pocket = recess(-1, outline, { width: 0.009, lip: 0.0012, back: PLATE.depth }, detail.fine ? 2 : 1, step, 0.1);
  bin.add('paint', pocket.bezel, pocket.throat);
  bin.add('trim', pocket.mesh);
}
