import { HIT_AGENT, HIT_BOX, HIT_NONE, HIT_WALL } from '../agents/agent';
import type { PlayState } from '../match/state';
import { boxKindSize, type HideSeekPhysics } from '../physics';
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
 * The sensor rays of one team's agents. Ray directions are stored as cos
 * and sin so a tick costs one cos and one sin per agent, not per ray, and
 * box rotations and sizes are worked out once per cast instead of once per
 * ray. Scratch arrays grow to the number of boxes, so the Sandbox can hold
 * any mix of cubes and planks.
 */
export class SensorRays {
  readonly count: number;
  readonly range: number;
  readonly angles: Float64Array;
  private readonly physics: HideSeekPhysics;
  private readonly cosA: Float64Array;
  private readonly sinA: Float64Array;
  private boxCos = new Float64Array(4);
  private boxSin = new Float64Array(4);
  private boxHx = new Float64Array(4);
  private boxHz = new Float64Array(4);

  constructor(count: number, range: number, physics: HideSeekPhysics) {
    this.count = count;
    this.range = range;
    this.physics = physics;
    this.angles = Float64Array.from(hideSeekRayAngles(count));
    this.cosA = this.angles.map(Math.cos);
    this.sinA = this.angles.map(Math.sin);
  }

  /**
   * Casts every ray of agent `i` from its center and stores the distances
   * (m, capped at the range) and what each ray hit on the agent. A blind
   * agent, the seeker during prep, gets rays that hit nothing.
   *
   * Rays stop at agents of the other team only. In a 1 v 1 match that is
   * just the opponent; in the Sandbox teammates are passed through, so the
   * "agent on ray" input keeps the meaning it had in training: an opponent.
   */
  cast(s: PlayState, i: number, blind: boolean): void {
    const a = s.agents[i];
    if (blind) {
      a.rays.fill(this.range);
      a.rayHits.fill(HIT_NONE);
      return;
    }
    const walls = s.arena.walls;
    const boxes = s.boxes;
    const boxCount = boxes.length;
    if (this.boxCos.length < boxCount) this.grow(boxCount);
    for (let b = 0; b < boxCount; b++) {
      const size = boxKindSize(this.physics, boxes[b].kind);
      this.boxCos[b] = Math.cos(boxes[b].yaw);
      this.boxSin[b] = Math.sin(boxes[b].yaw);
      this.boxHx[b] = size.length / 2;
      this.boxHz[b] = size.width / 2;
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
      for (let b = 0; b < boxCount; b++) {
        const box = boxes[b];
        const t = rayBox(a.x, a.z, dx, dz, box.x, box.z, this.boxHx[b], this.boxHz[b], this.boxCos[b], this.boxSin[b]);
        if (t < best) {
          best = t;
          hit = HIT_BOX;
        }
      }
      for (let j = 0; j < s.agents.length; j++) {
        const other = s.agents[j];
        if (other.index === a.index) continue;
        const t = rayCircle(a.x, a.z, dx, dz, other.x, other.z, radius);
        if (t < best) {
          best = t;
          hit = HIT_AGENT;
        }
      }
      a.rays[k] = best;
      a.rayHits[k] = hit;
    }
  }

  private grow(n: number): void {
    this.boxCos = new Float64Array(n);
    this.boxSin = new Float64Array(n);
    this.boxHx = new Float64Array(n);
    this.boxHz = new Float64Array(n);
  }
}
