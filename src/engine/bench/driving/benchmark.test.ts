import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_DRIVING_BLUEPRINT } from '../../driving/blueprints';
import { DEFAULT_DRIVING_SETTINGS } from '../../driving/run/settings';
import { drivingTestBrain } from '../../driving/run/testBrain';
import { DRIVING_BENCHMARK_VERSION } from '../../driving/version';
import { loadEpisodeModule, requireEpisodeInfo } from '../../env/registry';
import { Population } from '../../neat/population';
import type { Genome } from '../../neat/types';
import { compileScript } from '../../script/compiler';
import { createEpisodeRunConfig } from '../../training/newRun';
import { runShape, type RunConfig } from '../../training/runConfig';
import { runBenchmark } from '../index';
import type { BenchResult } from '../types';
import { drivingExam } from './exam';

/** A Driving run of the Standard brain, with a script when one is given. */
function config(source?: string): RunConfig {
  const script = source ? compileScript(source).script : null;
  return createEpisodeRunConfig({
    env: 'driving',
    name: 'bench test',
    seed: 3,
    blueprint: DEFAULT_DRIVING_BLUEPRINT,
    populationSize: 20,
    settings: { ...DEFAULT_DRIVING_SETTINGS },
    script: script && source ? { source, hash: script.sourceHash, customSensors: script.sensors.length } : undefined,
  });
}

const SCRIPT = (arrive: number) => `script "t" for driving v1
brain driving-standard
each tick {
  drive(steer: brain.steer, pedal: brain.pedal)
  reward +${arrive} when car.arrived
  stop "stuck" when car.noProgress > 2 s
}
`;

describe('the Driving benchmark', () => {
  const plain = config();
  let driver: Genome;
  let random: Genome;
  let result: BenchResult;

  beforeAll(async () => {
    await loadEpisodeModule('driving');
    await drivingExam();
    driver = drivingTestBrain(runShape(plain), requireEpisodeInfo('driving').inputSchema(plain, []));
    random = Population.create(runShape(plain), 7, { populationSize: 1 }).genomes[0];
    result = (await runBenchmark(plain, driver))!;
  }, 120_000);

  it('fills every part of the result', () => {
    expect(result.env).toBe('driving');
    expect(result.benchmarkVersion).toBe(DRIVING_BENCHMARK_VERSION);
    expect(Object.keys(result.radar).sort()).toEqual(['completion', 'efficiency', 'generalization', 'safety']);
    expect(result.parts.map((p) => p.id)).toEqual(['level-2', 'level-3', 'level-4', 'level-5']);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.scorePer100Params).toBeGreaterThan(0);
  });

  it('scores the hand set test driver well above a random brain', async () => {
    const low = await runBenchmark(plain, random);
    expect(low!.score).toBeLessThan(result.score - 15);
    // It waits at reds and slows into the destination, so it arrives safely on the quiet levels.
    expect(result.parts[0].metrics.safeArrivals).toBeGreaterThan(0.5);
  });

  it('ignores the training reward and stop rules', async () => {
    const a = await runBenchmark(config(SCRIPT(10)), driver);
    const b = await runBenchmark(config(SCRIPT(99)), driver);
    expect(a!.score).toBe(b!.score);
    expect(a!.score).toBe(result.score);
  });

  it('refuses a brain from another run and stops when asked', async () => {
    const small = Population.create({ ...runShape(plain), inputCount: 3 }, 1, { populationSize: 1 }).genomes[0];
    await expect(runBenchmark(plain, small)).rejects.toThrow(/inputs/);
    const ctrl = new AbortController();
    ctrl.abort();
    expect(await runBenchmark(plain, driver, { signal: ctrl.signal })).toBeNull();
  });
});
