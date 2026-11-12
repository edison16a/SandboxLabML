import { describe, expect, it } from 'vitest';
import { MAX_LEVEL } from '@/engine/driving/levels';
import { firstSandbox, STARTING_MODEL_COPIES } from '@/features/driving/sandbox/state';
import { LEVEL_WEIGHTS, MODEL_COPIES, SANDBOX_LEVELS, weightedShare } from './sandboxTrips';

describe('the Sandbox trips the Driving pick drives', () => {
  it('match what the lab Sandbox plays', () => {
    expect(MODEL_COPIES).toBe(STARTING_MODEL_COPIES);
    // A new run opens the Sandbox on the first of them, a trained run on any up to the top level.
    expect(firstSandbox(null, []).trip.level).toBe(SANDBOX_LEVELS[0]);
    expect(SANDBOX_LEVELS[SANDBOX_LEVELS.length - 1]).toBe(MAX_LEVEL);
  });

  it('weigh the levels into one share, level 2 the most', () => {
    expect(LEVEL_WEIGHTS.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(Math.max(...LEVEL_WEIGHTS)).toBe(LEVEL_WEIGHTS[0]);
    expect(weightedShare([1, 1, 1, 1])).toBeCloseTo(1);
    expect(weightedShare([1, 0, 0, 0])).toBeCloseTo(LEVEL_WEIGHTS[0]);
  });
});
