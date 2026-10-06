import { clamp } from '../../core/math';
import type { Rng } from '../../core/rng';
import type { CarParams } from '../car/params';
import type { RacingCar } from '../car/runtime';
import { curvatureAhead } from '../track/buildTrack';
import type { Track } from '../track/types';
import { CURVATURE_FAR, CURVATURE_NEAR, CURVATURE_SCALE, type RacingInputConfig } from './inputConfig';

/**
 * Precomputed ray directions so the hot loop only does a cos and sin per ray
 * per tick, and reads stay in schema order.
 */
export class RacingObserver {
  readonly angles: Float64Array;
  constructor(
    readonly cfg: RacingInputConfig,
    readonly car: CarParams,
    angles: number[],
  ) {
    this.angles = Float64Array.from(angles);
  }

  /** Casts the rays for one car and stores raw distances on it, in meters. */
  castRays(rc: RacingCar, track: Track): void {
    const { x, y, heading } = rc.car;
    const range = this.cfg.rays.range;
    for (let i = 0; i < this.angles.length; i++) {
      const a = heading + this.angles[i];
      rc.rays[i] = track.grid.raycast(x, y, Math.cos(a), Math.sin(a), range);
    }
  }

  /**
   * Writes the built-in inputs, normalized, into `out` and returns how many
   * were written. Noise, when enabled, uses the car's own seeded Rng so a
   * replay sees the same noise as training did.
   */
  write(rc: RacingCar, track: Track, out: Float64Array, noise: Rng | null): number {
    const cfg = this.cfg;
    let n = 0;
    const range = cfg.rays.range;
    for (let i = 0; i < rc.rays.length; i++) out[n++] = rc.rays[i] / range;
    if (cfg.speed) out[n++] = rc.car.speed / this.car.topSpeed;
    if (cfg.headingError) out[n++] = rc.headingError / Math.PI;
    if (cfg.steerAngle) out[n++] = rc.car.steer / this.car.steerMax;
    if (cfg.curvatureNear) out[n++] = clamp(curvatureAhead(track, rc.pos.index, CURVATURE_NEAR) / CURVATURE_SCALE, -1, 1);
    if (cfg.curvatureFar) out[n++] = clamp(curvatureAhead(track, rc.pos.index, CURVATURE_FAR) / CURVATURE_SCALE, -1, 1);
    if (cfg.slip) out[n++] = rc.car.slip;
    if (noise && cfg.noise > 0) for (let i = 0; i < n; i++) out[i] += noise.gaussian() * cfg.noise;
    return n;
  }
}
