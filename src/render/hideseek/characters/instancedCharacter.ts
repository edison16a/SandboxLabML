import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { setTintMask } from '../shared/tintMask';
import { CharacterMotion } from './motion/characterMotion';
import { bodyGeometry } from './rig/bodyParts';
import { createSkeleton } from './rig/bones';
import { faceGeometry } from './rig/faceParts';
import { CharacterPoser } from './rig/poser';
import { createCharacterDrive } from './types';

/**
 * Bakes a skinned part mesh into a plain one at the skeleton's current
 * pose: each vertex moved by the bone it follows. `tint` 1 lets the
 * instance color (the team color) through, 0 keeps the part's own colors.
 */
function bake(g: THREE.BufferGeometry, bones: THREE.Bone[], tint: number): THREE.BufferGeometry {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const skin = g.attributes.skinIndex;
  const v = new THREE.Vector3();
  const normal = new THREE.Matrix3();
  for (let i = 0; i < pos.count; i++) {
    const m = bones[skin.getX(i)].matrixWorld;
    v.fromBufferAttribute(pos, i).applyMatrix4(m);
    pos.setXYZ(i, v.x, v.y, v.z);
    v.fromBufferAttribute(nor, i).applyMatrix3(normal.getNormalMatrix(m)).normalize();
    nor.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute('skinIndex');
  g.deleteAttribute('skinWeight');
  return setTintMask(g, tint);
}

/**
 * The whole character standing at rest as one coarse mesh, for drawing a
 * hundred of them in one instanced call on the arena grid: the same rig,
 * motion and parts as up close, posed once and baked. Body, limbs and feet
 * take the instance color; the eyes and the smile keep their own.
 */
export function instancedCharacterGeometry(): THREE.BufferGeometry {
  const { root, bones } = createSkeleton();
  const motion = new CharacterMotion(0);
  const drive = createCharacterDrive();
  for (let i = 0; i < 40; i++) motion.update(drive, 1 / 30, i / 30);
  new CharacterPoser(bones).apply(motion.pose);
  root.updateMatrixWorld(true);
  const parts = [bake(bodyGeometry('instanced'), bones, 1), bake(faceGeometry('instanced', 'happy'), bones, 0)];
  const merged = mergeGeometries(parts) as THREE.BufferGeometry;
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}
