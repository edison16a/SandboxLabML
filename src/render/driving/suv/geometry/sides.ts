import * as THREE from 'three';
import { onBody } from './body';
import { CABIN, onCabin } from './cabin';
import { bothSides, gridGeometry, type Vec3 } from './grid';
import type { Detail, PartBin } from './parts';
import { beltAt } from './profile';
import { warp } from './warp';

/** A thin strip along the body at a band and share, from x0 to x1, `width` tall in band share. */
function bodyStrip(band: number, t0: number, t1: number, x0: number, x1: number, lift: number, steps: number): THREE.BufferGeometry {
  const rows: Vec3[][] = [];
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    rows.push([onBody(x, band, t0, lift), onBody(x, band, t1, lift)]);
  }
  return bothSides(gridGeometry(rows));
}

/** A shut line: a dark hairline down the side at x, from the cladding up to the belt. */
function shutLine(x: number): THREE.BufferGeometry {
  const pts: Vec3[] = [];
  for (const band of [1, 2, 3]) for (let k = 0; k <= 4; k++) pts.push(onBody(x, band, k / 4, 0.0015));
  const rows = [pts.map(([px, py, pz]) => [px - 0.004, py, pz] as Vec3), pts.map(([px, py, pz]) => [px + 0.004, py, pz] as Vec3)];
  return bothSides(gridGeometry(rows));
}

/**
 * A door mirror on its arm at the base of the A pillar: a painted cap, a
 * dark arm and the glass. Built on the left and mirrored.
 */
function mirrorParts(detail: Detail): { cap: THREE.BufferGeometry; arm: THREE.BufferGeometry; glass: THREE.BufferGeometry } {
  const x = 0.86;
  const [bz, by] = beltAt(x);
  const base = warp([x, by + 0.03, bz + 0.02]);
  const s = detail.fine ? 12 : 6;
  const cap = new THREE.SphereGeometry(1, s, Math.max(4, s / 2)).scale(0.11, 0.075, 0.13).translate(base[0] - 0.02, base[1] + 0.07, base[2] + 0.17);
  const arm = new THREE.BoxGeometry(0.1, 0.035, 0.12).translate(base[0], base[1] + 0.035, base[2] + 0.06);
  const glass = new THREE.CircleGeometry(1, s).scale(0.055, 0.06, 1).rotateY(-Math.PI / 2).translate(base[0] - 0.105, base[1] + 0.07, base[2] + 0.17);
  return { cap: bothSides(cap), arm: bothSides(arm), glass: bothSides(glass) };
}

/**
 * Side detail: gloss black window trim along the belt, door shut lines,
 * flush handles, a bright insert along the sill cladding and the mirrors.
 * The fine pieces only go on the followed SUV.
 */
export function addSides(bin: PartBin, detail: Detail): void {
  const steps = detail.fine ? 40 : 12;
  // The window line: a gloss black strip where the glass meets the paint.
  const rows: Vec3[][] = [];
  for (let i = 0; i <= steps; i++) {
    const x = CABIN.glassRear + ((CABIN.front - 0.04 - CABIN.glassRear) * i) / steps;
    rows.push([onCabin(x, 0, 0, 0.004), onCabin(x, 0, 0.035, 0.004)]);
  }
  bin.add('trim', bothSides(gridGeometry(rows)));
  bin.add('metal', bodyStrip(0, 0.52, 0.6, -0.9, 0.98, 0.006, steps));
  if (!detail.fine) {
    const m = mirrorParts(detail);
    bin.add('paint', m.cap);
    bin.add('trim', m.arm);
    m.glass.dispose();
    return;
  }
  for (const x of [0.96, -0.18, -0.88]) bin.add('liner', shutLine(x));
  for (const x of [0.12, -0.86]) bin.add('trim', bodyStrip(3, 0.38, 0.5, x, x + 0.2, 0.004, 3));
  const m = mirrorParts(detail);
  bin.add('paint', m.cap);
  bin.add('trim', m.arm);
  bin.add('metal', m.glass);
}
