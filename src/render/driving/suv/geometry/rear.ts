import { faceEdge } from './cap';
import { addPipes } from './exhaust';
import { smooth } from './curve';
import { at, capDisc, capPanel, capSpan } from './panels';
import type { Detail, PartBin } from './parts';
import { sillY, TAIL } from './profile';
import type { Pt } from './section';
import { addSpoiler } from './spoiler';
import { addTailgate } from './tailgate';

/**
 * The tail's light band in the face's unrolled coordinates: level across
 * the tailgate at 1.06 to 1.11 m, easing lower and slimmer as it wraps
 * 10 cm round each corner under the shoulder crease. `half` is how far it reaches.
 */
export const BAND = { half: 0.83, lo: 1.06, hi: 1.11 };

/** The light band's lower and upper edge at s. */
export function tailBand(s: number): { lo: number; hi: number } {
  const k = smooth((Math.abs(s) - 0.5) / 0.25);
  return { lo: BAND.lo - 0.02 * k, hi: BAND.hi - 0.032 * k };
}

/** A point in the band at s, a share `v` of its height up from its lower edge. */
function inBand(s: number, v: number): Pt {
  const { lo, hi } = tailBand(s);
  return [s, lo + (hi - lo) * v];
}

/** A strip in the band from s0 to s1 between shares v0 and v1, lifted off the face. */
function bandStrip(s0: number, s1: number, v0: number, v1: number, lift: number, cols: number, mirror = true) {
  const s = (u: number) => s0 + (s1 - s0) * u;
  return capSpan(-1, (u) => inBand(s(u), v0), (u) => inBand(s(u), v1), lift, cols, 1, mirror);
}

/**
 * The lights: a gloss black band across the top of the tailgate carrying
 * a slim full width light bar, which grows into a lamp at each corner as
 * the band wraps round onto the fender.
 */
function addLights(bin: PartBin, detail: Detail): void {
  const c = detail.fine ? 16 : detail.brakes ? 7 : 4;
  bin.add('trim', bandStrip(-BAND.half, BAND.half, 0, 1, 0.004, c * 4, false));
  // The corner lamp: a smoked lens filling most of the band toward each corner.
  bin.add('glass', bandStrip(0.52, BAND.half - 0.014, 0.12, 0.88, 0.006, c));
  // The bar parts in the middle for the app's own mark, lit like the bar, and runs out over the lens.
  bin.add('tail', bandStrip(0.036, BAND.half - 0.02, 0.38, 0.62, 0.008, c * 3));
  bin.add('tail', bandStrip(0.56, BAND.half - 0.034, 0.68, 0.78, 0.008, c));
  if (detail.brakes) addEmblem(bin, inBand(0, 0.49)[1], detail.fine ? 14 : 8);
  // Slim reflectors on the bumper's corners, under its crease.
  bin.add('tail', capPanel(-1, at(0.66), at(0.8), 0.595, 0.607, 0.004, 4, 1));
}

/**
 * The app's mark, small and lit, centered in the light band: three atoms
 * joined by two bonds into a bent molecule, about 4 cm across.
 */
function addEmblem(bin: PartBin, cy: number, seg: number): void {
  const k = 0.0024;
  const atoms: Pt[] = [[-8 * k, cy - 6 * k], [0, cy + 6 * k], [8 * k, cy - 6 * k]];
  const w = 0.004;
  for (let i = 0; i < 2; i++) {
    const [a, b] = [atoms[i], atoms[i + 1]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n: Pt = [(-(b[1] - a[1]) / len) * (w / 2), ((b[0] - a[0]) / len) * (w / 2)];
    const p = (u: number, s: number): Pt => [a[0] + (b[0] - a[0]) * u + n[0] * s, a[1] + (b[1] - a[1]) * u + n[1] * s];
    bin.add('tail', capSpan(-1, (u) => p(u, -1), (u) => p(u, 1), 0.008, 2, 1, false));
  }
  atoms.forEach(([z, y], i) => bin.add('tail', capDisc(-1, z, y, i === 1 ? 0.0085 : 0.0072, 0.009, seg, false)));
}

/**
 * The diffuser: a gloss black panel across the bottom of the bumper with
 * satin fins in the middle and a pair of tailpipes standing out of it on
 * each side (exhaust.ts). It fills the face down to its lowest edge and keeps inside
 * the face's own edge at every height.
 */
function addDiffuser(bin: PartBin, detail: Detail): void {
  const c = detail.fine ? 10 : detail.brakes ? 4 : 2;
  const y0 = sillY(TAIL);
  const top = 0.565;
  const half = (y: number) => faceEdge(-1, y) - 0.02;
  bin.add('trim', capPanel(-1, (y) => -half(y), half, y0, top, 0.004, c * 2, detail.fine ? 9 : 5, false));
  bin.add('metal', capPanel(-1, (y) => -half(y), half, top + 0.003, top + 0.008, 0.006, c * 2, 1, false));
  if (detail.fine) {
    for (const z of [-0.18, -0.09, 0, 0.09, 0.18]) bin.add('clad', capPanel(-1, at(z - 0.006), at(z + 0.006), y0 + 0.012, top - 0.035, 0.014, 1, 1, false));
  }
  addPipes(bin, detail);
}

/** The whole tail: lights, spoiler, tailgate and diffuser, laid on the bent face. */
export function addRear(bin: PartBin, detail: Detail): void {
  addLights(bin, detail);
  addSpoiler(bin, detail);
  addTailgate(bin, detail);
  addDiffuser(bin, detail);
}
