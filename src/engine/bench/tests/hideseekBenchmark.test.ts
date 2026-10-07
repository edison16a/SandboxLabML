import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HIDESEEK_BLUEPRINTS } from '../../blueprints/presets';
import type { HideSeekBlueprint } from '../../blueprints/types';
import { HIDESEEK_BENCHMARK_VERSION } from '../../core/version';
import { HIDESEEK_OUTPUT_COUNT, type HideSeekInputConfig } from '../../hideseek/inputConfig';
import { hideSeekBrainInputs } from '../../hideseek/sensing/inputSchema';
import { createArenaPool, type ArenaPool } from '../../hideseek/world/pool';
import { linkScriptCompiler } from '../../lessons/compilerLink';
import { Population } from '../../neat/population';
import { compileScript } from '../../script/compiler';
import { HIDESEEK_INTERMEDIATE } from '../../script/presets/hideseekIntermediate';
import { createHideSeekRunConfig } from '../../training/hideseekRunConfig';
import { examMatchesPerOpponent } from '../hideseek/exam';
import { encodeChampion } from '../hideseek/opponents';
import { runBenchmark } from '../index';
import type { BenchReferences } from '../types';

const [starter, standard, advanced] = HIDESEEK_BLUEPRINTS as [HideSeekBlueprint, HideSeekBlueprint, HideSeekBlueprint];

function brain(inputs: HideSeekInputConfig, seed: number, custom = 0) {
  const shape = { inputCount: hideSeekBrainInputs(inputs, custom), outputCount: HIDESEEK_OUTPUT_COUNT, activation: 'tanh' as const, wiring: 'direct' as const };
  return Population.create(shape, seed, { populationSize: 1 }).genomes[0];
}

/** A one-opponent reference file with brains of other shapes than the model's, which keeps the exam short. */
const references: BenchReferences = {
  env: 'hideseek',
  benchmarkVersion: HIDESEEK_BENCHMARK_VERSION,
  engineVersion: 1,
  generatedAt: '2026-10-06',
  seeds: 1,
  references: [],
  champions: [
    encodeChampion({
      tier: 'intermediate',
      seed: 1,
      generation: 0,
      rating: 1500,
      hider: { genome: brain(advanced.inputs, 3), inputs: advanced.inputs },
      seeker: { genome: brain(starter.inputs, 4), inputs: starter.inputs },
    }),
  ],
};

/** A run of the given script whose seekers sense less than its hiders. */
function config(source: string) {
  const script = compileScript(source).script;
  if (!script) throw new Error('Test script does not compile');
  return createHideSeekRunConfig({
    name: 'bench test',
    seed: 5,
    blueprint: standard,
    seekerBlueprint: starter,
    populationPerTeam: 10,
    script: { source, hash: script.sourceHash, customSensors: script.sensors.length },
  });
}

const intermediate = config(HIDESEEK_INTERMEDIATE);
const otherRewards = config(
  HIDESEEK_INTERMEDIATE.replace('reward +1 * dt when agent.hidden', 'reward +5 * dt when agent.hidden').replace('reward -1 * dt when agent.seen', 'reward -3 * dt when agent.seen'),
);
const model = { hider: brain(standard.inputs, 7), seeker: brain(starter.inputs, 8) };

let pool: ArenaPool;
beforeAll(async () => {
  linkScriptCompiler();
  pool = await createArenaPool();
});
afterAll(() => pool.dispose());

describe('runBenchmark for Hide and Seek', () => {
  it('fills every part of the result', async () => {
    const result = await runBenchmark(intermediate, model, { references, pool });
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.env).toBe('hideseek');
    expect(result.benchmarkVersion).toBe(HIDESEEK_BENCHMARK_VERSION);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    for (const v of Object.values(result.radar)) expect(v).toBeGreaterThanOrEqual(0);
    for (const v of Object.values(result.radar)) expect(v).toBeLessThanOrEqual(1);
    expect(Object.keys(result.radar).sort()).toEqual(['cover', 'generalization', 'hiding', 'seeking']);
    expect(result.metrics.games).toBe(examMatchesPerOpponent() / 2);
    expect(result.metrics.elo).toBeGreaterThan(0);
    expect(result.parts.map((p) => p.id)).toEqual(['vs:intermediate', 'room:open', 'room:shelter', 'room:corridor']);
    expect(result.scorePer100Params).toBeGreaterThan(0);
  });

  it('scores the same pair the same way every time, on a fresh pool too', async () => {
    const a = await runBenchmark(intermediate, model, { references, pool });
    const b = await runBenchmark(intermediate, model, { references });
    expect(b).toEqual(a);
  });

  it('does not change when only the training reward changes', async () => {
    expect(otherRewards.scripts[0].source).not.toBe(intermediate.scripts[0].source);
    const a = await runBenchmark(intermediate, model, { references, pool });
    const b = await runBenchmark(otherRewards, model, { references, pool });
    expect(b).toEqual(a);
  });

  it('reports progress per game, stops when aborted and refuses a brain from another run', async () => {
    const seen: number[] = [];
    await runBenchmark(intermediate, model, { references, pool, onProgress: (f) => seen.push(f) });
    expect(seen).toHaveLength(examMatchesPerOpponent() / 2);
    expect(seen[seen.length - 1]).toBe(1);
    const ctrl = new AbortController();
    expect(await runBenchmark(intermediate, model, { references, pool, signal: ctrl.signal, onProgress: () => ctrl.abort() })).toBeNull();
    await expect(runBenchmark(intermediate, { hider: model.seeker, seeker: model.seeker }, { references, pool })).rejects.toThrow(/hider brain has 17 inputs/);
    expect(await runBenchmark(intermediate, model.hider, { references, pool })).toBeNull();
    await expect(runBenchmark(intermediate, model, { references: { ...references, champions: [] }, pool })).rejects.toThrow(/no Hide and Seek champions/);
  });
});
