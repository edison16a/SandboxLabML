import { lerpAngle } from '@/engine/core/math';
import { RIG } from '../rig/proportions';
import { copyVec, setVec, vec3, type Vec3 } from './vec';

/** One foot: planted on the ground and still, or in the air on its way to the next footfall. */
export interface Foot {
  /** World position of the sole under the ankle; y is the ground height there. */
  pos: Vec3;
  /** World heading of the foot. A planted foot keeps its own heading while the body turns over it. */
  yaw: number;
  /** Toe up positive, rad: the heel rolls off before a step and the toe rises before the next heel strike. */
  pitch: number;
  planted: boolean;
  /** Where the current swing started. */
  from: Vec3;
  fromYaw: number;
  /** Swing progress, 0 at lift off to 1 at the footfall. */
  swing: number;
}

/** What the gait needs to know about the body this frame. */
export interface GaitInput {
  x: number;
  z: number;
  yaw: number;
  /** Ground height under the body, m. */
  ground: number;
  vx: number;
  vz: number;
  speed: number;
  yawRate: number;
  /** Rise of the ground per meter along (uphillX, uphillZ): a ramp's slope while climbing, else 0. */
  grade: number;
  uphillX: number;
  uphillZ: number;
  /** Feet follow the body instead of the ground: in the air, or asleep. */
  airborne: boolean;
  frozen: boolean;
  dt: number;
}

/** Half the distance between the feet at a stand and at a full run, m. */
const STANCE = { stand: 0.1, run: 0.065 };
/** A foot further than this from where it belongs has been left behind (a shove, a lost frame) and is put back, m. */
const LOST = 0.75;
/** Below this effective speed the feet only step to tidy up the stance, m/s. */
const IDLE = 0.08;
/** Furthest a planted foot may trail from under its hip before the leg must step, m. */
const REACH = 0.3;

/** Cycles per second at an effective speed: quicker steps as it speeds up, like a small person breaking into a run. */
export function cadence(speed: number): number {
  return speed < IDLE ? 1.5 : Math.min(3.4, Math.max(1.4, 1.15 + 0.62 * speed));
}

