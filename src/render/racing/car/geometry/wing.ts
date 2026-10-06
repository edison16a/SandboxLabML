import * as THREE from 'three';
import { bodyTopY } from './canopy';
import { bothSides } from './grid';
import type { Detail, PartBin } from './parts';

const SPAN = 0.74;
const CHORD = 0.27;
const LEAD = -1.96;
const HEIGHT = 1.08;
/** Angle of attack, trailing edge up, in radians. */
const PITCH = 0.12;

/**
 * An inverted airfoil: a flat top and a cambered underside, which is what a
 * downforce wing looks like from the side. Drawn leading edge at x = 0.
 */
function airfoil(detail: Detail): THREE.Shape {
  const n = detail.fine ? 12 : 5;
  const top: THREE.Vector2[] = [];
  const bottom: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = -t * CHORD;
    const thick = 0.042 * Math.sqrt(t) * (1 - t) * 2.2;
    top.push(new THREE.Vector2(x, 0.006 * (1 - t)));
    bottom.push(new THREE.Vector2(x, -thick - 0.01 * Math.sin(Math.PI * t)));
  }
  return new THREE.Shape([...top, ...bottom.reverse().slice(0, -1)]);
}

/**
 * The rear wing: a carbon main plane on two swan neck pylons that rise from
 * the engine deck, with endplates at the tips. The pylons hold the wing from
 * above, as modern hypercars do, which keeps the underside clean.
 */
export function addWing(bin: PartBin, detail: Detail): void {
  const bevel = detail.fine ? 0.004 : 0;
  const plane = new THREE.ExtrudeGeometry(airfoil(detail), { depth: SPAN * 2, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1 });
  plane.translate(0, 0, -SPAN);
  plane.rotateZ(-PITCH).translate(LEAD, HEIGHT, 0);
  bin.add('carbon', plane);

  const plate = new THREE.Shape([
    new THREE.Vector2(LEAD + 0.02, HEIGHT - 0.055),
    new THREE.Vector2(LEAD - CHORD - 0.02, HEIGHT - 0.02),
    new THREE.Vector2(LEAD - CHORD - 0.025, HEIGHT + 0.07),
    new THREE.Vector2(LEAD - 0.04, HEIGHT + 0.025),
  ]);
  bin.add('carbon', bothSides(new THREE.ExtrudeGeometry(plate, { depth: 0.012, bevelEnabled: false }).translate(0, 0, SPAN)));

  // Swan neck: up from the deck, over the top of the wing and down onto it.
  const z = 0.36;
  const foot = bodyTopY(-1.86, z) - 0.02;
  const neck = new THREE.Shape([
    new THREE.Vector2(-1.82, foot),
    new THREE.Vector2(-1.93, foot),
    new THREE.Vector2(-2.04, HEIGHT + 0.015),
    new THREE.Vector2(-2.1, HEIGHT + 0.05),
    new THREE.Vector2(-2.15, HEIGHT + 0.005),
    new THREE.Vector2(-2.1, HEIGHT + 0.005),
    new THREE.Vector2(-2.08, HEIGHT + 0.022),
    new THREE.Vector2(-2.03, HEIGHT - 0.01),
  ]);
  const pylon = new THREE.ExtrudeGeometry(neck, { depth: 0.016, bevelEnabled: bevel > 0, bevelSize: bevel / 2, bevelThickness: bevel / 2, bevelSegments: 1 });
  bin.add('carbon', bothSides(pylon.translate(0, 0, z - 0.008)));
}
