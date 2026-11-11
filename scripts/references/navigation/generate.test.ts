import { describe, expect, it } from 'vitest';
import { typicalRun } from './generate';

const run = (seed: number, ...scores: number[]) => ({ job: { seed }, scores });

describe('the typical Navigation reference run', () => {
  it('is the seed closest to the pooled final score, not the lower of two', () => {
    expect(typicalRun([run(1, 40, 62.5), run(2, 50, 90)], 79.6).job.seed).toBe(2);
    expect(typicalRun([run(1, 70), run(2, 80), run(3, 95)], 81).job.seed).toBe(2);
  });

  it('breaks a tie toward the higher score, then the lower seed', () => {
    expect(typicalRun([run(1, 70), run(2, 90)], 80).job.seed).toBe(2);
    expect(typicalRun([run(3, 80), run(2, 80)], 80).job.seed).toBe(2);
  });
});
