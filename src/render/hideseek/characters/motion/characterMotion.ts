import { clamp } from '@/engine/core/math';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { CONTACT_HOLD, CONTACT_NONE, CONTACT_PUSH, type CharacterDrive } from '../types';
import { BodyDynamics, type BodyInput } from './body';
import { FaceDynamics, type FaceInput } from './face';
import { Gait, type GaitInput } from './gait';
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
  // Inputs for the parts, filled in place every frame so a frame allocates nothing.
  private readonly gaitIn: GaitInput = { x: 0, z: 0, yaw: 0, ground: 0, vx: 0, vz: 0, speed: 0, yawRate: 0, grade: 0, uphillX: 1, uphillZ: 0, airborne: false, frozen: false, dt: 0 };
  private readonly bodyIn: BodyInput;
  private readonly faceIn: FaceInput;
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
    this.bodyIn = { yaw: 0, x: 0, z: 0, ground: 0, climb: 0, air: 0, asleep: 0, push: 0, hold: 0, crouch: 0, blocked: 0, lookYaw: 0, lookPitch: 0, looking: 0, time: 0, seed, dt: 0 };
    this.faceIn = { frozen: false, seen: false, seeing: false, straining: false, lookYaw: 0, lookPitch: 0, looking: 0, time: 0, seed, dt: 0 };
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
    const g = this.gaitIn;
    g.x = d.x;
    g.z = d.z;
    g.yaw = d.yaw;
    g.ground = d.elevation;
    g.vx = est.vx;
    g.vz = est.vz;
    g.speed = est.speed;
    g.yawRate = est.yawRate;
    g.grade = GRADE * this.climb;
    g.uphillX = ux;
    g.uphillZ = uz;
    g.airborne = d.airborne;
    g.frozen = d.frozen;
    g.dt = step;
    this.gait.update(g);

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

    const bi = this.bodyIn;
    bi.yaw = d.yaw;
    bi.x = d.x;
    bi.z = d.z;
    bi.ground = d.elevation;
    bi.climb = this.climb;
    bi.air = b.air;
    bi.asleep = b.asleep;
    bi.push = b.push;
    bi.hold = b.hold;
    bi.crouch = b.crouch;
    bi.blocked = d.blocked ? 1 : 0;
    bi.lookYaw = lookYaw;
    bi.lookPitch = lookPitch;
    bi.looking = this.looking;
    bi.time = time;
    bi.dt = step;
    this.body.update(bi, est, this.gait, p);
    const fi = this.faceIn;
    fi.frozen = d.frozen;
    fi.seen = d.seen;
    fi.seeing = d.seeing;
    fi.straining = d.contact !== CONTACT_NONE;
    // The eyes take up whatever turn the head and body have not.
    fi.lookYaw = lookYaw - p.headYaw - p.twist;
    fi.lookPitch = lookPitch - p.headPitch;
    fi.looking = this.looking;
    fi.time = time;
    fi.dt = step;
    this.face.update(fi, p);
    this.limbs.update(d, d.elevation, this.gait, est, b, step, p);
    return p;
  }

  /** The feet, for tests and for anything drawn at them. */
  get feet() {
    return this.gait.feet;
  }
}
