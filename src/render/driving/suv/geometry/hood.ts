import { onBody } from './body';
import { bothSides, type Vec3 } from './grid';
import type { Detail, PartBin } from './parts';
import { SEAM, SEAM_LIFT, seamGeometry } from './seams';
import { NOSE } from './profile';

/** The hood's shut line runs from the cowl to just behind the leading edge, m. */
const HOOD = { from: 0.98, to: NOSE - 0.06 };
/** Where the lines along the fenders run on the band from the fender peak in: a share of its width, about 0.4 m. */
const ALONG = { at: 0.04, width: 0.4 };

/** Bands of the section that make the hood's top: the fender peak to the valley's edge, and on to the centerline. */
const TOP = [5, 6];

/**
 * The hood's shut lines: a dark line along each fender just inside
 * its peak crease, and one across the hood just behind its leading edge.
 * They make the hood read as its own panel, set between the fenders,
 * instead of one blank sheet running into the face.
 */
export function addHoodLines(bin: PartBin, detail: Detail): void {
  if (!detail.fine) return;
  const n = 24;
  // Rows across the gap step in from the peak, and each walks back along the car, which faces the strip up.
  const along: Vec3[][] = SEAM.map(([d]) => Array.from({ length: n + 1 }, (_, i) => onBody(HOOD.to - ((HOOD.to - HOOD.from) * i) / n, 5, ALONG.at + d / ALONG.width, SEAM_LIFT)));
  bin.add('seam', bothSides(seamGeometry(along)));
  // Across the front: rows a gap apart along the car, each walking in from the peak to the centerline.
  const t0 = (b: number) => (b === 0 ? ALONG.at : 0);
  const across = SEAM.map(([d]) => TOP.flatMap((band, b) => Array.from({ length: 9 }, (_, k) => onBody(HOOD.to + d, band, t0(b) + ((1 - t0(b)) * k) / 8, SEAM_LIFT)).slice(b === 0 ? 0 : 1)));
  bin.add('seam', bothSides(seamGeometry(across)));
}