/** Share of a cycle each foot is on the ground: over half when walking (both feet down for a moment), under half when running (both off). */
export function dutyFactor(run: number): number {
  return 0.62 - 0.24 * run;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Footfalls that never slide. Each foot is planted at a point in the world
 * and stays there while the body passes over it, then swings in an arc to
 * where the body will be halfway through its next stance, predicted from
 * the real velocity and turn rate. The rhythm comes from a phase that
 * speeds up with speed, so the cadence always matches how fast the agent
 * really moves; turning on the spot makes the feet step round, and coming
 * to rest takes a step or two to square the stance. Pure math.
 */
export class Gait {
  readonly feet: [Foot, Foot] = [0, 1].map(() => ({ pos: vec3(), yaw: 0, pitch: 0, planted: true, from: vec3(), fromYaw: 0, swing: 0 })) as [Foot, Foot];
  /** Cycle phase, 0 to 1. The left foot lifts at the duty factor, the right half a cycle later. */
  phase = 0;
  /** 0 walking to 1 running, from the speed. */
  run = 0;
  /** Stance progress of each foot, 0 at heel strike to 1 at lift off, or -1 off the ground. */
  readonly stance = [0, 0];
  private readonly home = { x: 0, z: 0, y: 0, yaw: 0 };

  /** Both feet planted square under the body. */
  reset(x: number, z: number, yaw: number, ground: number): void {
    this.phase = 0;
    for (let side = 0; side < 2; side++) {
      const f = this.feet[side];
      this.homeOf(side, x, z, yaw, ground, 0, 0, 0, 0, 0, 0, 0);
      setVec(f.pos, this.home.x, ground, this.home.z);
      f.yaw = yaw;
      f.pitch = 0;
      f.planted = true;
      f.swing = 0;
    }
  }

  update(g: GaitInput): void {
    this.run = Math.min(1, Math.max(0, (g.speed - 1.4) / 1.4));
    if (g.airborne || g.frozen) return this.hold(g);
    const effective = g.speed + 0.22 * Math.abs(g.yawRate);
    const f = cadence(effective);
    const duty = dutyFactor(this.run);
    if (effective < IDLE && this.settled(g)) return;
    // A planted foot left too far behind (a burst of speed) hurries the stride: the swinging foot lands sooner so the trailing one can go.
    const hurry = (this.feet[0].planted && this.overReached(0, g)) || (this.feet[1].planted && this.overReached(1, g)) ? 2.5 : 1;
    this.phase = (this.phase + f * hurry * g.dt) % 1;
    const moving = effective >= IDLE ? 1 : 0;
    for (let side = 0; side < 2; side++) {
      const foot = this.feet[side];
      let p = (this.phase - side * 0.5 + 1) % 1;
      // A leg stretched as far as it goes behind the hip has to step now, whatever the rhythm says: the first step off a standstill, a sudden burst.
      if (p < duty && foot.planted && this.feet[1 - side].planted && this.overReached(side, g)) {
        this.phase = (side * 0.5 + duty + 1e-4) % 1;
        p = duty + 1e-4;
      }
      if (p < duty) {
        if (!foot.planted) this.touchDown(foot, g);
        this.stance[side] = p / duty;
        foot.pitch = -0.4 * moving * Math.min(1, g.speed / 2) * smooth(Math.max(0, (p / duty - 0.7) / 0.3));
        if (Math.hypot(foot.pos.x - g.x, foot.pos.z - g.z) > LOST) this.reset(g.x, g.z, g.yaw, g.ground);
        continue;
      }
      if (foot.planted) {
        foot.planted = false;
        copyVec(foot.from, foot.pos);
        foot.fromYaw = foot.yaw;
      }
      this.stance[side] = -1;
      const u = (p - duty) / (1 - duty);
      foot.swing = u;
      // Aim for where the hip will be halfway through the coming stance.
      const lead = moving * ((1 - u) * ((1 - duty) / f) + (duty / f) * 0.5);
      this.homeOf(side, g.x, g.z, g.yaw, g.ground, g.vx, g.vz, g.yawRate, lead, g.grade, g.uphillX, g.uphillZ);
      const e = smooth(u);
      const lift = 0.035 + 0.035 * Math.min(1, g.speed / 2) + 0.03 * this.run;
      foot.pos.x = foot.from.x + (this.home.x - foot.from.x) * e;
      foot.pos.z = foot.from.z + (this.home.z - foot.from.z) * e;
      foot.pos.y = foot.from.y + (this.home.y - foot.from.y) * u + lift * Math.sin(Math.PI * u);
      foot.yaw = lerpAngle(foot.fromYaw, this.home.yaw, e);
      foot.pitch = moving * (u < 0.5 ? -0.5 * Math.sin(Math.PI * u * 2) : 0.28 * Math.sin(Math.PI * (u - 0.5) * 2)) * Math.min(1, 0.4 + g.speed / 2);
    }
  }

  /** Whether planted foot `side` has fallen further from under its hip than a leg can reach. */
  private overReached(side: number, g: GaitInput): boolean {
    const w = side === 0 ? -RIG.hipZ : RIG.hipZ;
    const foot = this.feet[side];
    return Math.hypot(foot.pos.x - (g.x + Math.sin(g.yaw) * w), foot.pos.z - (g.z + Math.cos(g.yaw) * w)) > REACH;
  }

  /** A footfall: the foot stops dead where it is, flat on the ground under it. */
  private touchDown(foot: Foot, g: GaitInput): void {
    foot.planted = true;
    foot.swing = 0;
    foot.pitch = 0;
    foot.pos.y = g.ground + g.grade * ((foot.pos.x - g.x) * g.uphillX + (foot.pos.z - g.z) * g.uphillZ);
  }

  /** Whether both feet stand where an idle body wants them, so the gait can rest. */
  private settled(g: GaitInput): boolean {
    for (let side = 0; side < 2; side++) {
      const foot = this.feet[side];
      if (!foot.planted) return false;
      this.homeOf(side, g.x, g.z, g.yaw, g.ground, 0, 0, 0, 0, g.grade, g.uphillX, g.uphillZ);
      if (Math.hypot(foot.pos.x - this.home.x, foot.pos.z - this.home.z) > 0.07 || Math.abs(Math.atan2(Math.sin(foot.yaw - g.yaw), Math.cos(foot.yaw - g.yaw))) > 0.4) return false;
    }
    this.stance[0] = this.stance[1] = 0.5;
    return true;
  }

  /** In the air or asleep the feet are not on the ground; the poser tucks them. On landing they plant where they are. */
  private hold(g: GaitInput): void {
    for (let side = 0; side < 2; side++) {
      const foot = this.feet[side];
      this.stance[side] = g.frozen ? 0.5 : -1;
      if (g.frozen) continue;
      foot.planted = false;
      // The next swing starts from wherever the tucked foot is when the body lands.
      copyVec(foot.from, foot.pos);
      foot.fromYaw = g.yaw;
      foot.pitch = 0;
      foot.yaw = g.yaw;
    }
    this.phase = 0;
  }

  /**
   * Where foot `side` belongs: under its hip, `lead` seconds ahead along
   * the velocity and the turn, at the ground height there, written into
   * this.home.
   */
  private homeOf(side: number, x: number, z: number, yaw: number, ground: number, vx: number, vz: number, yawRate: number, lead: number, grade: number, ux: number, uz: number): void {
    const futureYaw = yaw + yawRate * lead;
    const w = (side === 0 ? -1 : 1) * (STANCE.stand + (STANCE.run - STANCE.stand) * this.run);
    const hx = x + vx * lead + Math.sin(futureYaw) * w;
    const hz = z + vz * lead + Math.cos(futureYaw) * w;
    this.home.x = hx;
    this.home.z = hz;
    this.home.y = ground + grade * ((hx - x) * ux + (hz - z) * uz);
    this.home.yaw = futureYaw;
  }
}

/** Puts a foot that was off the ground (a landing, waking up) down where it now is. */
export function plantFoot(foot: Foot, x: number, y: number, z: number, yaw: number): void {
  setVec(foot.pos, x, y, z);
  foot.yaw = yaw;
  foot.pitch = 0;
  foot.planted = true;
  foot.swing = 0;
}
