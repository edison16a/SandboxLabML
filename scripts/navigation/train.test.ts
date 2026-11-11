import { describe, expect, it } from 'vitest';
import { trainThroughPipeline } from './pipelineRun';

/**
 * The default run (no script, built in reward, automatic curriculum)
 * trained through the real coordinator and sim code. It must finish the
 * straight run and climb, and the best fifth must finish nearly every
 * course before each level up.
 */
describe('a default navigation run', () => {
  it('learns level 0 and climbs the curriculum within a dozen generations', async () => {
    const records = await trainThroughPipeline({ seed: 1, generations: 12, population: 100 });
    const levels = records.map((r) => r.metrics?.level ?? 0);
    expect(levels[0]).toBe(0);
    expect(Math.max(...levels)).toBeGreaterThanOrEqual(3);
    // Each level up came after a generation whose best fifth finished at least most of its courses.
    for (let g = 1; g < records.length; g++) if (levels[g] > levels[g - 1]) expect(records[g - 1].metrics?.eliteShare ?? 0).toBeGreaterThanOrEqual(0.6);
    // The champion finishes every course of the straight run once it has learned it.
    const straight = records.filter((r) => r.metrics?.level === 0);
    expect(straight[straight.length - 1].champion.metrics?.finished).toBe(2);
    expect(records.every((r) => r.replaySlot !== undefined && r.content !== undefined)).toBe(true);
  }, 120_000);
});
