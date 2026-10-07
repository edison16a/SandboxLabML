import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { setTintMask } from '../shared/tintMask';
import { LIMB } from '../grid/crowdGait';
import { CharacterMotion } from './motion/characterMotion';
import type { CharacterPose } from './motion/pose';
import { bodyGeometry } from './rig/bodyParts';
import { BONE, createSkeleton } from './rig/bones';
import { faceGeometry } from './rig/faceParts';
import { CharacterPoser } from './rig/poser';
import { createCharacterDrive } from './types';

/**
 * Bakes a skinned part mesh into a plain one at the skeleton's current
 * pose: each vertex moved by the bone it follows. `tint` 1 lets the
 * instance color (the team color) through, 0 keeps the part's own colors.
 */
function bake(g: THREE.BufferGeometry, bones: THREE.Bone[], tint: number, pose: CharacterPose): THREE.BufferGeometry {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const skin = g.attributes.skinIndex;
  const v = new THREE.Vector3();
  const normal = new THREE.Matrix3();
  const limb = new Float32Array(pos.count);
  const pivot = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const bone = skin.getX(i);
    limbOf(bone, pose, i, limb, pivot);
    const m = bones[bone].matrixWorld;
    v.fromBufferAttribute(pos, i).applyMatrix4(m);
    pos.setXYZ(i, v.x, v.y, v.z);
    v.fromBufferAttribute(nor, i).applyMatrix3(normal.getNormalMatrix(m)).normalize();
    nor.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute('skinIndex');
  g.deleteAttribute('skinWeight');
  g.setAttribute('aLimb', new THREE.BufferAttribute(limb, 1));
  g.setAttribute('aPivot', new THREE.BufferAttribute(pivot, 1));
  return setTintMask(g, tint);
}

/** Tags vertex `i` of bone `bone` with its limb (see LIMB) and the height that limb swings about: the hip or the shoulder. */
function limbOf(bone: number, pose: CharacterPose, i: number, limb: Float32Array, pivot: Float32Array): void {
  for (let side = 0; side < 2; side++) {
    if (bone === BONE.thigh[side] || bone === BONE.shin[side] || bone === BONE.foot[side]) {
      limb[i] = side === 0 ? LIMB.leftLeg : LIMB.rightLeg;
      pivot[i] = pose.hips[side].y;
    } else if (bone === BONE.upperArm[side] || bone === BONE.forearm[side] || bone === BONE.hand[side]) {
      limb[i] = side === 0 ? LIMB.leftArm : LIMB.rightArm;
      pivot[i] = pose.shoulders[side].y;
    }
  }
}

/**
 * The whole character standing at rest as one coarse mesh, for drawing a
 * hundred of them in one instanced call on the arena grid: the same rig,
 * motion and parts as up close, posed once and baked. Body, limbs and feet
 * take the instance color; the eyes and the smile keep their own. Every
 * limb vertex is tagged with its limb, so the crowd shader can swing it.
 */
export function instancedCharacterGeometry(): THREE.BufferGeometry {
  const { root, bones } = createSkeleton();
  const motion = new CharacterMotion(0);
  const drive = createCharacterDrive();
  for (let i = 0; i < 40; i++) motion.update(drive, 1 / 30, i / 30);
  new CharacterPoser(bones).apply(motion.pose);
  root.updateMatrixWorld(true);
  const parts = [bake(bodyGeometry('instanced'), bones, 1, motion.pose), bake(faceGeometry('instanced', 'happy'), bones, 0, motion.pose)];
  const merged = mergeGeometries(parts) as THREE.BufferGeometry;
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}
