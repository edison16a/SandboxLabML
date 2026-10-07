import * as THREE from 'three';
import { EXPRESSIONS } from '../motion/pose';
import { RIG } from './proportions';

/**
 * The bones of the character, by index. The trunk is a hierarchy (body,
 * torso, head, eyes); arms and legs hang straight off the root, because
 * their joints come out of IK already in the character's frame. Every part
 * of the mesh follows exactly one bone, so the whole character is one
 * skinned draw call per material.
 */
export const BONE = {
  root: 0,
  body: 1,
  torso: 2,
  head: 3,
  eye: [4, 5],
  pupil: [6, 7],
  lidUpper: [8, 9],
  lidLower: [10, 11],
  /** One per expression, in EXPRESSIONS order: a mouth shows by scaling its bone up. */
  mouth: EXPRESSIONS.map((_, i) => 12 + i),
  upperArm: [17, 18],
  forearm: [19, 20],
  hand: [21, 22],
  thigh: [23, 24],
  shin: [25, 26],
  foot: [27, 28],
} as const;

export const BONE_COUNT = 29;

/** Parent of each bone, -1 for the root. */
function parentOf(i: number): number {
  if (i === BONE.root) return -1;
  if (i === BONE.torso || i === BONE.head) return BONE.body;
  if ((BONE.eye as readonly number[]).includes(i) || (BONE.mouth as readonly number[]).includes(i)) return BONE.head;
  for (let side = 0; side < 2; side++) {
    if (i === BONE.pupil[side] || i === BONE.lidUpper[side] || i === BONE.lidLower[side]) return BONE.eye[side];
  }
  return BONE.root;
}

/**
 * A fresh skeleton for one character. The bones start at identity, which
 * is the pose the parts are modeled in (each in its own bone's frame), so
 * every inverse bind matrix is identity too; the poser then moves them.
 */
export function createSkeleton(): { root: THREE.Bone; bones: THREE.Bone[]; skeleton: THREE.Skeleton } {
  const bones = Array.from({ length: BONE_COUNT }, () => new THREE.Bone());
  for (let i = 0; i < BONE_COUNT; i++) {
    const p = parentOf(i);
    if (p >= 0) bones[p].add(bones[i]);
  }
  bones[BONE.head].position.set(0, RIG.headY, 0);
  const skeleton = new THREE.Skeleton(
    bones,
    bones.map(() => new THREE.Matrix4()),
  );
  return { root: bones[BONE.root], bones, skeleton };
}
