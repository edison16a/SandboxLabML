import type { HideSeekMatch } from '../../hideseek/match/match';
import { createArenaPool, type ArenaPool } from '../../hideseek/world/pool';
import { pause } from '../pause';

/** Ticks played between pauses, about a third of a match, so a tab running a check stays responsive. */
const TICKS_PER_SLICE = 300;

let pool: Promise<ArenaPool> | null = null;

/**
 * The arena pool every lesson check on this thread shares. Rapier loads
 * once, on the first Hide and Seek check, and the pool keeps one world per
 * room for the life of the page, so checks after the first start at once.
 */
export function lessonArenaPool(): Promise<ArenaPool> {
  pool ??= createArenaPool();
  return pool;
}

/**
 * Plays a match to the end a slice at a time, pausing in between.
 * `onStep` runs after every tick. Returns false if the signal aborted, and
 * the caller still releases the match either way.
 */
export async function playMatch(match: HideSeekMatch, signal?: AbortSignal, onStep?: () => void): Promise<boolean> {
  while (!match.done) {
    for (let k = 0; k < TICKS_PER_SLICE && !match.done; k++) {
      match.step();
      onStep?.();
    }
    await pause();
    if (signal?.aborted) return false;
  }
  return true;
}
