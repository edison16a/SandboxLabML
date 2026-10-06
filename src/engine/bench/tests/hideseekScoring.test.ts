import { describe, expect, it } from 'vitest';
import { composite, DRAW_MARGIN, gamePoints, HS_WEIGHTS, partScore, summarize } from '../hideseek/scoring';
import type { GameResult } from '../hideseek/types';

function game(overrides: Partial<GameResult>): GameResult {
  return { opponent: 'beginner', layout: 'open', seed: 1, hidden: 0.5, covered: 0.5, locks: 0, seen: 0.5, ...overrides };
}

describe('gamePoints', () => {
  it('wins when the model hid longer than the opponent did, and draws a close game', () => {
    expect(gamePoints(game({ hidden: 0.9, seen: 0.2 }))).toBe(1);
    expect(gamePoints(game({ hidden: 0.6, seen: 0.1 }))).toBe(0);
    expect(gamePoints(game({ hidden: 0.7, seen: 0.3 }))).toBe(0.5);
    expect(gamePoints(game({ hidden: 0.7, seen: 0.3 + DRAW_MARGIN / 2 }))).toBe(0.5);
    expect(gamePoints(game({ hidden: 0.7, seen: 0.3 + DRAW_MARGIN * 2 }))).toBe(1);
  });

  it('gives the two sides of the same game points that add up to one', () => {
    // The opponent's view of a game swaps the legs: its hidden is 1 - seen and its seen is 1 - hidden.
    for (const [hidden, seen] of [[0.9, 0.2], [0.6, 0.1], [0.7, 0.32], [1, 0]]) {
      expect(gamePoints(game({ hidden, seen })) + gamePoints(game({ hidden: 1 - seen, seen: 1 - hidden }))).toBe(1);
    }
  });
});

describe('composite', () => {
  it('uses weights that add up to one', () => {
    expect(Object.values(HS_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it('scores a perfect exam 100 and an empty one 0', () => {
    const perfect = summarize([game({ hidden: 1, seen: 1, covered: 1 })]);
    expect(composite(perfect, [perfect, perfect]).score).toBeCloseTo(100);
    expect(partScore(perfect)).toBeCloseTo(100);
    const none = summarize([game({ hidden: 0, seen: 0, covered: 0 })]);
    expect(composite(none, [none]).score).toBe(0);
  });

  it('judges generalization by the win rate in the weakest room', () => {
    const open = summarize([game({ hidden: 1, seen: 0.5 })]);
    const shelter = summarize([game({ layout: 'shelter', hidden: 0.2, seen: 0.1 })]);
    const all = summarize([game({ hidden: 1, seen: 0.5 }), game({ layout: 'shelter', hidden: 0.2, seen: 0.1 })]);
    const { radar } = composite(all, [open, shelter]);
    expect(radar.generalization).toBe(0);
    expect(radar.hiding).toBeCloseTo(0.6);
    expect(radar.seeking).toBeCloseTo(0.3);
    expect(all.winRate).toBeCloseTo(0.5);
  });
});
