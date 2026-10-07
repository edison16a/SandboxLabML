import { lerpAngle } from '@/engine/core/math';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import type { CharacterDrive } from '../types';
import { Gait, type GaitInput } from './gait';
import { MotionEstimate } from './kinematics';

const RAMP = DEFAULT_HIDESEEK_PHYSICS.box.ramp;
/** Rise per meter of a ramp's slope. */
const GRADE = RAMP.height / RAMP.length;
/**
 * Longest stretch of simulation time the feet take in one go, s. A faster
 * watch speed or a slow frame covers more than this, so the frame is cut
 * into equal slices along the agent's path and no footfall is skipped.
 */
const SLICE = 1 / 60;
/** Most slices in one frame: 0.1 s of wall time at 8x, far past any watch speed. */
const MAX_SLICES = 48;

/**
 * The motion estimate and the gait, stepped together along the agent's
 * path. Each frame covers the stretch from where the drive put the agent
 * last frame to where it is now; a long stretch (a fast watch speed, a
 * slow frame) is walked in even slices, so the velocity the feet aim with
 * is the real one and every footfall lands. Nothing allocated per frame.
 */
export class Footwork {
  readonly est = new MotionEstimate();
  readonly gait = new Gait();
  private readonly input: GaitInput = { x: 0, z: 0, yaw: 0, ground: 0, vx: 0, vz: 0, speed: 0, yawRate: 0, grade: 0, uphillX: 1, uphillZ: 0, airborne: false, frozen: false, dt: 0 };
  private readonly last = { x: 0, z: 0, yaw: 0, elevation: 0 };

  /** Forgets all motion and stands square at the drive's place, e.g. after a teleport. */
  reset(d: CharacterDrive): void {
    this.est.reset(d.x, d.z, d.yaw, d.elevation);
    this.gait.reset(d.x, d.z, d.yaw, d.elevation);
    this.remember(d);
  }

  /** Walks `step` s of simulation time up to the drive's place. `climb` (0 to 1) is how far the body stands on a ramp slope. */
  update(d: CharacterDrive, climb: number, step: number): void {
    const last = this.last;
    const slices = Math.min(MAX_SLICES, Math.ceil(step / SLICE - 1e-6));
    const dt = step / slices;
    for (let k = 1; k <= slices; k++) {
      const t = k / slices;
      const x = last.x + (d.x - last.x) * t;
      const z = last.z + (d.z - last.z) * t;
      const yaw = lerpAngle(last.yaw, d.yaw, t);
      const ground = last.elevation + (d.elevation - last.elevation) * t;
      this.est.update(x, z, yaw, ground, dt);
      this.stepFeet(x, z, yaw, ground, climb, d, dt);
    }
    this.remember(d);
  }

  private remember(d: CharacterDrive): void {
    this.last.x = d.x;
    this.last.z = d.z;
    this.last.yaw = d.yaw;
    this.last.elevation = d.elevation;
  }

  /** One slice of the gait at (x, z), facing `yaw`, on ground `ground` m up. */
  private stepFeet(x: number, z: number, yaw: number, ground: number, climb: number, d: CharacterDrive, dt: number): void {
    const est = this.est;
    // On a slope the ground rises along the way the agent moves up it.
    const moving = est.speed > 0.2;
    const up = est.rise >= 0 ? 1 : -1;
    const g = this.input;
    g.x = x;
    g.z = z;
    g.yaw = yaw;
    g.ground = ground;
    g.vx = est.vx;
    g.vz = est.vz;
    g.speed = est.speed;
    g.yawRate = est.yawRate;
    g.grade = GRADE * climb;
    g.uphillX = moving ? (up * est.vx) / est.speed : Math.cos(yaw);
    g.uphillZ = moving ? (up * est.vz) / est.speed : -Math.sin(yaw);
    g.airborne = d.airborne;
    g.frozen = d.frozen;
    g.dt = dt;
    this.gait.update(g);
  }
}
