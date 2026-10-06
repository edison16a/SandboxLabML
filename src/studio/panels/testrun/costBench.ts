import { makeTickIO, type AgentController } from '@/engine/env/types';
import type { RacingCar } from '@/engine/racing/car/runtime';

/**
 * Measures what a script costs per agent per tick, on its own. Timing each
 * call is useless in a browser because timers are coarsened to as much as
 * 100 µs, so the controller is called in a tight loop over car states
 * captured during the episode, and the loop grows until it runs long
 * enough to time well.
 */
export function measureScriptMicros(make: () => AgentController<RacingCar>, views: readonly RacingCar[], now: () => number = () => performance.now()): number {
  if (views.length === 0) return 0;
  const controller = make();
  const io = makeTickIO(2, 2);
  const out = new Float64Array(64);
  io.brain[0] = 0.3;
  io.brain[1] = 0.7;
  const pass = () => {
    for (const v of views) {
      io.reward = 0;
      io.stop = null;
      if (controller.customSensorCount > 0) controller.sensors(v, out, 0);
      controller.tick(v, io);
    }
  };
  for (let i = 0; i < 50; i++) pass();
  let rounds = 64;
  for (;;) {
    const t0 = now();
    for (let i = 0; i < rounds; i++) pass();
    const ms = now() - t0;
    const calls = rounds * views.length;
    if (ms >= 25 || calls >= 4_000_000) return (ms * 1000) / calls;
    rounds *= ms < 2 ? 8 : 2;
  }
}
