import { faceTop } from './body';
import type { Detail, PartBin } from './parts';
import { at, capPanel, capSpan } from './panels';
import type { Pt } from './section';

/** The headlight's span across the face, inner to outer end, m. */
const LAMP = { inner: 0.4, outer: 0.815 };

/** A point along the headlight, `u` from its inner end to its outer end, `down` m below the face's top edge. */
function lampEdge(u: number, down: number): Pt {
  const z = LAMP.inner + (LAMP.outer - LAMP.inner) * u;
  return [z, faceTop(1, z) - down];
}

/** The lamp's height at u: slim inboard, deep enough at the corner to hold the light signature. */
const depth = (u: number) => 0.05 + 0.04 * u ** 1.3;

/**
 * The headlights: slim units at the top corners of the face, following
 * the fender peaks, so each lamp rises to its peak and wraps down into
 * the corner. A gloss black bezel, a smoked lens, a thin light line along
 * the lower edge and the four dot daytime light signature at the corner.
 */
function addHeadlights(bin: PartBin, detail: Detail): void {
  const c = detail.fine ? 16 : detail.brakes ? 6 : 4;
  const top = 0.012;
  bin.add('trim', capSpan(1, (u) => lampEdge(u, top + depth(u) + 0.008), (u) => lampEdge(u, top - 0.006), 0.004, c, 1));
  bin.add('glass', capSpan(1, (u) => lampEdge(u, top + depth(u)), (u) => lampEdge(u, top), 0.007, c, 1));
  const line = (u: number) => 0.04 + u * 0.6;
  bin.add('led', capSpan(1, (u) => lampEdge(line(u), top + depth(line(u)) - 0.005), (u) => lampEdge(line(u), top + depth(line(u)) - 0.012), 0.009, c, 1));
  if (!detail.fine && !detail.brakes) return;
  // Four dots in a square at the corner, the signature you recognize in a mirror.
  const u = 0.8;
  const [qz, qy] = lampEdge(u, top + depth(u) / 2);
  const s = 0.012;
  for (const dz of [-0.017, 0.017]) {
    for (const dy of [-0.017, 0.017]) bin.add('led', capPanel(1, at(qz + dz - s), at(qz + dz + s), qy + dy - s * 0.8, qy + dy + s * 0.8, 0.011, 1, 1));
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A side intake's outline, inset by `k` m: a trapezoid whose inner edge leans out and whose top falls toward the corner. */
function sideIntake(k: number): { lo: (u: number) => Pt; hi: (u: number) => Pt } {
  return {
    lo: (u) => [lerp(0.5 + k, 0.79 - k, u), 0.432 + k],
    hi: (u) => [lerp(0.55 + k * 0.6, 0.79 - k, u), lerp(0.665 - k, 0.622 - k, u)],
  };
}

/**
 * The lower face: no tall grille, just a low wide center intake and two
 * large side intakes framed in gloss black, a clean painted nose above
 * them, and a gloss black lip under everything.
 */
function addIntakes(bin: PartBin, detail: Detail): void {
  const c = detail.fine ? 8 : detail.brakes ? 4 : 2;
  const center = (k: number) => (y: number) => 0.45 - k - (y - 0.432) * 0.32;
  bin.add('trim', capPanel(1, (y) => -center(0)(y), center(0), 0.432, 0.58, 0.004, c * 2, 2, false));
  bin.add('grille', capPanel(1, (y) => -center(0.016)(y), center(0.016), 0.448, 0.564, 0.007, c * 2, 2, false));
  const frame = sideIntake(0);
  const mesh = sideIntake(0.016);
  bin.add('trim', capSpan(1, frame.lo, frame.hi, 0.004, c, 3));
  bin.add('grille', capSpan(1, mesh.lo, mesh.hi, 0.007, c, 3));
  // One gloss blade across each side intake, at its middle.
  const mid = (v: number) => (u: number): Pt => {
    const a = mesh.lo(u);
    const b = mesh.hi(u);
    return [lerp(a[0], b[0], v), lerp(a[1], b[1], v)];
  };
  bin.add('trim', capSpan(1, mid(0.47), mid(0.55), 0.014, c, 1));
  bin.add('trim', capPanel(1, at(-0.75), at(0.75), 0.417, 0.437, 0.016, c * 3, 1, false));
}

/** The whole nose: lamps on top, intakes below, all laid on the warped face. */
export function addFront(bin: PartBin, detail: Detail): void {
  addHeadlights(bin, detail);
  addIntakes(bin, detail);
}
