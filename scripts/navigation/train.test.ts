import { describe, expect, it } from 'vitest';
import { compileScript } from '../../src/engine/script/compiler';
import { trainThroughPipeline } from './pipelineRun';

const levelsOf = (records: Awaited<ReturnType<typeof trainThroughPipeline>>) => records.map((r) => r.metrics?.level ?? 0);

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

  it('climbs with a hidden layer brain too', async () => {
    const records = await trainThroughPipeline({ seed: 2, generations: 12, population: 100, brain: { wiring: 'hidden', hiddenCount: 8, hiddenLayers: 1 } });
    expect(Math.max(...levelsOf(records))).toBeGreaterThanOrEqual(2);
  }, 120_000);

  it('follows a script that climbs a fixed level run with its own autoLevel bar', async () => {
    const source = [
      'script "Climb" for navigation v1',
      'brain navigation-standard',
      '',
      'each tick {',
      '  act(move: brain.move, turn: brain.turn)',
      '  reward +10 * agent.progressGain',
      '  reward +10 when agent.finished',
      '  reward -3 when agent.died',
      '}',
      '',
      'each generation {',
      '  autoLevel(threshold: 0.5)',
      '}',
      '',
    ].join('\n');
    const compiled = compileScript(source);
    expect(compiled.script).not.toBeNull();
    const script = { source, hash: compiled.script!.sourceHash, customSensors: 0 };
    const records = await trainThroughPipeline({ seed: 1, generations: 10, population: 60, settings: { autoLevel: false }, script });
    expect(Math.max(...levelsOf(records))).toBeGreaterThanOrEqual(1);
    // Without the script the same fixed level run stays put.
    const plain = await trainThroughPipeline({ seed: 1, generations: 6, population: 60, settings: { autoLevel: false } });
    expect(Math.max(...levelsOf(plain))).toBe(0);
  }, 120_000);
});
