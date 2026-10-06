import { makeTickIO, type AgentController } from '@/engine/env/types';

/**
 * Brain outputs the bench hands the script, in output order. Fixed and
 * away from zero, so branches on brain values run the same way every
 * time. Racing reads the first two (steer, pedal).
 */
const SAMPLE_BRAIN = [0.3, 0.7, -0.4, 0.6];

/**
 * Measures what a script costs per agent per tick, on its own. Timing each
 * call is useless in a browser because timers are coarsened to as much as
 * 100 µs, so the controller is called in a tight loop over agent states
 * captured during the episode, and the loop grows until it runs long
 * enough to time well. `outputs` is the brain size of the game: 2 for
 * racing, 4 for Hide and Seek.
 */
export function measureScriptMicros<V>(make: () => AgentController<V>, views: readonly V[], outputs = 2, now: () => number = () => performance.now()): number {
  if (views.length === 0) return 0;
  const controller = make();
  const io = makeTickIO(outputs, outputs);
  const out = new Float64Array(64);
  for (let i = 0; i < outputs; i++) io.brain[i] = SAMPLE_BRAIN[i % SAMPLE_BRAIN.length];
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
