import * as THREE from 'three';
import { BONE } from './bones';
import { ellipsoid, limb, mergeParts, rigid, segments, type MeshDetail } from './parts';
import { RIG } from './proportions';

/**
 * Side profile of the torso from its round bottom to the neck, (radius,
 * height over the hips) pairs: a soft bean, widest at the belly, tucking
 * in under the head. Smoothed by a spline and spun round the y axis.
 */
const PROFILE: Array<[number, number]> = [
  [0, RIG.bodyBottom],
  [0.1, -0.122],
  [0.168, -0.08],
  [0.203, 0.0],
  [0.214, 0.1],
  [0.205, 0.2],
  [0.18, 0.3],
  [0.142, 0.38],
  [0.105, 0.45],
  [0.06, 0.49],
  [0, RIG.bodyTop],
];

/** Shade of the feet against the body: a touch darker, like soft shoes. */
const FOOT_SHADE = 0.8;

export function torsoGeometry(detail: MeshDetail): THREE.BufferGeometry {
  const curve = new THREE.SplineCurve(PROFILE.map(([r, y]) => new THREE.Vector2(r, y)));
  const points = curve.getPoints(segments(detail, 26, 14, 7));
  // The spline can overshoot past the axis at the ends; pin both poles back onto it.
  points[0].x = 0;
  points[points.length - 1].x = 0;
  const g = new THREE.LatheGeometry(points, segments(detail, 30, 14, 7));
  g.computeVertexNormals();
  return g;
}

export function headGeometry(detail: MeshDetail): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(RIG.headRadius, segments(detail, 40, 18, 10), segments(detail, 28, 12, 7));
  g.scale(...RIG.headScale);
  return g;
}

/** A foot in its bone's frame (at the ankle, toes along +x): a soft rounded shoe with a flat sole on the ground. */
export function footGeometry(detail: MeshDetail): THREE.BufferGeometry {
  const f = RIG.foot;
  const g = ellipsoid(f.hx, f.hy, f.hz, f.ahead, -RIG.ankleY + f.hy, 0, detail, 18);
  const pos = g.attributes.position;
  // Flatten the bottom into a sole, so a planted foot meets the floor along its length.
  for (let i = 0; i < pos.count; i++) pos.setY(i, Math.max(pos.getY(i), -RIG.ankleY + 0.004));
  g.computeVertexNormals();
  return g;
}

/** A mitten of a hand in its bone's frame (at the wrist, pointing down -y), with a thumb on the forward side. */
export function handGeometry(detail: MeshDetail): THREE.BufferGeometry[] {
  const r = RIG.handRadius;
  return [ellipsoid(r, r * 1.12, r * 0.86, 0, -r * 0.8, 0, detail, 16), ellipsoid(0.026, 0.03, 0.024, r * 0.82, -r * 0.45, 0, detail, 10)];
}

/** An eyelid in its bone's frame (the eye's center): a thin shell over the upper or lower half of the eyeball. */
export function lidGeometry(upper: boolean, detail: MeshDetail): THREE.BufferGeometry {
  return new THREE.SphereGeometry(RIG.eye.radius + 0.0045, segments(detail, 24, 12), segments(detail, 8, 4), 0, Math.PI * 2, upper ? 0 : Math.PI / 2, Math.PI / 2);
}

/**
 * Every part in the team color as one skinned mesh: torso, head, eyelids,
 * arms, hands, legs and feet. Lids are skin, so a blink reads as the head
 * itself closing over the eye.
 */
export function bodyGeometry(detail: MeshDetail): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [rigid(torsoGeometry(detail), BONE.torso, 1), rigid(headGeometry(detail), BONE.head, 1)];
  for (let side = 0; side < 2; side++) {
    if (detail === 'instanced') {
      // The crowd stands at rest, so each limb is one straight piece: a third of the triangles, the same silhouette from afar.
      parts.push(rigid(limb(RIG.upperArm + RIG.forearm, RIG.upperArmRadius, detail), BONE.upperArm[side], 1));
      parts.push(rigid(handGeometry(detail)[0], BONE.hand[side], 1));
      parts.push(rigid(limb(RIG.thigh + RIG.shin, RIG.thighRadius, detail), BONE.thigh[side], 1));
    } else {
      parts.push(rigid(lidGeometry(true, detail), BONE.lidUpper[side], 1));
      parts.push(rigid(lidGeometry(false, detail), BONE.lidLower[side], 1));
      parts.push(rigid(limb(RIG.upperArm, RIG.upperArmRadius, detail), BONE.upperArm[side], 1));
      parts.push(rigid(limb(RIG.forearm, RIG.forearmRadius, detail), BONE.forearm[side], 1));
      for (const h of handGeometry(detail)) parts.push(rigid(h, BONE.hand[side], 1));
      parts.push(rigid(limb(RIG.thigh, RIG.thighRadius, detail), BONE.thigh[side], 1));
      parts.push(rigid(limb(RIG.shin, RIG.shinRadius, detail), BONE.shin[side], 1));
    }
    parts.push(rigid(footGeometry(detail), BONE.foot[side], FOOT_SHADE));
  }
  return mergeParts(parts);
}
