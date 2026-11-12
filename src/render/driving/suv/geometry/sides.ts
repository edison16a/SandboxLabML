import * as THREE from 'three';
import { onBody } from './body';
import { bothSides, gridGeometry, type Vec3 } from './grid';
import { mirrorParts } from './mirror';
import type { Detail, PartBin } from './parts';

/** A thin strip along the body at a band, between shares t0 and t1, from x0 to x1. */
function bodyStrip(band: number, t0: number, t1: number, x0: number, x1: number, lift: number, steps: number): THREE.BufferGeometry {
  const rows: Vec3[][] = [];
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    rows.push([onBody(x, band, t0, lift), onBody(x, band, t1, lift)]);
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
 * Side detail: door shut lines, flush handles on the shoulder and the
 * mirrors. The fine pieces only go on the followed SUV.
 */
export function addSides(bin: PartBin, detail: Detail): void {
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
  for (const x of [0.12, -0.9]) bin.add('trim', bodyStrip(2, 0.86, 0.9, x, x + 0.17, 0.003, 4));
}
