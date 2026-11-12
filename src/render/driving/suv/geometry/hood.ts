import { onBody } from './body';
import { bothSides, gridGeometry, type Vec3 } from './grid';
import type { Detail, PartBin } from './parts';
import { NOSE } from './profile';

/** The hood's shut line runs from the cowl to just behind the leading edge, m. */
const HOOD = { from: 0.96, to: NOSE - 0.055, gap: 0.0022 };

/** Bands of the section that make the hood's top: the fender peak to the valley's edge, and on to the centerline. */
const TOP = [5, 6];

/**
 * The hood's shut lines: a dark hairline along each fender just inside
 * its peak crease, and one across the hood just behind its leading edge.
 * They make the hood read as its own panel, set between the fenders,
 * instead of one blank sheet running into the face.
 */
export function addHoodLines(bin: PartBin, detail: Detail): void {
  if (!detail.fine) return;
  const n = 48;
  const along: Vec3[][] = [];
  for (let i = 0; i <= n; i++) {
    const x = HOOD.from + ((HOOD.to - HOOD.from) * i) / n;
    along.push([onBody(x, 5, 0.03, 0.0015), onBody(x, 5, 0.041, 0.0015)]);
  }
  bin.add('liner', bothSides(gridGeometry(along)));
  // Across the front: two rows a gap apart, each walking in from the peak to the centerline.
  const t0 = (b: number) => (b === 0 ? 0.03 : 0);
  const across = [-HOOD.gap, HOOD.gap].map((d) => TOP.flatMap((band, b) => Array.from({ length: 13 }, (_, k) => onBody(HOOD.to + d, band, t0(b) + ((1 - t0(b)) * k) / 12, 0.0015)).slice(b === 0 ? 0 : 1)));
  bin.add('liner', bothSides(gridGeometry(across)));
}
