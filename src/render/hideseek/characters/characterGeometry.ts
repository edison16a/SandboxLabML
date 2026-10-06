import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CharacterDetail } from './types';

/**
 * Proportions of the character, m. It stands 1.5 m tall inside the 0.4 m
 * collision radius of an agent: a big round head over a small bean of a
 * body, the head taking almost half the height so it reads from far away.
 */
export const RIG = {
  headY: 1.13,
  headRadius: 0.35,
  /** The head is a touch wider than tall, like a bun. */
  headScale: [1.07, 0.93, 1.07] as const,
  shoulderY: 0.66,
  shoulderZ: 0.165,
  armLength: 0.25,
  armRadius: 0.052,
  handRadius: 0.072,
  /** Arms rest a little away from the belly, rad. */
  restSplay: 0.36,
} as const;

/**
 * Mesh resolution: the two detail levels a character can be drawn at, plus
 * a coarse one for the instanced crowds of the arena grid.
 */
export type MeshDetail = CharacterDetail | 'instanced';

/**
 * Side profile of the body from the floor up, (radius, height) pairs: a
 * rounded base, a soft belly and a narrow neck that tucks into the head.
 * It is smoothed by a spline and spun round the vertical axis.
 */
const PROFILE: Array<[number, number]> = [
  [0, 0],
  [0.12, 0.012],
  [0.195, 0.06],
  [0.232, 0.15],
  [0.24, 0.26],
  [0.226, 0.4],
  [0.195, 0.53],
  [0.158, 0.65],
  [0.13, 0.76],
  [0.112, 0.85],
  [0.085, 0.93],
  [0, 0.96],
];

function segments(detail: MeshDetail, full: number, low: number, instanced = Math.max(3, Math.round(low * 0.6))): number {
  return detail === 'full' ? full : detail === 'low' ? low : instanced;
}

/** The torso and base as one smooth lathe, its bottom at y = 0. */
export function bodyGeometry(detail: MeshDetail): THREE.BufferGeometry {
  const curve = new THREE.SplineCurve(PROFILE.map(([r, y]) => new THREE.Vector2(r, y)));
  const points = curve.getPoints(segments(detail, 40, 14, 9));
  // The spline can overshoot past the axis at the ends; pin both poles back onto it.
  points[0].x = 0;
  points[points.length - 1].x = 0;
  const g = new THREE.LatheGeometry(points, segments(detail, 40, 14, 9));
  g.computeVertexNormals();
  return g;
}

/** The head: a unit sphere of the head radius, centered on its own origin. The mesh scales it into a bun. */
export function headGeometry(detail: MeshDetail): THREE.BufferGeometry {
  return new THREE.SphereGeometry(RIG.headRadius, segments(detail, 48, 18, 11), segments(detail, 32, 12, 8));
}

/**
 * One arm with its hand, hanging straight down from the shoulder pivot at
 * the origin. The hand is a mitten: a squashed ball with a small thumb on
 * the forward side, which is enough to read as a hand at this size.
 */
export function armGeometry(detail: MeshDetail): THREE.BufferGeometry {
  const arm = new THREE.CapsuleGeometry(RIG.armRadius, RIG.armLength - RIG.armRadius, segments(detail, 6, 3, 1), segments(detail, 14, 7, 5), 1);
  arm.translate(0, -RIG.armLength / 2, 0);
  const hand = new THREE.SphereGeometry(RIG.handRadius, segments(detail, 18, 8, 6), segments(detail, 12, 6, 4));
  hand.scale(1, 1.08, 0.82);
  hand.translate(0.008, -RIG.armLength - 0.03, 0);
  const thumb = new THREE.SphereGeometry(0.03, segments(detail, 10, 6, 4), segments(detail, 8, 4, 3));
  thumb.translate(0.06, -RIG.armLength - 0.005, 0);
  const merged = mergeGeometries([arm, hand, thumb]) as THREE.BufferGeometry;
  [arm, hand, thumb].forEach((g) => g.dispose());
  return merged;
}

/** A round soft shadow under the character, for tiers without shadow maps. Faces up, at y = 0. */
export function blobGeometry(): THREE.BufferGeometry {
  const g = new THREE.CircleGeometry(0.42, 32);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.006, 0);
  return g;
}
