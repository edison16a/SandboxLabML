import { HIT_AGENT, HIT_BOX, HIT_NONE, HIT_WALL } from '../agents/agent';
import type { MatchState } from '../match/state';
import { BOX_COUNT, boxSize, type HideSeekPhysics } from '../physics';
import { rayAabb, rayBox, rayCircle } from './raycast2d';

/**
 * Ray directions relative to the agent's facing, in input order: evenly
 * around the full circle, starting straight ahead and turning left.
 * Angles past half a turn are written as negative (to the right), so every
 * angle lies in (-PI, PI].
 */
export function hideSeekRayAngles(count: number): number[] {
  return Array.from({ length: count }, (_, i) => {
    const a = (2 * Math.PI * i) / count;
    return a > Math.PI ? a - 2 * Math.PI : a;
  });
}

/**
 * The sensor rays of one agent. Ray directions are stored as cos and sin
 * so a tick costs one cos and one sin per agent, not per ray, and box
 * rotations are computed once per cast instead of once per ray.
 */
export class SensorRays {
  readonly count: number;
  readonly range: number;
  readonly angles: Float64Array;
  private readonly cosA: Float64Array;
  private readonly sinA: Float64Array;
  private readonly boxCos = new Float64Array(BOX_COUNT);
  private readonly boxSin = new Float64Array(BOX_COUNT);
  private readonly boxHx = new Float64Array(BOX_COUNT);
  private readonly boxHz = new Float64Array(BOX_COUNT);

  constructor(count: number, range: number, physics: HideSeekPhysics) {
    this.count = count;
    this.range = range;
    this.angles = Float64Array.from(hideSeekRayAngles(count));
    this.cosA = this.angles.map(Math.cos);
    this.sinA = this.angles.map(Math.sin);
    for (let i = 0; i < BOX_COUNT; i++) {
      const size = boxSize(physics, i);
      this.boxHx[i] = size.length / 2;
      this.boxHz[i] = size.width / 2;
    }
  }

  /**
   * Casts every ray of agent `i` from its center and stores the distances
   * (m, capped at the range) and what each ray hit on the agent. A blind
   * agent, the seeker during prep, gets rays that hit nothing.
   */
  cast(s: MatchState, i: number, blind: boolean): void {
    const a = s.agents[i];
    if (blind) {
      a.rays.fill(this.range);
      a.rayHits.fill(HIT_NONE);
      return;
    }
    const other = s.agents[1 - i];
    const walls = s.arena.walls;
    const boxes = s.boxes;
    for (let b = 0; b < BOX_COUNT; b++) {
      this.boxCos[b] = Math.cos(boxes[b].yaw);
      this.boxSin[b] = Math.sin(boxes[b].yaw);
    }
    const cy = Math.cos(a.yaw);
    const sy = Math.sin(a.yaw);
    const radius = s.physics.agent.radius;
    for (let k = 0; k < this.count; k++) {
      // Facing is (cos, -sin) of the angle, so a ray at yaw + angle points this way.
      const dx = cy * this.cosA[k] - sy * this.sinA[k];
      const dz = -(sy * this.cosA[k] + cy * this.sinA[k]);
      let best = this.range;
      let hit = HIT_NONE;
      for (let w = 0; w < walls.length; w++) {
        const r = walls[w];
        const t = rayAabb(a.x, a.z, dx, dz, r.x, r.z, r.hx, r.hz);
        if (t < best) {
          best = t;
          hit = HIT_WALL;
        }
      }
      for (let b = 0; b < BOX_COUNT; b++) {
        const box = boxes[b];
        const t = rayBox(a.x, a.z, dx, dz, box.x, box.z, this.boxHx[b], this.boxHz[b], this.boxCos[b], this.boxSin[b]);
        if (t < best) {
          best = t;
          hit = HIT_BOX;
        }
      }
      const t = rayCircle(a.x, a.z, dx, dz, other.x, other.z, radius);
      if (t < best) {
        best = t;
        hit = HIT_AGENT;
      }
      a.rays[k] = best;
      a.rayHits[k] = hit;
    }
  }
}
