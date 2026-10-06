import { describe, expect, it } from 'vitest';
import { ELO_ANCHOR, expectedScore, fitRatings, performanceRating } from '../hideseek/elo';

describe('Elo-style ratings', () => {
  it('expects an even score between equals and 10 to 1 odds 400 points apart', () => {
    expect(expectedScore(1500, 1500)).toBe(0.5);
    expect(expectedScore(1900, 1500) / expectedScore(1500, 1900)).toBeCloseTo(10, 9);
  });

  it('rates an even record at the opponent rating and a clean sweep high but finite', () => {
    expect(performanceRating([{ opponent: 1400, points: 15, games: 30 }])).toBeCloseTo(1400, 6);
    const sweep = performanceRating([{ opponent: 1400, points: 30, games: 30 }]);
    expect(sweep).toBeGreaterThan(1900);
    expect(sweep).toBeLessThan(2400);
    expect(performanceRating([{ opponent: 1400, points: 0, games: 30 }])).toBeCloseTo(2 * 1400 - sweep, 6);
    expect(performanceRating([])).toBe(ELO_ANCHOR);
  });

  it('fits a round robin with the mean pinned and the order kept', () => {
    // Player 2 beats 1 beats 0, each 20 of 30.
    const ratings = fitRatings(3, [
      { a: 1, b: 0, points: 20, games: 30 },
      { a: 2, b: 1, points: 20, games: 30 },
      { a: 2, b: 0, points: 25, games: 30 },
    ]);
    expect(ratings[0]).toBeLessThan(ratings[1]);
    expect(ratings[1]).toBeLessThan(ratings[2]);
    expect((ratings[0] + ratings[1] + ratings[2]) / 3).toBeCloseTo(ELO_ANCHOR, 6);
  });

  it('gives a rated player its own rating back as a performance rating', () => {
    const pairings = [
      { a: 0, b: 1, points: 8, games: 30 },
      { a: 0, b: 2, points: 3, games: 30 },
      { a: 1, b: 2, points: 11, games: 30 },
    ];
    const r = fitRatings(3, pairings);
    // Player 1 against everyone, itself included: a draw with itself changes nothing.
    const back = performanceRating([
      { opponent: r[0], points: 30 - 8, games: 30 },
      { opponent: r[1], points: 15, games: 30 },
      { opponent: r[2], points: 11, games: 30 },
    ]);
    expect(back).toBeCloseTo(r[1], 3);
  });
});
