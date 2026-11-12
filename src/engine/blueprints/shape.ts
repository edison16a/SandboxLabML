import { requireEpisodeInfo } from '../env/registry';
import { MAX_HIDDEN_LAYERS } from '../neat/startShape';
import type { GenomeShape } from '../neat/types';
import { MAX_INPUTS, MAX_OUTPUTS, type Blueprint, type BlueprintIssue } from './types';

/** Number of brain inputs the blueprint produces before any script sensors. */
export function blueprintInputCount(b: Blueprint): number {
  return requireEpisodeInfo(b.env).inputCount(b.inputs);
}

export function blueprintOutputCount(b: Blueprint): number {
  return requireEpisodeInfo(b.env).outputs.length;
}

/** The genome shape a new run starts from, including script-defined sensors. */
export function blueprintShape(b: Blueprint, customSensors = 0): GenomeShape {
  return {
    inputCount: blueprintInputCount(b) + customSensors,
    outputCount: blueprintOutputCount(b),
    activation: b.activation,
    wiring: b.wiring,
    hiddenCount: b.hiddenCount,
    hiddenLayers: b.hiddenLayers,
  };
}

export type { BlueprintIssue };

/** Validates a blueprint, e.g. one imported from a file or edited in the form. */
export function validateBlueprint(b: Blueprint, customSensors = 0): BlueprintIssue[] {
  const issues: BlueprintIssue[] = [];
  const inputs = blueprintInputCount(b) + customSensors;
  if (!b.id || !/^[a-z0-9-]+$/.test(b.id)) issues.push({ field: 'id', message: 'Use lowercase letters, digits and dashes.' });
  if (!b.name.trim()) issues.push({ field: 'name', message: 'Give the blueprint a name.' });
  if (inputs < 1) issues.push({ field: 'inputs', message: 'A brain needs at least one input.' });
  if (inputs > MAX_INPUTS) issues.push({ field: 'inputs', message: `At most ${MAX_INPUTS} inputs, this has ${inputs}.` });
  if (blueprintOutputCount(b) > MAX_OUTPUTS) issues.push({ field: 'outputs', message: `At most ${MAX_OUTPUTS} outputs.` });
  // Every env shares the noise level, so it is checked here, whatever the env checks on top.
  const noise = (b.inputs as { noise?: unknown }).noise;
  if (typeof noise !== 'number' || !(noise >= 0 && noise <= 0.1)) issues.push({ field: 'noise', message: 'Noise must be between 0 and 10%.' });
  issues.push(...(requireEpisodeInfo(b.env).validateInputs?.(b.inputs) ?? []));
  if (b.wiring === 'hidden' && (!b.hiddenCount || b.hiddenCount < 1 || b.hiddenCount > 32)) {
    issues.push({ field: 'hiddenCount', message: 'Hidden layer needs 1 to 32 neurons.' });
  }
  if (b.wiring === 'hidden' && b.hiddenLayers !== undefined && (b.hiddenLayers < 1 || b.hiddenLayers > MAX_HIDDEN_LAYERS)) {
    issues.push({ field: 'hiddenLayers', message: `Use 1 to ${MAX_HIDDEN_LAYERS} hidden layers.` });
  }
  return issues;
}
