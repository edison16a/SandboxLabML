import { describe, expect, it } from 'vitest';
import { hashObject } from '../core/hash';
import { loadEpisodeModule } from '../env/registry';
import type { AnyEpisodeModule } from '../env/episode';
import { DEFAULT_DRIVING_BLUEPRINT } from '../driving/blueprints';
import { DEFAULT_DRIVING_SETTINGS } from '../driving/run/settings';
import { NAVIGATION_BLUEPRINTS } from '../navigation/pipeline/blueprints';
import { navigationSettings } from '../navigation/pipeline/settings';
import { linkScriptCompiler } from '../lessons/compilerLink';
import { Network } from '../neat/network';
import { compileScript } from '../script/compiler';
import type { Blueprint } from '../blueprints/types';
import { EpisodeTrainer, trainingControllerSeed } from './episodeTrainer';
import { createEpisodeRunConfig } from './newRun';
import type { GenerationRecord } from './records';
import type { RunConfig } from './runConfig';

/** Moves the curriculum on after two generations, so the golden runs also cover a script directive. */
const DRIVING_SCRIPT = `script "Golden" for driving v1
brain driving-standard
each tick {
  drive(steer: brain.steer, pedal: brain.pedal)
  reward +0.02 * route.gain
  reward +10 when car.arrived
  stop "stuck" when car.noProgress > 4 s
}
each generation {
  speciate(target: 4)
  if generation == 2 {
    useLevel(level: 3)
  }
}
`;

const NAVIGATION_SCRIPT = `script "Golden" for navigation v1
brain navigation-standard
each tick {
  act(move: brain.move, turn: brain.turn)
  reward +10 * agent.progressGain
  reward +10 when agent.finished
  reward -3 when agent.died
}
each generation {
  speciate(target: 4)
  if generation == 2 {
    useLevel(level: 4)
  }
}
`;

function config(blueprint: Blueprint, settings: Readonly<Record<string, unknown>>, source?: string): RunConfig {
  const script = source ? { source, hash: compileScript(source).script!.sourceHash, customSensors: 0 } : undefined;
  return { ...createEpisodeRunConfig({ env: blueprint.env, name: 'golden', seed: 77, blueprint, populationSize: 24, settings, script }), id: 'golden', createdAt: 0 };
}

/** One generation the way the sim workers run it, without the threads. */
function generation(envModule: AnyEpisodeModule, t: EpisodeTrainer): GenerationRecord {
  const env = envModule.createEnv(t.setup() as never, t.host(), trainingControllerSeed(t.generation));
  env.reset(
    t.genomes.map((g) => new Network(g)),
    t.seeds(),
    t.slots(),
  );
  while (!env.done) env.step();
  return t.complete(env.results() as never, 0);
}

async function train(c: RunConfig, generations: number): Promise<{ hash: string; contents: number; level: number | undefined; trainer: EpisodeTrainer; envModule: AnyEpisodeModule }> {
  linkScriptCompiler();
  const envModule = await loadEpisodeModule(c.env);
  const trainer = new EpisodeTrainer(envModule, c);
  const records = Array.from({ length: generations }, () => generation(envModule, trainer));
  const level = records.at(-1)?.metrics?.level;
  return { hash: hashObject({ records, state: trainer.toState() }), contents: new Set(records.map((r) => r.trackHash)).size, level, trainer, envModule };
}

/**
 * Training must stay bit for bit what it was: the shipped reference files
 * and every stored run depend on it. These hashes were taken before the
 * old labs left the code; a change means Driving or Navigation results
 * changed, which needs an engine version bump and new references.
 */
describe('golden training runs', () => {
  const driving = (source?: string) => config(DEFAULT_DRIVING_BLUEPRINT, { ...DEFAULT_DRIVING_SETTINGS, trips: 1 }, source);
  const navigation = (source?: string) => config(NAVIGATION_BLUEPRINTS[1], { ...navigationSettings() }, source);

  it('Driving matches with the built in reward and with a script that moves the level', async () => {
    expect(await train(driving(), 4).then((r) => [r.hash, r.contents, r.level])).toEqual(['1e447d57', 4, 1]);
    expect(await train(driving(DRIVING_SCRIPT), 4).then((r) => [r.hash, r.contents, r.level])).toEqual(['4c439b18', 4, 3]);
  });

  it('Navigation matches with the built in reward and with a script that moves the level', async () => {
    expect(await train(navigation(), 5).then((r) => [r.hash, r.contents, r.level])).toEqual(['0fb2d058', 5, 0]);
    expect(await train(navigation(NAVIGATION_SCRIPT), 5).then((r) => [r.hash, r.contents, r.level])).toEqual(['ff078c95', 5, 4]);
  });

  it('resumes Navigation from a checkpoint with identical results', async () => {
    const { trainer: a, envModule } = await train(navigation(NAVIGATION_SCRIPT), 3);
    const b = new EpisodeTrainer(envModule, a.config, structuredClone(a.toState()));
    for (let i = 0; i < 3; i++) {
      const ra = generation(envModule, a);
      const rb = generation(envModule, b);
      expect(rb.stats).toEqual(ra.stats);
      expect(rb.champion).toEqual(ra.champion);
      expect(rb.trackHash).toBe(ra.trackHash);
    }
  });
});
