import { mixSeed } from '../core/rng';
import { Network } from '../neat/network';
import { resultOf } from '../racing/episode';
import { RacingEnv } from '../racing/env';
import { envOptionsFor, TrackCache } from '../training/racingSetup';
import { RacingTrainer } from '../training/racingTrainer';
import { createRacingRunConfig } from '../training/runConfig';
import { linkScriptCompiler } from './compilerLink';
import { pause } from './pause';
import type { PreparedRacing } from './prepare';

/** Small and fixed, so a check trains in a few seconds and gives every learner the same answer. */
export const LESSON_POPULATION = 40;
export const LESSON_SEED = 2024;
/** Shorter episodes than a real run, which keeps checks quick. Lesson targets are set for this length. */
export const LESSON_EPISODE_SECONDS = 30;
/** Ticks simulated between pauses, so a browser tab running a check stays responsive. */
const TICKS_PER_SLICE = 240;

/** What a training check can measure, taken over every generation it trained. */
export interface TrainingMetrics {
  /** Furthest any generation's champion drove, m. */
  bestDistance: number;
  bestFitness: number;
  /** Most laps any champion finished. */
  laps: number;
  /** Species alive after the last generation. */
  species: number;
}

export const TRAINING_METRICS: readonly (keyof TrainingMetrics)[] = ['bestDistance', 'bestFitness', 'laps', 'species'];

export interface TrainingOptions {
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/**
 * Trains a lesson script headless with the real RacingTrainer, so rewards,
 * stop rules and the generation block behave exactly as in the lab. It
 * yields every few hundred ticks and between generations. Returns null if
 * the signal aborts.
 */
export async function trainLessonScript(prepared: PreparedRacing, generations: number, opts: TrainingOptions = {}): Promise<TrainingMetrics | null> {
  const blueprint = prepared.blueprint;
  if (!blueprint) throw new Error('Training checks need a racing brain.');
  linkScriptCompiler();
  const { script, source } = prepared;
  const trainer = new RacingTrainer(
    createRacingRunConfig({
      name: 'Lesson check',
      seed: LESSON_SEED,
      blueprint,
      track: prepared.track,
      carPreset: 'standard',
      populationSize: LESSON_POPULATION,
      maxTime: LESSON_EPISODE_SECONDS,
      script: { source, hash: script.sourceHash, customSensors: script.sensors.length },
    }),
  );
  const cache = new TrackCache();
  const best: TrainingMetrics = { bestDistance: 0, bestFitness: -Infinity, laps: 0, species: 0 };
  for (let g = 0; g < generations; g++) {
    const setup = trainer.setup();
    const env = new RacingEnv(envOptionsFor(setup, cache.get(setup.track), trainer.host(), mixSeed(trainer.generation, 0x51)));
    env.reset(
      trainer.genomes.map((genome) => new Network(genome)),
      trainer.seeds(),
    );
    while (!env.done) {
      for (let k = 0; k < TICKS_PER_SLICE && !env.done; k++) env.step();
      await pause();
      if (opts.signal?.aborted) return null;
    }
    const { champion } = trainer.complete(env.cars.map(resultOf), 0);
    best.bestDistance = Math.max(best.bestDistance, champion.distance);
    best.bestFitness = Math.max(best.bestFitness, champion.fitness);
    best.laps = Math.max(best.laps, champion.laps);
    best.species = trainer.population.species.length;
    opts.onProgress?.((g + 1) / generations);
  }
  return best;
}
