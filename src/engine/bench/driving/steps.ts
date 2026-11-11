import { pause } from '../../lessons/pause';

/**
 * Ticks stepped between pauses. The background benchmark shares the
 * replay worker with the ghosts on screen, and a rush hour trip can take a
 * second to simulate, so it lets the worker breathe every few
 * milliseconds of work.
 */
export const EXAM_SLICE = 150;

/** Steps an episode to its end, pausing between slices. Returns false when the signal aborts first. */
export async function driveToEnd(env: { done: boolean; step(): void }, signal?: AbortSignal): Promise<boolean> {
  while (!env.done) {
    for (let k = 0; k < EXAM_SLICE && !env.done; k++) env.step();
    await pause();
    if (signal?.aborted) return false;
  }
  return true;
}
