import { MAX_PEDS, MAX_TRAFFIC, type WorldState } from '../world/state';

/** How far around a learner anything can matter this tick, m: the longest sensor plus a car length. */
export const NEARBY_RADIUS = 58;

/**
 * The cars and people near one learner, gathered in a single pass over the
 * world. Lidar, perception and the collision checks then look only at
 * these few instead of the whole city, which is most of the per learner
 * cost at rush hour. Reused for every learner, so nothing is allocated.
 */
export class Nearby {
  readonly cars = new Int32Array(MAX_TRAFFIC);
  readonly peds = new Int32Array(MAX_PEDS);
  carCount = 0;
  pedCount = 0;

  gather(world: WorldState, x: number, y: number, radius = NEARBY_RADIUS): this {
    const r2 = radius * radius;
    let n = 0;
    for (let i = 0; i < world.carCount; i++) {
      const dx = world.carX[i] - x;
      const dy = world.carY[i] - y;
      if (dx * dx + dy * dy < r2) this.cars[n++] = i;
    }
    this.carCount = n;
    n = 0;
    for (let i = 0; i < world.pedCount; i++) {
      const dx = world.pedX[i] - x;
      const dy = world.pedY[i] - y;
      if (dx * dx + dy * dy < r2) this.peds[n++] = i;
    }
    this.pedCount = n;
    return this;
  }
}
