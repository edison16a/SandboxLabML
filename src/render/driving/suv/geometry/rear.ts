import { faceEdge, faceTop, onCap } from './cap';
import { smooth } from './curve';
import { gridGeometry, type Vec3 } from './grid';
import { at, capDisc, capPanel, capSpan } from './panels';
import type { Detail, PartBin } from './parts';
import { sillY, TAIL } from './profile';
import type { Pt } from './section';
import { addTailgate } from './tailgate';

/**
 * The tail's light band in the face's unrolled coordinates: level across
 * the tailgate at 1.0 to 1.05 m, easing a little lower as it wraps 10 cm
 * round each corner under the shoulder. `half` is how far it reaches.
 */
export const BAND = { half: 0.83, lo: 0.993, hi: 1.046 };

/** The light band's lower and upper edge at s. */
export function tailBand(s: number): { lo: number; hi: number } {
  const k = smooth((Math.abs(s) - 0.52) / 0.3);
  return { lo: BAND.lo - 0.012 * k, hi: BAND.hi - 0.022 * k };
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
  // Slim reflectors low on the bumper's corners.
  bin.add('tail', capPanel(-1, at(0.66), at(0.8), 0.6, 0.612, 0.004, 4, 1));
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
 * A lip spoiler along the top of the tail, where the roofline ends. Its
 * top grows out of the roof, kicks up a little and ends in a thin, crisp
 * trailing edge 3 cm out; its underside tucks back into the tailgate.
 * Both ends taper away.
 */
function addSpoiler(bin: PartBin, detail: Detail): void {
  const n = detail.fine ? 28 : detail.brakes ? 10 : 6;
  const half = 0.6;
  const rows: Vec3[][] = [];
  for (let i = 0; i <= n; i++) {
    const z = -half + (2 * half * i) / n;
    const top = faceTop(-1, z);
    const k = 1 - (z / half) ** 8;
    const edge = 0.004 + 0.03 * k;
    rows.push([
      onCap(-1, z, top - 0.03, 0.001),
      onCap(-1, z, top - 0.008 * k, edge * 0.8),
      onCap(-1, z, top + 0.001 + 0.006 * k, edge),
      onCap(-1, z, top + 0.006 + 0.008 * k, edge),
      onCap(-1, z, top + 0.012, -0.035),
    ]);
  }
  bin.add('paint', gridGeometry(rows));
}

/**
 * The diffuser: a gloss black panel across the bottom of the bumper with
 * satin fins in the middle and a pair of wide tailpipes set into it on
 * each side. It fills the face down to its lowest edge and keeps inside
 * the face's own edge at every height.
 */
function addDiffuser(bin: PartBin, detail: Detail): void {
  const c = detail.fine ? 10 : detail.brakes ? 4 : 2;
  const y0 = sillY(TAIL);
  const top = 0.53;
  const half = (y: number) => faceEdge(-1, y) - 0.02;
  bin.add('trim', capPanel(-1, (y) => -half(y), half, y0, top, 0.004, c * 2, detail.fine ? 9 : 5, false));
  bin.add('metal', capPanel(-1, (y) => -half(y), half, top + 0.003, top + 0.008, 0.006, c * 2, 1, false));
  if (detail.fine) {
    for (const z of [-0.18, -0.09, 0, 0.09, 0.18]) bin.add('clad', capPanel(-1, at(z - 0.006), at(z + 0.006), y0 + 0.012, top - 0.035, 0.014, 1, 1, false));
  }
  const seg = detail.fine ? 22 : detail.brakes ? 10 : 6;
  for (const z of [0.4, 0.545]) {
    bin.add('metal', capDisc(-1, z, 0.44, 0.064, 0.009, seg, true, 0.5));
    bin.add('liner', capDisc(-1, z, 0.44, 0.052, 0.011, seg, true, 0.44));
  }
}

/** The whole tail: lights, spoiler, tailgate and diffuser, laid on the bent face. */
export function addRear(bin: PartBin, detail: Detail): void {
  addLights(bin, detail);
  addSpoiler(bin, detail);
  addTailgate(bin, detail);
  addDiffuser(bin, detail);
}
