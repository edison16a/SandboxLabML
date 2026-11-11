import { profile, smooth, toCenter } from './curve';
import { bothSides, gridGeometry, type Vec3 } from './grid';
import type { Detail, PartBin, Slot } from './parts';
import { beltAt, deckY, sectionAt } from './profile';
import { along, deg, key, resample, span, type Pt } from './section';
import { warp } from './warp';

/**
 * The cabin: a glasshouse on the belt line under a coupe roof that peaks
 * over the front seats and falls in one long arc to a short tail. It
 * starts on the hood at the cowl and ends on the rear deck, matching the
 * body exactly at both ends, so no seam or cap is needed.
 */
export const CABIN = { rear: -2.33, glassRear: -2.1, roofRear: -0.95, header: 0.14, front: 1.04 };

const [FZ, FY] = beltAt(CABIN.front);
const [RZ, RY] = beltAt(CABIN.rear);
/** The roof edge: the top of the side glass, running down the A pillar at the front and the sail at the back. */
const edgeZ = profile([[CABIN.rear, RZ], [-2.0, 0.69], [-1.6, 0.655], [-1.0, 0.637], [-0.4, 0.632], [0.14, 0.648], [0.7, 0.72], [CABIN.front, FZ]]);
const edgeY = profile([[CABIN.rear, RY], [-2.0, 1.312], [-1.5, 1.432], [-0.95, 1.522], [-0.25, 1.572], [0.14, 1.54], [0.7, 1.29], [CABIN.front, FY]]);
/** The roofline at the centerline: windshield, crown, then the long fall to the deck. */
const centerY = profile([[CABIN.rear, deckY(CABIN.rear)], [-2.0, 1.36], [-1.5, 1.48], [-0.95, 1.574], [-0.25, 1.62], [0.14, 1.586], [0.7, 1.275], [CABIN.front, deckY(CABIN.front)]]);
/** The narrow roll between the side glass and the roof, m. */
const RAIL = { out: 0.03, down: 0.045 };
/** How far in from the belt the glass leans by the time it reaches the roof: the tumblehome. */
const TUMBLE = deg(19);

/** The body's top at x, belt to centerline, resampled to steps: what the roof blends into at each end. */
function bodyTop(x: number, steps: number): Pt[] {
  const k = sectionAt(x).keys;
  return resample([...span(k[4], k[5], 16), ...span(k[5], k[6], 16).slice(1)], steps);
}

/** How strongly the roof takes the body's shape: fully at each end, fading out over 0.35 m. */
function fade(x: number): number {
  return Math.max(1 - smooth((CABIN.front - x) / 0.35), 1 - smooth((x - CABIN.rear) / 0.35));
}

/**
 * Points across one band of the cabin at x, in (z, y). Band 0 is the
 * glass side from the belt up to the rail, band 1 the rail, band 2 the
 * roof, which arrives level at the centerline so the halves join smoothly.
 */
export function cabinBand(x: number, band: number, steps: number): Pt[] {
  const [bz, by] = beltAt(x);
  const edge: Pt = [edgeZ(x), edgeY(x)];
  // The rail shrinks away where the side band closes up, at the A pillar's foot and the end of the sail.
  const r = Math.min(1, Math.max(0, (edge[1] - by) / 0.12));
  const rail: Pt = [edge[0] + RAIL.out * r, edge[1] - RAIL.down * r];
  if (band === 0) return span(key(bz, by, TUMBLE), key(rail[0], rail[1], TUMBLE + deg(4)), steps);
  if (band === 1) return span(key(rail[0], rail[1], TUMBLE + deg(4)), key(edge[0], edge[1], deg(70)), steps);
  const roof = toCenter(edge, centerY(x), steps);
  const f = fade(x);
  if (f <= 0) return roof;
  // Near the cowl and the deck the roof's section eases into the body's, so the glass sits right on the paint.
  const end = x > 0 ? CABIN.front : CABIN.rear;
  const base = toCenter([edgeZ(end), edgeY(end)], centerY(end), steps);
  const top = bodyTop(end, steps);
  // The windshield's foot tucks a little under the hood, so the two meet in a clean line at any detail.
  const tuck = x > 0 ? 0.012 * (1 - smooth((CABIN.front - x) / 0.12)) : 0;
  return roof.map(([z, y], i) => [z + (top[i][0] - base[i][0]) * f, y + (top[i][1] - base[i][1]) * f - tuck * Math.min(1, i / 2)]);
}

interface Range {
  from: number;
  to: number;
  rail: Slot;
  top: Slot;
  /** Width kept beside a window in the roof band, m: the A pillars and the sails beside the rear glass. */
  pillar?: number;
  pillarSlot?: Slot;
}

/**
 * The roof is paint with glass set into it: the windshield between
 * gloss black A pillars, the rear window between gloss black pillars, so
 * the painted roof panel floats on a dark glasshouse. The side band is
 * built in windows.ts, where the window graphic is drawn.
 */
const RANGES: Range[] = [
  { from: CABIN.rear, to: CABIN.glassRear, rail: 'trim', top: 'paint' },
  { from: CABIN.glassRear, to: CABIN.roofRear, rail: 'trim', top: 'glass', pillar: 0.2, pillarSlot: 'trim' },
  { from: CABIN.roofRear, to: CABIN.header, rail: 'paint', top: 'paint' },
  { from: CABIN.header, to: CABIN.front, rail: 'trim', top: 'glass', pillar: 0.07, pillarSlot: 'trim' },
];

/** Stations along the cabin from x0 to x1, about as dense as the body's. */
export function cabinStations(x0: number, x1: number, detail: Detail): number[] {
  const n = Math.max(3, Math.round(((x1 - x0) / 4.9) * detail.stations * 1.1));
  return Array.from({ length: n + 1 }, (_, i) => x0 + ((x1 - x0) * i) / n);
}

export function addCabin(bin: PartBin, detail: Detail): void {
  for (const r of RANGES) {
    const xs = cabinStations(r.from, r.to, detail);
    const rail = xs.map((x) => cabinBand(x, 1, 2).map(([z, y]) => warp([x, y, z])));
    bin.add(r.rail, bothSides(gridGeometry(rail)));
    const steps = detail.cabin[1];
    const rows = xs.map((x) => cabinBand(x, 2, steps).map(([z, y]) => warp([x, y, z])));
    if (!r.pillar) {
      bin.add(r.top, bothSides(gridGeometry(rows)));
      continue;
    }
    // Split each row a fixed width in from the edge, so the pillars keep their width as the roof narrows.
    const split = xs.map((x) => Math.min(0.5, (r.pillar as number) / roofWidth(x)));
    const part = (t0: (i: number) => number, t1: (i: number) => number, n: number) =>
      xs.map((x, i) => Array.from({ length: n + 1 }, (_, j) => onCabin(x, 2, t0(i) + ((t1(i) - t0(i)) * j) / n)));
    bin.add(r.pillarSlot as Slot, bothSides(gridGeometry(part(() => 0, (i) => split[i], 2))));
    bin.add(r.top, bothSides(gridGeometry(part((i) => split[i], () => 1, steps))));
  }
}

/** Length of the roof band at x from its edge to the centerline, m. */
export function roofWidth(x: number): number {
  const pts = cabinBand(x, 2, 32);
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return d;
}

/** A point on the cabin: band 0 the side, 1 the rail, 2 the roof; `t` runs from the belt toward the centerline by arc length. */
export function onCabin(x: number, band: number, t: number, lift = 0): Vec3 {
  const { p, n } = along(cabinBand(x, band, 48), t);
  return warp([x, p[1] + n[1] * lift, p[0] + n[0] * lift]);
}
