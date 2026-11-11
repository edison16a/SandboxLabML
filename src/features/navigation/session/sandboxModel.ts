import { findPresetBlueprint } from '@/engine/blueprints/presets';
import type { ReferenceModel, ReferenceTier } from '@/engine/bench/types';
import { mixSeed } from '@/engine/core/rng';
import { navigationSettings } from '@/engine/navigation/pipeline/settings';
import type { NavigationInputConfig } from '@/engine/navigation/sensors/inputConfig';
import { base64ToBytes, decodeGenome } from '@/engine/neat/serialize';
import { findScriptPreset } from '@/engine/script/presets';
import { createEpisodeRunConfig } from '@/engine/training/newRun';
import type { GhostSpec } from '@/workers/replay/ghostPlayer';
import type { LabState } from '@/features/lab/state/labState';

/** What the shared panels show for a brain from outside the run (see LabState.sandboxBrain). */
export type SandboxBrain = NonNullable<LabState['sandboxBrain']>;

export const TIER_LABEL: Record<ReferenceTier, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

/**
 * Copies of a shipped model as runners, with the brain inputs and script
 * it trained with, and the brain as the panels show it: a run config of
 * its own built from its preset brain (so the inputs tab and the network
 * label what it really senses), its genome, and its name. Null when the
 * model does not load.
 */
export function modelRunners(model: ReferenceModel, copies: number): { specs: GhostSpec[]; inputs: NavigationInputConfig; brain: SandboxBrain } | null {
  const blueprint = findPresetBlueprint(model.blueprint);
  const preset = findScriptPreset(model.preset);
  if (blueprint?.env !== 'navigation' || !preset) return null;
  const genome = decodeGenome(base64ToBytes(model.genome));
  const specs = Array.from({ length: copies }, (_, k) => ({ generation: 0, genome, seed: mixSeed(model.seed, k), scriptSource: preset.source, slot: k }));
  const run = createEpisodeRunConfig({ env: 'navigation', name: 'Trained model', seed: model.seed, blueprint, populationSize: 1, settings: { ...navigationSettings() } });
  const label = `Trained model: the ${TIER_LABEL[model.tier]} preset's champion, benchmark ${Math.round(model.score)}`;
  return { specs, inputs: blueprint.inputs as NavigationInputConfig, brain: { run, genome, label } };
}
