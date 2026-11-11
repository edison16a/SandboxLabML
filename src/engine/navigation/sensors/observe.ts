import { clamp, wrapAngle } from '../../core/math';
import type { Rng } from '../../core/rng';
import { RAY_MOVER, RAY_SPIKES, type NavAgent } from '../agent';
import type { Course } from '../course/build';
import { sampleFlow } from '../course/fieldSample';
import { MAX_COURSE_LENGTH } from '../course/types';
import type { NavigationParams } from '../params';
import { navRayAngles, type NavigationInputConfig } from './inputConfig';
import { castRay, type RayHit, type RayWorld } from './raycast';

const hit: RayHit = { distance: 0, kind: 0 };
const flow = { x: 0, z: 0 };

/** Bearing of world direction (dx, dz) seen from heading `yaw`, left positive, rad. */
export function bearingOf(dx: number, dz: number, yaw: number): number {
  return wrapAngle(Math.atan2(-dz, dx) - yaw);
}

/**
 * Builds a Navigation brain's inputs. Ray directions are stored as cos and
 * sin, so a tick costs one cos and one sin per agent rather than per ray,
 * and every value is written in schema order.
 */
export class NavigationObserver {
  readonly angles: Float64Array;
  private readonly cos: Float64Array;
  private readonly sin: Float64Array;

  constructor(
    readonly cfg: NavigationInputConfig,
    readonly params: NavigationParams,
  ) {
    this.angles = Float64Array.from(navRayAngles(cfg.rays.count, cfg.rays.fov));
    this.cos = this.angles.map(Math.cos);
    this.sin = this.angles.map(Math.sin);
  }

  /** Casts the agent's rays and stores raw distances (m) and hit kinds on it. */
  castRays(a: NavAgent, w: RayWorld): void {
    const cy = Math.cos(a.yaw);
    const sy = Math.sin(a.yaw);
    const range = this.cfg.rays.range;
    for (let i = 0; i < this.angles.length; i++) {
      // cos and sin of yaw + angle; the world direction is (cos, -sin).
      const c = cy * this.cos[i] - sy * this.sin[i];
      const s = sy * this.cos[i] + cy * this.sin[i];
      castRay(w, a.x, a.z, c, -s, range, hit);
      a.rays[i] = hit.distance;
      a.rayHits[i] = hit.kind;
    }
  }

  /**
   * Writes the built in inputs, normalized, into `out` and returns how many
   * were written. Noise, when on, uses the agent's own seeded Rng, so a
   * replay sees the same noise training did.
   */
  write(a: NavAgent, course: Course, out: Float64Array, noise: Rng | null): number {
    const cfg = this.cfg;
    const range = cfg.rays.range;
    const count = a.rays.length;
    let n = 0;
    for (let i = 0; i < count; i++) out[n++] = a.rays[i] / range;
    if (cfg.rays.hitTypes) {
      for (let i = 0; i < count; i++) out[n++] = a.rayHits[i] === RAY_SPIKES ? 1 : 0;
      for (let i = 0; i < count; i++) out[n++] = a.rayHits[i] === RAY_MOVER ? 1 : 0;
    }
    if (cfg.goal) {
      out[n++] = wrapAngle(-a.yaw) / Math.PI;
      out[n++] = clamp(a.distanceLeft / MAX_COURSE_LENGTH, 0, 1.5);
    }
    if (cfg.pathHint) {
      sampleFlow(course.field, a.x, a.z, flow);
      out[n++] = bearingOf(flow.x, flow.z, a.yaw) / Math.PI;
    }
    if (cfg.velocity) {
      const cy = Math.cos(a.yaw);
      const sy = Math.sin(a.yaw);
      const top = this.params.agent.maxSpeed;
      out[n++] = (a.vx * cy - a.vz * sy) / top;
      out[n++] = (-a.vx * sy - a.vz * cy) / top;
    }
    if (cfg.time) out[n++] = clamp(1 - a.time / course.timeLimit, 0, 1);
    if (noise && cfg.noise > 0) for (let i = 0; i < n; i++) out[i] += noise.gaussian() * cfg.noise;
    return n;
  }
}
