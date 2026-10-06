import { HIDESEEK_OUTPUT_COUNT, hideSeekInputCount } from '../hideseek/inputConfig';
import type { GenomeShape } from '../neat/types';
import { builtInInputCount } from '../racing/sensors/inputSchema';
import { MAX_INPUTS, MAX_OUTPUTS, type Blueprint } from './types';

/** Number of brain inputs the blueprint produces before any script sensors. */
export function blueprintInputCount(b: Blueprint): number {
  return b.env === 'racing' ? builtInInputCount(b.inputs) : hideSeekInputCount(b.inputs);
}

export function blueprintOutputCount(b: Blueprint): number {
  return b.env === 'racing' ? 2 : HIDESEEK_OUTPUT_COUNT;
}

/** The genome shape a new run starts from, including script-defined sensors. */
export function blueprintShape(b: Blueprint, customSensors = 0): GenomeShape {
  return {
    inputCount: blueprintInputCount(b) + customSensors,
    outputCount: blueprintOutputCount(b),
    activation: b.activation,
    wiring: b.wiring,
    hiddenCount: b.hiddenCount,
  };
}

export interface BlueprintIssue {
  field: string;
  message: string;
}

/** Validates a blueprint, e.g. one imported from a file or edited in the form. */
export function validateBlueprint(b: Blueprint, customSensors = 0): BlueprintIssue[] {
  const issues: BlueprintIssue[] = [];
  const inputs = blueprintInputCount(b) + customSensors;
  if (!b.id || !/^[a-z0-9-]+$/.test(b.id)) issues.push({ field: 'id', message: 'Use lowercase letters, digits and dashes.' });
  if (!b.name.trim()) issues.push({ field: 'name', message: 'Give the blueprint a name.' });
  if (inputs < 1) issues.push({ field: 'inputs', message: 'A brain needs at least one input.' });
  if (inputs > MAX_INPUTS) issues.push({ field: 'inputs', message: `At most ${MAX_INPUTS} inputs, this has ${inputs}.` });
  if (blueprintOutputCount(b) > MAX_OUTPUTS) issues.push({ field: 'outputs', message: `At most ${MAX_OUTPUTS} outputs.` });
  if (b.inputs.rays.count < 1 || b.inputs.rays.count > 33) {
    issues.push({ field: 'rays', message: 'Use between 1 and 33 rays.' });
  }
  if (b.inputs.rays.range <= 0) issues.push({ field: 'rays', message: 'Ray range must be positive.' });
  if (b.inputs.noise < 0 || b.inputs.noise > 0.1) issues.push({ field: 'noise', message: 'Noise must be between 0 and 10%.' });
  if (b.wiring === 'hidden' && (!b.hiddenCount || b.hiddenCount < 1 || b.hiddenCount > 32)) {
    issues.push({ field: 'hiddenCount', message: 'Hidden layer needs 1 to 32 neurons.' });
  }
  return issues;
}
