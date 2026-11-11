import * as THREE from 'three';
import { onBody } from './body';
import { bothSides, gridGeometry, type Vec3 } from './grid';
import type { Detail, PartBin } from './parts';
import { beltAt } from './profile';

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
  for (const band of [1, 2, 3]) for (let k = band === 1 ? 0 : 1; k <= 6; k++) pts.push(onBody(x, band, k / 6, 0.0015));
  const rows = [pts.map(([px, py, pz]) => [px - 0.0035, py, pz] as Vec3), pts.map(([px, py, pz]) => [px + 0.0035, py, pz] as Vec3)];
  return bothSides(gridGeometry(rows));
}

/**
 * A door mirror: a wedge shaped painted housing, rounded at the front and
 * cut flat at the back where the glass sits, on a slim gloss black arm
 * from the door just under the window graphic. Built on the left and
 * mirrored.
 */
function mirrorParts(detail: Detail): { cap: THREE.BufferGeometry; arm: THREE.BufferGeometry; glass: THREE.BufferGeometry } {
  const x = 0.8;
  const [bz, by] = beltAt(x);
  const s = detail.fine ? 20 : detail.brakes ? 8 : 6;
  const cap = new THREE.SphereGeometry(1, s, Math.max(5, Math.round(s * 0.6)));
  const p = cap.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let px = p.getX(i);
    const py = p.getY(i);
    const pz = p.getZ(i);
    // Flat back for the glass, a crisp lower edge, and a housing that narrows toward the car.
    if (px < -0.25) px = -0.25;
    const out = pz * 0.5 + 0.5;
    const taper = 0.6 + 0.4 * out;
    p.setXYZ(i, px * (0.055 + 0.03 * out), (py < 0 ? py * 0.7 : py) * 0.052 * taper, pz * 0.115);
  }
  cap.computeVertexNormals();
  const center: Vec3 = [x - 0.04, by + 0.085, bz + 0.17];
  cap.rotateZ(-0.05).translate(...center);
  const arm = new THREE.BoxGeometry(0.07, 0.018, 0.1).rotateX(-0.3).translate(x - 0.02, by + 0.045, bz + 0.06);
  const back = center[0] - 0.25 * 0.07 - 0.002;
  const glass = new THREE.CircleGeometry(1, s).scale(0.09, 0.04, 1).rotateY(-Math.PI / 2).translate(back, center[1], center[2] + 0.005);
  return { cap: bothSides(cap), arm: bothSides(arm), glass: bothSides(glass) };
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
  bin.add('metal', m.glass);
  for (const x of [1.0, -0.235, -0.955]) bin.add('liner', shutLine(x));
  for (const x of [0.2, -0.68]) bin.add('trim', bodyStrip(3, 0.2, 0.3, x, x + 0.18, 0.003, 4));
}
