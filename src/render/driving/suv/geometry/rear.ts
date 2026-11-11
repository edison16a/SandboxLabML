import { faceTop, onCap } from './body';
import { gridGeometry, type Vec3 } from './grid';
import type { Detail, PartBin } from './parts';
import { at, capDisc, capPanel, capSpan } from './panels';
import type { Pt } from './section';

/** Half width of the tail's light band, m: it runs almost corner to corner. */
const BAND = 0.765;

/** A point along the tail's top corner, `u` from the band's inner end at 0.48 to its outer end, `down` m under the top edge. */
function cornerEdge(u: number, down: number): Pt {
  const z = 0.48 + (BAND - 0.48) * u;
  return [z, faceTop(-1, z) - down];
}

/**
 * The lights: a gloss black band across the top of the tailgate carrying
 * a slim full width light bar, which thickens into a lamp at each corner
 * where the band follows the tail's rounded shoulder.
 */
function addLights(bin: PartBin, detail: Detail): void {
  const c = detail.fine ? 10 : detail.brakes ? 4 : 3;
  const y0 = faceTop(-1, 0.48) - 0.112;
  bin.add('trim', capPanel(-1, at(-0.48), at(0.48), y0, y0 + 0.05, 0.004, c * 2, 1, false));
  bin.add('trim', capSpan(-1, (u) => [0.48 + (BAND - 0.48) * u, y0 + 0.012 * u], (u) => cornerEdge(u, 0.062), 0.004, c, 1));
  // The bar parts in the middle for the app's own mark, lit like the bar.
  bin.add('tail', capPanel(-1, at(0.036), at(0.48), y0 + 0.02, y0 + 0.031, 0.007, c, 1));
  if (detail.brakes) addEmblem(bin, y0 + 0.025, detail.fine ? 14 : 8);
  // The corner lamp: the bar carries on and a taller lens sits above it toward the corner.
  bin.add('tail', capSpan(-1, (u) => [0.48 + (BAND - 0.02 - 0.48) * u, y0 + 0.02 + 0.006 * u], (u) => [0.48 + (BAND - 0.02 - 0.48) * u, y0 + 0.031 + 0.012 * u], 0.007, c, 1));
  bin.add('glass', capSpan(-1, (u) => [0.6 + (BAND - 0.035 - 0.6) * u, y0 + 0.046 + 0.01 * u], (u) => cornerEdge(0.43 + 0.5 * u, 0.072), 0.006, c, 1));
  bin.add('tail', capSpan(-1, (u) => [0.62 + (BAND - 0.055 - 0.62) * u, y0 + 0.052 + 0.01 * u], (u) => [0.62 + (BAND - 0.055 - 0.62) * u, y0 + 0.059 + 0.012 * u], 0.009, c, 1));
  // Slim reflectors at the bumper corners, just over the diffuser.
  bin.add('tail', capPanel(-1, at(0.64), at(0.76), 0.662, 0.673, 0.005, 2, 1));
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
    const at = (u: number, s: number): Pt => [a[0] + (b[0] - a[0]) * u + n[0] * s, a[1] + (b[1] - a[1]) * u + n[1] * s];
    bin.add('tail', capSpan(-1, (u) => at(u, -1), (u) => at(u, 1), 0.008, 2, 1, false));
  }
  atoms.forEach(([z, y], i) => bin.add('tail', capDisc(-1, z, y, i === 1 ? 0.0085 : 0.0072, 0.009, seg, false)));
}

/** A lip spoiler along the top of the tail, where the roofline ends: it kicks up and back. */
function addSpoiler(bin: PartBin, detail: Detail): void {
  const n = detail.fine ? 24 : detail.brakes ? 8 : 6;
  const rows: Vec3[][] = [];
  for (let i = 0; i <= n; i++) {
    const z = -0.66 + (1.32 * i) / n;
    const top = faceTop(-1, z);
    const rise = 1 - (z / 0.66) ** 4;
    rows.push([onCap(-1, z, top - 0.04, 0.002), onCap(-1, z, top - 0.004 + 0.008 * rise, 0.03 + 0.022 * rise), onCap(-1, z, top + 0.006 + 0.008 * rise, 0.025 + 0.022 * rise), onCap(-1, z, top + 0.004, -0.02)]);
  }
  bin.add('paint', gridGeometry(rows));
}

/**
 * The diffuser: a gloss black panel across the bottom of the bumper with
 * satin fins in the middle and a pair of oval tailpipes set into it on
 * each side.
 */
function addDiffuser(bin: PartBin, detail: Detail): void {
  const c = detail.fine ? 10 : detail.brakes ? 4 : 2;
  bin.add('trim', capPanel(-1, (y) => -(0.77 - (0.615 - y) * 0.2), (y) => 0.77 - (0.615 - y) * 0.2, 0.455, 0.615, 0.004, c * 2, 2, false));
  bin.add('metal', capPanel(-1, at(-0.72), at(0.72), 0.618, 0.623, 0.006, c * 2, 1, false));
  if (detail.fine) {
    for (const z of [-0.2, -0.1, 0, 0.1, 0.2]) bin.add('clad', capPanel(-1, at(z - 0.006), at(z + 0.006), 0.46, 0.58, 0.014, 1, 1, false));
  }
  const seg = detail.fine ? 22 : detail.brakes ? 10 : 6;
  for (const z of [0.4, 0.555]) {
    bin.add('metal', capDisc(-1, z, 0.522, 0.064, 0.009, seg, true, 0.52));
    bin.add('liner', capDisc(-1, z, 0.522, 0.052, 0.011, seg, true, 0.46));
  }
}

/** The whole tail: lights, spoiler and diffuser, laid on the warped face. */
export function addRear(bin: PartBin, detail: Detail): void {
  addLights(bin, detail);
  addSpoiler(bin, detail);
  addDiffuser(bin, detail);
}
