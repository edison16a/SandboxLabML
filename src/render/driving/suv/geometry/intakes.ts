import { faceEdge, onCap } from './cap';
import type { FaceCut } from './face';
import { bothSides, gridGeometry, type Vec3 } from './grid';
import { capPanel } from './panels';
import type { Detail, PartBin } from './parts';
import { NOSE, sectionAt, sillY } from './profile';
import { facing, recess, rounded } from './recess';
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
export function intakeCut(detail: Detail): FaceCut {
  const [b0, b1] = detail.bands;
  return { from: b0, to: b0 + b1, half: centerHalf };
}

/**
 * A side intake, outboard of the central one: 0.16 m wide and 0.26 m
 * tall, leaning out a little at the top, wrapped onto the corner by the
 * face's unrolled coordinates. Counterclockwise in (s, y).
 */
const SIDE: Pt[] = [[0.585, 0.385], [0.735, 0.385], [0.765, 0.645], [0.615, 0.645]];

/**
 * The lower face. The central intake is open: its gloss black bezel
 * lips round a hole in the paint and its mesh sits 4.5 cm back. The side
 * intakes sit in the bumper's curl behind slimmer bezels, each split by
 * one thin upright fin. Lighter cars draw the openings flat.
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
  const side = recess(1, rounded(SIDE, 0.03, corner), { width: 0.016, lip: 0.01, back: -0.003 }, rings, step);
  side.throat.dispose();
  if (detail.brakes) bin.add('trim', bothSides(side.bezel));
  else side.bezel.dispose();
  bin.add('grille', bothSides(side.mesh));
  if (!detail.fine) return;
  // One thin upright fin across each side intake, leaning with it.
  const mid = (y: number) => 0.675 + ((y - 0.385) / 0.26) * 0.03;
  bin.add('trim', capPanel(1, (y) => mid(y) - 0.005, (y) => mid(y) + 0.005, 0.395, 0.635, 0.012, 1, 6));
}

/**
 * A gloss black splitter under the face, carrying the black sill trim
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
  bin.add('trim', facing(gridGeometry(rows), [1, 0, 0]));
}
