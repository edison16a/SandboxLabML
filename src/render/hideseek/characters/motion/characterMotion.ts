import { clamp } from '@/engine/core/math';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { CONTACT_HOLD, CONTACT_NONE, CONTACT_PUSH, type CharacterDrive } from '../types';
import { BodyDynamics } from './body';
import { FaceDynamics } from './face';
import { Gait } from './gait';
import { MotionEstimate } from './kinematics';
import { Limbs, type ArmBlend } from './limbs';
import { createPose, type CharacterPose } from './pose';
import { approach } from './spring';
import { toLocal } from './vec';

const RAMP = DEFAULT_HIDESEEK_PHYSICS.box.ramp;
/** Rise per meter of a ramp's slope. */
const GRADE = RAMP.height / RAMP.length;
/** Eye height over the ground, m, to aim the head at something. */
const EYES = 1.15;
/** A stop sharper than this against something solid is a collision, m/s² as the motion estimate smooths it: a run into a wall peaks near 14. */
const BUMP = 8;

/**
 * The motion of one character, as a renderer reads it: every frame it
 * takes where the simulation put the agent and what it is doing, and works
 * out a physically plausible body on top. Momentum and turn rate drive the
 * trunk on springs, feet are planted in the world and stepped by a gait
 * that matches the real speed, legs and arms bend through IK, the head and
 * eyes turn to whatever the agent sees, and a jump tucks, reaches for the
 * ground and lands on bent knees. It never moves the agent itself: the
 * position and heading stay exactly the simulation's. Pure math, no
 * three.js, and nothing allocated per frame.
 */
export class CharacterMotion {
  readonly pose: CharacterPose = createPose();
  private readonly est = new MotionEstimate();
  private readonly gait = new Gait();
  private readonly body = new BodyDynamics();
  private readonly face = new FaceDynamics();
  private readonly limbs = new Limbs();
  private readonly blend: ArmBlend = { raise: 0, air: 0, push: 0, hold: 0, asleep: 0, crouch: 0 };
  private readonly flat = { x: 0, z: 0 };
  private climb = 0;
  private looking = 0;
  private wasAirborne = false;
  private wasSeen = false;
  /** Seconds before another bump can start, so one collision is one bump. */
  private bumpWait = 0;
  private readonly seed: number;

  /** `seed` staggers idle motion so a crowd does not breathe or blink in step. */
  constructor(seed = 0) {
    this.seed = seed;
  }

  /** Advances by `dt` seconds of wall time at clock `time` and returns the pose, which it owns. */
  update(d: CharacterDrive, dt: number, time: number): CharacterPose {
    const step = clamp(dt, 1e-4, 0.1);
    const p = this.pose;
    if (d.teleported) {
      this.est.reset(d.x, d.z, d.yaw, d.elevation);
      this.gait.reset(d.x, d.z, d.yaw, d.elevation);
      this.body.reset();
      d.teleported = false;
    }
    const est = this.est;
    est.update(d.x, d.z, d.yaw, d.elevation, step);
    const b = this.blend;
    this.climb = approach(this.climb, d.climbing ? 1 : 0, 12, step);
    b.air = approach(b.air, d.airborne ? 1 : 0, 16, step);
    b.asleep = 1 - p.awake;
    b.push = approach(b.push, d.contact === CONTACT_PUSH && !d.frozen ? 1 : 0, 8, step);
    b.hold = approach(b.hold, d.contact === CONTACT_HOLD && !d.frozen ? 1 : 0, 9, step);
    b.raise = approach(b.raise, d.seen && d.contact === CONTACT_NONE ? 1 : 0, 10, step) * (1 - b.air);
    // About to leap off a ramp lip: crouch and swing the arms back.
    b.crouch = approach(b.crouch, d.climbing && d.elevation > RAMP.height * 0.72 && est.forward > 0.8 ? 1 : 0, 14, step);

    // Something to look at: the agent it sees or that sees it, else the box in its hands.
    let lookYaw = 0;
    let lookPitch = 0;
    const target = d.look || d.contact !== CONTACT_NONE;
    if (target) {
      const tx = d.look ? d.lookX : d.contactX;
      const tz = d.look ? d.lookZ : d.contactZ;
      const ty = d.look ? d.lookY : d.contactHeight * 0.6;
      toLocal(tx - d.x, tz - d.z, d.yaw, this.flat);
      lookYaw = Math.atan2(-this.flat.z, this.flat.x);
      lookPitch = Math.atan2(d.elevation + EYES - ty, Math.max(0.3, Math.hypot(this.flat.x, this.flat.z)));
    }
    this.looking = approach(this.looking, target && !d.frozen ? 1 : 0, 6, step);

    // On a slope the ground rises along the way the agent moves up it.
    const moving = est.speed > 0.2;
    const up = est.rise >= 0 ? 1 : -1;
    const ux = moving ? (up * est.vx) / est.speed : Math.cos(d.yaw);
    const uz = moving ? (up * est.vz) / est.speed : -Math.sin(d.yaw);
    this.gait.update({ x: d.x, z: d.z, yaw: d.yaw, ground: d.elevation, vx: est.vx, vz: est.vz, speed: est.speed, yawRate: est.yawRate, grade: GRADE * this.climb, uphillX: ux, uphillZ: uz, airborne: d.airborne, frozen: d.frozen, dt: step });

    if (this.wasAirborne && !d.airborne) this.body.kick(Math.min(0, est.rise) * 0.45 - 0.5);
    // Brains steer by velocity, so they can stop dead anywhere; only a hard stop with something solid in front is a collision.
    this.bumpWait = Math.max(0, this.bumpWait - step);
    if (est.forwardAccel < -BUMP && d.blocked && this.bumpWait === 0 && !d.airborne && !d.frozen) {
      this.body.bump(Math.min(3, (-est.forwardAccel - BUMP) * 0.2 + 1.4));
      this.bumpWait = 0.6;
    }
    this.wasAirborne = d.airborne;
    if (d.seen && !this.wasSeen && d.contact === CONTACT_NONE) this.body.kick(1.3);
    this.wasSeen = d.seen;

    this.body.update(
      { yaw: d.yaw, x: d.x, z: d.z, ground: d.elevation, climb: this.climb, air: b.air, asleep: b.asleep, push: b.push, hold: b.hold, crouch: b.crouch, blocked: d.blocked ? 1 : 0, lookYaw, lookPitch, looking: this.looking, time, seed: this.seed, dt: step },
      est,
      this.gait,
      p,
    );
    this.face.update(
      { frozen: d.frozen, seen: d.seen, seeing: d.seeing, straining: d.contact !== CONTACT_NONE, lookYaw: lookYaw - p.headYaw - p.twist, lookPitch: lookPitch - p.headPitch, looking: this.looking, time, seed: this.seed, dt: step },
      p,
    );
    this.limbs.update(d, d.elevation, this.gait, est, b, step, p);
    return p;
  }

  /** The feet, for tests and for anything drawn at them. */
  get feet() {
    return this.gait.feet;
  }
}
