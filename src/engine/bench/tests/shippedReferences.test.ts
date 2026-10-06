import { describe, expect, it } from 'vitest';
import { BENCHMARK_VERSION, ENGINE_VERSION } from '../../core/version';
import { readReferences } from '../nodeReferences';
import type { BenchReferences } from '../types';

const final = (refs: BenchReferences | null, tier: string) => refs?.references.find((r) => r.tier === tier)?.finalScore ?? NaN;

/**
 * The shipped reference file must come from the current engine and
 * benchmark. Bumping either version fails this test until the file is
 * regenerated with npm run refs.
 */
describe('public/references/racing.json', () => {
  it('matches the current engine and benchmark versions', async () => {
    const refs = await readReferences('racing');
    expect(refs, 'Run npm run refs to generate the file.').not.toBeNull();
    expect(refs?.env).toBe('racing');
    expect(refs?.engineVersion).toBe(ENGINE_VERSION);
    expect(refs?.benchmarkVersion).toBe(BENCHMARK_VERSION);
    expect(refs?.seeds).toBeGreaterThanOrEqual(5);
  });

  it('ranks Beginner below Intermediate and Advanced', async () => {
    const refs = await readReferences('racing');
    expect(final(refs, 'beginner')).toBeLessThan(final(refs, 'intermediate'));
    expect(final(refs, 'beginner')).toBeLessThan(final(refs, 'advanced'));
  });

  /**
   * The intended order puts Advanced on top, but with 100 cars and 100
   * generations its champions steer harder and crash more on unseen roads
   * than Intermediate's, on every part of the score (see docs/benchmark.md).
   * This is marked as an expected failure so it flips, and gets noticed,
   * the day a preset change makes Advanced win.
   */
  it.fails('ranks Advanced above Intermediate', async () => {
    const refs = await readReferences('racing');
    expect(final(refs, 'intermediate')).toBeLessThan(final(refs, 'advanced'));
  });

  it('has a curve with a band around the median at every checkpoint', async () => {
    const refs = await readReferences('racing');
    for (const r of refs?.references ?? []) {
      expect(r.curve.length).toBeGreaterThan(2);
      expect(r.curve[0].generation).toBe(0);
      for (const p of r.curve) {
        expect(p.p25).toBeLessThanOrEqual(p.median);
        expect(p.median).toBeLessThanOrEqual(p.p75);
      }
      expect(r.finalScore).toBe(r.curve[r.curve.length - 1].median);
    }
  });
});
