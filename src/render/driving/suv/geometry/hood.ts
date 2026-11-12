import { onBody } from './body';
import { bothSides, gridGeometry, type Vec3 } from './grid';
import { SHUT, type Detail, type PartBin } from './parts';
import { NOSE } from './profile';

/** The hood's shut line runs from the cowl to just behind the leading edge, m. */
const HOOD = { from: 0.98, to: NOSE - 0.06 };
/** Where the lines along the fenders sit on the band from the fender peak in, as shares of its 0.4 m width. */
const ALONG = { from: 0.03, to: 0.03 + SHUT.width / 0.4 };

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
  const n = 48;
  const along: Vec3[][] = [];
  for (let i = 0; i <= n; i++) {
    const x = HOOD.from + ((HOOD.to - HOOD.from) * i) / n;
    along.push([onBody(x, 5, ALONG.from, SHUT.lift), onBody(x, 5, ALONG.to, SHUT.lift)]);
  }
  bin.add('liner', bothSides(gridGeometry(along)));
  // Across the front: two rows a gap apart, each walking in from the peak to the centerline.
  const t0 = (b: number) => (b === 0 ? ALONG.from : 0);
  const gap = SHUT.width / 2;
  const across = [-gap, gap].map((d) => TOP.flatMap((band, b) => Array.from({ length: 13 }, (_, k) => onBody(HOOD.to + d, band, t0(b) + ((1 - t0(b)) * k) / 12, SHUT.lift)).slice(b === 0 ? 0 : 1)));
  bin.add('liner', bothSides(gridGeometry(across)));
}
