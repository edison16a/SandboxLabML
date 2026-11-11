import type { EpisodeBlueprint } from '../../blueprints/types';
import type { EpisodeEnv, EpisodeLessons, EpisodeResult } from '../../env/episode';
import { loadEpisodeModule, requireEpisodeModule } from '../../env/registry';
import { bestMetric } from '../../env/metrics';
import { Network } from '../../neat/network';
import type { CompileResult, CompiledScript } from '../../script/compiler';
import { EpisodeTrainer, trainingControllerSeed } from '../../training/episodeTrainer';
import { createEpisodeRunConfig } from '../../training/newRun';
import type { GenerationRecord } from '../../training/records';
import { runShape, type RunConfig } from '../../training/runConfig';
import { hostFor } from '../../training/scriptHost';
import { linkScriptCompiler } from '../compilerLink';
import { pause } from '../pause';
import { TEST_BRAIN_SEED } from '../testDriver';
import { LESSON_POPULATION, LESSON_SEED, type TrainingOptions } from '../training';

export { testRunMetricNames, trainingMetricNames } from './names';

/** A lesson script of an env added through the registry, compiled and ready for its checks. */
export interface PreparedEpisode {
  env: EpisodeBlueprint['env'];
  source: string;
  script: CompiledScript;
  compiled: CompileResult;
  /** Set when the script names a preset brain of its env, or the env's lesson brain otherwise. */
  blueprint: EpisodeBlueprint | null;
}

/** A prepared script whose brain is known, which is what every episode below needs. */
export type PreparedWithBrain = PreparedEpisode & { blueprint: EpisodeBlueprint };

/** Ticks simulated between pauses, so a tab running a check stays responsive. */
const TICKS_PER_SLICE = 240;

/**
 * The env's lesson hooks, from its loaded module. Callers check the info's
 * `lessons` and load the module first; this names the case they ruled out.
 */
export function lessonsOf(env: string): EpisodeLessons<EpisodeResult> {
  const lessons = requireEpisodeModule(env).lessons;
  if (!lessons) throw new Error('This lab has no lessons yet.');
  return lessons;
}

/** The run a check trains or test runs: small, seeded and with the env's lesson settings. */
export function lessonRunConfig(p: PreparedWithBrain): RunConfig {
  return createEpisodeRunConfig({
    env: p.env,
    name: 'Lesson check',
    seed: LESSON_SEED,
    blueprint: p.blueprint,
    populationSize: LESSON_POPULATION,
    settings: lessonsOf(p.env).settings(p.script),
    script: { source: p.source, hash: p.script.sourceHash, customSensors: p.script.sensors.length },
  });
}

/**
 * One agent on the env's first content, driven by the fixed test brain and
 * the script's own controller. The caller loads the env's module first,
 * which loadTestEpisode does.
 */
export function startTestEpisode(p: PreparedWithBrain): EpisodeEnv {
  linkScriptCompiler();
  const envModule = requireEpisodeModule(p.env);
  const config = lessonRunConfig(p);
  const setup = envModule.createSetup({ config, content: envModule.initialContent(config), scriptSource: p.source });
  const env = envModule.createEnv(setup, hostFor(p.source), TEST_BRAIN_SEED);
  const genome = lessonsOf(p.env).testBrain(runShape(config), envModule.inputSchema(config, p.script.sensors));
  env.reset([new Network(genome)], [TEST_BRAIN_SEED]);
  return env;
}

/** Loads the env's module, then starts its test episode. */
export async function loadTestEpisode(p: PreparedWithBrain): Promise<EpisodeEnv> {
  await loadEpisodeModule(p.env);
  return startTestEpisode(p);
}

/** Runs the test episode to the end and measures it. */
export async function testEpisode(p: PreparedWithBrain): Promise<Record<string, number>> {
  const env = await loadTestEpisode(p);
  while (!env.done) env.step();
  const result = env.results()[0];
  return { totalReward: result.fitness, ticks: env.tick, inputs: env.lastObservation(0).length, ...lessonsOf(p.env).measure(result) };
}

/**
 * Trains a lesson script headless with the real EpisodeTrainer, so its
 * rewards, stop rules and generation block behave exactly as in the lab.
 * Returns the best value of every training metric, or null on abort.
 */
export async function trainEpisodeLesson(p: PreparedWithBrain, generations: number, opts: TrainingOptions = {}): Promise<Record<string, number> | null> {
  linkScriptCompiler();
  const envModule = await loadEpisodeModule(p.env);
  const trainer = new EpisodeTrainer(envModule, lessonRunConfig(p));
  const records: GenerationRecord[] = [];
  for (let g = 0; g < generations; g++) {
    const env = envModule.createEnv(trainer.setup(), trainer.host(), trainingControllerSeed(trainer.generation));
    env.reset(
      trainer.genomes.map((genome) => new Network(genome)),
      trainer.seeds(),
    );
    while (!env.done) {
      for (let k = 0; k < TICKS_PER_SLICE && !env.done; k++) env.step();
      await pause();
      if (opts.signal?.aborted) return null;
    }
    records.push(trainer.complete(env.results(), 0));
    opts.onProgress?.((g + 1) / generations);
  }
  const out: Record<string, number> = {
    bestFitness: Math.max(...records.map((r) => r.champion.fitness)),
    species: trainer.population.species.length,
  };
  for (const spec of envModule.metrics) {
    const best = bestMetric(records, spec);
    out[spec.key] = Number.isFinite(best) ? best : 0;
  }
  return out;
}
