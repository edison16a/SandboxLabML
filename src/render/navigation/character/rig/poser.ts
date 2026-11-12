import * as THREE from 'three';
import type { CharacterPose } from '../motion/pose';
import type { Vec3 } from '../motion/vec';
import { BONE } from './bones';
import { MOUTH_CENTER } from './faceParts';
import { eyeCenter, RIG } from './proportions';

const DOWN = new THREE.Vector3(0, -1, 0);
/** Lid angles about the eye's side axis, rad: the upper lid's edge from open (up and back) to shut (below the middle), the lower lid's from open to raised. */
const UPPER = { open: 0.98, shut: -0.5 };
const LOWER = { open: -0.98, raised: 0.0 };

/**
 * Puts a pose on a skeleton. Trunk bones take angles; limb bones are
 * placed at their joint and turned to point at the next one, straight from
 * the IK. Everything is written in place into preallocated objects.
 */
export class CharacterPoser {
  private readonly dir = new THREE.Vector3();
  private readonly bones: THREE.Bone[];

  constructor(bones: THREE.Bone[]) {
    this.bones = bones;
    const c = { x: 0, y: 0, z: 0 };
    for (let side = 0; side < 2; side++) {
      eyeCenter(side === 0 ? -1 : 1, c);
      bones[BONE.eye[side]].position.set(c.x, c.y, c.z);
    }
    for (const m of BONE.mouth) bones[m].position.copy(MOUTH_CENTER);
  }

  apply(p: CharacterPose): void {
    const b = this.bones;
    b[BONE.body].position.set(p.pelvis.x, p.pelvis.y, p.pelvis.z);
    b[BONE.body].rotation.set(p.roll, p.twist, -p.lean, 'YXZ');
    const side = 1 / Math.sqrt(p.squash);
    b[BONE.torso].scale.set(side, p.squash, side);
    b[BONE.head].position.set(0, RIG.headY * p.squash, 0);
    b[BONE.head].rotation.set(p.headRoll, p.headYaw, -p.headPitch, 'YXZ');
    for (let s = 0; s < 2; s++) {
      b[BONE.eye[s]].scale.setScalar(p.eyeScale);
      const pupil = b[BONE.pupil[s]];
      pupil.rotation.set(0, p.gazeYaw, -p.gazePitch, 'YXZ');
      pupil.scale.set(1, p.pupilScale, p.pupilScale);
      b[BONE.lidUpper[s]].rotation.z = UPPER.open + (UPPER.shut - UPPER.open) * p.lidUpper;
      b[BONE.lidLower[s]].rotation.z = LOWER.open + (LOWER.raised - LOWER.open) * p.lidLower;
      this.segment(BONE.upperArm[s], p.shoulders[s], p.elbows[s]);
      this.segment(BONE.forearm[s], p.elbows[s], p.hands[s]);
      this.segment(BONE.hand[s], p.hands[s], p.hands[s], p.elbows[s]);
      this.segment(BONE.thigh[s], p.hips[s], p.knees[s]);
      this.segment(BONE.shin[s], p.knees[s], p.ankles[s]);
      const foot = b[BONE.foot[s]];
      foot.position.set(p.ankles[s].x, p.ankles[s].y, p.ankles[s].z);
      foot.rotation.set(0, p.footYaw[s], p.footPitch[s], 'YXZ');
    }
    for (let i = 0; i < BONE.mouth.length; i++) {
      // A mouth grows from its middle as it fades in; never quite zero, which a bone matrix cannot invert.
      const w = Math.max(1e-3, p.mouth[i]);
      b[BONE.mouth[i]].scale.set(1, w, w);
    }
  }

  /** Places bone `i` at `from`, pointing down its -y axis toward `to` (or along `from` minus `back`, for a hand). */
  private segment(i: number, from: Vec3, to: Vec3, back?: Vec3): void {
    const bone = this.bones[i];
    bone.position.set(from.x, from.y, from.z);
    if (back) this.dir.set(from.x - back.x, from.y - back.y, from.z - back.z);
    else this.dir.set(to.x - from.x, to.y - from.y, to.z - from.z);
    if (this.dir.lengthSq() < 1e-10) return;
    this.dir.normalize();
    bone.quaternion.setFromUnitVectors(DOWN, this.dir);
  }
}
