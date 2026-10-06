import * as THREE from 'three';
import { onCap } from './body';
import { capDecals, type Pt } from './decals';
import { bothSides } from './grid';
import type { Detail, PartBin } from './parts';

/**
 * The tail: a wide black mesh across the back, Y shaped tail lamps at the
 * upper corners, a pair of hexagonal exhausts set high in the middle and a
 * carbon diffuser under it all.
 */
export function addRear(bin: PartBin, detail: Detail): void {
  const { shape, strip } = capDecals(-1, detail.fine);
  const mesh: Pt[] = [[0, 0.355], [0.58, 0.355], [0.69, 0.46], [0.64, 0.655], [0.3, 0.685], [0, 0.69], [-0.3, 0.685], [-0.64, 0.655], [-0.69, 0.46], [-0.58, 0.355]];
  bin.add('grille', shape(mesh, 0.004));

  // Tail lamp Y: a long arm inboard under the deck lip, one up the corner, one down the flank.
  const joint: Pt = [0.672, 0.705];
  const w = 0.022;
  bin.add('tail', bothSides(strip(joint, [0.3, 0.735], w, 0.008)));
  bin.add('tail', bothSides(strip(joint, [0.738, 0.825], w, 0.008)));
  bin.add('tail', bothSides(strip(joint, [0.765, 0.545], w, 0.008)));
  bin.add('trim', bothSides(strip([0.29, 0.735], [0.74, 0.715], 0.05, 0.005)));

  for (const z of [-0.105, 0.105]) addExhaust(bin, detail, z, 0.575);
  addDiffuser(bin, detail);
}

/** A hexagonal exhaust tip standing proud of the mesh, dark inside. */
function addExhaust(bin: PartBin, detail: Detail, z: number, y: number): void {
  const r = 0.06;
  const [x] = onCap(-1, z, y, 0);
  const outer = new THREE.Shape();
  const inner = new THREE.Path();
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const o = [Math.cos(a) * r, Math.sin(a) * r];
    const n = [Math.cos(a) * (r - 0.012), Math.sin(a) * (r - 0.012)];
    if (i === 0) {
      outer.moveTo(o[0], o[1]);
      inner.moveTo(n[0], n[1]);
    } else {
      outer.lineTo(o[0], o[1]);
      inner.lineTo(n[0], n[1]);
    }
  }
  outer.holes.push(inner);
  const bevel = detail.fine ? 0.003 : 0;
  // The tip is drawn facing +Z and turned to face backward, out of the tail.
  const tip = new THREE.ExtrudeGeometry(outer, { depth: 0.09, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1 });
  tip.rotateY(-Math.PI / 2).translate(x + 0.06, y, z);
  bin.add('rim', tip);
  const soot = new THREE.CircleGeometry(r - 0.01, 6, Math.PI / 6).rotateY(-Math.PI / 2).translate(x + 0.02, y, z);
  bin.add('liner', soot);
}

/**
 * The diffuser: a ramp that climbs toward the tail, split by vertical
 * strakes. All of it is matte black, so from the chase camera it reads as
 * one deep shadow under the tail rather than a row of teeth.
 */
function addDiffuser(bin: PartBin, detail: Detail): void {
  const x0 = -1.72;
  const x1 = -2.2;
  const y0 = 0.115;
  const y1 = 0.31;
  const half = 0.7;
  // The ramp: a slab, so it reads from above as well as below.
  const ramp = new THREE.BoxGeometry(Math.hypot(x1 - x0, y1 - y0), 0.012, half * 2);
  ramp.rotateZ(-Math.atan2(y1 - y0, x0 - x1)).translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
  // Matte black, so the tunnel reads as a deep shadow between the carbon strakes.
  bin.add('trim', ramp);
  // Strakes split the flow; the outer pair doubles as side walls that close the tunnel from the side.
  const strakes = detail.fine ? [0, 0.36, half] : [0, half];
  for (const z of strakes) {
    const low = z === half ? y0 : y0 + 0.03;
    const fin = new THREE.Shape([new THREE.Vector2(x0, y0), new THREE.Vector2(x1 + 0.02, low), new THREE.Vector2(x1, y1), new THREE.Vector2(x0, y0 + 0.006)]);
    const g = new THREE.ExtrudeGeometry(fin, { depth: 0.012, bevelEnabled: false }).translate(0, 0, z - 0.006);
    bin.add('trim', z === 0 ? g : bothSides(g));
  }
}
