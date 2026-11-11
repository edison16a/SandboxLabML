import * as THREE from 'three';
import { onBody } from './body';
import { bothSides, gridGeometry, type Vec3 } from './grid';
import type { Detail, PartBin } from './parts';
import { beltAt } from './profile';

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
 * A door mirror: a wedge shaped painted housing, rounded at the front and
 * cut flat at the back where the glass sits, tapering in toward a slim
 * gloss black stalk on the door. Built on the left and mirrored.
 */
function mirrorParts(detail: Detail): { cap: THREE.BufferGeometry; arm: THREE.BufferGeometry; glass: THREE.BufferGeometry } {
  const x = 0.84;
  const [bz, by] = beltAt(x);
  const s = detail.fine ? 18 : 8;
  const cap = new THREE.SphereGeometry(1, s, Math.max(5, Math.round(s * 0.6)));
  const p = cap.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let px = p.getX(i);
    const py = p.getY(i);
    const pz = p.getZ(i);
    // Flat back for the glass, a sharp lower edge, and a housing that narrows toward the car into a wedge.
    if (px < -0.3) px = -0.3;
    const out = pz * 0.5 + 0.5;
    const taper = 0.55 + 0.45 * out;
    p.setXYZ(i, px * (0.06 + 0.035 * out), (py < 0 ? py * 0.6 : py) * 0.06 * taper, pz * 0.13);
  }
  cap.computeVertexNormals();
  const center: Vec3 = [x - 0.05, by + 0.105, bz + 0.2];
  cap.rotateZ(-0.06).translate(...center);
  const arm = new THREE.BoxGeometry(0.075, 0.022, 0.13).rotateX(-0.35).translate(x - 0.02, by + 0.05, bz + 0.075);
  const back = center[0] - 0.3 * 0.085 - 0.002;
  const glass = new THREE.CircleGeometry(1, s).scale(0.1, 0.048, 1).rotateY(-Math.PI / 2).translate(back, center[1], center[2] + 0.005);
  return { cap: bothSides(cap), arm: bothSides(arm), glass: bothSides(glass) };
}

/**
 * Side detail: gloss black window trim along the belt, door shut lines,
 * flush handles, a bright insert along the sill cladding and the mirrors.
 * The fine pieces only go on the followed SUV.
 */
export function addSides(bin: PartBin, detail: Detail): void {
  const steps = detail.fine ? 40 : 12;
  // A gloss black blade along the lower doors between the arches, topped with a bright insert: it lightens the tall body side.
  bin.add('trim', bodyStrip(1, 0, 0.26, -0.93, 1.0, 0.003, steps));
  bin.add('metal', bodyStrip(1, 0.26, 0.3, -0.93, 1.0, 0.004, steps));
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
