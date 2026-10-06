import { clamp, wrapAngle } from '../core/math';
import type { CarParams } from './car/params';
import { GRAVITY } from './car/params';
import type { RacingCar } from './car/runtime';
import type { Track } from './track/types';

/**
 * A hand-written driver with perfect track knowledge: pure-pursuit steering
 * plus a speed target from the sharpest curve within braking distance. It
 * exists to prove every built-in track is drivable with the car model, and
 * as the "par" lap time in tests. Evolved brains never see it.
 */
export function scriptedDriver(rc: RacingCar, track: Track, p: CarParams, out: Float64Array): void {
  const v = rc.car.speed;
  const lookahead = 5 + 0.45 * v;
  const ahead = (rc.pos.index + Math.round(lookahead / track.spacing)) % track.count;
  const dx = track.cx[ahead] - rc.car.x;
  const dy = track.cy[ahead] - rc.car.y;
  const alpha = wrapAngle(Math.atan2(dy, dx) - rc.car.heading);
  const kappa = (2 * Math.sin(alpha)) / Math.max(1, Math.hypot(dx, dy));
  const fade = v / p.steerFadeSpeed;
  const available = p.steerMax / (1 + fade * fade);
  out[0] = clamp(Math.atan(kappa * p.wheelbase) / available, -1, 1);

  const muG = p.grip * GRAVITY;
  const scan = (v * v) / (2 * p.brake) + 12;
  let worst = 1e-4;
  for (let d = 0; d < scan; d += 2) {
    const i = (rc.pos.index + Math.round(d / track.spacing)) % track.count;
    worst = Math.max(worst, Math.abs(track.curvature[i]));
  }
  const target = Math.min(p.topSpeed, Math.sqrt((0.8 * muG) / worst));
  out[1] = clamp((target - v) * 0.6, -1, 1);
}
