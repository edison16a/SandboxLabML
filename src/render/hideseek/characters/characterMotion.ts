import { angleDelta, clamp } from '@/engine/core/math';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import type { CharacterDrive } from './types';

/** The faces a character can pull. One shows at a time. */
export type Expression = 'happy' | 'sleep' | 'startled' | 'keen';

/**
 * Everything the character mesh needs to pose itself, recomputed every
 * frame from the drive. Angles in radians, lengths in meters.
 */
export interface CharacterPose {
  /** Body lift off the feet's elevation: idle breathing, the waddle, the startle hop and the treads under a climber. */
  bob: number;
  /** Vertical squash, 1 for none. A step or a landing flattens it a little; it curls up rising off a ramp lip. */
  squash: number;
  /** Forward pitch into the direction of travel, negative when backing up. On a slope it stands square to it. */
  lean: number;
  /** Sideways lean into a turn plus the rock of each step. */
  roll: number;
  /** Head turn ahead of the body while turning. */
  headYaw: number;
  /** Head nod, positive looks down. */
  headPitch: number;
  /** Arm swing about the shoulder, the left arm forward when positive. */
  swing: number;
  /** 0 arms down, 1 arms straight forward, for carrying a box. */
  reach: number;
  /** 0 arms down, 1 hands up by the head, for the startle. */
  raise: number;
  /** 0 on the ground, 1 in the air off a ramp lip: arms thrown up overhead. */
  leap: number;
  /** 0 asleep, 1 awake: dims the glow and shows the sleeping face. */
  awake: number;
  /** Glow strength on top of awake: up when seen or seeing. */
  glow: number;
  expression: Expression;
  /** 1 eyes open, near 0 mid blink. Only the keen face blinks, the others have closed eyes anyway. */
  blink: number;
}

/** Travel per waddle cycle, m: two steps, one rock each way. */
const STRIDE = 1.1;
/** Speed at which the arms swing their widest, m/s. */
const FULL_SWING_SPEED = 3;
/** Startle hop: how high and how long, m and s. */
const HOP_HEIGHT = 0.14;
const HOP_SECONDS = 0.32;
/** A climber stands square to the ramp's slope, so it leans this far into it, rad. The grid crowds lean the same. */
const RAMP = DEFAULT_HIDESEEK_PHYSICS.box.ramp;
export const SLOPE_LEAN = Math.atan2(RAMP.height, RAMP.length) * 0.92;
/** A climber stands this far above the slope, m: on its grip treads. */
export const TREAD_LIFT = 0.03;
/** Steps on a slope are this share of a floor stride: quick and short. */
const CLIMB_STRIDE = 0.45;
/** Landing squash: how deep (share of height) and how long (s). */
const LAND_SQUASH = 0.2;
const LAND_SECONDS = 0.3;

/** Moves `v` toward `target` at a rate that does not depend on frame rate. */
function approach(v: number, target: number, rate: number, dt: number): number {
  return v + (target - v) * (1 - Math.exp(-rate * dt));
}

/**
 * The animation brain of one character. It keeps a little state (smoothed
 * speed, waddle phase, hop timer) and turns the drive into a pose. Pure
 * math with no three.js, so it is cheap to run for many characters and easy
 * to test.
 */
export class CharacterMotion {
  readonly pose: CharacterPose = { bob: 0, squash: 1, lean: 0, roll: 0, headYaw: 0, headPitch: 0, swing: 0, reach: 0, raise: 0, leap: 0, awake: 1, glow: 1, expression: 'happy', blink: 1 };
  private lastX = 0;
  private lastZ = 0;
  private lastYaw = 0;
  private forward = 0;
  private speed = 0;
  private turn = 0;
  private phase = 0;
  private hop = HOP_SECONDS;
  private wasSeen = false;
  private lastElevation = 0;
  /** 0 on the floor, 1 on a slope, and 0 on the ground, 1 in the air: blended so poses ease in and out. */
  private climb = 0;
  private air = 0;
  private rise = 0;
  private land = LAND_SECONDS;
  private wasAirborne = false;
  private nextBlink = 2;
  private readonly seed: number;

  /** `seed` staggers idle motion so a crowd does not breathe in step. */
  constructor(seed = 0) {
    this.seed = seed;
    this.phase = seed * 1.7;
  }

