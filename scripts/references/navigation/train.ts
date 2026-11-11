import { findPresetBlueprint } from '../../../src/engine/blueprints/presets';
import { benchmarkNavigation } from '../../../src/engine/bench/navigation/runner';
import type { ReferenceTier } from '../../../src/engine/bench/types';
import { registerEpisodeModule } from '../../../src/engine/env/registry';
import { linkScriptCompiler } from '../../../src/engine/lessons/compilerLink';
import { navigationModule } from '../../../src/engine/navigation/module';
import { NAV_METRIC } from '../../../src/engine/navigation/pipeline/metricSpecs';
import { navigationSettings } from '../../../src/engine/navigation/pipeline/settings';
import { Network } from '../../../src/engine/neat/network';
import { bytesToBase64, encodeGenome } from '../../../src/engine/neat/serialize';
import { compileScript } from '../../../src/engine/script/compiler';
import { NAVIGATION_PRESETS } from '../../../src/engine/script/presets/navigation';
import { EpisodeTrainer, trainingControllerSeed } from '../../../src/engine/training/episodeTrainer';
import { createEpisodeRunConfig } from '../../../src/engine/training/newRun';
import type { RunConfig } from '../../../src/engine/training/runConfig';
import { checkpoints } from '../checkpoints';

/** One Navigation reference training run: a preset tier and a seed. */
export interface NavigationReferenceJob {
  kind: 'navigation';
  tier: ReferenceTier;
  seed: number;
  /** Last generation trained. Generations 0 to this are all evaluated. */
  generations: number;
  /** Benchmark the champion at every multiple of this. */
  every: number;
  population: number;
}

export interface NavigationReferenceResult {
  job: NavigationReferenceJob;
  /** Benchmark score at each checkpoint generation, in order. */
  scores: number[];
  /** The curriculum level at each checkpoint. */
  levels: number[];
  /** The last checkpoint's champion in the binary format, as base64, for the shipped model. */
  champion: string;
  seconds: number;
}

/**
 * The run config a reference uses: the preset's script and brain with the
 * settings a new run gets (level 0, the automatic curriculum, two
 * courses per generation). It is the run a user gets with that preset.
 */
export function navigationReferenceConfig(job: Pick<NavigationReferenceJob, 'tier' | 'seed' | 'population'>): RunConfig {
  const preset = NAVIGATION_PRESETS.find((p) => p.tier === job.tier);
  const script = preset ? compileScript(preset.source).script : null;
  const blueprint = script ? findPresetBlueprint(script.header.brain ?? 'navigation-standard') : undefined;
  if (!preset || !script || blueprint?.env !== 'navigation') throw new Error(`No navigation preset for tier ${job.tier}`);
  return createEpisodeRunConfig({
    env: 'navigation',
    name: `Reference ${preset.name} ${job.seed}`,
    seed: job.seed,
    blueprint,
    populationSize: job.population,
    settings: { ...navigationSettings() },
    script: { source: preset.source, hash: script.sourceHash, customSensors: script.sensors.length },
  });
}

/**
 * Trains one preset headless the way the sim workers do (same setup,
 * controller seed, agent seeds and start slots, so chunking makes no
 * difference) and benchmarks the champion of every checkpoint generation.
 */
export async function trainNavigationReference(job: NavigationReferenceJob): Promise<NavigationReferenceResult> {
  linkScriptCompiler();
  const started = performance.now();
  const config = navigationReferenceConfig(job);
  // A worker thread here runs through tsx's require hook only, which cannot follow the registry's dynamic import, so the module is put in place directly.
  registerEpisodeModule(navigationModule);
  const envModule = navigationModule;
  const trainer = new EpisodeTrainer(envModule, config);
  const marks = new Set(checkpoints(job.generations, job.every));
  const scores: number[] = [];
  const levels: number[] = [];
  let champion = '';
  while (trainer.generation <= job.generations) {
    const env = envModule.createEnv(trainer.setup(), trainer.host(), trainingControllerSeed(trainer.generation));
    env.reset(
      trainer.genomes.map((g) => new Network(g)),
      trainer.seeds(),
      trainer.slots(),
    );
    while (!env.done) env.step();
    const record = trainer.complete(env.results(), 0);
    if (!marks.has(record.generation)) continue;
    const result = await benchmarkNavigation(config, record.genome);
    scores.push(result?.score ?? 0);
    levels.push(record.metrics?.[NAV_METRIC.level] ?? 0);
    champion = bytesToBase64(encodeGenome(record.genome));
  }
  return { job, scores, levels, champion, seconds: (performance.now() - started) / 1000 };
}
