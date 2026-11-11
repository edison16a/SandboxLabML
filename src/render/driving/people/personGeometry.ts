import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** What a vertex is dressed in: the shader picks the color from the instance's palette by this. */
export const PART = { skin: 0, shirt: 1, pants: 2, shoes: 3, hair: 4 } as const;
/** Which limb a vertex belongs to (0 none), and whether it is below the knee or elbow. */
export const LIMB = { none: 0, leftLeg: 1, rightLeg: 2, leftArm: 3, rightArm: 4 } as const;

/** Joint heights of a 1.74 m adult at scale 1, m, and how far either side of the middle the limbs hang. */
export const JOINTS = { hip: 0.93, knee: 0.5, shoulder: 1.41, elbow: 1.12, hipZ: 0.092, shoulderZ: 0.205 };

/** Tags a part's vertices with its dress (part) and its place in a limb (limb, lower). */
function tag(g: THREE.BufferGeometry, part: number, limb: number, lower: number): THREE.BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  const n = geo.attributes.position.count;
  geo.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(part), 1));
  geo.setAttribute('aLimb', new THREE.BufferAttribute(new Float32Array(n * 2).map((_, i) => (i % 2 === 0 ? limb : lower)), 2));
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  if (geo !== g) g.dispose();
  return geo;
}

/** A tapered limb segment from y0 down to y1 at (x, z), radii r0 at the top and r1 at the bottom. */
function segment(x: number, z: number, y0: number, y1: number, r0: number, r1: number, sides: number): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(r0, r1, y0 - y1, sides, 1).translate(x, (y0 + y1) / 2, z);
}

/**
 * A person standing in the walk pose's neutral moment, facing +x: head
 * and hair, neck, a torso that narrows to the waist, hips, two arms and
 * two legs in upper and lower segments, hands and shoes. Proportions are
 * an adult's (head about an eighth of the height). Every vertex is tagged
 * so the shader can dress it and swing its limb. `fine` doubles the sides
 * round each part for the High tier.
 */
export function personGeometry(fine: boolean): THREE.BufferGeometry {
  const n = fine ? 10 : 6;
  const J = JOINTS;
  const parts: THREE.BufferGeometry[] = [
    tag(new THREE.SphereGeometry(0.1, n + 2, n).scale(0.95, 1.12, 0.88).translate(0.01, 1.625, 0), PART.skin, 0, 0),
    tag(new THREE.SphereGeometry(0.106, n + 2, n, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(0.98, 1.08, 0.92).rotateZ(0.25).translate(-0.004, 1.64, 0), PART.hair, 0, 0),
    tag(segment(0, 0, 1.54, 1.46, 0.045, 0.052, n), PART.skin, 0, 0),
    tag(new THREE.CylinderGeometry(0.205, 0.17, 0.44, n + 2, 1).scale(0.58, 1, 1).translate(0, 1.22, 0), PART.shirt, 0, 0),
    tag(new THREE.SphereGeometry(0.2, n + 2, Math.max(3, n / 2), 0, Math.PI * 2, 0, Math.PI / 2).scale(0.58, 0.32, 1.02).translate(0, 1.43, 0), PART.shirt, 0, 0),
    tag(new THREE.CylinderGeometry(0.17, 0.165, 0.16, n + 2, 1).scale(0.62, 1, 1).translate(0, 0.96, 0), PART.pants, 0, 0),
  ];
  for (const side of [1, -1]) {
    const leg = side > 0 ? LIMB.leftLeg : LIMB.rightLeg;
    const arm = side > 0 ? LIMB.leftArm : LIMB.rightArm;
    const hz = side * J.hipZ;
    const sz = side * J.shoulderZ;
    parts.push(tag(segment(0, hz, J.hip + 0.02, J.knee, 0.078, 0.058, n), PART.pants, leg, 0));
    parts.push(tag(segment(0, hz, J.knee, 0.08, 0.056, 0.042, n), PART.pants, leg, 1));
    parts.push(tag(new THREE.BoxGeometry(0.25, 0.075, 0.1).translate(0.05, 0.0375, hz), PART.shoes, leg, 1));
    parts.push(tag(segment(0, sz, J.shoulder, J.elbow, 0.048, 0.04, n), PART.shirt, arm, 0));
    parts.push(tag(segment(0, sz * 1.02, J.elbow, 0.86, 0.038, 0.032, n), PART.skin, arm, 1));
    parts.push(tag(new THREE.SphereGeometry(0.042, n, Math.max(3, n / 2)).scale(0.8, 1.25, 0.65).translate(0, 0.82, sz * 1.02), PART.skin, arm, 1));
  }
  const g = mergeGeometries(parts) as THREE.BufferGeometry;
  parts.forEach((p) => p.dispose());
  g.computeBoundingSphere();
  return g;
}
