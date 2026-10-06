import { SIM_DT } from '../../racing/car/params';
import { rayAngles } from '../../racing/sensors/inputConfig';
import type { Track } from '../../racing/track/types';
import { startTestDrive, TEST_DRIVE_SECONDS } from '../checks/testRun';
import type { PreparedRacing } from '../prepare';
import type { DrivePreview } from './types';

/** One road line as x, y pairs. */
function polyline(xs: Float64Array, ys: Float64Array): Float32Array {
  const out = new Float32Array(xs.length * 2);
  for (let i = 0; i < xs.length; i++) {
    out[2 * i] = xs[i];
    out[2 * i + 1] = ys[i];
  }
  return out;
}

function road(track: Track): Pick<DrivePreview, 'center' | 'left' | 'right' | 'width' | 'bounds'> {
  return {
    center: polyline(track.cx, track.cy),
    left: polyline(track.leftX, track.leftY),
    right: polyline(track.rightX, track.rightY),
    width: track.halfWidth * 2,
    bounds: { ...track.bounds },
  };
}

/**
 * Records the lesson test drive (see startTestDrive) tick by tick for the
 * preview: the car's pose, where its rays hit and its total reward. It is
 * the drive a check runs, so what the learner watches is what gets
 * checked. Takes a few milliseconds, since a car alone is cheap.
 */
export function recordTestDrive(prepared: PreparedRacing): DrivePreview {
  const env = startTestDrive(prepared);
  const { track, inputs } = env.opts;
  const angles = rayAngles(inputs.rays.count, inputs.rays.fov);
  const rc = env.cars[0];
  const cap = Math.ceil(TEST_DRIVE_SECONDS / SIM_DT) + 2;
  const poses = new Float32Array(cap * 3);
  const rays = new Float32Array(cap * angles.length * 2);
  const rewards = new Float32Array(cap);
  let n = 0;
  while (!env.done && n < cap) {
    env.step();
    const { x, y, heading } = rc.car;
    poses.set([x, y, heading], n * 3);
    for (let k = 0; k < angles.length; k++) {
      const a = heading + angles[k];
      const o = (n * angles.length + k) * 2;
      rays[o] = x + rc.rays[k] * Math.cos(a);
      rays[o + 1] = y + rc.rays[k] * Math.sin(a);
    }
    rewards[n] = rc.fitness;
    n++;
  }
  return {
    kind: 'racing',
    ...road(track),
    ticks: n,
    poses: poses.slice(0, n * 3),
    rays: rays.slice(0, n * angles.length * 2),
    rayCount: angles.length,
    rewards: rewards.slice(0, n),
    stopReason: rc.stopReason ?? 'time',
  };
}
