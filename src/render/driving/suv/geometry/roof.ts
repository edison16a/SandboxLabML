import { CABIN, cabinBand, cabinStations, onCabin, roofWidth } from './cabin';
import { profile } from './curve';
import { bothSides, gridGeometry } from './grid';
import type { Detail, PartBin } from './parts';
import { warp } from './warp';

/**
 * Where the roof's paint meets its glass, m: the windshield's header and
 * the rear glass's top edge on the centerline, and how far each edge
 * sweeps along the car by the time it reaches the roof's frame. Swept
 * edges round the painted panel's corners, so from the side its ends
 * slant into the pillars instead of standing as square cuts.
 */
const ROOF = { header: CABIN.header, rear: CABIN.roofRear, sweep: 0.11, sweepRear: 0.14 };

/**
 * Width of the gloss black frame along the roof's edge, m: the A pillars,
 * a slim band over the doors and the wide sails beside the rear glass.
 * One continuous frame, so the painted roof floats on a dark band.
 */
const frame = profile([[CABIN.glassRear, 0.19], [ROOF.rear, 0.19], [ROOF.rear + ROOF.sweepRear + 0.15, 0.04], [ROOF.header - ROOF.sweep - 0.1, 0.04], [ROOF.header, 0.07], [CABIN.front, 0.07]]);

/** The frame's share of the roof band at x, from the edge. */
const frameShare = (x: number) => Math.min(0.5, frame(x) / roofWidth(x));

/** Where the glass gives way to paint across the roof band at x, as a share from the edge: 1 is all glass. */
function glassShare(x: number, p: number): number {
  const { header, rear, sweep, sweepRear } = ROOF;
  if (x >= header || x <= rear) return 1;
  if (x > header - sweep) return 1 - (1 - p) * Math.sqrt((header - x) / sweep);
  if (x < rear + sweepRear) return 1 - (1 - p) * Math.sqrt((x - rear) / sweepRear);
  return p;
}

/** Stations bunched toward `at`, from `at + span` (or below, for a negative span), so a swept edge stays a smooth curve. */
const toward = (at: number, span: number, n: number) => Array.from({ length: n + 1 }, (_, i) => at + span * (1 - i / n) ** 2);

/** One grid over stations `xs`, between shares t0(x) and t1(x) of the roof band, `n` columns across. */
function strip(xs: number[], t0: (x: number) => number, t1: (x: number) => number, n: number) {
  return bothSides(gridGeometry(xs.map((x) => Array.from({ length: n + 1 }, (_, j) => onCabin(x, 2, t0(x) + ((t1(x) - t0(x)) * j) / n)))));
}

/**
 * The cabin's top: the painted deck behind the rear glass, and over the
 * glasshouse a gloss black rail, the black frame, the windshield and the
 * rear glass, with the painted roof panel between them. The side band is
 * built in windows.ts, where the window graphic is drawn.
 */
export function addCabin(bin: PartBin, detail: Detail): void {
  const steps = detail.cabin[1];
  // Behind the rear glass, belt to centerline in one row per station: the side band and the rail have all but closed up.
  const deck = cabinStations(CABIN.rear, CABIN.glassRear, detail).map((x) =>
    [...cabinBand(x, 0, detail.cabin[0]), ...cabinBand(x, 1, 2).slice(1), ...cabinBand(x, 2, steps).slice(1)].map(([z, y]) => warp([x, y, z])),
  );
  bin.add('paint', bothSides(gridGeometry(deck)));
  const n = detail.fine ? 4 : detail.brakes ? 2 : 1;
  const { header, rear, sweep, sweepRear } = ROOF;
  const xs = [
    ...cabinStations(CABIN.glassRear, rear, detail),
    ...toward(rear, sweepRear, n).reverse(),
    ...cabinStations(rear + sweepRear, header - sweep, detail),
    ...toward(header, -sweep, n),
    ...cabinStations(header, CABIN.front, detail),
  ].sort((a, b) => a - b);
  const all = xs.filter((x, i) => i === 0 || x - xs[i - 1] > 1e-6);
  const within = (a: number, b: number) => all.filter((x) => x >= a - 1e-9 && x <= b + 1e-9);
  const p = new Map(all.map((x) => [x, frameShare(x)]));
  const share = (x: number) => p.get(x) as number;
  const g = (x: number) => glassShare(x, share(x));
  bin.add('trim', bothSides(gridGeometry(all.map((x) => cabinBand(x, 1, 2).map(([z, y]) => warp([x, y, z]))))));
  bin.add('trim', strip(all, () => 0, share, detail.brakes ? 2 : 1));
  bin.add('glass', strip(within(CABIN.glassRear, rear + sweepRear), share, g, steps));
  bin.add('glass', strip(within(header - sweep, CABIN.front), share, g, steps));
  bin.add('paint', strip(within(rear, header), g, () => 1, steps));
}
