import { angleDelta, clamp } from '@/engine/core/math';
import type { CharacterDrive } from './types';

/** The faces a character can pull. One shows at a time. */
export type Expression = 'happy' | 'sleep' | 'startled' | 'keen';

/**
 * Everything the character mesh needs to pose itself, recomputed every
 * frame from the drive. Angles in radians, lengths in meters.
 */
export interface CharacterPose {
  /** Body lift off the floor: idle breathing, the waddle and the startle hop. */
  bob: number;
  /** Vertical squash, 1 for none. A landing or a step flattens it a little. */
  squash: number;
  /** Forward pitch into the direction of travel, negative when backing up. */
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
  readonly pose: CharacterPose = { bob: 0, squash: 1, lean: 0, roll: 0, headYaw: 0, headPitch: 0, swing: 0, reach: 0, raise: 0, awake: 1, glow: 1, expression: 'happy', blink: 1 };
  private lastX = 0;
  private lastZ = 0;
  private lastYaw = 0;
  private forward = 0;
  private speed = 0;
  private turn = 0;
  private phase = 0;
  private hop = HOP_SECONDS;
  private wasSeen = false;
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
      this.speed = this.forward = this.turn = 0;
      d.teleported = false;
    }
    const vx = (d.x - this.lastX) / step;
    const vz = (d.z - this.lastZ) / step;
    const yawRate = angleDelta(this.lastYaw, d.yaw) / step;
    this.lastX = d.x;
    this.lastZ = d.z;
    this.lastYaw = d.yaw;
    // Forward is +x turned by yaw, which points along (cos, -sin) on the floor.
    const along = vx * Math.cos(d.yaw) - vz * Math.sin(d.yaw);
    this.speed = approach(this.speed, Math.min(5, Math.hypot(vx, vz)), 10, step);
    this.forward = approach(this.forward, clamp(along, -5, 5), 10, step);
    this.turn = approach(this.turn, clamp(yawRate, -6, 6), 8, step);

    const moving = clamp(this.speed / FULL_SWING_SPEED, 0, 1);
    this.phase += (this.speed / STRIDE) * Math.PI * 2 * step;
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
    p.bob = (1 - moving) * (0.018 + idle * 0.016) * p.awake + moving * waddle * 0.05 + (1 - p.awake) * breathe * 0.008 + hop;
    p.squash = 1 + (1 - moving) * idle * 0.012 * p.awake - moving * (1 - waddle) * 0.04 + (1 - p.awake) * (breathe * 0.012 - 0.03);
    p.lean = clamp(this.forward * 0.075, -0.18, 0.26) + (1 - p.awake) * 0.05;
    p.roll = clamp(-this.turn * this.speed * 0.035, -0.22, 0.22) + Math.cos(this.phase) * 0.05 * moving;
    p.headYaw = clamp(this.turn * 0.09, -0.35, 0.35);
    p.headPitch = (1 - p.awake) * 0.32 - (d.seen ? 0.08 : 0);
    p.swing = Math.sin(this.phase) * 0.75 * moving * (1 - p.reach);
    p.reach = approach(p.reach, d.holding && !d.frozen ? 1 : 0, 9, step);
    p.raise = approach(p.raise, d.seen && !d.holding ? 1 : 0, 10, step);
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
