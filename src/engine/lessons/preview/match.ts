import { HIDESEEK_SNAPSHOT } from '../../hideseek/snapshot';
import { lessonArenaPool } from '../hideseek/play';
import { startTestMatch } from '../hideseek/testMatch';
import type { PreparedHideSeek } from '../prepare';
import type { MatchPreview } from './types';

/**
 * Records the lesson test match (see startTestMatch) for the preview: one
 * arena snapshot and both teams' totals per tick. It is the match a check
 * plays. It runs straight through without pausing, so call it from a
 * worker, where a match of 900 ticks blocks nothing.
 */
export async function recordTestMatch(prepared: PreparedHideSeek): Promise<MatchPreview> {
  const match = startTestMatch(prepared, await lessonArenaPool());
  try {
    const stride = HIDESEEK_SNAPSHOT.stride;
    const cap = match.state.totalTicks;
    const frames = new Float32Array(cap * stride);
    const rewards = new Float32Array(cap * 2);
    const [hider, seeker] = match.state.agents;
    let n = 0;
    while (!match.done && n < cap) {
      match.step();
      match.snapshot(frames, n * stride);
      rewards[2 * n] = hider.fitness;
      rewards[2 * n + 1] = seeker.fitness;
      n++;
    }
    return {
      kind: 'hideseek',
      layout: prepared.rules.layout,
      ticks: n,
      prepTicks: match.state.prepTicks,
      frames: frames.slice(0, n * stride),
      rewards: rewards.slice(0, n * 2),
    };
  } finally {
    match.release();
  }
}
