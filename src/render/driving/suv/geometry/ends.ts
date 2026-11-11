import * as THREE from 'three';
import { onCap } from './body';
import type { Detail, PartBin } from './parts';
import { at, capPanel } from './panels';

/**
 * The nose: slim LED light units at the corners joined by a full width
 * light bar under the hood edge, a large dark grille with a gloss surround,
 * corner intakes and a dark lower lip. All laid on the warped nose face.
 */
export function addFront(bin: PartBin, detail: Detail): void {
  const c = detail.fine ? 8 : 4;
  // The light bar across the whole front, the signature you see first in a mirror.
  bin.add('led', capPanel(1, at(-0.46), at(0.46), 0.884, 0.9, 0.007, c * 2, 1, false));
  // Headlight housings, a smoked lens, an LED brow along the top and four projector cells.
  bin.add('glass', capPanel(1, at(0.43), (y) => 0.72 - (y - 0.78) * 0.25, 0.785, 0.905, 0.005, c, 2));
  bin.add('led', capPanel(1, at(0.45), at(0.69), 0.88, 0.892, 0.009, c, 1));
  for (let k = 0; k < 4; k++) {
    const z = 0.465 + k * 0.058;
    bin.add('led', capPanel(1, at(z), at(z + 0.036), 0.818, 0.848, 0.009, 1, 1));
  }
  // The grille: wider at the foot, with a gloss surround standing just proud of it.
  bin.add('trim', capPanel(1, (y) => -(0.54 - (y - 0.4) * 0.12), (y) => 0.54 - (y - 0.4) * 0.12, 0.385, 0.755, 0.003, c * 2, 3, false));
  bin.add('grille', capPanel(1, (y) => -(0.515 - (y - 0.4) * 0.12), (y) => 0.515 - (y - 0.4) * 0.12, 0.405, 0.735, 0.006, c * 2, 3, false));
  // Corner intakes and the dark lip under everything.
  bin.add('clad', capPanel(1, at(0.575), at(0.73), 0.41, 0.66, 0.003, c, 2));
  bin.add('grille', capPanel(1, at(0.595), at(0.71), 0.43, 0.64, 0.006, c, 2));
  bin.add('clad', capPanel(1, at(-0.68), at(0.68), 0.345, 0.39, 0.004, c * 2, 1, false));
}

/**
 * The tail: a full width light bar, wraparound lamps at the corners in a
 * smoked housing, a dark diffuser and four exhaust tips.
 */
export function addRear(bin: PartBin, detail: Detail): void {
  const c = detail.fine ? 8 : 4;
  bin.add('glass', capPanel(-1, at(0.5), at(0.79), 0.94, 1.075, 0.004, c, 2));
  bin.add('tail', capPanel(-1, at(-0.62), at(0.62), 1.022, 1.046, 0.007, c * 2, 1, false));
  bin.add('tail', capPanel(-1, at(0.54), at(0.77), 1.0, 1.05, 0.008, c, 1));
  bin.add('tail', capPanel(-1, at(0.56), at(0.75), 0.96, 0.975, 0.008, c, 1));
  bin.add('tail', capPanel(-1, at(0.64), at(0.76), 0.6, 0.62, 0.005, 2, 1));
  bin.add('clad', capPanel(-1, at(-0.72), at(0.72), 0.405, 0.56, 0.004, c * 2, 2, false));
  const tip = new THREE.CylinderGeometry(0.042, 0.046, 0.09, detail.fine ? 20 : 10, 1, true).rotateZ(Math.PI / 2);
  const bore = new THREE.CircleGeometry(0.036, detail.fine ? 20 : 10).rotateY(-Math.PI / 2);
  for (const z of [0.36, 0.47, -0.36, -0.47]) {
    const p = onCap(-1, z, 0.475, -0.01);
    bin.add('metal', tip.clone().translate(p[0], p[1], p[2]));
    bin.add('liner', bore.clone().translate(p[0] - 0.03, p[1], p[2]));
  }
  tip.dispose();
  bore.dispose();
}
