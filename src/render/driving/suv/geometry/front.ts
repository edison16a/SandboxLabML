import { faceEdge, faceTop, onCap } from './body';
import { bothSides, gridGeometry, type Vec3 } from './grid';
import type { Detail, PartBin } from './parts';
import { smooth } from './curve';
import { at, capDisc, capPanel, capSpan } from './panels';
import { NOSE, sillY } from './profile';
import { facing, recess, rounded } from './recess';
import type { Pt } from './section';

/** The headlight's span across the face, inner to outer end, and how far its lens sits under the face's top edge, m. */
const LAMP = { inner: 0.31, outer: 0.705, top: 0.011 };

/** A point on the face at z, `down` m below its top edge. */
const under = (z: number, down: number): Pt => [z, faceTop(1, z) - down];

/** z a share `u` along the lamp, `grow` m past each end. */
const lampZ = (u: number, grow = 0) => LAMP.inner - grow + (LAMP.outer - LAMP.inner + 2 * grow) * u;

/** The lens height at u: slim inboard, a little deeper at the corner to hold the light signature. */
const height = (u: number) => 0.056 + 0.024 * smooth((u - 0.3) / 0.6);

/**
 * The headlight lens at u, its lower and upper edge as (z, y). It hangs
 * a fixed distance under the face's top edge, so it rises to the fender
 * peak and follows the roll down into the corner.
 */
export function headlampLens(u: number): { lo: Pt; hi: Pt } {
  const z = lampZ(u);
  return { lo: under(z, LAMP.top + height(u)), hi: under(z, LAMP.top) };
}

/**
 * The headlights: slim units at the top corners of the face. A tight
 * gloss black bezel round a lens with a chrome reflector above and a dark
 * band below, which carries a thin light line, a projector, and the four
 * point daytime light signature at the corner.
 */
function addHeadlights(bin: PartBin, detail: Detail): void {
  const c = detail.fine ? 18 : detail.brakes ? 8 : 4;
  const edge = (u: number, down: number, grow = 0) => under(lampZ(u, grow), down);
  // Shares of the lens height from its top edge down to where chrome meets the dark band.
  const split = (u: number) => LAMP.top + height(u) * 0.52;
  bin.add('trim', capSpan(1, (u) => edge(u, LAMP.top + height(u) + 0.005, 0.006), (u) => edge(u, LAMP.top - 0.004, 0.006), 0.004, c, 1));
  bin.add('metal', capSpan(1, (u) => edge(u, split(u)), (u) => headlampLens(u).hi, 0.007, c, 1));
  bin.add('glass', capSpan(1, (u) => headlampLens(u).lo, (u) => edge(u, split(u)), 0.007, c, 1));
  const line = (u: number) => 0.03 + u * 0.6;
  bin.add('led', capSpan(1, (u) => edge(line(u), LAMP.top + height(line(u)) - 0.006), (u) => edge(line(u), LAMP.top + height(line(u)) - 0.012), 0.01, c, 1));
  if (!detail.fine && !detail.brakes) return;
  const seg = detail.fine ? 20 : 10;
  // A projector lens in the chrome.
  const [pz, py] = edge(0.42, LAMP.top + height(0.42) * 0.3);
  bin.add('glass', capDisc(1, pz, py, 0.012, 0.01, seg));
  // Four points in a square at the corner on a dark ground, the signature you recognize in a mirror.
  const [qz, qy] = edge(0.82, LAMP.top + height(0.82) * 0.5);
  bin.add('trim', capPanel(1, at(qz - 0.036), at(qz + 0.036), qy - 0.031, qy + 0.031, 0.01, 2, 2));
  for (const dz of [-0.017, 0.017]) for (const dy of [-0.015, 0.015]) bin.add('led', capDisc(1, qz + dz, qy + dy, 0.0098, 0.012, seg));
}

/** How far each intake's lip stands proud of the face, and the width of its bezel, m. */
const INTAKE = { depth: 0.038, bezel: 0.022, margin: 0.02 };

/** The center intake: low and wide, narrowing a little toward its top. Counterclockwise in (z, y). */
const CENTER: Pt[] = [[-0.3, 0.4], [0.3, 0.4], [0.25, 0.55], [-0.25, 0.55]];

/** The left side intake, taller and leaning out at the top, its outer edge kept inside the face's own edge. */
function sideIntake(): Pt[] {
  const out = (y: number) => faceEdge(1, y) - INTAKE.margin - INTAKE.bezel;
  return [[0.42, 0.4], [out(0.4), 0.4], [out(0.665), 0.665], [0.51, 0.7]];
}

/**
 * The lower face: no tall grille, just a low wide center intake and two
 * large side intakes, each set deep behind a gloss black bezel, with a
 * clean painted nose above them.
 */
function addIntakes(bin: PartBin, detail: Detail): void {
  const corner = detail.fine ? 4 : detail.brakes ? 2 : 1;
  const rings = detail.fine ? 4 : 2;
  const center = recess(1, rounded(CENTER, 0.03, corner), INTAKE.depth, INTAKE.bezel, rings);
  const side = recess(1, rounded(sideIntake(), 0.03, corner), INTAKE.depth, INTAKE.bezel, rings);
  bin.add('trim', center.bezel, bothSides(side.bezel));
  bin.add('grille', center.mesh, bothSides(side.mesh));
}

/**
 * A gloss black lip under the face, carrying the black rocker round the
 * front. It is a real blade with a top, a front and an underside, and its
 * underside sits on the face's lowest edge so nothing hangs below it.
 * It tapers back into the face at both ends.
 */
function addLip(bin: PartBin, detail: Detail): void {
  const y0 = sillY(NOSE);
  const y1 = y0 + 0.05;
  const half = faceEdge(1, y0 + 0.02) - 0.012;
  const n = detail.fine ? 24 : detail.brakes ? 10 : 6;
  const rows: Vec3[][] = [];
  for (let i = 0; i <= n; i++) {
    const z = -half + (2 * half * i) / n;
    const k = 1 - (z / half) ** 6;
    rows.push(([[y1, 0.002], [y1 - 0.012, 0.004 + 0.014 * k], [y0 + 0.006, 0.004 + 0.022 * k], [y0, 0.002 + 0.012 * k]] as const).map(([y, lift]) => onCap(1, z, y, lift)));
  }
  bin.add('trim', facing(gridGeometry(rows), [1, 0, 0]));
}

/** The whole nose: lamps on top, intakes below, all laid on the warped face. */
export function addFront(bin: PartBin, detail: Detail): void {
  addHeadlights(bin, detail);
  addIntakes(bin, detail);
  addLip(bin, detail);
}
