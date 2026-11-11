import { describe, expect, it } from 'vitest';
import { runColumn } from './benchmarkGaps';

describe('runColumn', () => {
  it('joins across reference generations and breaks where benchmarks were skipped', () => {
    const points = [
      { generation: 5, benchmark: 10 },
      { generation: 10, benchmark: 12 },
      { generation: 70, benchmark: 30 },
      { generation: 75, benchmark: 31 },
    ];
    const xs = [0, 5, 10, 20, 70, 75, 80];
    expect(runColumn(xs, points)).toEqual([undefined, 10, 12, null, 30, 31, undefined]);
  });

  it('keeps an evenly scored run in one line', () => {
    const points = [0, 5, 10].map((generation) => ({ generation, benchmark: generation }));
    expect(runColumn([0, 5, 10], points)).toEqual([0, 5, 10]);
    expect(runColumn([0, 5, 7, 10], points)).toEqual([0, 5, undefined, 10]);
  });
});