  /** Advances by `dt` seconds of wall time at clock `time` and returns the pose, which it owns. */
  update(d: CharacterDrive, dt: number, time: number): CharacterPose {
    const step = clamp(dt, 1e-4, 0.1);
    const p = this.pose;
    if (d.teleported) {
      this.lastX = d.x;
      this.lastZ = d.z;
      this.lastYaw = d.yaw;
      this.lastElevation = d.elevation;
      this.speed = this.forward = this.turn = this.rise = 0;
      d.teleported = false;
    }
    const vx = (d.x - this.lastX) / step;
    const vz = (d.z - this.lastZ) / step;
    const yawRate = angleDelta(this.lastYaw, d.yaw) / step;
    this.rise = approach(this.rise, clamp((d.elevation - this.lastElevation) / step, -8, 8), 14, step);
    this.lastX = d.x;
    this.lastZ = d.z;
    this.lastYaw = d.yaw;
    this.lastElevation = d.elevation;
    // Forward is +x turned by yaw, which points along (cos, -sin) on the floor.
    const along = vx * Math.cos(d.yaw) - vz * Math.sin(d.yaw);
    this.speed = approach(this.speed, Math.min(5, Math.hypot(vx, vz)), 10, step);
    this.forward = approach(this.forward, clamp(along, -5, 5), 10, step);
    this.turn = approach(this.turn, clamp(yawRate, -6, 6), 8, step);

    this.climb = approach(this.climb, d.climbing ? 1 : 0, 12, step);
    this.air = approach(this.air, d.airborne ? 1 : 0, 16, step);
    if (this.wasAirborne && !d.airborne) this.land = 0;
    this.wasAirborne = d.airborne;
    this.land = Math.min(LAND_SECONDS, this.land + step);
    const landing = this.land < LAND_SECONDS ? Math.sin((this.land / LAND_SECONDS) * Math.PI) : 0;
    // Curled up while rising, a little stretched while falling toward the landing.
    const tuck = this.air * clamp(this.rise / 3, 0, 1);
    const stretch = this.air * clamp(-this.rise / 4, 0, 1);
    const grounded = 1 - this.air;

    const moving = clamp(this.speed / FULL_SWING_SPEED, 0, 1);
    this.phase += (this.speed / (STRIDE * (1 - (1 - CLIMB_STRIDE) * this.climb))) * Math.PI * 2 * step;
    const awake = d.frozen ? 0 : 1;
    p.awake = approach(p.awake, awake, d.frozen ? 2.5 : 6, step);

    // Startle: a hop the moment the hider is first seen.
    if (d.seen && !this.wasSeen) this.hop = 0;
    this.wasSeen = d.seen;
    this.hop = Math.min(HOP_SECONDS, this.hop + step);
    const hopT = this.hop / HOP_SECONDS;
    const hop = hopT < 1 ? Math.sin(hopT * Math.PI) * HOP_HEIGHT : 0;

    const idle = Math.sin(time * 2.1 + this.seed * 2.3);
    const breathe = Math.sin(time * 1.15 + this.seed);
    const waddle = Math.abs(Math.sin(this.phase));
    // Standing still the base stays on the floor and the body breathes by squashing; walking lifts it a little each step, a slope's short steps less.
    const steps = moving * waddle * (0.05 - 0.025 * this.climb) * grounded;
    p.bob = (1 - moving) * (0.006 + idle * 0.006) * p.awake + steps + hop + TREAD_LIFT * this.climb;
    p.squash = 1 + (1 - moving) * idle * 0.018 * p.awake - moving * (1 - waddle) * 0.04 * grounded + (1 - p.awake) * (breathe * 0.015 - 0.03) - 0.14 * tuck + 0.06 * stretch - LAND_SQUASH * landing;
    const floorLean = clamp(this.forward * 0.075, -0.18, 0.26) + (1 - p.awake) * 0.05;
    // On a slope the body stands square to it; in the air it rights itself, diving a touch forward.
    p.lean = (floorLean * (1 - this.climb) + SLOPE_LEAN * this.climb) * grounded + 0.12 * this.air;
    p.roll = (clamp(-this.turn * this.speed * 0.035, -0.22, 0.22) + Math.cos(this.phase) * 0.05 * moving) * grounded;
    p.headYaw = clamp(this.turn * 0.09, -0.35, 0.35);
    p.headPitch = (1 - p.awake) * 0.32 - (d.seen ? 0.08 : 0) - 0.14 * this.climb;
    p.swing = Math.sin(this.phase) * (0.75 + 0.2 * this.climb) * moving * (1 - p.reach) * grounded;
    p.reach = approach(p.reach, d.holding && !d.frozen ? 1 : 0, 9, step);
    p.raise = approach(p.raise, d.seen && !d.holding ? 1 : 0, 10, step);
    p.leap = this.air;
    p.glow = approach(p.glow, d.seen ? 1.6 + 0.5 * Math.sin(time * 12) : d.seeing ? 1.45 : 1, 8, step);
    p.expression = d.frozen ? 'sleep' : d.seen ? 'startled' : d.seeing ? 'keen' : 'happy';
    p.blink = this.blinkAt(time);
    return p;
  }

  /** Eyes close for a tenth of a second every few seconds, at a rhythm that drifts a little. */
  private blinkAt(time: number): number {
    if (time > this.nextBlink + 0.12) this.nextBlink = time + 2.6 + ((Math.sin(time * 7.3 + this.seed * 5.1) + 1) * 1.4);
    const t = time - this.nextBlink;
    return t >= 0 && t < 0.12 ? Math.abs(t - 0.06) / 0.06 : 1;
  }
}
