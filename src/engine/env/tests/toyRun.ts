import { Network } from '../../neat/network';
import { EpisodeTrainer, trainingControllerSeed } from '../../training/episodeTrainer';
import { createEpisodeRunConfig } from '../../training/newRun';
import type { GenerationRecord } from '../../training/records';
import type { RunConfig } from '../../training/runConfig';
import { TOY_BLUEPRINT, TOY_ENV, toyModule } from './toyEnv';

/** A small toy run. Walking 10 m in 6 s is easy, so it soon levels up. */
export function toyConfig(seed = 3, script?: { source: string; hash: string; customSensors: number }): RunConfig {
  return createEpisodeRunConfig({ env: TOY_ENV, name: 'toy', seed, blueprint: TOY_BLUEPRINT, populationSize: 24, settings: { maxTime: 6 }, script });
}

export function toyTrainer(config = toyConfig()): EpisodeTrainer {
  return new EpisodeTrainer(toyModule, config);
}

/** One generation the way the sim workers run it, without the threads. */
export function toyGeneration(t: EpisodeTrainer): GenerationRecord {
  const env = toyModule.createEnv(t.setup() as never, t.host(), trainingControllerSeed(t.generation));
  env.reset(
    t.genomes.map((g) => new Network(g)),
    t.seeds(),
  );
  while (!env.done) env.step();
  return t.complete(env.results() as never, 0);
}
