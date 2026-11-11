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
  for (const band of [1, 2, 3, 4]) for (let k = band === 1 ? 0 : 1; k <= 6; k++) pts.push(onBody(x, band, k / 6, 0.0015));
  const rows = [pts.map(([px, py, pz]) => [px - 0.0035, py, pz] as Vec3), pts.map(([px, py, pz]) => [px + 0.0035, py, pz] as Vec3)];
  return bothSides(gridGeometry(rows));
}

/**
 * A slim wing from `root` on the door to `tip` under the mirror: an oval
 * section that narrows along its length, so the arm reads as a shaped
 * stalk rather than a stick.
 */
function stalk(root: Vec3, tip: Vec3, n: number): THREE.BufferGeometry {
  const rows: Vec3[][] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    rows.push([[root, 0.1, 0.026], [tip, 0.06, 0.016]].map(([b, chord, thick]) => {
      const [bx, by, bz] = b as Vec3;
      return [bx + (Math.cos(a) * (chord as number)) / 2, by + (Math.sin(a) * (thick as number)) / 2, bz] as Vec3;
    }));
  }
  return gridGeometry(rows);
}

/**
 * A door mirror: a wedge shaped painted housing, rounded at the front,
 * flat underneath and cut flat at the back where the glass sits, on a
 * gloss black stalk from the door just under the window graphic. Built
 * on the left and mirrored.
 */
function mirrorParts(detail: Detail): { cap: THREE.BufferGeometry; arm: THREE.BufferGeometry; glass: THREE.BufferGeometry } {
  const x = 0.74;
  const [bz, by] = beltAt(x);
  const s = detail.fine ? 22 : detail.brakes ? 8 : 6;
  const cap = new THREE.SphereGeometry(1, s, Math.max(5, Math.round(s * 0.6)));
  const p = cap.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let px = p.getX(i);
    let py = p.getY(i);
    const pz = p.getZ(i);
    // Flat back for the glass and a flat underside; the housing grows deeper toward its outer end.
    if (px < -0.2) px = -0.2;
    if (py < -0.55) py = -0.55;
    const out = pz * 0.5 + 0.5;
    p.setXYZ(i, px * (0.05 + 0.03 * out), py * (0.04 + 0.016 * out), pz * 0.112);
  }
  cap.computeVertexNormals();
  const center: Vec3 = [x - 0.03, by + 0.07, bz + 0.17];
  cap.rotateZ(-0.05).translate(...center);
  const arm = stalk([x - 0.01, by + 0.012, bz - 0.01], [center[0] + 0.005, center[1] - 0.02, center[2] - 0.07], detail.fine ? 12 : 6);
  const back = center[0] - 0.2 * 0.07 - 0.002;
  const glass = new THREE.CircleGeometry(1, s).scale(0.085, 0.034, 1).rotateY(-Math.PI / 2).translate(back, center[1] + 0.004, center[2] + 0.008);
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
  // Dark mirror glass: a chrome disc would read as a bright button from the chase camera.
  bin.add('glass', m.glass);
  for (const x of [0.99, -0.43, -0.99]) bin.add('liner', shutLine(x));
  for (const x of [0.12, -0.9]) bin.add('trim', bodyStrip(2, 0.86, 0.9, x, x + 0.17, 0.003, 4));
}
