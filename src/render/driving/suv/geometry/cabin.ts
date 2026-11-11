import { bowed, profile, toCenter } from './curve';
import { bothSides, gridGeometry, polygonGeometry, type Vec3 } from './grid';
import type { Detail, PartBin, Slot } from './parts';
import { beltAt } from './profile';
import { warp } from './warp';

/**
 * The cabin: a glasshouse that sits on the belt line, with a coupe roof
 * that peaks over the front seats and sweeps down to a short tail. The
 * windshield rises from the cowl at the back of the hood.
 */
export const CABIN = { rear: -2.3, front: 1.06, roofFront: 0.32, glassRear: -2.12, roofRear: -1.0 };

const edgeZ = profile([[-2.3, 0.52], [-2.1, 0.57], [-1.7, 0.625], [-1.0, 0.668], [-0.2, 0.68], [0.3, 0.69], [0.7, 0.765], [1.06, 0.855]]);
const edgeY = profile([[-2.3, 1.185], [-2.1, 1.262], [-1.7, 1.41], [-1.05, 1.592], [-0.35, 1.652], [0.25, 1.632], [0.7, 1.39], [1.06, 1.09]]);
const centerY = profile([[-2.3, 1.2], [-2.1, 1.28], [-1.7, 1.436], [-1.05, 1.622], [-0.35, 1.684], [0.25, 1.664], [0.7, 1.41], [1.06, 1.106]]);
/** The narrow body colored rail between the side glass and the roof, m. */
const RAIL = { out: 0.028, down: 0.05 };

/**
 * Points across one band of the cabin at x, in (z, y). Band 0 is the side
 * glass from the belt up to the rail, band 1 the rail, band 2 the roof,
 * which arrives level at the centerline so the halves join smoothly.
 */
function cabinBand(x: number, band: number, steps: number): Array<[number, number]> {
  const [bz, by] = beltAt(x);
  const edge: [number, number] = [edgeZ(x), edgeY(x)];
  const rail: [number, number] = [edge[0] + RAIL.out, edge[1] - RAIL.down];
  if (band === 2) return toCenter(edge, centerY(x), steps);
  if (band === 1) return bowed(rail, edge, 0.004, Math.max(1, Math.round(steps / 3)));
  return bowed([bz - 0.008, by - 0.006], rail, 0.022, steps);
}

interface Range {
  from: number;
  to: number;
  side: Slot;
  top: Slot;
  /** Share of the roof band, from its outer edge, kept in paint beside the glass: the pillars either side of a window. */
  pillar?: number;
}

/**
 * The cabin's sides and roof are paint; the windshield and the rear window
 * are glass, changing at crisp seams. The side windows, the pillars' black
 * trim and the sunroof are laid over the paint (see windows.ts).
 */
const RANGES: Range[] = [
  { from: CABIN.rear, to: CABIN.glassRear, side: 'paint', top: 'paint' },
  { from: CABIN.glassRear, to: CABIN.roofRear, side: 'paint', top: 'glass', pillar: 0.34 },
  { from: CABIN.roofRear, to: CABIN.roofFront, side: 'paint', top: 'paint' },
  { from: CABIN.roofFront, to: CABIN.front, side: 'paint', top: 'glass', pillar: 0.12 },
];

export function addCabin(bin: PartBin, detail: Detail): void {
  const total = Math.round(detail.stations * 0.7);
  const span = CABIN.front - CABIN.rear;
  for (const r of RANGES) {
    const n = Math.max(3, Math.round((total * (r.to - r.from)) / span));
    const xs = Array.from({ length: n + 1 }, (_, i) => r.from + ((r.to - r.from) * i) / n);
    for (const band of [0, 1, 2]) {
      const steps = band === 2 ? detail.cabin[1] : detail.cabin[0];
      const rows = xs.map((x) => cabinBand(x, band, steps).map(([z, y]) => warp([x, y, z])));
      const slot = band === 0 ? r.side : band === 1 ? 'paint' : r.top;
      // A window in the roof band keeps a painted pillar along its outer edge: the C pillar's sail, the A pillar.
      const k = band === 2 && r.pillar ? Math.round(steps * r.pillar) : 0;
      if (k > 0 && k < steps) {
        bin.add('paint', bothSides(gridGeometry(rows.map((row) => row.slice(0, k + 1)))));
        bin.add(slot, bothSides(gridGeometry(rows.map((row) => row.slice(k)))));
      } else bin.add(slot, bothSides(gridGeometry(rows)));
    }
  }
  // Close the tail end of the cabin where the roof steps down to the deck.
  const x = CABIN.rear;
  const half = [...cabinBand(x, 0, detail.cabin[0]), ...cabinBand(x, 1, 2).slice(1), ...cabinBand(x, 2, detail.cabin[1]).slice(1)];
  const ring: Vec3[] = [...half.map(([z, y]) => warp([x, y, z])), ...half.slice(0, -1).reverse().map(([z, y]) => warp([x, y, -z]))];
  bin.add('paint', polygonGeometry(ring, [-1, 0, 0]));
}

/** A point on the cabin: band 0 the side glass, 1 the rail, 2 the roof; `t` runs from the belt toward the centerline. */
export function onCabin(x: number, band: number, t: number, lift = 0): Vec3 {
  const pts = cabinBand(x, band, 48);
  const last = pts.length - 1;
  const i = Math.min(last - 1, Math.floor(t * last));
  const [p, q] = [pts[i], pts[i + 1]];
  const f = t * last - i;
  const dz = q[0] - p[0];
  const dy = q[1] - p[1];
  const len = Math.hypot(dz, dy) || 1;
  return warp([x, p[1] + dy * f - (dz / len) * lift, p[0] + dz * f + (dy / len) * lift]);
}

export { edgeY as cabinEdgeY, edgeZ as cabinEdgeZ };
