import { findPresetBlueprint } from '../../../src/engine/blueprints/presets';
import type { HideSeekBlueprint } from '../../../src/engine/blueprints/types';
import type { ReferenceTier } from '../../../src/engine/bench/types';
import { HideSeekTrainer } from '../../../src/engine/hideseek/trainer/trainer';
import { createArenaPool } from '../../../src/engine/hideseek/world/pool';
import { linkScriptCompiler } from '../../../src/engine/lessons/compilerLink';
import type { Genome } from '../../../src/engine/neat/types';
import { compileScript } from '../../../src/engine/script/compiler';
import { HIDESEEK_PRESETS } from '../../../src/engine/script/presets/hideseek';
import { createHideSeekRunConfig } from '../../../src/engine/training/hideseekRunConfig';
import { hideSeekControllers, hideSeekScriptSource, hideSeekSensorCounts, hideSeekTrainerOptions, safeHideSeekHost } from '../../../src/engine/training/hideseekSetup';
import type { RunConfig } from '../../../src/engine/training/runConfig';
import { checkpoints } from '../checkpoints';

/** One Hide and Seek reference training run: a preset tier and a seed. */
export interface HideSeekTrainJob {
  kind: 'hideseek-train';
  tier: ReferenceTier;
  seed: number;
  /** Last generation trained. Generations 0 to this are all played. */
  generations: number;
  /** Keep the champion pair at every multiple of this. */
  every: number;
  /** Genomes per team. */
  population: number;
}

/** A champion pair kept at a checkpoint generation. */
export interface CheckpointPair {
  generation: number;
  hider: Genome;
  seeker: Genome;
}

export interface HideSeekTrainResult {
  job: HideSeekTrainJob;
  config: RunConfig;
  pairs: CheckpointPair[];
  seconds: number;
}

/**
 * The run config a reference uses: the preset's script and brain, with
 * every room and the lab's other defaults, so it is the run a user gets by
 * picking that preset in the New run dialog with the same seed and team
 * size. The script's own rooms and opponents still win, as in the lab.
 */
export function hideSeekReferenceConfig(tier: ReferenceTier, seed: number, population: number): RunConfig {
  const preset = HIDESEEK_PRESETS.find((p) => p.tier === tier);
  const script = preset ? compileScript(preset.source).script : null;
  const blueprint = script ? findPresetBlueprint(script.header.brain ?? 'hideseek-standard') : undefined;
  if (!preset || !script || blueprint?.env !== 'hideseek') throw new Error(`No Hide and Seek preset for tier ${tier}`);
  return createHideSeekRunConfig({
    name: `Reference ${preset.name} ${seed}`,
    seed,
    blueprint: blueprint as HideSeekBlueprint,
    populationPerTeam: population,
    script: { source: preset.source, hash: script.sourceHash, customSensors: script.sensors.length },
  });
}

/**
 * Trains one preset headless the way the lab's coordinator does: the same
 * trainer options, the script's generation block, and script controllers
 * seeded with each match seed. Keeps the champion pair of every
 * checkpoint generation, which is the pair the lab's records hold.
 */
export async function trainHideSeekReference(job: HideSeekTrainJob): Promise<HideSeekTrainResult> {
  linkScriptCompiler();
  const started = performance.now();
  const config = hideSeekReferenceConfig(job.tier, job.seed, job.population);
  const { host, error } = safeHideSeekHost(hideSeekScriptSource(config, 0));
  if (error) throw new Error(`The ${job.tier} preset does not compile: ${error}`);
  const trainer = HideSeekTrainer.create(hideSeekTrainerOptions(config, hideSeekSensorCounts(host)), host);
  const pool = await createArenaPool();
  const marks = new Set(checkpoints(job.generations, job.every));
  const pairs: CheckpointPair[] = [];
  try {
    while (trainer.generation <= job.generations) {
      const stats = trainer.runGeneration(pool, (spec) => hideSeekControllers(host, spec.seed), host);
      if (!marks.has(stats.generation)) continue;
      const hiders = trainer.hallOfFame.hiders.toState();
      const seekers = trainer.hallOfFame.seekers.toState();
      pairs.push({ generation: stats.generation, hider: hiders[hiders.length - 1].genome, seeker: seekers[seekers.length - 1].genome });
    }
  } finally {
    pool.dispose();
  }
  return { job, config, pairs, seconds: (performance.now() - started) / 1000 };
}
