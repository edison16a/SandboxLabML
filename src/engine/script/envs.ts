import type { EnvId } from '../env/types';
import { HIDESEEK_PRESETS } from './presets/hideseek';
import { RACING_PRESETS } from './presets/racing';
import type { ScriptPreset } from './presets/types';
import { HIDESEEK_SLICE } from './registry/hideseek';
import { RACING_SLICE } from './registry/racing';
import type { RegistrySlice } from './registry/types';

/** The script layer's part of one env: what its scripts may use and the scripts it ships. */
export interface ScriptEnv {
  env: EnvId;
  /** Sensors, actions and operators a `for <env> v1` script can name. */
  slice: RegistrySlice;
  /** Read only scripts for the picker and Studio, one per tier. */
  presets: readonly ScriptPreset[];
  /** What a run without a script trains on, in one line for the script picker. */
  builtin: string;
}

/**
 * Every env a script header may name. This is the one entry a new env
 * adds to the script layer: the checker, compiler, docs, block palette,
 * autocomplete and preset lists all read it.
 */
export const SCRIPT_ENV_TABLE: readonly ScriptEnv[] = [
  { env: 'racing', slice: RACING_SLICE, presets: RACING_PRESETS, builtin: 'Checkpoints, laps and a little speed.' },
  { env: 'hideseek', slice: HIDESEEK_SLICE, presets: HIDESEEK_PRESETS, builtin: 'Hiders score while unseen, seekers while they see.' },
];

export function scriptEnv(env: string): ScriptEnv | undefined {
  return SCRIPT_ENV_TABLE.find((e) => e.env === env);
}
