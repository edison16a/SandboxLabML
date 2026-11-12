import { angleDelta, clamp } from '@/engine/core/math';
import { RIG } from '../rig/proportions';
import { CONTACT_HOLD, CONTACT_NONE, type CharacterDrive } from '../types';
import type { Gait } from './gait';
import { solveTwoBone } from './ik';
import type { MotionEstimate } from './kinematics';
import type { CharacterPose } from './pose';
import { driveSpring, spring } from './spring';
import { rotateBody, setVec, toLocal, toWorld, vec3, type Vec3 } from './vec';

/** How each arm is posed, 0 to 1, besides swinging: hands up in a startle, out for balance in the air, on a box, limp asleep, back to jump. */
export interface ArmBlend {
  raise: number;
  air: number;
  push: number;
  hold: number;
  asleep: number;
  crouch: number;
}

const KNEE_POLE = [vec3(1, 0, -0.3), vec3(1, 0, 0.3)];
const ELBOW_POLE = [vec3(-1, -0.4, -0.7), vec3(-1, -0.4, 0.7)];
const ARM = RIG.upperArm + RIG.forearm;

/**
 * Legs and arms. Each leg reaches from its hip to its foot, wherever the
 * gait planted it in the world, through two bone IK, so knees bend as the
 * body passes over a planted foot and absorb a landing. Arms swing against
 * the legs as damped pendulums that keep swinging a beat after the body
 * stops, and reach for a box with both hands to push or carry it.
 */
export class Limbs {
  private readonly swing = [spring(), spring()];
  private readonly tmp = vec3();
  private readonly target = vec3();
  private readonly flat = { x: 0, z: 0 };

  update(d: CharacterDrive, ground: number, gait: Gait, est: MotionEstimate, arms: ArmBlend, dt: number, pose: CharacterPose): void {
    this.legs(d, ground, gait, est.rise, pose);
    this.arms(d, est, arms, dt, pose);
  }

  private legs(d: CharacterDrive, ground: number, gait: Gait, rise: number, pose: CharacterPose): void {
    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -1 : 1;
      const hip = pose.hips[side];
      rotateBody(setVec(this.tmp, 0, 0, sign * RIG.hipZ), 0, pose.roll, pose.twist, hip);
      hip.x += pose.pelvis.x;
      hip.y += pose.pelvis.y;
      const foot = gait.feet[side];
      const t = this.target;
      if (d.airborne) {
        // In the air the feet tuck up under the hips while rising and reach down for the ground while falling; the gait plants them wherever they are on landing.
        const tuck = 0.2 + 0.13 * clamp(0.5 - rise / 4, 0, 1);
        setVec(t, hip.x + 0.06, hip.y - tuck, hip.z + sign * 0.02);
        toWorld(t.x, t.z, d.yaw, this.flat);
        setVec(foot.pos, d.x + this.flat.x, ground + t.y - RIG.ankleY, d.z + this.flat.z);
      } else {
        toLocal(foot.pos.x - d.x, foot.pos.z - d.z, d.yaw, this.flat);
        // A heel coming off the ground pivots the foot on its toe, which lifts the ankle.
        const lift = foot.pitch < 0 ? -foot.pitch * 0.12 : foot.pitch * 0.05;
        setVec(t, this.flat.x, foot.pos.y - ground + RIG.ankleY + lift, this.flat.z);
      }
      solveTwoBone(hip, t, RIG.thigh, RIG.shin, KNEE_POLE[side], pose.knees[side], pose.ankles[side]);
      pose.footYaw[side] = angleDelta(d.yaw, foot.yaw);
      pose.footPitch[side] = foot.pitch;
    }
  }

  private arms(d: CharacterDrive, est: MotionEstimate, w: ArmBlend, dt: number, pose: CharacterPose): void {
    const free = Math.max(0, 1 - w.raise - w.air - w.push - w.hold - w.asleep - w.crouch);
    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -1 : 1;
      const shoulder = pose.shoulders[side];
      rotateBody(setVec(this.tmp, 0, RIG.shoulderY * pose.squash, sign * RIG.shoulderZ), pose.lean, pose.roll, pose.twist, shoulder);
      shoulder.x += pose.pelvis.x;
      shoulder.y += pose.pelvis.y;
      shoulder.z += pose.pelvis.z;
      // The arm swings against its own leg: forward as that foot falls behind. Inertia throws it forward on braking.
      const footAhead = pose.ankles[side].x - pose.hips[side].x;
      const swing = driveSpring(this.swing[side], clamp(-2.6 * footAhead, -0.85, 0.85), 9, 0.32, dt, -2.2 * est.forwardAccel);
      const bend = ARM * (0.93 - 0.12 * clamp(est.speed / 3, 0, 1));
      const t = this.target;
      setVec(t, 0, 0, 0);
      add(t, shoulder, Math.sin(swing) * bend, -Math.cos(swing) * bend, sign * 0.05, free);
      add(t, shoulder, 0.1, 0.2, sign * 0.12, w.raise);
      add(t, shoulder, 0.03, 0.14, sign * 0.23, w.air);
      add(t, shoulder, 0.07, -0.25, sign * 0.03, w.asleep);
      add(t, shoulder, -0.13, -0.21, sign * 0.07, w.crouch);
      if (d.contact !== CONTACT_NONE && w.push + w.hold > 0) {
        this.grip(d, sign, d.contact === CONTACT_HOLD ? 0.6 : 0.74, this.tmp);
        add(t, this.tmp, 0, 0, 0, w.push + w.hold);
      }
      solveTwoBone(shoulder, t, RIG.upperArm, RIG.forearm, ELBOW_POLE[side], pose.elbows[side], pose.hands[side]);
    }
  }

  /** Where hand `sign` (-1 left, +1 right) grips the box face the drive reports, in the character's frame. */
  private grip(d: CharacterDrive, sign: number, height: number, out: Vec3): void {
    // Along the face, to the character's own left or right of its middle.
    const tx = -d.contactNZ;
    const tz = d.contactNX;
    toLocal(tx, tz, d.yaw, this.flat);
    const along = this.flat.z * sign >= 0 ? 0.19 : -0.19;
    toLocal(d.contactX + tx * along - d.x, d.contactZ + tz * along - d.z, d.yaw, this.flat);
    setVec(out, this.flat.x, Math.min(d.contactHeight * height, 0.75) - d.elevation, this.flat.z);
  }
}

/** Adds `weight` of the point `base` + (x, y, z) into `out`. */
function add(out: Vec3, base: Vec3, x: number, y: number, z: number, weight: number): void {
  if (weight <= 0) return;
  out.x += (base.x + x) * weight;
  out.y += (base.y + y) * weight;
  out.z += (base.z + z) * weight;
}
