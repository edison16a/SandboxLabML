import { describe, expect, it } from 'vitest';
import { STANDARD_HIDESEEK_INPUTS } from '../inputConfig';
import type { MatchResult, MatchSpec } from '../match/types';
import { scoreGeneration } from '../trainer/scoring';
import { randomGenomes } from './helpers';

const [genome] = randomGenomes(STANDARD_HIDESEEK_INPUTS, 1, 1);
const spec = (hider: number, seeker: number): MatchSpec => ({
  layout: 'shelter',
  seed: 1,
  hider: { genome, inputs: STANDARD_HIDESEEK_INPUTS, slot: hider },
  seeker: { genome, inputs: STANDARD_HIDESEEK_INPUTS, slot: seeker },
});

/** A finished match with nothing happening in it, apart from `over`. */
function result(over: Partial<MatchResult>): MatchResult {
  return {
    layout: 'shelter',
    seed: 1,
    ticks: 900,
    hiderReward: 0,
    seekerReward: 0,
    hiddenShare: 0.5,
    seenShare: 0.5,
    exposedShare: 0.5,
    firstSeenAt: -1,
    locksPlaced: 0,
    hiderLocks: 0,
    seekerLocks: 0,
    unlocks: 0,
    lockedAtEnd: 0,
    hiderGrabs: 0,
    seekerGrabs: 0,
    hiderClimbs: 0,
    seekerClimbs: 0,
    hiderVaults: 0,
    seekerVaults: 0,
    boxesMoved: 0,
    boxTravel: 0,
    hiderStop: null,
    seekerStop: null,
    ...over,
  };
}

describe('generation stats', () => {
  it('count climbs for both teams and vaults for each team, per match', () => {
    const plan = [[spec(0, 0), spec(1, 1)]];
    const results = [[result({ seekerClimbs: 3, seekerVaults: 2, hiderClimbs: 1 }), result({ seekerClimbs: 1, hiderVaults: 1 })]];
    const { game } = scoreGeneration(plan, results, 2, 2);
    expect(game.climbsPerMatch).toBe(2.5);
    expect(game.seekerVaultsPerMatch).toBe(1);
    expect(game.hiderVaultsPerMatch).toBe(0.5);
  });

  it('split locks by the team that placed them', () => {
    const plan = [[spec(0, 0), spec(1, 1)]];
    const results = [[result({ locksPlaced: 3, hiderLocks: 2, seekerLocks: 1 }), result({ locksPlaced: 1, seekerLocks: 1 })]];
    const { game } = scoreGeneration(plan, results, 2, 2);
    expect(game.locksPerMatch).toBe(2);
    expect(game.hiderLocksPerMatch).toBe(1);
    expect(game.seekerLocksPerMatch).toBe(1);
  });
});
