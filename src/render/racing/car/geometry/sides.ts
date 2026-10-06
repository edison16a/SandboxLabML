import * as THREE from 'three';
import { onBody } from './body';
import { SCOOP } from './bodyProfile';
import { CANOPY, onCanopy } from './canopy';
import { bandPatch, creaseStripe } from './decals';
import { bothSides, gridGeometry, merge, type Vec3 } from './grid';
import type { Detail, PartBin } from './parts';

/**
 * Details along the flanks and over the top: the big side intakes, gold
 * pinstripes on the hood edges and skirts, mirrors on stalks and louvers
 * across the engine cover.
 */
export function addSides(bin: PartBin, detail: Detail): void {
  const rows = detail.fine ? 14 : 4;
  // The intake fills the scoop behind the door; its leading edge leans back like the crease above it.
  // The crowd car's coarse body can bulge past the true surface, so its decals stand further off.
  const lift = detail.fine ? 0.003 : 0.012;
  const intake = bandPatch(2, SCOOP.from + 0.06, SCOOP.to - 0.04, () => 0.1, () => 0.93, rows, detail.fine ? 6 : 2, lift, -0.12);
  bin.add('grille', bothSides(intake));
  // A carbon blade along the intake's leading edge, standing a little proud of the paint.
  if (detail.fine) bin.add('carbon', bothSides(edgeBlade(SCOOP.to - 0.04, detail)));

  // The door's leading shut line, a hairline from the skirt up to the shoulder.
  if (detail.fine) for (const band of [1, 2, 3]) bin.add('liner', bothSides(bandPatch(band, 0.9, 0.904, () => 0, () => 1, 1, 6, 0.0015, band === 3 ? -0.05 : 0)));

  const stripe = detail.fine ? 0.011 : 0.016;
  bin.add('gold', bothSides(creaseStripe(4, 'top', 0.98, 2.2, stripe, detail.fine ? 40 : 10)));
  bin.add('gold', bothSides(creaseStripe(1, 'bottom', -0.86, 0.94, stripe, detail.fine ? 24 : 6)));

  if (detail.fine) addMirrors(bin);
  addLouvers(bin, detail);
}

/** A thin blade standing off the side along the front edge of the intake. */
function edgeBlade(x: number, detail: Detail): THREE.BufferGeometry {
  const n = detail.fine ? 6 : 2;
  const rows: Vec3[][] = [];
  for (let j = 0; j <= n; j++) {
    const t = 0.1 + (0.83 * j) / n;
    const lean = -0.12 * (j / n);
    rows.push([onBody(x + lean + 0.03, 2, t, 0.002), onBody(x + lean, 2, t, 0.03)]);
  }
  // Both faces, since the blade is seen from ahead and behind.
  return merge([gridGeometry(rows), gridGeometry(rows.map((r) => r.slice().reverse()))]);
}

/**
 * Mirrors: a teardrop pod, body colored, on a short carbon stalk from the
 * top of the door. The pod is a lathe around its own long axis, squashed to
 * an oval, with the glass on its blunt rear.
 */
function addMirrors(bin: PartBin): void {
  const foot = new THREE.Vector3(...onBody(0.8, 4, 0.12, -0.01));
  const at = new THREE.Vector3(0.76, foot.y + 0.08, foot.z + 0.1);
  const profile = [[0.026, -0.07], [0.034, -0.05], [0.036, -0.02], [0.031, 0.02], [0.018, 0.055], [0.001, 0.08]].map(([r, a]) => new THREE.Vector2(r, a));
  // The lathe spins around Y; turning it makes the pod's nose point forward along X.
  const pod = new THREE.LatheGeometry(profile, 14).rotateZ(-Math.PI / 2).scale(1, 0.78, 1.3).translate(at.x, at.y, at.z);
  bin.add('paint', bothSides(pod));
  const glass = new THREE.CircleGeometry(0.025, 14).rotateY(-Math.PI / 2).scale(1, 0.78, 1.3).translate(at.x - 0.0705, at.y, at.z);
  bin.add('metal', bothSides(glass));
  bin.add('carbon', bothSides(beam(foot, at.clone().add(new THREE.Vector3(0.005, -0.015, -0.02)), 0.04, 0.012)));
}

/** A thin flat bar from `a` to `b`, `w` wide and `h` thick. */
function beam(a: THREE.Vector3, b: THREE.Vector3, w: number, h: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, a.distanceTo(b)).translate(0, 0, a.distanceTo(b) / 2);
  // lookAt aims the matrix z axis from the target back to the eye, so the eye goes where the bar should point.
  g.applyMatrix4(new THREE.Matrix4().lookAt(b.clone().sub(a), new THREE.Vector3(), new THREE.Vector3(0, 1, 0)).setPosition(a));
  return g;
}

/** Dark slots across the carbon engine cover, letting the heat out. */
function addLouvers(bin: PartBin, detail: Detail): void {
  const count = detail.fine ? 7 : 4;
  for (let i = 0; i < count; i++) {
    const x0 = CANOPY.roofRear - 0.2 - i * 0.13;
    const rows: Vec3[][] = [];
    for (let j = 0; j <= 1; j++) {
      const x = x0 - j * 0.05;
      rows.push(Array.from({ length: 5 }, (_, k) => onCanopy(x, 1, 0.12 + (0.84 * k) / 4, 0.003)));
    }
    bin.add('grille', bothSides(gridGeometry(rows.reverse())));
  }
}
