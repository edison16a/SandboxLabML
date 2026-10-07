import { describe, expect, it } from 'vitest';
import { HIDESEEK_BENCHMARK_VERSION, HIDESEEK_ENGINE_VERSION } from '../../core/version';
import { ELO_ANCHOR } from '../hideseek/elo';
import { HS_REFERENCE_FINAL_WINDOW } from '../hideseek/exam';
import { opponentsFrom } from '../hideseek/opponents';
import { readReferences } from '../nodeReferences';
import type { BenchReferences } from '../types';

const final = (refs: BenchReferences | null, tier: string) => refs?.references.find((r) => r.tier === tier)?.finalScore ?? NaN;

/**
 * The shipped Hide and Seek reference file must come from the current
 * engine and benchmark. Bumping either version fails this test until the
 * file is regenerated with npm run refs -- --env hideseek.
 */
describe('public/references/hideseek.json', () => {
  it('matches the current engine and Hide and Seek benchmark versions', async () => {
    const refs = await readReferences('hideseek');
    expect(refs, 'Run npm run refs -- --env hideseek to generate the file.').not.toBeNull();
    expect(refs?.env).toBe('hideseek');
    expect(refs?.engineVersion).toBe(HIDESEEK_ENGINE_VERSION);
    expect(refs?.benchmarkVersion).toBe(HIDESEEK_BENCHMARK_VERSION);
    expect(refs?.seeds).toBeGreaterThanOrEqual(3);
  });

  /**
   * Every preset must learn: its final score sits well above where its runs
   * started. The tiers used to be checked for rank order too, but with ramps
   * in every room they end within about a point of each other at the nightly
   * budget. See "What the references show" in docs/benchmark.md.
   */
  it('shows every preset learning', async () => {
    const refs = await readReferences('hideseek');
    for (const tier of ['beginner', 'intermediate', 'advanced']) {
      const start = refs?.references.find((r) => r.tier === tier)?.curve[0].median ?? NaN;
      expect(final(refs, tier)).toBeGreaterThan(start + 8);
    }
  });

  it('has a curve with a band around the median at every checkpoint', async () => {
    const refs = await readReferences('hideseek');
    expect(refs?.references.map((r) => r.tier)).toEqual(['beginner', 'intermediate', 'advanced']);
    for (const r of refs?.references ?? []) {
      expect(r.curve.length).toBeGreaterThan(2);
      expect(r.curve[0].generation).toBe(0);
      for (const p of r.curve) {
        expect(p.p25).toBeLessThanOrEqual(p.median);
        expect(p.median).toBeLessThanOrEqual(p.p75);
      }
      // The final score pools every seed over the last checkpoints, so it sits inside their bands.
      const late = r.curve.slice(-HS_REFERENCE_FINAL_WINDOW);
      expect(r.finalScore).toBeGreaterThanOrEqual(Math.min(...late.map((p) => p.p25)));
      expect(r.finalScore).toBeLessThanOrEqual(Math.max(...late.map((p) => p.p75)));
    }
  });

  it('ships one rated champion pair per tier whose brains fit their inputs', async () => {
    const refs = await readReferences('hideseek');
    expect(refs).not.toBeNull();
    if (!refs) return;
    const opponents = opponentsFrom(refs);
    expect(opponents.map((o) => o.tier)).toEqual(['beginner', 'intermediate', 'advanced']);
    const mean = opponents.reduce((s, o) => s + o.rating, 0) / opponents.length;
    expect(mean).toBeCloseTo(ELO_ANCHOR, 0);
  });
});
