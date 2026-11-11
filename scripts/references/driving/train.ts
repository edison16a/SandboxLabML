import { benchmarkDriving } from '../../../src/engine/bench/driving/runner';
import type { ReferenceTier } from '../../../src/engine/bench/types';
import { findPresetBlueprint } from '../../../src/engine/blueprints/presets';
import type { EpisodeBlueprint } from '../../../src/engine/blueprints/types';
import { drivingModule } from '../../../src/engine/driving/module';
import { DEFAULT_DRIVING_SETTINGS } from '../../../src/engine/driving/run/settings';
import { linkScriptCompiler } from '../../../src/engine/lessons/compilerLink';
import { Network } from '../../../src/engine/neat/network';
import { bytesToBase64, encodeGenome } from '../../../src/engine/neat/serialize';
import { compileScript } from '../../../src/engine/script/compiler';
import { DRIVING_PRESETS } from '../../../src/engine/script/presets/driving';
import { EpisodeTrainer, trainingControllerSeed } from '../../../src/engine/training/episodeTrainer';
import { createEpisodeRunConfig } from '../../../src/engine/training/newRun';
import type { RunConfig } from '../../../src/engine/training/runConfig';
import { checkpoints } from '../checkpoints';

/** One Driving reference training run: a preset tier and a seed. */
export interface DrivingReferenceJob {
  kind: 'driving';
  tier: ReferenceTier;
  seed: number;
  /** Last generation trained. Generations 0 to this are all evaluated. */
  generations: number;
  /** Benchmark the champion at every multiple of this. */
  every: number;
  population: number;
}

/** Benchmark score at each checkpoint, the level reached and the final champion, ready to ship. */
export interface DrivingReferenceResult {
  job: DrivingReferenceJob;
  scores: number[];
  /** The curriculum level each checkpoint generation drove. */
  levels: number[];
  champion: { generation: number; score: number; genome: string; blueprint: string; inputs: unknown };
  seconds: number;
}

/**
 * The run config a reference uses: the preset's script and brain with the
 * settings a new run starts on (Midtown, the automatic curriculum from
 * level 1, three trips), exactly what a user gets with that preset.
 */
export function drivingReferenceConfig(job: DrivingReferenceJob): RunConfig {
  const preset = DRIVING_PRESETS.find((p) => p.tier === job.tier);
  const script = preset ? compileScript(preset.source).script : null;
  const blueprint = script ? findPresetBlueprint(script.header.brain ?? 'driving-standard') : undefined;
  if (!preset || !script || blueprint?.env !== 'driving') throw new Error(`No driving preset for tier ${job.tier}`);
  return createEpisodeRunConfig({
    env: 'driving',
    name: `Reference ${preset.name} ${job.seed}`,
    seed: job.seed,
    blueprint: blueprint as EpisodeBlueprint,
    populationSize: job.population,
    settings: { ...DEFAULT_DRIVING_SETTINGS },
    script: { source: preset.source, hash: script.sourceHash, customSensors: script.sensors.length },
  });
}

/**
 * Trains one preset headless exactly as the lab would, one generation at a
 * time on this thread, and benchmarks the champion of every checkpoint
 * generation. The controller seed matches the sim worker's, so a reference
 * run is the run a user would get with that preset and seed.
 */
export async function trainDrivingReference(job: DrivingReferenceJob): Promise<DrivingReferenceResult> {
  // The module and the exam are imported here rather than loaded through the registry: worker threads run under tsx's require hook, which cannot follow the registry's dynamic imports.
  linkScriptCompiler();
  const started = performance.now();
  const config = drivingReferenceConfig(job);
  const trainer = new EpisodeTrainer(drivingModule, config);
  const marks = new Set(checkpoints(job.generations, job.every));
  const scores: number[] = [];
  const levels: number[] = [];
  let champion: DrivingReferenceResult['champion'] | null = null;
  while (trainer.generation <= job.generations) {
    const level = trainer.content.level;
    const env = drivingModule.createEnv(trainer.setup(), trainer.host(), trainingControllerSeed(trainer.generation));
    env.reset(
      trainer.genomes.map((g) => new Network(g)),
      trainer.seeds(),
    );
    while (!env.done) env.step();
    const record = trainer.complete(env.results(), 0);
    if (!marks.has(record.generation)) continue;
    const score = (await benchmarkDriving(config, record.genome))?.score ?? 0;
    scores.push(score);
    levels.push(level);
    const blueprint = config.blueprint as EpisodeBlueprint;
    champion = { generation: record.generation, score, genome: bytesToBase64(encodeGenome(record.genome)), blueprint: blueprint.id, inputs: blueprint.inputs };
  }
  if (!champion) throw new Error('A reference run benchmarked no generation.');
  return { job, scores, levels, champion, seconds: (performance.now() - started) / 1000 };
}
