import * as THREE from 'three';
import { onBody } from './body';
import { bothSides, gridGeometry, type Vec3 } from './grid';
import { mirrorParts } from './mirror';
import { lightest, type Detail, type PartBin } from './parts';
import { ARCH, AXLES } from './profile';

/** A thin strip along the body at a band from x0 to x1; `across` lists its points as (share of the band, lift off it). */
function bodyStrip(band: number, across: Array<[number, number]>, x0: number, x1: number, steps: number): THREE.BufferGeometry {
  const rows: Vec3[][] = [];
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    rows.push(across.map(([t, lift]) => onBody(x, band, t, lift)));
  }
  return bothSides(gridGeometry(rows));
}

/** A shut line: a dark hairline down the side at x, from the rocker up to the belt. */
function shutLine(x: number): THREE.BufferGeometry {
  const pts: Vec3[] = [];
  for (const band of [1, 2, 3, 4]) for (let k = band === 1 ? 0 : 1; k <= 6; k++) pts.push(onBody(x, band, k / 6, 0.0015));
  const rows = [pts.map(([px, py, pz]) => [px - 0.0035, py, pz] as Vec3), pts.map(([px, py, pz]) => [px + 0.0035, py, pz] as Vec3)];
  return bothSides(gridGeometry(rows));
}

/**
 * The bright strip along the top of the sill cladding, between the arch
 * flares: across it, (share of the cladding band, lift off it), a slim
 * rounded bead that catches the sky along its top. It makes the black
 * base read as trim on the body rather than as shadow under it.
 */
const ACCENT: Array<[number, number]> = [[0.885, 0.0008], [0.91, 0.0026], [0.94, 0.0034], [0.965, 0.0026], [0.98, 0.0008]];
const ACCENT_FAR: Array<[number, number]> = [[0.885, 0.0015], [0.98, 0.0015]];
/** Where the strip runs, m: from the rear flare's front edge to the front flare's back edge. */
const ACCENT_RUN = { rear: AXLES[1] + ARCH.radius + 0.05, front: AXLES[0] - ARCH.radius - 0.05 };

/**
 * Side detail: the cladding's bright strip, door shut lines, flush
 * handles on the shoulder and the mirrors. The fine pieces only go on
 * the followed SUV.
 */
export function addSides(bin: PartBin, detail: Detail): void {
  if (!lightest(detail)) bin.add('metal', bodyStrip(0, detail.fine ? ACCENT : ACCENT_FAR, ACCENT_RUN.rear, ACCENT_RUN.front, detail.fine ? 24 : 4));
  const m = mirrorParts(detail);
  bin.add('paint', m.cap);
  bin.add('trim', m.arm);
  if (!detail.fine) {
    m.glass.dispose();
    return;
  }
  // Dark mirror glass: chrome would read as a bright button from the chase camera.
  bin.add('glass', m.glass);
  for (const x of [0.99, -0.43, -0.99]) bin.add('liner', shutLine(x));
  for (const x of [0.12, -0.9]) bin.add('trim', bodyStrip(2, [[0.86, 0.003], [0.9, 0.003]], x, x + 0.17, 4));
}
