import { describe, expect, it } from 'vitest';
import { RACING_BLUEPRINTS } from '../../blueprints/presets';
import { BENCHMARK_VERSION } from '../../core/version';
import { mixSeed } from '../../core/rng';
import { linkScriptCompiler } from '../../lessons/compilerLink';
import { Population } from '../../neat/population';
import { runShape, createRacingRunConfig, type RunConfig } from '../../training/runConfig';
import { evaluateRacing } from '../../racing/episode';
import { BUILT_IN_TRACKS } from '../../racing/track/presets';
import { compileScript } from '../../script/compiler';
import { RACING_ADVANCED } from '../../script/presets/racingAdvanced';
import { envOptionsFor, TrackCache } from '../../training/racingSetup';
import { RacingTrainer } from '../../training/racingTrainer';
import { runBenchmark } from '../index';

/** A run of the given script on the Oval. Brains with the same blueprint and sensors fit every such run. */
function config(source: string, seed = 5): RunConfig {
  const script = compileScript(source).script;
  if (!script) throw new Error('Test script does not compile');
  return createRacingRunConfig({
    name: 'bench test',
    seed,
    blueprint: RACING_BLUEPRINTS[3],
    track: BUILT_IN_TRACKS[0],
    carPreset: 'standard',
    populationSize: 50,
    script: { source, hash: script.sourceHash, customSensors: script.sensors.length },
  });
}

const advanced = config(RACING_ADVANCED);
/** The Advanced preset with different rewards and stops, but the same brain and sensors. */
const otherRewards = config(
  RACING_ADVANCED.replace('reward +1 when checkpoint.passed', 'reward +5 when checkpoint.passed')
    .replace('reward -0.05 when car.slip > slipLimit', 'reward -2 when car.slip > slipLimit')
    .replace('stop "stalled" when car.noProgress > 3 s', 'stop "stalled" when car.noProgress > 1 s'),
);

function randomBrain(c: RunConfig) {
  return Population.create(runShape(c), 99, { populationSize: 1 }).genomes[0];
}

/** A few generations of real training, enough to beat a random brain clearly. */
function trainedChampion(c: RunConfig, generations: number) {
  linkScriptCompiler();
  const trainer = new RacingTrainer(c);
  const cache = new TrackCache();
  let best = trainer.genomes[0];
  for (let g = 0; g < generations; g++) {
    const setup = trainer.setup();
    const results = evaluateRacing(trainer.genomes, envOptionsFor(setup, cache.get(setup.track), trainer.host(), mixSeed(trainer.generation, 0x51)), trainer.seeds());
    best = trainer.complete(results, 0).genome;
  }
  return best;
}

describe('runBenchmark', () => {
  const champion = trainedChampion(advanced, 8);

  it('fills every part of the result', async () => {
    const result = await runBenchmark(advanced, champion);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.benchmarkVersion).toBe(BENCHMARK_VERSION);
    expect(result.parts).toHaveLength(5);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    for (const v of Object.values(result.radar)) expect(v).toBeGreaterThanOrEqual(0);
    for (const v of Object.values(result.radar)) expect(v).toBeLessThanOrEqual(1);
    expect(Object.keys(result.metrics).sort()).toEqual(['crashRate', 'distance', 'lapTime', 'laps', 'steerChange']);
    expect(result.scorePer100Params).toBeGreaterThan(0);
  });

  it('scores the same brain the same way every time', async () => {
    expect(await runBenchmark(advanced, champion)).toEqual(await runBenchmark(advanced, champion));
  });

  it('does not change when only the training reward changes', async () => {
    const a = await runBenchmark(advanced, champion);
    const b = await runBenchmark(otherRewards, champion);
    expect(b?.score).toBe(a?.score);
    expect(b?.parts).toEqual(a?.parts);
  });

  it('scores a trained champion above a random brain', async () => {
    const trained = await runBenchmark(advanced, champion);
    const random = await runBenchmark(advanced, randomBrain(advanced));
    expect(trained?.score ?? 0).toBeGreaterThan((random?.score ?? 0) + 10);
  });

  it('reports progress per episode and stops when aborted', async () => {
    const seen: number[] = [];
    await runBenchmark(advanced, champion, { onProgress: (f) => seen.push(f) });
    expect(seen).toHaveLength(15);
    expect(seen[14]).toBe(1);
    const controller = new AbortController();
    const result = await runBenchmark(advanced, champion, { signal: controller.signal, onProgress: () => controller.abort() });
    expect(result).toBeNull();
  });

  it('returns null for Hide and Seek and refuses a brain from another run', async () => {
    expect(await runBenchmark({ ...advanced, env: 'hideseek' }, champion)).toBeNull();
    const standard = { ...advanced, blueprint: RACING_BLUEPRINTS[2] };
    await expect(runBenchmark(standard, champion)).rejects.toThrow(/inputs/);
  });
});
