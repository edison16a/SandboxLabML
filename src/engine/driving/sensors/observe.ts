import { clamp } from '../../core/math';
import type { Rng } from '../../core/rng';
import type { DrivingLearner } from '../agent/learner';
import type { CarParams } from '../car/params';
import { LANE_WIDTH } from '../city/dimensions';
import { LIGHT_RED, LIGHT_YELLOW } from '../signals/plan';
import { CURVE_SCALE, DEST_RANGE, GAP_RANGE, PED_LATERAL_SCALE, PED_RANGE, REL_SPEED_SCALE, STOP_RANGE, type DrivingInputConfig } from './inputConfig';

/** Normalized light input: green or no signal 0, yellow 0.5, red 1. */
export function lightInput(light: number): number {
  return light === LIGHT_RED ? 1 : light === LIGHT_YELLOW ? 0.5 : 0;
}

/**
 * Writes a learner's built in inputs, normalized, into `out` in schema
 * order, and returns how many were written. Lidar and perception must
 * already be up to date on the learner. Noise, when enabled, uses the
 * learner's own seeded Rng so a replay sees the same noise.
 */
export function writeObservation(l: DrivingLearner, cfg: DrivingInputConfig, car: CarParams, out: Float64Array, noise: Rng | null): number {
  let n = 0;
  const range = cfg.lidar.range;
  for (let i = 0; i < l.lidar.length; i++) out[n++] = l.lidar[i] / range;
  if (cfg.lidarKinds) for (let i = 0; i < l.lidarKind.length; i++) out[n++] = l.lidarKind[i] / 3;
  const s = l.sense;
  if (cfg.lane) {
    out[n++] = clamp(l.lateral / LANE_WIDTH, -1, 1);
    out[n++] = clamp(l.headingError / (Math.PI / 2), -1, 1);
    out[n++] = clamp(l.aim / (Math.PI / 2), -1, 1);
    out[n++] = clamp(l.curveNear / CURVE_SCALE, -1, 1);
    out[n++] = clamp(l.curveFar / CURVE_SCALE, -1, 1);
  }
  if (cfg.route) {
    out[n++] = l.nextTurn;
    out[n++] = clamp(l.turnDistance / STOP_RANGE, 0, 1);
    out[n++] = clamp(l.remaining / DEST_RANGE, -1, 1);
  }
  if (cfg.light) {
    out[n++] = lightInput(s.light);
    out[n++] = s.light >= 0 ? clamp(s.lightDistance / STOP_RANGE, 0, 1) : 1;
  }
  if (cfg.carAhead) {
    out[n++] = clamp(s.gap / GAP_RANGE, 0, 1);
    out[n++] = s.car >= 0 ? clamp(s.relSpeed / REL_SPEED_SCALE, -1, 1) : 0;
  }
  if (cfg.pedestrian) {
    out[n++] = clamp(s.pedDistance / PED_RANGE, 0, 1);
    out[n++] = s.ped >= 0 ? clamp(s.pedLateral / PED_LATERAL_SCALE, -1, 1) : 0;
  }
  if (cfg.speed) {
    out[n++] = l.car.speed / car.topSpeed;
    out[n++] = l.speedLimit / car.topSpeed;
  }
  if (noise && cfg.noise > 0) for (let i = 0; i < n; i++) out[i] += noise.gaussian() * cfg.noise;
  return n;
}
