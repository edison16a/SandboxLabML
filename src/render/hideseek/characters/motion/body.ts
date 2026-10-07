import { clamp } from '@/engine/core/math';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { LEG_REACH, RIG } from '../rig/proportions';
import type { Gait } from './gait';
import type { MotionEstimate } from './kinematics';
import type { CharacterPose } from './pose';
import { driveSpring, settleSpring, spring } from './spring';

/** A climber stands square to the ramp, so it leans this far into the slope, rad. The grid crowds lean the same. */
const RAMP = DEFAULT_HIDESEEK_PHYSICS.box.ramp;
export const SLOPE_LEAN = Math.atan2(RAMP.height, RAMP.length) * 0.75;

/** What the body reacts to this frame, besides its own momentum. */
export interface BodyInput {
  yaw: number;
  /** World position and ground height under the body, to measure how far each planted foot reaches. */
  x: number;
  z: number;
  ground: number;
  /** 0 to 1 blends: on a slope, in the air, asleep, leaning into a box, carrying one, crouched to jump. */
  climb: number;
  air: number;
  asleep: number;
  push: number;
  hold: number;
  crouch: number;
  /** 1 with a wall or box right in front: a stop there is not braking, so the body does not lean back for it. */
  blocked: number;
  /** Where the agent looks, relative to its facing (left positive) and up, rad, and how much it wants to. */
  lookYaw: number;
  lookPitch: number;
  looking: number;
  time: number;
  seed: number;
  dt: number;
}

/**
 * The trunk and head as masses on springs. Momentum drives them: speeding
 * up leans the body into the run, braking rocks it back, a turn banks it
 * toward the inside and the head trails each change and settles with a
 * small overshoot. The hips ride as high as the planted legs allow, so the
 * body vaults over each footfall like an inverted pendulum, compresses on
 * every running stride and dips on a landing. Damping below 1 is on
 * purpose: that settle is what reads as weight.
 */
export class BodyDynamics {
  private readonly height = spring(RIG.hipY);
  private readonly lean = spring();
  private readonly roll = spring();
  private readonly twist = spring();
  private readonly headYaw = spring();
  private readonly headPitch = spring();
  private readonly headRoll = spring();

  reset(): void {
    settleSpring(this.height, RIG.hipY);
    for (const s of [this.lean, this.roll, this.twist, this.headYaw, this.headPitch, this.headRoll]) settleSpring(s, 0);
  }

  /** A sudden vertical shove of the hips, m/s: down for a landing, up for a startled hop. */
  kick(velocity: number): void {
    this.height.velocity += velocity;
  }

  /**
   * A hard stop against something: the trunk's momentum pitches it forward
   * by `strength` rad/s, the head nods after it and the knees give a
   * little, and the springs bring it all back with a small recoil.
   */
  bump(strength: number): void {
    this.lean.velocity += strength;
    this.headPitch.velocity += strength * 0.8;
    this.height.velocity -= strength * 0.12;
  }

  update(b: BodyInput, est: MotionEstimate, gait: Gait, pose: CharacterPose): void {
    const dt = b.dt;
    const grounded = 1 - b.air;
    const breathe = Math.sin(b.time * 2.1 + b.seed * 2.3);
    // Hips as high as the lowest planted leg lets them be, then lowered for running, carrying, a crouch or sleep.
    let reach: number = RIG.hipY;
    let supported = false;
    let sway = 0;
    for (let side = 0; side < 2; side++) {
      const foot = gait.feet[side];
      if (!foot.planted) continue;
      const hipX = b.x + Math.sin(b.yaw) * (side === 0 ? -RIG.hipZ : RIG.hipZ);
      const hipZ = b.z + Math.cos(b.yaw) * (side === 0 ? -RIG.hipZ : RIG.hipZ);
      const flat = Math.hypot(foot.pos.x - hipX, foot.pos.z - hipZ);
      const top = foot.pos.y - b.ground + RIG.ankleY + Math.sqrt(Math.max(0, LEG_REACH * LEG_REACH - flat * flat));
      reach = supported ? Math.max(reach, top) : top;
      supported = true;
      // Weight shifts over the foot that carries it.
      const s = gait.stance[side];
      if (s >= 0) sway += (side === 0 ? -1 : 1) * Math.sin(Math.PI * s);
    }
    const stride = gait.stance[0] >= 0 ? gait.stance[0] : gait.stance[1];
    let target = Math.min(RIG.hipY, supported ? reach : RIG.hipY + 0.03 * gait.run);
    target -= 0.05 * gait.run * (stride >= 0 ? Math.sin(Math.PI * stride) : 0);
    target -= 0.03 * b.climb + 0.035 * Math.max(b.push, b.hold) + 0.11 * b.crouch + 0.06 * b.asleep - 0.004 * breathe * (1 - b.asleep * 0.5);
    target += 0.05 * b.air;
    driveSpring(this.height, target, 17, 0.42, dt);
    pose.pelvis.x = -0.02 * b.push;
    pose.pelvis.y = this.height.value;
    pose.pelvis.z = 0;
    // Lean: balance against acceleration, lean into speed, square to a slope, into a box, slumped asleep.
    const walk = clamp(est.speed / 2, 0, 1) * grounded;
    const leanTarget =
      clamp(0.035 * est.forward + 0.02 * est.forwardAccel * (1 - b.blocked), -0.2, 0.24) * grounded * (1 - b.climb) * (1 - b.push) +
      SLOPE_LEAN * b.climb +
      0.34 * b.push -
      0.1 * b.hold * clamp(-est.forward, 0, 1) +
      0.16 * b.air +
      0.14 * b.asleep +
      0.12 * b.crouch;
    pose.lean = driveSpring(this.lean, leanTarget, 8, 0.6, dt);
    // Bank into the turn's pull and sway over the stance foot.
    const rollTarget = clamp(0.045 * est.lateralAccel, -0.3, 0.3) * grounded + 0.045 * sway * walk * (1 - gait.run * 0.5);
    pose.roll = driveSpring(this.roll, rollTarget, 9, 0.55, dt);
    const look = clamp(b.lookYaw, -1.6, 1.6) * b.looking;
    pose.twist = driveSpring(this.twist, 0.22 * look - 0.06 * sway * walk, 10, 0.7, dt);
    // The head turns to look, nods with each step and trails the body's acceleration.
    const idleGlance = (1 - b.looking) * 0.25 * Math.sin(b.time * 0.37 + b.seed * 4.1) * (1 - walk);
    const yawTarget = clamp(look - pose.twist, -1.1, 1.1) + (1 - b.looking) * clamp(est.yawRate * 0.12, -0.4, 0.4) + idleGlance;
    pose.headYaw = driveSpring(this.headYaw, yawTarget, 12, 0.72, dt);
    const pitchTarget = clamp(b.lookPitch, -0.5, 0.5) * b.looking + 0.38 * b.asleep - 0.12 * b.climb + 0.05 * walk + 0.02 * breathe * b.asleep;
    pose.headPitch = driveSpring(this.headPitch, pitchTarget, 11, 0.45, dt, -1.4 * est.forwardAccel * grounded);
    pose.headRoll = driveSpring(this.headRoll, -0.5 * pose.roll + 0.15 * b.asleep, 10, 0.5, dt, -0.9 * est.lateralAccel * grounded);
    // Squash and stretch from the hips' own bounce: squashed as a landing drives them down, stretched as they spring up.
    pose.squash = 1 + clamp(this.height.velocity * 0.07, -0.1, 0.08) + 0.012 * breathe * (1 - walk);
  }
}
