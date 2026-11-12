import { boxesOverlap } from '../../driving/agent/contacts';
import { SUV_SIZE } from '../../driving/car/params';
import type { DrivingEnv } from '../../driving/env';
import { PED_RADIUS } from '../../driving/sensors/lidar';
import { CUT } from '../cut';
import { carAtCamera } from './camera';

/**
 * Ticks the city keeps living after the SUV arrives, before the next trip
 * goes in: the hold, the dip to dark and the two ticks the page may draw
 * behind. The SUV stands where it stopped all that time, in plain view.
 */
export const PARKED_TICKS = CUT.hold + CUT.fadeOut + 2;

/**
 * What goes wrong on screen around the SUV once it has arrived, if
 * anything. The env stops checking contacts for an SUV that is done, and
 * traffic and people cannot see it, so a car could roll through it or a
 * person walk through it while the frame holds on it. A car could also
 * drive through the chase camera, which still hangs behind the SUV.
 */
export function parkedClash(env: DrivingEnv): string | null {
  const car = env.learners[0].car;
  const s = env.world.state;
  const half = SUV_SIZE.length / 2;
  const halfWidth = SUV_SIZE.width / 2;
  for (let i = 0; i < s.carCount; i++) {
    const dx = s.carX[i] - car.x;
    const dy = s.carY[i] - car.y;
    if (dx * dx + dy * dy > 64) continue;
    if (boxesOverlap(car.x, car.y, car.heading, half, halfWidth, s.carX[i], s.carY[i], s.carHeading[i], s.carLength[i] / 2, s.carWidth[i] / 2)) return 'a car drove through it after it arrived';
  }
  const ch = Math.cos(car.heading);
  const sh = Math.sin(car.heading);
  for (let i = 0; i < s.pedCount; i++) {
    const dx = s.pedX[i] - car.x;
    const dy = s.pedY[i] - car.y;
    if (Math.abs(dx * ch + dy * sh) < half + PED_RADIUS && Math.abs(-dx * sh + dy * ch) < halfWidth + PED_RADIUS) return 'a person walked through it after it arrived';
  }
  return carAtCamera(env) ? 'had a car at the camera after it arrived' : null;
}
