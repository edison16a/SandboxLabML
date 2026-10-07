import { describe, expect, it } from 'vitest';
import type { HideSeekGenerationStats } from '@/engine/hideseek/trainer/types';
import { boxAndRampSeries, legendOf } from './progressSeries';

/** A history row with only the game numbers these charts read. */
function row(game: Partial<HideSeekGenerationStats['game']>): { stats: HideSeekGenerationStats } {
  const base = {
    matches: 1,
    hiddenShare: 0,
    seenShare: 0,
    currentHiddenShare: 0,
    locksPerMatch: 0,
    boxesMovedPerMatch: 0,
    grabsPerMatch: 0,
    hallOfFame: { hiders: 0, seekers: 0 },
  };
  return { stats: { game: { ...base, ...game } } as HideSeekGenerationStats };
}

describe('progress chart series', () => {
  it('splits locks by team and adds a ramps chart once the history has climbing numbers', () => {
    const { boxes, ramps } = boxAndRampSeries([
      row({ locksPerMatch: 0.5, grabsPerMatch: 2 }),
      row({ locksPerMatch: 0.3, hiderLocksPerMatch: 0.1, seekerLocksPerMatch: 0.2, climbsPerMatch: 0.4, hiderVaultsPerMatch: 0, seekerVaultsPerMatch: 0.05 }),
    ]);
    expect(boxes.map((s) => s.label)).toEqual(['Hider locks', 'Seeker locks', 'Grabs', 'Boxes moved']);
    // A generation from before team locks leaves a gap rather than a false zero.
    expect(boxes[0].values).toEqual([null, 0.1]);
    expect(boxes[1].values).toEqual([null, 0.2]);
    expect(boxes[2].values).toEqual([2, 0]);
    expect(ramps?.map((s) => s.label)).toEqual(['Climbs', 'Hider vaults', 'Seeker vaults']);
    expect(ramps?.[2].values).toEqual([null, 0.05]);
    expect(legendOf(boxes)[2]).toEqual({ label: 'Grabs', color: boxes[2].color, dashed: true });
  });

  it('keeps one locks line and no ramps chart for a run from before ramps', () => {
    const { boxes, ramps } = boxAndRampSeries([row({ locksPerMatch: 0.5 }), row({ locksPerMatch: 0.7 })]);
    expect(boxes[0]).toMatchObject({ label: 'Locks', values: [0.5, 0.7] });
    expect(ramps).toBeNull();
  });
});
