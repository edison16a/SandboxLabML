import { describe, expect, it } from 'vitest';
import { builtinDrivingController } from './builtinReward';
import { SUV } from './car/params';
import { DrivingEnv, type DrivingBrain } from './env';
import { STANDARD_DRIVING_INPUTS } from './sensors/inputConfig';
import { drivingInputSchema } from './sensors/inputSchema';
import { createDrivingSetup, drivingEnvOptions } from './setup';

/**
 * A reflex driver that reads only its inputs, like an evolved brain:
 * steer at the lane ahead, brake for red lights, cars and people. It keeps
 * most of a population on the road for a long time, which is the fair
 * load for a speed measurement.
 */
function reflexBrain(): DrivingBrain {
  const keys = drivingInputSchema(STANDARD_DRIVING_INPUTS, SUV).map((s) => s.key);
  const at = (k: string) => keys.indexOf(k);
  const [aim, light, lightD, gap, ped, speed] = ['aim', 'light', 'lightDistance', 'carGap', 'pedDistance', 'speed'].map(at);
  return {
    activate(x, out) {
      out[0] = Math.max(-1, Math.min(1, x[aim] * 3));
      const stop = (x[light] > 0.4 && x[lightD] < 0.35) || x[gap] < 0.25 || x[ped] < 0.3;
      out[1] = stop ? -0.8 : x[speed] < 0.4 ? 0.35 : 0;
    },
  };
}

describe('speed', () => {
  it('steps 100 learners at rush hour fast enough to train', () => {
    const setup = createDrivingSetup({ level: 5, seed: 3 });
    const env = new DrivingEnv(drivingEnvOptions(setup, SUV, STANDARD_DRIVING_INPUTS, builtinDrivingController));
    env.reset(Array.from({ length: 100 }, reflexBrain));
    // Warm up the JIT, then measure.
    for (let t = 0; t < 150; t++) env.step();
    const t0 = performance.now();
    let ticks = 0;
    let activeSum = 0;
    for (; ticks < 900 && !env.done; ticks++) {
      env.step();
      activeSum += env.active;
    }
    const perSecond = (ticks / (performance.now() - t0)) * 1000;
    console.log(`100 learners at rush hour: ${perSecond.toFixed(0)} ticks/s, ${(activeSum / Math.max(1, ticks)).toFixed(0)} driving on average`);
    // A loose floor: the machine running tests may be busy. Real numbers are logged above.
    expect(perSecond).toBeGreaterThan(120);
  });
});
