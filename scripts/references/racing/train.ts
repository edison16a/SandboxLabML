import { findPresetBlueprint } from '../../../src/engine/blueprints/presets';
import type { RacingBlueprint } from '../../../src/engine/blueprints/types';
import { runBenchmark } from '../../../src/engine/bench';
import type { ReferenceTier } from '../../../src/engine/bench/types';
import { mixSeed } from '../../../src/engine/core/rng';
import type { Genome } from '../../../src/engine/neat/types';
import { linkScriptCompiler } from '../../../src/engine/lessons/compilerLink';
import { evaluateRacing } from '../../../src/engine/racing/episode';
import { BUILT_IN_TRACKS } from '../../../src/engine/racing/track/presets';
import { compileScript } from '../../../src/engine/script/compiler';
import { RACING_PRESETS } from '../../../src/engine/script/presets/racing';
import { envOptionsFor, TrackCache } from '../../../src/engine/training/racingSetup';
import { RacingTrainer } from '../../../src/engine/training/racingTrainer';
import { createRacingRunConfig, type RunConfig } from '../../../src/engine/training/runConfig';
import { checkpoints } from '../checkpoints';

/** One Racing reference training run: a preset tier and a seed. */
export interface RacingReferenceJob {
  kind: 'racing';
  tier: ReferenceTier;
  seed: number;
  /** Last generation trained. Generations 0 to this are all evaluated. */
  generations: number;
  /** Benchmark the champion at every multiple of this. */
  every: number;
  population: number;
  /** Also return the benchmarked champions, for tuning the benchmark offline. */
  keepGenomes?: boolean;
}

/** Benchmark score at each checkpoint generation, in order. */
export interface RacingReferenceResult {
  job: RacingReferenceJob;
  scores: number[];
  genomes?: Genome[];
  seconds: number;
}

/**
 * The run config a reference uses: the preset's script and brain on the
 * Oval, the track a new run starts on. Presets that pick their own track
 * (Beginner) or switch tracks (Advanced) do so from their script.
 */
export function racingReferenceConfig(job: RacingReferenceJob): RunConfig {
  const preset = RACING_PRESETS.find((p) => p.tier === job.tier);
  const script = preset ? compileScript(preset.source).script : null;
  const blueprint = script ? findPresetBlueprint(script.header.brain ?? 'racing-standard') : undefined;
  if (!preset || !script || blueprint?.env !== 'racing') throw new Error(`No racing preset for tier ${job.tier}`);
  return createRacingRunConfig({
    name: `Reference ${preset.name} ${job.seed}`,
    seed: job.seed,
    blueprint: blueprint as RacingBlueprint,
    track: BUILT_IN_TRACKS[0],
    carPreset: 'standard',
    populationSize: job.population,
    script: { source: preset.source, hash: script.sourceHash, customSensors: script.sensors.length },
  });
}

/**
 * Trains one preset headless exactly as the lab would, and benchmarks the
 * champion of every checkpoint generation. The controller seed matches the
 * sim worker's, so a reference run is the same run a user would get with
 * that preset and seed.
 */
export async function trainRacingReference(job: RacingReferenceJob): Promise<RacingReferenceResult> {
  linkScriptCompiler();
  const started = performance.now();
  const config = racingReferenceConfig(job);
  const trainer = new RacingTrainer(config);
  const cache = new TrackCache();
  const marks = new Set(checkpoints(job.generations, job.every));
  const scores: number[] = [];
  const genomes: Genome[] = [];
  while (trainer.generation <= job.generations) {
    const setup = trainer.setup();
    const opts = envOptionsFor(setup, cache.get(setup.track), trainer.host(), mixSeed(trainer.generation, 0x51));
    const record = trainer.complete(evaluateRacing(trainer.genomes, opts, trainer.seeds()), 0);
    if (!marks.has(record.generation)) continue;
    const result = await runBenchmark(config, record.genome);
    scores.push(result?.score ?? 0);
    if (job.keepGenomes) genomes.push(record.genome);
  }
  return { job, scores, ...(job.keepGenomes ? { genomes } : {}), seconds: (performance.now() - started) / 1000 };
}
