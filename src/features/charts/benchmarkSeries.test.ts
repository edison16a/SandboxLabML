import { describe, expect, it } from 'vitest';
import type { ReferenceCurve, ReferenceTier } from '@/engine/bench/types';
import { DEFAULT_DRIVING_BLUEPRINT } from '@/engine/driving/blueprints';
import { DEFAULT_DRIVING_SETTINGS } from '@/engine/driving/run/settings';
import { presetsOf } from '@/engine/script/presets';
import { createEpisodeRunConfig } from '@/engine/training/newRun';
import type { RunConfig } from '@/engine/training/runConfig';
import { benchmarkData, benchmarkSeries, drawOrder } from './benchmarkSeries';
import { matchingTier } from './benchmarkTier';

const curve = (tier: ReferenceTier, base: number): ReferenceCurve => ({
  tier,
  finalScore: base + 10,
  curve: [0, 10, 20].map((generation) => ({ generation, median: base + generation, p25: base + generation - 3, p75: base + generation + 3 })),
});
const TIERS = [curve('beginner', 10), curve('intermediate', 20), curve('advanced', 30)];
const POINTS = [{ generation: 5, benchmark: 40 }];

const run = (source?: string): RunConfig => {
  const config = createEpisodeRunConfig({ env: 'driving', name: 'r', seed: 1, blueprint: DEFAULT_DRIVING_BLUEPRINT, populationSize: 50, settings: { ...DEFAULT_DRIVING_SETTINGS } });
  return source ? { ...config, scripts: [{ fromGeneration: 0, source, hash: 'h' }] } : config;
};

describe('the reference a run matches', () => {
  it('is the preset its script is, by the name in its header', () => {
    for (const p of presetsOf('driving')) expect(matchingTier(run(p.source))).toBe(p.tier);
    // Comments changed since the run was made: the header still names the preset.
    const beginner = presetsOf('driving').find((p) => p.tier === 'beginner')!;
    expect(matchingTier(run(beginner.source.replace(/^\/\/.*$/m, '// An older first line.')))).toBe('beginner');
  });

  it("is Intermediate for the built-in reward, and none for the user's own script", () => {
    expect(matchingTier(run())).toBe('intermediate');
    expect(matchingTier(run('script "My own" for driving v1\n'))).toBeNull();
    expect(matchingTier(null)).toBeNull();
  });
});

describe('benchmark series', () => {
  it('shades only the matching reference, drawn last under the run', () => {
    const order = drawOrder(TIERS, 'beginner');
    expect(order.map((t) => t.tier)).toEqual(['intermediate', 'advanced', 'beginner']);
    const { series, bands } = benchmarkSeries(order, 'beginner');
    // x, two thin medians, the band's edges and its median, then the run.
    expect(series.map((s) => s.label)).toEqual([undefined, 'intermediate', 'advanced', 'beginner p75', 'beginner p25', 'beginner', 'This run']);
    expect(bands).toHaveLength(1);
    expect(bands[0].series).toEqual([3, 4]);
    expect(series[1].dash).toBeDefined();
    expect(series[5].dash).toBeUndefined();
  });

  it('lines the data columns up with the series', () => {
    const order = drawOrder(TIERS, 'intermediate');
    const { series } = benchmarkSeries(order, 'intermediate');
    const data = benchmarkData(order, 'intermediate', POINTS);
    expect(data.length).toBe(series.length);
    // Generations 0, 5, 10 and 20, shown one based.
    expect(Array.from(data[0])).toEqual([1, 6, 11, 21]);
    const col = (label: string) => Array.from(data[series.findIndex((s) => s.label === label)]);
    expect(col('intermediate p75')).toEqual([23, undefined, 33, 43]);
    expect(col('beginner')).toEqual([10, undefined, 20, 30]);
    expect(col('This run')).toEqual([undefined, 40, undefined, undefined]);
  });

  it('shades none when the run matches no reference', () => {
    const { series, bands } = benchmarkSeries(drawOrder(TIERS, null), null);
    expect(bands).toHaveLength(0);
    expect(series).toHaveLength(5);
  });
});
