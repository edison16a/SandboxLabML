import type { DrivingReferenceModel } from '@/engine/bench/driving/models';
import { findPresetBlueprint } from '@/engine/blueprints/presets';
import type { EpisodeBlueprint } from '@/engine/blueprints/types';
import { DEFAULT_DRIVING_BLUEPRINT } from '@/engine/driving/blueprints';
import { DEFAULT_DRIVING_SETTINGS } from '@/engine/driving/run/settings';
import { base64ToBytes, decodeGenome } from '@/engine/neat/serialize';
import type { Genome } from '@/engine/neat/types';
import { createEpisodeRunConfig } from '@/engine/training/newRun';
import type { RunConfig } from '@/engine/training/runConfig';

const TIER_NAME = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' } as const;

/** A shipped model ready to drive: its genome, the run config its inputs come from, and how the panels name it. */
export interface TrainedModel {
  model: DrivingReferenceModel;
  genome: Genome;
  run: RunConfig;
  label: string;
}

/**
 * The model the Sandbox offers: the best scoring one whose inputs match the
 * open run's, so its sensors read like the run's own champions, or the
 * best scoring one of all when none match.
 */
export function pickModel(models: readonly DrivingReferenceModel[], run: RunConfig | null): DrivingReferenceModel | null {
  const inputs = run?.blueprint.env === 'driving' ? JSON.stringify((run.blueprint as EpisodeBlueprint).inputs) : null;
  return models.find((m) => JSON.stringify(m.inputs) === inputs) ?? models[0] ?? null;
}

/**
 * Decodes a shipped model and gives it a run config of its own, built from
 * its preset brain with its exact inputs, so the inputs tab and the
 * network label what it really senses.
 */
export function trainedModel(model: DrivingReferenceModel): TrainedModel {
  const preset = findPresetBlueprint(model.blueprint);
  const base = (preset?.env === 'driving' ? preset : DEFAULT_DRIVING_BLUEPRINT) as EpisodeBlueprint;
  const run = createEpisodeRunConfig({
    env: 'driving',
    name: 'Trained model',
    seed: model.seed,
    blueprint: { ...base, inputs: model.inputs },
    populationSize: 1,
    settings: { ...DEFAULT_DRIVING_SETTINGS },
  });
  return { model, genome: decodeGenome(base64ToBytes(model.genome)), run, label: `Trained model: the ${TIER_NAME[model.tier]} preset's champion, benchmark ${Math.round(model.score)}` };
}
