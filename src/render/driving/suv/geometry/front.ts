import { faceEdge, faceTop, onCap } from './body';
import { bothSides, gridGeometry, type Vec3 } from './grid';
import type { Detail, PartBin } from './parts';
import { at, capPanel, capSpan } from './panels';
import { NOSE, sillY } from './profile';
import { facing, recess, rounded } from './recess';
import type { Pt } from './section';

/** The headlight's span across the face, inner to outer end, m. */
const LAMP = { inner: 0.34, outer: 0.69 };

/** A point along the headlight, `u` from its inner end to its outer end, `down` m below the face's top edge. */
function lampEdge(u: number, down: number): Pt {
  const z = LAMP.inner + (LAMP.outer - LAMP.inner) * u;
  return [z, faceTop(1, z) - down];
}

/** The lamp's height at u: slim inboard, deep enough at the corner to hold the light signature. */
const depth = (u: number) => 0.058 + 0.05 * u ** 1.3;

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
