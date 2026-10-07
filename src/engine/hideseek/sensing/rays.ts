import { HIT_AGENT, HIT_BOX, HIT_NONE, HIT_RAMP, HIT_WALL } from '../agents/agent';
import type { PlayState } from '../match/state';
import { boxSlice, type BoxKind, type BoxSlice, type HideSeekPhysics } from '../physics';
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
 * any mix of boxes.
 */
export class SensorRays {
  readonly count: number;
  readonly range: number;
  readonly angles: Float64Array;
  private readonly physics: HideSeekPhysics;
  private readonly cosA: Float64Array;
  private readonly sinA: Float64Array;
  /** What of each kind stands taller than ray height, so what a ray can hit (see BoxSlice). */
  private readonly slices: Record<BoxKind, BoxSlice>;
  private boxCos = new Float64Array(5);
  private boxSin = new Float64Array(5);
  private boxX = new Float64Array(5);
  private boxZ = new Float64Array(5);
  private boxHx = new Float64Array(5);
  private boxHz = new Float64Array(5);
  /** Radius of a circle around each slice, so most rays skip a box after a dot product. */
  private boxR = new Float64Array(5);

  constructor(count: number, range: number, physics: HideSeekPhysics) {
    this.count = count;
    this.range = range;
    this.physics = physics;
    this.angles = Float64Array.from(hideSeekRayAngles(count));
    this.cosA = this.angles.map(Math.cos);
    this.sinA = this.angles.map(Math.sin);
    this.slices = { cube: boxSlice(physics, 'cube'), plank: boxSlice(physics, 'plank'), ramp: boxSlice(physics, 'ramp') };
  }

  /**
   * Casts every ray of agent `i` from its center and stores the distances
   * (m, capped at the range) and what each ray hit on the agent. A blind
   * agent, the seeker during prep, gets rays that hit nothing.
   *
   * Rays stop at agents of the other team only. In a 1 v 1 match that is
   * just the opponent; in the Sandbox teammates are passed through, so the
   * "agent on ray" input keeps the meaning it had in training: an opponent.
   * An agent on a ramp or in the air has its collider switched off, so rays
   * pass it too, as Rapier's would.
   *
   * Boxes block at their sight slice: all of a crate, the high end of a
   * ramp. An agent on a ramp casts through the ramp it stands on, and one
   * high enough to see over boxes casts past every box. Walls always block.
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
    const boxCount = a.elevation >= this.physics.climb.seeOverBoxes ? 0 : boxes.length;
    if (this.boxCos.length < boxCount) this.grow(boxCount);
    for (let b = 0; b < boxCount; b++) {
      const slice = this.slices[boxes[b].kind];
      const cos = Math.cos(boxes[b].yaw);
      const sin = Math.sin(boxes[b].yaw);
      this.boxCos[b] = cos;
      this.boxSin[b] = sin;
      this.boxX[b] = boxes[b].x + slice.offset * cos;
      this.boxZ[b] = boxes[b].z - slice.offset * sin;
      this.boxHx[b] = slice.hx;
      this.boxHz[b] = slice.hz;
      this.boxR[b] = Math.sqrt(slice.hx * slice.hx + slice.hz * slice.hz);
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
        if (b === a.climbRamp || this.boxHx[b] === 0) continue;
        // Skip boxes whose bounding circle lies beyond the best hit or off the ray's line.
        const vx = this.boxX[b] - a.x;
        const vz = this.boxZ[b] - a.z;
        const along = vx * dx + vz * dz;
        const r = this.boxR[b];
        if (along - r >= best || vx * vx + vz * vz - along * along > r * r) continue;
        const t = rayBox(a.x, a.z, dx, dz, this.boxX[b], this.boxZ[b], this.boxHx[b], this.boxHz[b], this.boxCos[b], this.boxSin[b]);
        if (t < best) {
          best = t;
          hit = boxes[b].kind === 'ramp' ? HIT_RAMP : HIT_BOX;
        }
      }
      for (let j = 0; j < s.agents.length; j++) {
        const other = s.agents[j];
        if (other.index === a.index || other.climbing || other.airborne) continue;
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
    this.boxX = new Float64Array(n);
    this.boxZ = new Float64Array(n);
    this.boxHx = new Float64Array(n);
    this.boxHz = new Float64Array(n);
    this.boxR = new Float64Array(n);
  }
}
