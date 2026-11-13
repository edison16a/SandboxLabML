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
 * The best of a few models for a newcomer to watch: the safest on the
 * generator's check trips, since the Sandbox shows whether SUVs arrive
 * safely and the benchmark also pays for pace. When any of them has no
 * safe share (a file from before the field) they are ranked by benchmark,
 * as they were then. Ties go to the higher benchmark.
 */
function safest(models: readonly DrivingReferenceModel[]): DrivingReferenceModel | null {
  if (models.length === 0) return null;
  const bySafety = models.every((m) => m.safeShare !== undefined);
  const rank = (m: DrivingReferenceModel) => (bySafety ? (m.safeShare ?? 0) : m.score);
  return [...models].sort((a, b) => rank(b) - rank(a) || b.score - a.score)[0];
}

/**
 * The model the Sandbox offers: the safest one whose inputs match the open
 * run's, so its sensors read like the run's own champions, or the safest
 * of all when none match.
 */
export function pickModel(models: readonly DrivingReferenceModel[], run: RunConfig | null): DrivingReferenceModel | null {
  const inputs = run?.blueprint.env === 'driving' ? JSON.stringify((run.blueprint as EpisodeBlueprint).inputs) : null;
  const matching = models.filter((m) => JSON.stringify(m.inputs) === inputs);
  return safest(matching.length ? matching : models);
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
