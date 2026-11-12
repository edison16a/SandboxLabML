import { faceEdge, faceTop, onCap } from './body';
import { gridGeometry, type Vec3 } from './grid';
import type { Detail, PartBin } from './parts';
import { at, capDisc, capPanel, capSpan } from './panels';
import { sillY, TAIL } from './profile';
import type { Pt } from './section';
import { addTailgate } from './tailgate';

/** The tail's light band: its half width, and how far its two edges sit under the face's top edge, m. */
const BAND = { half: 0.755, hi: 0.072, lo: 0.13 };

/**
 * The light band's lower and upper edge at z, both measured down from
 * the face's top edge, so the band keeps its height as it follows the
 * deck across and the shoulder down into each corner. Every lamp inside
 * it is placed at a share of this height, so none can leave the band.
 */
export function tailBand(z: number): { lo: number; hi: number } {
  const top = faceTop(-1, z);
  return { lo: top - BAND.lo, hi: top - BAND.hi };
}

/** A point in the band at z, a share `v` of its height up from its lower edge. */
function inBand(z: number, v: number): Pt {
  const { lo, hi } = tailBand(z);
  return [z, lo + (hi - lo) * v];
}

/** A strip in the band from z0 to z1 between shares v0 and v1, lifted off the face. */
function bandStrip(z0: number, z1: number, v0: number, v1: number, lift: number, cols: number, mirror = true) {
  const z = (u: number) => z0 + (z1 - z0) * u;
  return capSpan(-1, (u) => inBand(z(u), v0), (u) => inBand(z(u), v1), lift, cols, 1, mirror);
}

/**
 * The lights: a gloss black band across the top of the tailgate carrying
 * a slim full width light bar, which grows into a lamp at each corner
 * where the band follows the tail's rounded shoulder down.
 */
function addLights(bin: PartBin, detail: Detail): void {
  const c = detail.fine ? 14 : detail.brakes ? 6 : 4;
  bin.add('trim', bandStrip(-BAND.half, BAND.half, 0, 1, 0.004, c * 3, false));
  // The corner lamp: a smoked lens filling most of the band toward each corner.
  bin.add('glass', bandStrip(0.5, BAND.half - 0.012, 0.12, 0.88, 0.006, c));
  // The bar parts in the middle for the app's own mark, lit like the bar, and runs out over the lens.
  bin.add('tail', bandStrip(0.036, BAND.half - 0.016, 0.36, 0.54, 0.008, c * 2));
  bin.add('tail', bandStrip(0.54, BAND.half - 0.03, 0.66, 0.76, 0.008, c));
  if (detail.brakes) addEmblem(bin, inBand(0, 0.45)[1], detail.fine ? 14 : 8);
  // Slim reflectors at the bumper corners, just over the diffuser.
  bin.add('tail', capPanel(-1, at(0.64), at(0.74), 0.662, 0.673, 0.005, 2, 1));
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
 * each side. It fills the face down to its lowest edge and keeps inside
 * the face's own edge at every height.
 */
function addDiffuser(bin: PartBin, detail: Detail): void {
  const c = detail.fine ? 10 : detail.brakes ? 4 : 2;
  const y0 = sillY(TAIL);
  const top = 0.6;
  const half = (y: number) => faceEdge(-1, y) - 0.025;
  bin.add('trim', capPanel(-1, (y) => -half(y), half, y0, top, 0.004, c * 2, detail.fine ? 9 : 5, false));
  bin.add('metal', capPanel(-1, (y) => -half(y), half, top + 0.003, top + 0.008, 0.006, c * 2, 1, false));
  if (detail.fine) {
    for (const z of [-0.2, -0.1, 0, 0.1, 0.2]) bin.add('clad', capPanel(-1, at(z - 0.006), at(z + 0.006), y0 + 0.012, top - 0.035, 0.014, 1, 1, false));
  }
  const seg = detail.fine ? 22 : detail.brakes ? 10 : 6;
  for (const z of [0.4, 0.555]) {
    bin.add('metal', capDisc(-1, z, 0.48, 0.064, 0.009, seg, true, 0.52));
    bin.add('liner', capDisc(-1, z, 0.48, 0.052, 0.011, seg, true, 0.46));
  }
}

/** The whole tail: lights, spoiler, tailgate and diffuser, laid on the warped face. */
export function addRear(bin: PartBin, detail: Detail): void {
  addLights(bin, detail);
  addSpoiler(bin, detail);
  addTailgate(bin, detail);
  addDiffuser(bin, detail);
}
