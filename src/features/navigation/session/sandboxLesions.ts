import { findPresetBlueprint } from '@/engine/blueprints/presets';
import { navigationInfo } from '@/engine/navigation/info';
import type { NavigationInputConfig } from '@/engine/navigation/sensors/inputConfig';
import { navigationInputSchema } from '@/engine/navigation/sensors/inputSchema';
import { compileScript } from '@/engine/script';
import { scriptAt, type RunConfig } from '@/engine/training/runConfig';
import type { NavSandbox } from '../state/sandboxState';

/**
 * The input keys of the brains a Sandbox setup puts on screen, in input
 * order: a shipped model's own inputs, or the run's with its script's
 * sensors at `generation`, as the inputs tab lists them.
 */
export function sandboxInputKeys(run: RunConfig, s: NavSandbox, generation: number): string[] {
  if (s.source === 'model') {
    const model = s.models?.find((m) => m.tier === s.model) ?? s.models?.[0];
    const blueprint = model ? findPresetBlueprint(model.blueprint) : undefined;
    return blueprint?.env === 'navigation' ? navigationInputSchema(blueprint.inputs as NavigationInputConfig).map((i) => i.key) : [];
  }
  const source = scriptAt(run, generation)?.source ?? null;
  const custom = source ? (compileScript(source).script?.sensors ?? []) : [];
  return navigationInfo.inputSchema(run, custom).map((i) => i.key);
}

/**
 * Lesions carried from one brain to another. A lesion is kept by input
 * index, and two brains number their inputs differently, so each one is
 * moved by its input's key: an input both brains read stays switched off,
 * and one the new brain lacks is dropped rather than landing on another.
 */
export function carryLesions(lesions: Readonly<Record<number, number>>, from: readonly string[], to: readonly string[]): Record<number, number> {
  const out: Record<number, number> = {};
  for (const [index, value] of Object.entries(lesions)) {
    const key = from[Number(index)];
    const next = key === undefined ? -1 : to.indexOf(key);
    if (next >= 0) out[next] = value;
  }
  return out;
}
