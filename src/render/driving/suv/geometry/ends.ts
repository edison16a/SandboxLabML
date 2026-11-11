import * as THREE from 'three';
import { onCap } from './body';
import { gridGeometry, type Vec3 } from './grid';
import type { Detail, PartBin } from './parts';
import { at, capBlade, capPanel } from './panels';

/**
 * The nose: slim LED light units at the corners joined by a full width
 * light bar under the hood edge, a large grille whose three body colored
 * blades stand proud of a dark mesh, vertical air curtains at the corners
 * framed in gloss black, and a gloss black lip. All laid on the warped nose
 * face.
 */
export function addFront(bin: PartBin, detail: Detail): void {
  const c = detail.fine ? 8 : 4;
  // The light bar across the whole front, the signature you see first in a mirror.
  bin.add('led', capPanel(1, at(-0.46), at(0.46), 0.902, 0.916, 0.007, c * 2, 1, false));
  // Headlight housings: a gloss black frame, a smoked lens, an LED brow along the top and four projector cells.
  bin.add('trim', capPanel(1, at(0.418), (y) => 0.735 - (y - 0.79) * 0.25, 0.79, 0.93, 0.004, c, 2));
  bin.add('glass', capPanel(1, at(0.43), (y) => 0.72 - (y - 0.8) * 0.25, 0.8, 0.922, 0.006, c, 2));
  bin.add('led', capPanel(1, at(0.45), at(0.69), 0.897, 0.909, 0.009, c, 1));
  for (let k = 0; k < 4; k++) {
    const z = 0.465 + k * 0.058;
    bin.add('led', capPanel(1, at(z), at(z + 0.036), 0.834, 0.864, 0.009, 1, 1));
  }
  // The grille: wide at the foot, a gloss surround standing just proud of the mesh, three blades across it.
  const grilleHalf = (inset: number) => (y: number) => 0.5 - inset - (y - 0.44) * 0.12;
  bin.add('trim', capPanel(1, (y) => -grilleHalf(0)(y), grilleHalf(0), 0.44, 0.755, 0.003, c * 2, 3, false));
  bin.add('grille', capPanel(1, (y) => -grilleHalf(0.024)(y), grilleHalf(0.024), 0.462, 0.733, 0.006, c * 2, 3, false));
  for (const y of [0.522, 0.6, 0.678]) bin.add('paint', capBlade(1, grilleHalf(0.03), y, y + 0.03, 0.022, c * 2));
  // Air curtains: tall slots at the corners that feed air round the front wheels.
  bin.add('trim', capPanel(1, at(0.585), at(0.705), 0.45, 0.74, 0.003, c, 2));
  bin.add('liner', capPanel(1, at(0.602), at(0.688), 0.468, 0.722, 0.006, c, 2));
  bin.add('paint', capPanel(1, at(0.64), at(0.651), 0.468, 0.722, 0.012, 1, 2));
  // The lip under everything, with a bright blade in it.
  bin.add('trim', capPanel(1, at(-0.66), at(0.66), 0.392, 0.428, 0.004, c * 2, 1, false));
  bin.add('metal', capPanel(1, at(-0.4), at(0.4), 0.405, 0.412, 0.007, c * 2, 1, false));
}

/**
 * The tail: a full width light bar, wraparound lamps at the corners in a
 * smoked housing, a gloss black finned diffuser and four exhaust tips.
 */
export function addRear(bin: PartBin, detail: Detail): void {
  const c = detail.fine ? 8 : 4;
  bin.add('glass', capPanel(-1, at(0.5), at(0.79), 0.97, 1.105, 0.004, c, 2));
  bin.add('tail', capPanel(-1, at(-0.62), at(0.62), 1.052, 1.076, 0.007, c * 2, 1, false));
  bin.add('tail', capPanel(-1, at(0.54), at(0.77), 1.03, 1.08, 0.008, c, 1));
  bin.add('tail', capPanel(-1, at(0.56), at(0.75), 0.99, 1.005, 0.008, c, 1));
  bin.add('tail', capPanel(-1, at(0.64), at(0.76), 0.63, 0.65, 0.005, 2, 1));
  // A gloss black diffuser with satin fins, under a bright strip.
  bin.add('trim', capPanel(-1, at(-0.72), at(0.72), 0.43, 0.565, 0.004, c * 2, 2, false));
  bin.add('metal', capPanel(-1, at(-0.62), at(0.62), 0.57, 0.577, 0.006, c * 2, 1, false));
  for (const z of [-0.18, -0.06, 0.06, 0.18]) {
    const p = onCap(-1, z, 0.47, 0.012);
    bin.add('clad', new THREE.BoxGeometry(0.026, 0.07, 0.01).translate(p[0], p[1], p[2]));
  }
  // A ducktail lip along the top of the tail, the coupe's sign off.
  const lip: Vec3[][] = [];
  for (let i = 0; i <= c * 2; i++) {
    const z = -0.66 + (1.32 * i) / (c * 2);
    const rise = 1 - (z / 0.66) ** 4;
    lip.push([onCap(-1, z, 1.112, 0.002), onCap(-1, z, 1.128 + 0.008 * rise, 0.035 + 0.025 * rise), onCap(-1, z, 1.138 + 0.008 * rise, 0.03 + 0.025 * rise), onCap(-1, z, 1.14, 0.002)]);
  }
  bin.add('paint', gridGeometry(lip));
  const tip = new THREE.CylinderGeometry(0.042, 0.046, 0.09, detail.fine ? 20 : 10, 1, true).rotateZ(Math.PI / 2);
  const bore = new THREE.CircleGeometry(0.036, detail.fine ? 20 : 10).rotateY(-Math.PI / 2);
  for (const z of [0.36, 0.47, -0.36, -0.47]) {
    const p = onCap(-1, z, 0.49, -0.01);
    bin.add('metal', tip.clone().translate(p[0], p[1], p[2]));
    bin.add('liner', bore.clone().translate(p[0] - 0.03, p[1], p[2]));
  }
  tip.dispose();
  bore.dispose();
}
