import { faceEdge, onCap } from './cap';
import type { FaceCut } from './face';
import { bothSides, gridGeometry, type Vec3 } from './grid';
import type { Detail, PartBin } from './parts';
import { NOSE, sectionAt, sillY } from './profile';
import { capFill, facing, offset, recess, ringGeometry, rounded } from './recess';
import type { Pt } from './section';

/**
 * The central intake: one wide trapezoid, 1.05 m across at the bottom and
 * 0.9 m at the top. Its floor and roof are the nose face's own rows (the
 * top of the sill trim and the fold over it), so the face can be cut
 * open along its grid and the mesh set well back behind the paint.
 */
const CENTER = { bottom: 0.525, top: 0.45, back: 0.045, width: 0.018, lip: 0.005 };

/** Heights of the intake's floor and roof: keys 1 and 2 of the nose section. */
function centerSpan(): [number, number] {
  const k = sectionAt(NOSE).keys;
  return [k[1].y, k[2].y];
}

/** The central intake's half width at height y. */
function centerHalf(y: number): number {
  const [y0, y1] = centerSpan();
  return CENTER.bottom + ((CENTER.top - CENTER.bottom) * (y - y0)) / (y1 - y0);
}

/** The hole the nose face leaves for the central intake, between its key 1 and key 2 rows. */
export function intakeCut(): FaceCut {
  const [y0, y1] = centerSpan();
  return { y0, y1, half: centerHalf };
}

/**
 * A side intake, outboard of the central one: 0.16 m wide and 0.26 m
 * tall, its sides leaning in toward the top like the central intake's,
 * so the three openings read as one trapezoid mouth. It wraps onto the
 * corner by the face's unrolled coordinates. Counterclockwise in (s, y).
 */
const SIDE: Pt[] = [[0.585, 0.385], [0.745, 0.385], [0.69, 0.645], [0.53, 0.645]];

/** The side intake's fin line at height y: down the middle of the opening, leaning with it. */
const finAt = (y: number) => 0.665 - ((y - 0.385) / 0.26) * 0.055;

/**
 * Across the frame the bumper raises round each side intake, as (out
 * from the opening, lift off the face) in m: the paint swells up over
 * 5 cm to a crisp edge 9 mm proud, then turns down into the opening.
 */
const FRAME: Array<[number, number]> = [[0.055, 0.0004], [0.034, 0.0045], [0.018, 0.0086], [0.008, 0.009], [0.004, 0.0072]];

/**
 * The lower face. The central intake is open: its gloss black bezel
 * lips round a hole in the paint and its mesh sits 4.5 cm back. Each side
 * intake sits in a raised body colored frame, so the bumper is sculpted
 * round it; gloss black walls drop from the frame's edge to the mesh and
 * one body colored fin splits it. Lighter cars draw the openings flat.
 */
export function addIntakes(bin: PartBin, detail: Detail): void {
  const corner = detail.fine ? 5 : detail.brakes ? 3 : 1;
  const rings = detail.fine ? 4 : detail.brakes ? 2 : 1;
  // Outline steps: fine enough that no edge cuts a chord under the curved paint, coarse on the far population.
  const step = detail.fine ? 0.022 : detail.brakes ? 0.035 : 0.12;
  const [y0, y1] = centerSpan();
  const open = detail.fine || detail.brakes;
  const trapezoid: Pt[] = [[-CENTER.bottom, y0], [CENTER.bottom, y0], [CENTER.top, y1], [-CENTER.top, y1]];
  // Behind its hole the central mesh sits clear of the paint, so it can be coarse.
  const center = recess(1, rounded(trapezoid, 0.026, corner), { width: CENTER.width, lip: CENTER.lip, back: open ? CENTER.back : -0.003 }, open ? 2 : 1, step, open ? 0.09 : step);
  if (detail.brakes) bin.add('trim', center.bezel);
  else center.bezel.dispose();
  if (open) bin.add('liner', center.throat);
  else center.throat.dispose();
  bin.add('grille', center.mesh);
  const side = rounded(SIDE, 0.03, corner);
  // The far population lifts its flat mesh a little more and keeps finer steps, so the curl never swallows it.
  bin.add('grille', bothSides(capFill(1, offset(side, -0.004), open ? 0.0012 : 0.004, rings, Math.min(step, 0.05))));
  if (!open) return;
  const mid = onCap(1, 0.64, 0.515, 0);
  const inward = (p: Vec3): Vec3 => [mid[0] - p[0], mid[1] - p[1], mid[2] - p[2]];
  // The frame is a soft swell, so it can take longer steps than the opening's own edge.
  bin.add('paint', bothSides(facing(ringGeometry(1, side, FRAME, Math.max(step, 0.032)), [1, 0, 0])));
  bin.add('trim', bothSides(facing(ringGeometry(1, side, [[0.004, 0.0072], [-0.004, 0.0012]], Math.max(step, 0.032)), inward)));
  if (!detail.fine) return;
  // The fin: a slim body colored bar with walls, standing up to the frame's height.
  const fin = rounded([[finAt(0.39) - 0.006, 0.39], [finAt(0.39) + 0.006, 0.39], [finAt(0.64) + 0.006, 0.64], [finAt(0.64) - 0.006, 0.64]], 0.004, 2);
  bin.add('paint', bothSides(facing(ringGeometry(1, fin, [[0.0, 0.0012], [-0.002, 0.0078], [-0.0045, 0.0086], [-0.0058, 0.0086]], 0.03), [1, 0, 0])));
}

/**
 * A satin black splitter under the face, carrying the sill cladding
 * round the front. It is a real blade with a top, a front and an
 * underside, wrapping a little way round each corner and tapering back
 * into the bumper at its ends.
 */
export function addLip(bin: PartBin, detail: Detail): void {
  const y0 = sillY(NOSE);
  const half = faceEdge(1, y0 + 0.02) + 0.14;
  const n = detail.fine ? 32 : detail.brakes ? 14 : 8;
  const rows: Vec3[][] = [];
  for (let i = 0; i <= n; i++) {
    const s = -half + (2 * half * i) / n;
    const k = 1 - (s / half) ** 8;
    rows.push(([[y0 + 0.045, 0.002], [y0 + 0.034, 0.004 + 0.016 * k], [y0 + 0.008, 0.004 + 0.024 * k], [y0, 0.002 + 0.014 * k]] as const).map(([y, lift]) => onCap(1, s, y, lift)));
  }
  bin.add('clad', facing(gridGeometry(rows), [1, 0, 0]));
}
