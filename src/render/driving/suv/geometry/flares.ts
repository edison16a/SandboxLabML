import { bandCurve } from './body';
import type { Vec3 } from './grid';
import { lightest, type Detail } from './parts';
import { smooth } from './curve';
import { ARCH, ARCHED_BANDS, sectionAt } from './profile';
import { warp } from './warp';

/**
 * One point on an arch's edge: where it sits (x, y, and z on the skin)
 * and the unit direction (ux, uy) pointing away from the wheel, along the
 * arch's radius over the top and straight fore or aft down its legs.
 */
export interface EdgePoint {
  x: number;
  y: number;
  z: number;
  ux: number;
  uy: number;
}

/** The side skin at height y on the section at x, as its z and outward normal (nz, ny). */
export function skinAt(x: number, y: number): { z: number; nz: number; ny: number } {
  for (let band = 0; band < ARCHED_BANDS; band++) {
    const pts = bandCurve(x, band, 16);
    for (let i = 0; i < pts.length - 1; i++) {
      const [z0, y0] = pts[i];
      const [z1, y1] = pts[i + 1];
      if (y0 <= y && y1 >= y) {
        const len = Math.hypot(z1 - z0, y1 - y0) || 1;
        // Outward is to the right of travel: the section climbs from the sill.
        return { z: z0 + ((z1 - z0) * (y - y0)) / (y1 - y0 || 1), nz: (y1 - y0) / len, ny: -(z1 - z0) / len };
      }
    }
  }
  return { z: sectionAt(x).keys[0].z, nz: 1, ny: 0 };
}

/**
 * The flare round each arch, as (out from the arch's edge, lift off the
 * skin) in m: a slim satin black band 4.6 cm wide that rises from a
 * feathered outer edge to a soft crown 8 mm proud of the paint, then
 * rolls over the edge into the opening. It frames the wheel, so the full
 * tire reads against the dark well, and with the sill cladding it draws
 * the dark base an SUV stands on.
 */
const FLARE: Array<[number, number]> = [[0.046, 0.001], [0.04, 0.0042], [0.034, 0.0068], [0.02, 0.0084], [0.009, 0.0084], [0.003, 0.0068], [0.0005, 0.0042]];
const FAR_FLARE: Array<[number, number]> = [[0.046, 0.0015], [0.012, 0.0075], [0.002, 0.005]];
/** The lightest population car keeps three points across: the flare's edge, its crown and the ring's inner edge. */
const FAREST: Array<[number, number]> = [[0.046, 0.0015], [0.008, 0.0075]];

/**
 * Inside the opening, as (out along the radius, in toward the car) from
 * the skin's cut: the flare's roll carries on down and in, then a ring
 * 2.4 cm wide faces out a little deeper, and the liner takes over from
 * its inner edge.
 */
const RING: Array<[number, number]> = [[-0.002, -0.0005], [-0.005, -0.005], [-0.008, -0.012], [-0.009, -0.014], [-0.03, -0.016], [-0.033, -0.019], [-0.034, -0.032]];
const FAR_RING: Array<[number, number]> = [[-0.03, -0.016], [-0.034, -0.032]];
const FAREST_RING: Array<[number, number]> = [[-0.034, -0.032]];

/** How far below the hub the flare's legs taper into the cladding, m. */
const TAPER = 0.09;

/**
 * Rows across the flare and its ring at each edge point, from the
 * feathered outer edge on the paint into the opening. Out on the paint
 * each point follows the skin and stands off it along its normal; inside
 * the opening it steps in from the cut. The last point of each row is
 * where the liner starts.
 */
export function flareRows(edge: EdgePoint[], detail: Detail): Vec3[][] {
  const outside = detail.brakes ? FLARE : lightest(detail) ? FAREST : FAR_FLARE;
  const inside = detail.brakes ? RING : lightest(detail) ? FAREST_RING : FAR_RING;
  return edge.map(({ x, y, z, ux, uy }) => {
    // Down the legs the flare dies into the sill cladding's top, level with the hub, instead of wrapping under the sill.
    const k = smooth((y - ARCH.centerY + TAPER) / TAPER);
    return [
      ...outside.map(([out, lift]): Vec3 => {
        const px = x + ux * out * k;
        const py = y + uy * out * k;
        const s = skinAt(px, py);
        return warp([px, py + s.ny * lift * k, s.z + s.nz * lift * k]);
      }),
      ...inside.map(([out, inward]): Vec3 => warp([x + ux * out, y + uy * out, z + inward])),
    ];
  });
}
