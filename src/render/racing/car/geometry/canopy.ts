import { sectionAt } from './bodyProfile';
import { bowed, profile, toCenter } from './curve';
import { bothSides, gridGeometry, polygonGeometry, type Vec3 } from './grid';
import type { Detail, PartBin, Slot } from './parts';
import { warp } from './warp';

/**
 * The cabin and engine cover: a teardrop canopy that sits on the body like
 * a fighter jet's. Its base follows the body's top surface, so it seals to
 * the paint at any width.
 */
export const CANOPY = { rear: -1.98, front: 0.98, roofFront: 0.04, roofRear: -0.72 };

const baseZ = profile([[-1.98, 0.5], [-1.4, 0.6], [-0.7, 0.665], [0.3, 0.69], [0.75, 0.67], [0.98, 0.62]]);
const edgeZ = profile([[-1.98, 0.36], [-1.4, 0.46], [-0.7, 0.53], [-0.1, 0.55], [0.5, 0.6], [0.98, 0.62]]);
const edgeY = profile([[-1.98, 0.9], [-1.4, 1.0], [-0.72, 1.09], [-0.25, 1.118], [0.04, 1.108], [0.55, 0.955], [0.98, 0.82]]);
const centerY = profile([[-1.98, 0.915], [-1.4, 1.025], [-0.72, 1.12], [-0.25, 1.15], [0.04, 1.14], [0.55, 0.985], [0.98, 0.83]]);

/** Height of the body's top surface at (x, z), read off the fender and hood bands. */
export function bodyTopY(x: number, z: number): number {
  const s = sectionAt(x);
  const pts = [4, 5, 6].flatMap((b) => bowed(s.keys[b], s.keys[b + 1], s.bulge[b], 24));
  for (let i = 0; i < pts.length - 1; i++) {
    const [z0, y0] = pts[i];
    const [z1, y1] = pts[i + 1];
    if ((z <= z0 && z >= z1) || (z >= z0 && z <= z1)) return y0 + ((y1 - y0) * (z - z0)) / (z1 - z0 || 1);
  }
  return s.keys[7][1];
}

/**
 * Points across one band of the canopy at x, in (z, y). Band 0 is the side
 * glass from the base on the body up to the roof edge; band 1 the roof,
 * which arrives level at the centerline so the two halves join smoothly.
 */
function canopyBand(x: number, band: number, steps: number): Array<[number, number]> {
  const bz = baseZ(x);
  const edge: [number, number] = [edgeZ(x), edgeY(x)];
  if (band === 1) return toCenter(edge, centerY(x), steps);
  return bowed([bz, bodyTopY(x, bz) - 0.012], edge, 0.035, steps);
}

interface Range {
  from: number;
  to: number;
  side: Slot;
  top: Slot;
}

const RANGES: Range[] = [
  { from: CANOPY.rear, to: CANOPY.roofRear, side: 'carbon', top: 'carbon' },
  { from: CANOPY.roofRear, to: CANOPY.roofFront, side: 'glass', top: 'carbon' },
  { from: CANOPY.roofFront, to: CANOPY.front, side: 'glass', top: 'glass' },
];

/**
 * Builds the canopy in three lengths (engine cover, roof, windshield) so
 * glass and carbon change at a crisp seam, each with side and top bands.
 */
export function addCanopy(bin: PartBin, detail: Detail): void {
  const total = Math.round(detail.stations * 0.75);
  for (const r of RANGES) {
    const n = Math.max(3, Math.round((total * (r.to - r.from)) / (CANOPY.front - CANOPY.rear)));
    const xs = Array.from({ length: n + 1 }, (_, i) => r.from + ((r.to - r.from) * i) / n);
    [0, 1].forEach((band) => {
      const rows = xs.map((x) => canopyBand(x, band, detail.canopy[band]).map(([z, y]) => warp([x, y, z])));
      bin.add(band === 0 ? r.side : r.top, bothSides(gridGeometry(rows)));
    });
  }
  // Close the tail end of the engine cover where it meets the deck.
  const x = CANOPY.rear;
  const half = [...canopyBand(x, 0, detail.canopy[0]), ...canopyBand(x, 1, detail.canopy[1]).slice(1)];
  const ring: Vec3[] = [...half.map(([z, y]) => warp([x, y, z])), ...half.slice(0, -1).reverse().map(([z, y]) => warp([x, y, -z]))];
  bin.add('carbon', polygonGeometry(ring, [-1, 0, 0]));
}

/** A point on the canopy: band 0 is the side glass, band 1 the roof; `t` runs base to center. */
export function onCanopy(x: number, band: number, t: number, lift = 0): Vec3 {
  const pts = canopyBand(x, band, 48);
  const i = Math.min(47, Math.floor(t * 48));
  const [p, q] = [pts[i], pts[i + 1]];
  const f = t * 48 - i;
  const dz = q[0] - p[0];
  const dy = q[1] - p[1];
  const len = Math.hypot(dz, dy) || 1;
  return warp([x, p[1] + dy * f - (dz / len) * lift, p[0] + dz * f + (dy / len) * lift]);
}
