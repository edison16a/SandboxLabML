import { profile, smooth, toCenter } from './curve';
import { TAIL } from './ends';
import type { Vec3 } from './grid';
import type { Detail } from './parts';
import { beltAt, deckY, sectionAt } from './profile';
import { along, deg, key, resample, span, type Pt } from './section';
import { warp } from './warp';

/**
 * The cabin: a glasshouse on the belt line under a coupe roof that peaks
 * over the front seats and falls in one long arc to the lip over the
 * tailgate. It starts on the hood at the cowl and ends on the tail's
 * deck, matching the body exactly at both ends, so no seam or cap is needed.
 */
export const CABIN = { rear: TAIL, glassRear: -2.16, roofRear: -1.06, header: -0.05, front: 0.9 };

const [FZ, FY] = beltAt(CABIN.front);
const [RZ, RY] = beltAt(CABIN.rear);
/** The roof edge: the top of the side glass, running down the A pillar at the front and the sail at the back. */
const edgeZ = profile([[CABIN.rear, RZ], [-2.0, 0.678], [-1.6, 0.664], [-1.0, 0.657], [-0.45, 0.66], [-0.05, 0.673], [0.3, 0.714], [0.6, 0.765], [CABIN.front, FZ]]);
const edgeY = profile([[CABIN.rear, RY], [-2.0, 1.292], [-1.7, 1.372], [-1.4, 1.443], [-1.0, 1.522], [-0.45, 1.578], [-0.05, 1.556], [0.3, 1.392], [0.6, 1.238], [CABIN.front, FY]]);
/** The roofline at the centerline: windshield, crown, then the long fall to the lip. */
const centerY = profile([[CABIN.rear, deckY(CABIN.rear)], [-2.0, 1.336], [-1.7, 1.425], [-1.4, 1.5], [-1.0, 1.58], [-0.6, 1.634], [-0.35, 1.648], [-0.15, 1.632], [-0.05, 1.6], [0.2, 1.47], [0.425, 1.345], [0.7, 1.186], [CABIN.front, deckY(CABIN.front)]]);
/** The narrow roll between the side glass and the roof, m. */
const RAIL = { out: 0.03, down: 0.045 };
/** How far in from the belt the glass leans by the time it reaches the roof: the tumblehome. */
const TUMBLE = deg(19);

/** The body's top at x, belt to centerline, resampled to steps: what the roof blends into at each end. */
function bodyTop(x: number, steps: number): Pt[] {
  const k = sectionAt(x).keys;
  return resample([...span(k[5], k[6], 16), ...span(k[6], k[7], 16).slice(1)], steps);
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
  // Toward the tail the narrow roof drops to the wide belt and the side band lies almost flat, like a sail.
  // There it leans with its own chord; held at the glass's lean it would ripple up, across and up again.
  const chord = Math.atan2(bz - rail[0], rail[1] - by);
  const lean = TUMBLE + Math.max(0, chord - TUMBLE - deg(4));
  if (band === 0) return span(key(bz, by, lean), key(rail[0], rail[1], lean + deg(4)), steps);
  if (band === 1) return span(key(rail[0], rail[1], lean + deg(4)), key(edge[0], edge[1], Math.max(deg(70), lean + deg(4))), steps);
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

/** Stations along the cabin from x0 to x1, about as dense as the body's. */
export function cabinStations(x0: number, x1: number, detail: Detail): number[] {
  const n = Math.max(3, Math.round(((x1 - x0) / 4.9) * detail.stations * 1.1));
  return Array.from({ length: n + 1 }, (_, i) => x0 + ((x1 - x0) * i) / n);
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
