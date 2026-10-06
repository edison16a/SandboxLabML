import { findPresetBlueprint } from '@/engine/blueprints/presets';
import type { HideSeekBlueprint, RacingBlueprint } from '@/engine/blueprints/types';
import type { EnvId } from '@/engine/env/types';
import { compileScript, HIDESEEK_PRESETS, RACING_PRESETS, type ScriptPreset } from '@/engine/script';

/** The blueprint type a lab works with, so each dialog gets back the shape it can train. */
export type BlueprintOf<E extends EnvId> = E extends 'racing' ? RacingBlueprint : HideSeekBlueprint;

/** The reward a new run trains with: the built-in reward or a compiled SBL script. */
export type ScriptChoice<B = RacingBlueprint | HideSeekBlueprint> =
  | { kind: 'builtin' }
  | { kind: 'script'; id: string; name: string; compiled: { source: string; hash: string; customSensors: number }; blueprint?: B };

/** The read only scripts offered for one environment. */
export function presetsFor(env: EnvId): readonly ScriptPreset[] {
  return env === 'racing' ? RACING_PRESETS : HIDESEEK_PRESETS;
}

/**
 * Compiles a script into the shape a new run stores, or null if it has
 * errors or was written for the other environment. A `brain` line that
 * names a preset blueprint comes back too, so the run trains the brain the
 * script was written for.
 */
export function choiceFromSource<E extends EnvId>(env: E, id: string, name: string, source: string): ScriptChoice<BlueprintOf<E>> | null {
  const { script } = compileScript(source);
  if (!script || script.header.env !== env) return null;
  const bp = script.header.brain ? findPresetBlueprint(script.header.brain) : undefined;
  return {
    kind: 'script',
    id,
    name,
    compiled: { source, hash: script.sourceHash, customSensors: script.sensors.length },
    // The env check makes this cast safe: a blueprint of the right env is the BlueprintOf<E> shape.
    blueprint: bp?.env === env ? (bp as BlueprintOf<E>) : undefined,
  };
}

/** Presets always compile; a test guards that. */
export function choiceFromPreset<E extends EnvId>(env: E, p: ScriptPreset): ScriptChoice<BlueprintOf<E>> | null {
  return choiceFromSource(env, p.id, `${p.name} script`, p.source);
}
