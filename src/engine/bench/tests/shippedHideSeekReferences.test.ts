import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION, HIDESEEK_BENCHMARK_VERSION } from '../../core/version';
import { ELO_ANCHOR } from '../hideseek/elo';
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
    expect(refs?.engineVersion).toBe(ENGINE_VERSION);
    expect(refs?.benchmarkVersion).toBe(HIDESEEK_BENCHMARK_VERSION);
    expect(refs?.seeds).toBeGreaterThanOrEqual(3);
  });

  /**
   * The presets are teaching tiers, and their references should rank that
   * way. It took the Advanced seekers' v1 rewards and the nightly budget of
   * 60 generations to get there; see "What the references show" in
   * docs/benchmark.md if a regenerated file breaks the order.
   */
  it('ranks Beginner below Intermediate below Advanced', async () => {
    const refs = await readReferences('hideseek');
    expect(final(refs, 'beginner')).toBeLessThan(final(refs, 'intermediate'));
    expect(final(refs, 'intermediate')).toBeLessThan(final(refs, 'advanced'));
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
      expect(r.finalScore).toBe(r.curve[r.curve.length - 1].median);
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
